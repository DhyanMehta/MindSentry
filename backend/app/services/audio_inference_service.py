"""Hosted Hugging Face audio analysis with canonical audio preprocessing."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import time
import logging

from app.utils.ffmpeg_path import *  # noqa: F401,F403
from app.core.config import get_settings
from app.services.hf_inference_service import HFInferenceError, get_hf_client
from app.services.media_preprocessing_service import MediaPreprocessingError, preprocess_audio
from app.services.text_inference_service import analyse_text
from app.services.text_inference_service import _map_label as map_text_label

logger = logging.getLogger(__name__)
_AUDIO_MODEL_SUCCESS_CACHE: str | None = None

# ── TTL-based failure cache (replaces permanent blacklist) ─────
# Transient 503 errors are retried after cooldown instead of
# permanently blacklisting a model for the server lifetime.
_AUDIO_MODEL_FAILURE_CACHE: dict[str, float] = {}   # model_name -> expiry timestamp
_PERMANENT_FAILURE_MODELS: set[str] = set()          # auth/404 errors only
_FAILURE_TTL_SECONDS = 300  # 5 minutes

_LOCAL_SER_PIPELINES: dict[str, object] = {}
_LOCAL_SER_FAILURE_CACHE: dict[str, float] = {}   # TTL-based for local too
_LOCAL_FAILURE_TTL_SECONDS = 600  # 10 minutes for local (less transient)
_AUDIO_PRELOAD_COMPLETE = False


def _is_model_failed(model_name: str) -> bool:
    """Check if a hosted model is temporarily or permanently failed."""
    if model_name in _PERMANENT_FAILURE_MODELS:
        return True
    expiry = _AUDIO_MODEL_FAILURE_CACHE.get(model_name)
    if expiry is not None:
        if time.time() < expiry:
            return True
        del _AUDIO_MODEL_FAILURE_CACHE[model_name]
    return False


def _mark_model_failed(model_name: str, permanent: bool = False) -> None:
    """Mark a hosted model as failed, either permanently or with TTL."""
    if permanent:
        _PERMANENT_FAILURE_MODELS.add(model_name)
    else:
        _AUDIO_MODEL_FAILURE_CACHE[model_name] = time.time() + _FAILURE_TTL_SECONDS


def _is_local_model_failed(model_name: str) -> bool:
    """Check if a local model is temporarily failed."""
    expiry = _LOCAL_SER_FAILURE_CACHE.get(model_name)
    if expiry is not None:
        if time.time() < expiry:
            return True
        del _LOCAL_SER_FAILURE_CACHE[model_name]
    return False


def set_preferred_audio_model(model_name: str | None) -> None:
    global _AUDIO_MODEL_SUCCESS_CACHE
    _AUDIO_MODEL_SUCCESS_CACHE = model_name.strip() if model_name else None


def _read_audio_bytes(file_path: str | Path) -> bytes:
    return Path(file_path).read_bytes()


def _transcribe_audio_bytes(audio_bytes: bytes) -> dict:
    settings = get_settings()
    warnings: list[str] = []

    # ── Hard size guard ────────────────────────────────────────────
    # HF Inference API rejects payloads > 25 MB.  Use 20 MB as a
    # conservative ceiling so we never flirt with the boundary.
    _MAX_AUDIO_BYTES = 20 * 1024 * 1024  # 20 MB
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        size_mb = round(len(audio_bytes) / (1024 * 1024), 2)
        return {
            "transcript": "",
            "language": "unknown",
            "warnings": [f"Audio payload too large ({size_mb} MB > 20 MB limit). Trim the clip."],
            "model_name": settings.huggingface_asr_model,
        }

    try:
        payload = get_hf_client().automatic_speech_recognition(audio_bytes, content_type="audio/wav")

        # ── Strict response validation ─────────────────────────────
        # Whisper via HF always returns {"text": "..."}.  Anything
        # else is an API regression — surface it as a warning instead
        # of silently returning garbage.
        if isinstance(payload, dict) and "text" in payload:
            return {
                "transcript": str(payload["text"]).strip(),
                "language": str(payload.get("language", "unknown") or "unknown"),
                "warnings": warnings,
                "model_name": settings.huggingface_asr_model,
            }

        warnings.append(f"Hosted ASR returned unexpected shape: {type(payload).__name__}")
    except HFInferenceError as exc:
        warnings.append(f"Hosted ASR unavailable: {exc}")

    return {
        "transcript": "",
        "language": "unknown",
        "warnings": warnings,
        "model_name": settings.huggingface_asr_model,
    }


def transcribe_from_wav(wav_path: str | Path) -> dict:
    fp = Path(wav_path)
    if not fp.exists():
        settings = get_settings()
        return {
            "transcript": "",
            "language": "unknown",
            "warnings": ["file_not_found"],
            "model_name": settings.huggingface_asr_model,
        }

    return _transcribe_audio_bytes(_read_audio_bytes(fp))


def extract_audio_features(wav_path: str | Path) -> dict:
    try:
        import librosa
        import numpy as np

        y, sr = librosa.load(str(wav_path), sr=16000, mono=True, duration=120)
        duration = librosa.get_duration(y=y, sr=sr)
        rms_frames = librosa.feature.rms(y=y)[0]
        rms = float(rms_frames.mean()) if len(rms_frames) else 0.0
        zcr = float(librosa.feature.zero_crossing_rate(y).mean()) if len(y) else 0.0
        silence_ratio = float((rms_frames < max(rms * 0.1, 1e-6)).mean()) if len(rms_frames) else 1.0
        spectral_centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean()) if len(y) else 0.0
        pitch, voiced_flags, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
        )
        voiced_ratio = float(np.mean(voiced_flags)) if voiced_flags is not None else 0.0
        pitch_mean = float(np.nanmean(pitch)) if pitch is not None and np.any(~np.isnan(pitch)) else 0.0
        clipping_ratio = float(np.mean(np.abs(y) >= 0.98)) if len(y) else 0.0

        return {
            "duration_seconds": round(duration, 2),
            "sample_rate_hz": sr,
            "rms_energy": round(rms, 6),
            "zero_crossing_rate": round(zcr, 6),
            "silence_ratio": round(silence_ratio, 4),
            "spectral_centroid": round(spectral_centroid, 2),
            "voiced_ratio": round(voiced_ratio, 4),
            "pitch_mean_hz": round(pitch_mean, 2),
            "clipping_ratio": round(clipping_ratio, 5),
        }
    except ImportError:
        return {"error": "librosa_not_installed"}
    except Exception as exc:
        return {"error": str(exc)}


def _audio_integrity(features: dict, transcript: str) -> dict:
    duration = float(features.get("duration_seconds", 0.0) or 0.0)
    silence = float(features.get("silence_ratio", 0.0) or 0.0)
    voiced_ratio = float(features.get("voiced_ratio", 0.0) or 0.0)
    clipping = float(features.get("clipping_ratio", 0.0) or 0.0)
    token_count = len((transcript or "").split())

    risk = 0.0
    flags: list[str] = []
    if duration < 2.5:
        risk += 0.28
        flags.append("very_short_audio")
    if silence > 0.78:
        risk += 0.24
        flags.append("mostly_silent")
    if voiced_ratio < 0.12 and duration >= 2.0:
        risk += 0.2
        flags.append("low_voiced_content")
    if clipping > 0.02:
        risk += 0.15
        flags.append("possible_clipping")
    if token_count < 3 and duration >= 4.0:
        risk += 0.08
        flags.append("speech_content_mismatch")

    spoof_risk = max(0.0, min(1.0, risk))
    return {
        "audio_integrity_score": round(1.0 - spoof_risk, 4),
        "audio_spoof_risk": round(spoof_risk, 4),
        "audio_integrity_flags": flags,
    }


def _parse_audio_emotion_payload(payload: object) -> tuple[str | None, float]:
    rows = payload[0] if isinstance(payload, list) and payload and isinstance(payload[0], list) else payload
    if isinstance(rows, dict):
        if isinstance(rows.get("scores"), list):
            rows = rows["scores"]
        elif rows.get("label") is not None:
            rows = [rows]
    if not isinstance(rows, list) or not rows:
        return None, 0.0
    top = max(rows, key=lambda item: float(item.get("score", 0.0) or 0.0))
    return map_text_label(str(top.get("label", ""))), float(top.get("score", 0.0) or 0.0)


def _candidate_audio_models() -> list[str]:
    settings = get_settings()
    raw_candidates = [settings.huggingface_audio_emotion_model, *str(settings.huggingface_audio_emotion_candidates or "").split(",")]
    preferred = _AUDIO_MODEL_SUCCESS_CACHE
    candidates: list[str] = []
    seen: set[str] = set()
    if preferred:
        preferred = preferred.strip()
        if preferred and not _is_model_failed(preferred):
            candidates.append(preferred)
            seen.add(preferred)
    for model_name in raw_candidates:
        cleaned = model_name.strip()
        if not cleaned or cleaned in seen or _is_model_failed(cleaned):
            continue
        seen.add(cleaned)
        candidates.append(cleaned)
    return candidates


def _infer_audio_emotion_with_hosted_models(audio_bytes: bytes) -> tuple[str | None, float, str | None, list[str]]:
    warnings: list[str] = []
    best_label: str | None = None
    best_score = 0.0
    best_model: str | None = None
    global _AUDIO_MODEL_SUCCESS_CACHE

    for model_name in _candidate_audio_models():
        try:
            payload = get_hf_client().audio_classification(
                audio_bytes,
                content_type="audio/wav",
                model_id=model_name,
            )
            label, score = _parse_audio_emotion_payload(payload)
            if label:
                if score > best_score:
                    best_label = label
                    best_score = score
                    best_model = model_name
                if score >= 0.65:
                    _AUDIO_MODEL_SUCCESS_CACHE = model_name
                    return best_label, best_score, best_model, warnings
            warnings.append(f"Audio model {model_name} returned no supported emotion labels.")
            _mark_model_failed(model_name, permanent=False)
        except HFInferenceError as exc:
            exc_str = str(exc)
            # Only permanently block auth errors, not transient 503s
            is_permanent = "hf_auth_" in exc_str or "hf_http_404" in exc_str
            _mark_model_failed(model_name, permanent=is_permanent)
            warnings.append(f"Hosted audio emotion model {model_name} unavailable: {exc}")

    if best_label:
        if best_model:
            _AUDIO_MODEL_SUCCESS_CACHE = best_model
        return best_label, best_score, best_model, warnings
    return None, 0.0, None, warnings


def _local_audio_model_candidates() -> list[str]:
    settings = get_settings()
    configured = [*str(settings.huggingface_audio_emotion_local_candidates or "").split(",")]
    fallback = [
        "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
        "superb/wav2vec2-base-superb-er",
        # NOTE: speechbrain/emotion-recognition-wav2vec2-IEMOCAP is NOT
        # compatible with transformers.pipeline() — it uses SpeechBrain's
        # own framework and has no model_type in config.json.
    ]
    out: list[str] = []
    seen: set[str] = set()
    for name in [*configured, *fallback]:
        cleaned = name.strip()
        if not cleaned or cleaned in seen or _is_local_model_failed(cleaned):
            continue
        seen.add(cleaned)
        out.append(cleaned)
    return out


def _get_local_ser_pipeline(model_name: str):
    if model_name in _LOCAL_SER_PIPELINES:
        return _LOCAL_SER_PIPELINES[model_name]

    settings = get_settings()
    cache_dir = str(Path(settings.huggingface_local_model_cache_dir).resolve())

    try:
        from transformers import pipeline
    except Exception as exc:
        raise RuntimeError(f"transformers_unavailable:{exc}")

    logger.info(
        "Loading local SER pipeline '%s' (cache_dir=%s)...",
        model_name,
        cache_dir,
    )
    classifier = pipeline(
        task="audio-classification",
        model=model_name,
        top_k=5,
        model_kwargs={"cache_dir": cache_dir},
    )
    _LOCAL_SER_PIPELINES[model_name] = classifier
    logger.info("Local SER pipeline '%s' loaded successfully.", model_name)
    return classifier


def preload_local_audio_pipelines() -> None:
    """Warm all configured local audio models so analysis never downloads at request time."""
    global _AUDIO_PRELOAD_COMPLETE
    settings = get_settings()
    if not settings.huggingface_use_local_audio_cache:
        _AUDIO_PRELOAD_COMPLETE = True
        return

    for model_name in _local_audio_model_candidates():
        try:
            _get_local_ser_pipeline(model_name)
        except Exception as exc:
            logger.warning(
                "Failed to preload local audio model '%s': %s (will skip during analysis)",
                model_name,
                exc,
            )
            _LOCAL_SER_FAILURE_CACHE[model_name] = time.time() + _LOCAL_FAILURE_TTL_SECONDS

    _AUDIO_PRELOAD_COMPLETE = True
    logger.info(
        "Audio model preload complete — %d models loaded. Analysis-time loads will use local_files_only=True.",
        len(_LOCAL_SER_PIPELINES),
    )

def _read_wav_as_numpy(wav_path: str | Path) -> tuple:
    """Read a canonical WAV file into a float32 numpy array.

    Uses only Python stdlib (wave) + numpy — zero dependency on ffmpeg.
    The canonical WAV is already mono 16kHz PCM16 from preprocess_audio().
    """
    import wave
    import numpy as np

    with wave.open(str(wav_path), "rb") as wf:
        sr = wf.getframerate()
        raw_frames = wf.readframes(wf.getnframes())
    audio_np = np.frombuffer(raw_frames, dtype=np.int16).astype(np.float32) / 32768.0
    return audio_np, sr


def _infer_audio_emotion_with_local_models(wav_path: str | Path) -> tuple[str | None, float, str | None, list[str]]:
    warnings: list[str] = []
    best_label: str | None = None
    best_score = 0.0
    best_model: str | None = None

    # Read WAV once as numpy — avoids ffmpeg dependency in transformers pipeline
    try:
        audio_np, sr = _read_wav_as_numpy(wav_path)
    except Exception as exc:
        return None, 0.0, None, [f"Failed to read WAV file for local SER: {exc}"]

    audio_input = {"array": audio_np, "sampling_rate": sr}

    for model_name in _local_audio_model_candidates():
        try:
            classifier = _get_local_ser_pipeline(model_name)
            payload = classifier(audio_input)
            rows = payload if isinstance(payload, list) else [payload]
            if rows and isinstance(rows[0], list):
                rows = rows[0]
            if not rows:
                warnings.append(f"Local audio model {model_name} returned no predictions.")
                continue

            top = max(rows, key=lambda item: float(item.get("score", 0.0) or 0.0))
            label = map_text_label(str(top.get("label", "")))
            score = float(top.get("score", 0.0) or 0.0)
            if label:
                if score > best_score:
                    best_label = label
                    best_score = score
                    best_model = model_name
                if score >= 0.62:
                    return best_label, best_score, best_model, warnings
        except Exception as exc:
            _LOCAL_SER_FAILURE_CACHE[model_name] = time.time() + _LOCAL_FAILURE_TTL_SECONDS
            warnings.append(f"Local audio emotion model {model_name} unavailable: {exc}")

    if best_label:
        return best_label, best_score, best_model, warnings
    return None, 0.0, None, warnings


def _fallback_audio_emotion(transcript: str, features: dict) -> tuple[str | None, float, str, list[str]]:
    warnings = ["Audio emotion used transcript+acoustic fallback because hosted SER was unavailable."]
    silence = float(features.get("silence_ratio", 0.0) or 0.0)
    clipping = float(features.get("clipping_ratio", 0.0) or 0.0)
    voiced_ratio = float(features.get("voiced_ratio", 0.0) or 0.0)
    energy = float(features.get("rms_energy", 0.0) or 0.0)

    if transcript:
        text_result = analyse_text(transcript)
        label = text_result.get("emotion")
        base_confidence = float(text_result.get("text_emotion_confidence", 0.0) or 0.0)
        quality_penalty = min(0.2, silence * 0.14 + clipping * 0.2)
        confidence = max(0.45, min(0.8, base_confidence * 0.88 - quality_penalty))
        return (
            label,
            round(confidence, 4),
            "transcript_acoustic_fallback",
            warnings + ["fallback_low_confidence"] + list(text_result.get("warnings", [])),
        )

    if silence > 0.8 or voiced_ratio < 0.08:
        return "neutral", 0.4, "acoustic_fallback", warnings + ["fallback_low_confidence", "Audio clip had too little voiced content for strong emotion inference."]
    if clipping > 0.03:
        return "anger", 0.46, "acoustic_fallback", warnings + ["fallback_low_confidence"]
    if energy < 0.015:
        return "sadness", 0.44, "acoustic_fallback", warnings + ["fallback_low_confidence"]
    return "neutral", 0.45, "acoustic_fallback", warnings + ["fallback_low_confidence"]


def analyse_audio(file_path: str | Path) -> dict:
    settings = get_settings()
    fp = Path(file_path)
    total_start = time.perf_counter()

    try:
        preprocess_start = time.perf_counter()
        canonical = preprocess_audio(fp)
        logger.info(
            "Audio preprocessing completed in %.2fs for %s",
            time.perf_counter() - preprocess_start,
            file_path,
        )
    except MediaPreprocessingError as exc:
        return {
            "transcript": "",
            "language": "unknown",
            "audio_emotion": None,
            "audio_emotion_confidence": 0.0,
            "transcription_model": settings.huggingface_asr_model,
            "audio_model_name": settings.huggingface_audio_emotion_model,
            "inference_source": "fallback",
            "features": {"error": "audio_preprocessing_failed"},
            "warnings": [f"Audio preprocessing error: {exc}"],
            "audio_integrity_score": 0.0,
            "audio_spoof_risk": 1.0,
            "audio_integrity_flags": ["preprocessing_error"],
        }

    wav_path = canonical["canonical_path"]
    payload_bytes = _read_audio_bytes(wav_path)

    transcript_result = None
    features = None
    audio_emotion = None
    audio_confidence = 0.0
    audio_model_name = settings.huggingface_audio_emotion_model

    # ── Parallel: transcription + features + local SER (primary path) ──
    with ThreadPoolExecutor(max_workers=3) as executor:
        transcript_future = executor.submit(_transcribe_audio_bytes, payload_bytes)
        features_future = executor.submit(extract_audio_features, wav_path)

        # Try local SER as primary path (fast, reliable, no cold-start)
        local_future = None
        if settings.huggingface_use_local_audio_cache:
            local_future = executor.submit(_infer_audio_emotion_with_local_models, wav_path)

        transcript_start = time.perf_counter()
        transcript_result = transcript_future.result()
        transcript_elapsed = time.perf_counter() - transcript_start

        features_start = time.perf_counter()
        features = features_future.result()
        features_elapsed = time.perf_counter() - features_start

        warnings = list(transcript_result.get("warnings", []))

        # Collect local SER result (primary)
        if local_future is not None:
            try:
                local_start = time.perf_counter()
                local_label, local_score, local_model, local_warnings = local_future.result()
                logger.info(
                    "Audio local SER (primary) completed in %.2fs for %s",
                    time.perf_counter() - local_start,
                    file_path,
                )
                warnings.extend(local_warnings)
                if local_label:
                    audio_emotion = local_label
                    audio_confidence = local_score
                    audio_model_name = local_model or "local_audio_ser"
            except Exception as exc:
                warnings.append(f"Audio local SER preparation failed: {exc}")

    # ── Fallback to hosted SER if local failed ──
    if not audio_emotion:
        try:
            hosted_start = time.perf_counter()
            hosted_label, hosted_score, hosted_model, hosted_warnings = _infer_audio_emotion_with_hosted_models(payload_bytes)
            logger.info(
                "Audio hosted SER (fallback) completed in %.2fs for %s",
                time.perf_counter() - hosted_start,
                file_path,
            )
            warnings.extend(hosted_warnings)
            if hosted_label:
                audio_emotion = hosted_label
                audio_confidence = hosted_score
                if hosted_model:
                    audio_model_name = hosted_model
        except Exception as exc:
            warnings.append(f"Audio hosted SER fallback failed: {exc}")

    # ── Ultimate fallback: transcript + acoustic heuristic ──
    if not audio_emotion:
        fallback_start = time.perf_counter()
        audio_emotion, audio_confidence, audio_model_name, fallback_warnings = _fallback_audio_emotion(
            transcript_result.get("transcript", ""),
            features,
        )
        logger.info(
            "Audio fallback inference completed in %.2fs for %s",
            time.perf_counter() - fallback_start,
            file_path,
        )
        warnings.extend(fallback_warnings)

    integrity = _audio_integrity(features, transcript_result.get("transcript", ""))

    logger.info(
        "Audio analysis completed in %.2fs for %s (transcript=%.2fs, features=%.2fs)",
        time.perf_counter() - total_start,
        file_path,
        transcript_elapsed,
        features_elapsed,
    )

    source = "fallback"
    if "fallback" not in str(audio_model_name):
        source = "local" if audio_model_name in _LOCAL_SER_PIPELINES or "local" in str(audio_model_name) else "huggingface"

    return {
        "transcript": transcript_result.get("transcript", ""),
        "language": transcript_result.get("language", "unknown"),
        "audio_emotion": audio_emotion,
        "audio_emotion_confidence": round(float(audio_confidence or 0.0), 4),
        "audio_confidence_tag": "low" if audio_model_name.endswith("fallback") or float(audio_confidence or 0.0) < 0.55 else "high",
        "transcription_model": transcript_result.get("model_name", settings.huggingface_asr_model),
        "audio_model_name": audio_model_name,
        "inference_source": source,
        "features": features,
        "analysis_latency_ms": int((time.perf_counter() - total_start) * 1000),
        "warnings": sorted(set(warnings)),
        **integrity,
    }
