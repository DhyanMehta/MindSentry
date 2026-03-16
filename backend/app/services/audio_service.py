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

        return {
            "duration_seconds": round(duration, 2),
            "rms_energy": round(rms, 6),
            "zero_crossing_rate": round(zcr, 6),
            "silence_ratio": round(silence_ratio, 4),
        }
    except ImportError:
        return {"error": "librosa_not_installed"}
    except Exception as e:
        return {"error": str(e)}


def _derive_emotion(features: dict, transcript_emotion: str = "neutral") -> str:
    """Heuristic: combine acoustic cues with transcript emotion."""
    silence = features.get("silence_ratio", 0.0)
    rms = features.get("rms_energy", 0.03)
    if silence > 0.6:
        return "sadness"
    if rms > 0.05 and transcript_emotion in ("anger", "fear"):
        return transcript_emotion
    return transcript_emotion


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
    t_emotion = classify_emotion(transcript_text)["label"] if transcript_text else "neutral"
    audio_emotion = _derive_emotion(features, t_emotion)

    return {
        "transcript": transcript_result.get("transcript", ""),
        "language": transcript_result.get("language", "en"),
        "audio_emotion": audio_emotion,
        "features": features,
    }
