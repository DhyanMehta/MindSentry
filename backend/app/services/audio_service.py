"""
Audio analysis service.

Transcription  →  Groq Whisper API (free tier, 20 hrs audio/day)
  Endpoint: https://api.groq.com/openai/v1/audio/transcriptions
  Model:    whisper-large-v3-turbo
  Key:      GROQ_API_KEY in .env
  Docs:     https://console.groq.com/docs/speech-text

Feature extraction  →  librosa (pure DSP library, no model download)
  Features: duration, rms_energy, zero_crossing_rate, silence_ratio

Falls back gracefully when key is missing or API is unavailable.
"""
from __future__ import annotations
from pathlib import Path
import httpx

from app.core.config import get_settings

_GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
_GROQ_MODEL = "whisper-large-v3-turbo"


def transcribe(file_path: str | Path) -> dict:
    """
    Send audio file to Groq Whisper API and return transcript + language.

    Returns:
        {"transcript": str, "language": str}   on success
        {"transcript": "", "language": "en", "error": str}  on failure
    """
    settings = get_settings()
    if not settings.groq_api_key:
        return {"transcript": "", "language": "en", "error": "GROQ_API_KEY not set"}

    fp = Path(file_path)
    if not fp.exists():
        return {"transcript": "", "language": "en", "error": "file_not_found"}

    try:
        with fp.open("rb") as audio_file:
            resp = httpx.post(
                _GROQ_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={"file": (fp.name, audio_file, "audio/mpeg")},
                data={
                    "model": _GROQ_MODEL,
                    "response_format": "verbose_json",
                    "temperature": "0",
                },
                timeout=90.0,
            )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "transcript": data.get("text", "").strip(),
                "language": data.get("language", "en"),
            }
        return {
            "transcript": "", "language": "en",
            "error": f"groq_http_{resp.status_code}",
        }
    except Exception as e:
        return {"transcript": "", "language": "en", "error": str(e)}


def extract_audio_features(file_path: str | Path) -> dict:
    """Extract acoustic features from an audio file using librosa."""
    try:
        import librosa
        import numpy as np

        y, sr = librosa.load(str(file_path), sr=None, mono=True, duration=120)
        duration = librosa.get_duration(y=y, sr=sr)
        rms_frames = librosa.feature.rms(y=y)[0]
        rms = float(rms_frames.mean())
        zcr = float(librosa.feature.zero_crossing_rate(y).mean())
        silence_ratio = float((rms_frames < rms * 0.1).mean()) if rms > 0 else 0.0
        spectral_centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
        pitch, voiced_flags, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
        )
        voiced_ratio = float(np.mean(voiced_flags)) if voiced_flags is not None else 0.0
        pitch_mean = float(np.nanmean(pitch)) if pitch is not None and np.any(~np.isnan(pitch)) else 0.0
        clipping_ratio = float(np.mean(np.abs(y) >= 0.98))

        return {
            "duration_seconds": round(duration, 2),
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
    except Exception as e:
        return {"error": str(e)}


def _derive_emotion(features: dict, transcript_emotion: str = "neutral", transcript_score: float = 0.0) -> str:
    """Heuristic: combine transcript emotion confidence with acoustic cues."""
    silence = features.get("silence_ratio", 0.0)
    rms = features.get("rms_energy", 0.03)
    zcr = features.get("zero_crossing_rate", 0.06)

    # Respect non-neutral text inference when confidence is meaningful.
    if transcript_emotion != "neutral" and transcript_score >= 0.58:
        return transcript_emotion

    # Acoustic-only fallback to avoid always returning neutral.
    if silence >= 0.68:
        return "sadness"
    if rms >= 0.055 and zcr >= 0.10:
        return "anger"
    if zcr >= 0.085 and rms < 0.045:
        return "fear"
    if rms >= 0.05 and silence < 0.35:
        return "joy"

    return transcript_emotion if transcript_emotion else "neutral"


def _acoustic_confidence(features: dict) -> float:
    """Estimate confidence from acoustic signal quality and separability."""
    silence = float(features.get("silence_ratio", 0.0) or 0.0)
    rms = float(features.get("rms_energy", 0.03) or 0.03)
    zcr = float(features.get("zero_crossing_rate", 0.06) or 0.06)
    voiced_ratio = float(features.get("voiced_ratio", 0.0) or 0.0)
    clipping = float(features.get("clipping_ratio", 0.0) or 0.0)

    # Basic confidence proxy: less silence + enough energy + non-flat ZCR.
    conf = 0.45
    conf += max(0.0, 0.55 - silence) * 0.35
    conf += min(1.0, rms / 0.06) * 0.2
    conf += min(1.0, zcr / 0.12) * 0.1
    conf += min(1.0, voiced_ratio / 0.6) * 0.1
    conf -= min(0.2, clipping * 3.0)
    return max(0.0, min(1.0, conf))


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
        flags.append("possible_clipping_or_synthetic_source")
    if token_count < 3 and duration >= 4.0:
        risk += 0.1
        flags.append("speech_content_mismatch")

    spoof_risk = max(0.0, min(1.0, risk))
    integrity = round(1.0 - spoof_risk, 4)
    return {
        "audio_integrity_score": integrity,
        "audio_spoof_risk": round(spoof_risk, 4),
        "audio_integrity_flags": flags,
    }


def analyse_audio(file_path: str | Path) -> dict:
    """
    Full audio pipeline:
      1. Transcribe  (Groq API)
      2. Extract acoustic features  (librosa)
      3. Classify emotion on transcript  (HF API via text_service)
      4. Derive final audio_emotion heuristic

    Returns:
        transcript, language, audio_emotion, features dict
    """
    transcript_result = transcribe(file_path)
    features = extract_audio_features(file_path)

    # Import inline to avoid circular dependency
    from app.services.text_service import classify_emotion
    transcript_text = transcript_result.get("transcript", "")
    text_result = classify_emotion(transcript_text) if transcript_text else {"label": "neutral", "score": 0.0}
    t_emotion = text_result.get("label", "neutral")
    t_score = float(text_result.get("score", 0.0) or 0.0)
    audio_emotion = _derive_emotion(features, t_emotion, t_score)
    acoustic_conf = _acoustic_confidence(features)
    audio_conf = max(t_score, acoustic_conf) if transcript_text else acoustic_conf
    integrity = _audio_integrity(features, transcript_text)

    return {
        "transcript": transcript_result.get("transcript", ""),
        "language": transcript_result.get("language", "en"),
        "audio_emotion": audio_emotion,
        "audio_emotion_confidence": round(audio_conf, 4),
        "features": features,
        **integrity,
    }
