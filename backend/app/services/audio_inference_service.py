"""Hosted Hugging Face audio transcription and emotion analysis."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import wave

from app.core.config import get_settings
from app.services.hf_inference_service import HFInferenceError, get_hf_client
from app.services.text_inference_service import analyse_text
from app.services.text_inference_service import _map_label as map_text_label

_AUDIO_EMOTION_MODEL_FALLBACKS = (
    "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
    "superb/wav2vec2-base-superb-er",
)


def _audio_content_type(file_path: str | Path) -> str:
    suffix = Path(file_path).suffix.lower()
    return {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".webm": "audio/webm",
        ".m4a": "audio/mp4",
    }.get(suffix, "application/octet-stream")


def _read_audio_bytes(file_path: str | Path) -> bytes:
    return Path(file_path).read_bytes()


def _load_audio_signal(file_path: str | Path):
    import librosa

    return librosa.load(str(file_path), sr=16000, mono=True, duration=120)


def _prepare_hosted_audio_payload(file_path: str | Path) -> tuple[bytes, str, list[str]]:
    warnings: list[str] = []
    content_type = _audio_content_type(file_path)
    if content_type == "audio/wav":
        return _read_audio_bytes(file_path), content_type, warnings

    try:
        import numpy as np

        y, sr = _load_audio_signal(file_path)
        buffer = BytesIO()
        pcm = np.clip(y, -1.0, 1.0)
        pcm = (pcm * 32767.0).astype(np.int16)
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sr)
            wav_file.writeframes(pcm.tobytes())
        return buffer.getvalue(), "audio/wav", warnings
    except Exception as exc:
        warnings.append(f"Audio normalization fallback used original file bytes: {exc}")
        return _read_audio_bytes(file_path), content_type, warnings


def transcribe(file_path: str | Path) -> dict:
    settings = get_settings()
    fp = Path(file_path)
    if not fp.exists():
        return {"transcript": "", "language": "unknown", "warnings": ["file_not_found"], "model_name": settings.huggingface_asr_model}

    payload_bytes, payload_type, warnings = _prepare_hosted_audio_payload(fp)
    try:
        payload = get_hf_client().automatic_speech_recognition(
            payload_bytes,
            content_type=payload_type,
        )
        if isinstance(payload, dict):
            return {
                "transcript": str(payload.get("text", "") or "").strip(),
                "language": str(payload.get("language", "unknown") or "unknown"),
                "warnings": warnings,
                "model_name": settings.huggingface_asr_model,
            }
        if isinstance(payload, str):
            return {
                "transcript": payload.strip(),
                "language": "unknown",
                "warnings": warnings,
                "model_name": settings.huggingface_asr_model,
            }
    except HFInferenceError as exc:
        return {
            "transcript": "",
            "language": "unknown",
            "warnings": warnings + [f"Hosted ASR unavailable: {exc}"],
            "model_name": settings.huggingface_asr_model,
        }

    return {
        "transcript": "",
        "language": "unknown",
        "warnings": warnings + ["Hosted ASR returned an unexpected response shape."],
        "model_name": settings.huggingface_asr_model,
    }


def extract_audio_features(file_path: str | Path) -> dict:
    try:
        import librosa
        import numpy as np

        y, sr = _load_audio_signal(file_path)
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
    if duration < 1.8:
        risk += 0.35
        flags.append("very_short_audio")
    if silence > 0.78:
        risk += 0.25
        flags.append("mostly_silent")
    if voiced_ratio < 0.12 and duration >= 2.0:
        risk += 0.2
        flags.append("low_voiced_content")
    if clipping > 0.02:
        risk += 0.2
        flags.append("possible_clipping")
    if token_count < 3 and duration >= 4.0:
        risk += 0.1
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


def _infer_audio_emotion_with_hosted_models(audio_bytes: bytes, content_type: str) -> tuple[str | None, float, str | None, list[str]]:
    settings = get_settings()
    warnings: list[str] = []
    candidate_models = list(dict.fromkeys([settings.huggingface_audio_emotion_model, *_AUDIO_EMOTION_MODEL_FALLBACKS]))

    for model_name in candidate_models:
        try:
            payload = get_hf_client().audio_classification(
                audio_bytes,
                content_type=content_type,
                model_id=model_name,
            )
            label, score = _parse_audio_emotion_payload(payload)
            if label:
                return label, score, model_name, warnings
            warnings.append(f"Audio model {model_name} returned no supported emotion labels.")
        except HFInferenceError as exc:
            warnings.append(f"Hosted audio emotion model {model_name} unavailable: {exc}")

    return None, 0.0, None, warnings


def _fallback_audio_emotion(transcript: str, features: dict) -> tuple[str | None, float, str, list[str]]:
    warnings = ["Audio emotion used resilient fallback inference because hosted SER was unavailable."]
    silence = float(features.get("silence_ratio", 0.0) or 0.0)
    clipping = float(features.get("clipping_ratio", 0.0) or 0.0)
    voiced_ratio = float(features.get("voiced_ratio", 0.0) or 0.0)
    energy = float(features.get("rms_energy", 0.0) or 0.0)
    centroid = float(features.get("spectral_centroid", 0.0) or 0.0)

    if transcript:
        text_result = analyse_text(transcript)
        label = text_result.get("emotion")
        base_confidence = float(text_result.get("text_emotion_confidence", 0.0) or 0.0)
        quality_penalty = min(0.22, silence * 0.18 + clipping * 0.25)
        confidence = max(0.28, min(0.74, base_confidence * 0.82 - quality_penalty))
        return label, round(confidence, 4), "transcript_acoustic_fallback", warnings + list(text_result.get("warnings", []))

    if silence > 0.8 or voiced_ratio < 0.08:
        return "neutral", 0.22, "acoustic_fallback", warnings + ["Audio clip had too little voiced content for strong emotion inference."]
    if clipping > 0.03 or centroid > 2800:
        return "anger", 0.31, "acoustic_fallback", warnings
    if energy < 0.015:
        return "sadness", 0.29, "acoustic_fallback", warnings
    return "neutral", 0.27, "acoustic_fallback", warnings


def analyse_audio(file_path: str | Path) -> dict:
    settings = get_settings()
    fp = Path(file_path)
    transcript_result = transcribe(fp)
    features = extract_audio_features(fp)

    warnings = list(transcript_result.get("warnings", []))
    audio_emotion = None
    audio_confidence = 0.0
    audio_model_name = settings.huggingface_audio_emotion_model
    payload_bytes = None
    payload_type = _audio_content_type(fp)

    try:
        payload_bytes, payload_type, normalization_warnings = _prepare_hosted_audio_payload(fp)
        warnings.extend(normalization_warnings)
        audio_emotion, audio_confidence, selected_model, hosted_warnings = _infer_audio_emotion_with_hosted_models(
            payload_bytes,
            payload_type,
        )
        warnings.extend(hosted_warnings)
        if selected_model:
            audio_model_name = selected_model
    except Exception as exc:
        warnings.append(f"Audio preparation for hosted inference failed: {exc}")

    if not audio_emotion:
        audio_emotion, audio_confidence, audio_model_name, fallback_warnings = _fallback_audio_emotion(
            transcript_result.get("transcript", ""),
            features,
        )
        warnings.extend(fallback_warnings)

    integrity = _audio_integrity(features, transcript_result.get("transcript", ""))

    return {
        "transcript": transcript_result.get("transcript", ""),
        "language": transcript_result.get("language", "unknown"),
        "audio_emotion": audio_emotion,
        "audio_emotion_confidence": round(float(audio_confidence or 0.0), 4),
        "transcription_model": transcript_result.get("model_name", settings.huggingface_asr_model),
        "audio_model_name": audio_model_name,
        "inference_source": "huggingface" if audio_model_name != "transcript_acoustic_fallback" and audio_model_name != "acoustic_fallback" else "fallback",
        "features": features,
        "warnings": sorted(set(warnings)),
        **integrity,
    }
