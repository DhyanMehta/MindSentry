"""Startup health checks for hosted Hugging Face model endpoints."""
from __future__ import annotations

import io
import logging
import wave
from dataclasses import dataclass, asdict

from app.core.config import get_settings
from app.services.audio_inference_service import set_preferred_audio_model
from app.services.hf_inference_service import HFInferenceError, get_hf_client

logger = logging.getLogger(__name__)

_LAST_MODEL_HEALTH: dict | None = None


@dataclass
class ModelProbeResult:
    model_name: str
    status: str
    detail: str | None = None


@dataclass
class ModelHealthReport:
    text: ModelProbeResult
    asr: ModelProbeResult
    audio: ModelProbeResult
    face: ModelProbeResult
    preferred_audio_model: str | None


def _make_silence_wav_bytes(duration_seconds: float = 0.4, sample_rate: int = 16000) -> bytes:
    frames = int(duration_seconds * sample_rate)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"\x00\x00" * frames)
    return buffer.getvalue()


def _make_face_probe_bytes() -> bytes:
    try:
        import cv2
        import numpy as np

        image = np.full((64, 64, 3), 220, dtype=np.uint8)
        ok, encoded = cv2.imencode(".jpg", image)
        if ok:
            return encoded.tobytes()
    except Exception:
        pass
    return b""


def _probe_text_model() -> ModelProbeResult:
    settings = get_settings()
    try:
        payload = get_hf_client().text_classification(
            "This is a short calm health-check sentence.",
            model_id=settings.huggingface_text_model,
        )
        if payload:
            return ModelProbeResult(settings.huggingface_text_model, "ok")
    except HFInferenceError as exc:
        return ModelProbeResult(settings.huggingface_text_model, "error", str(exc))
    except Exception as exc:
        return ModelProbeResult(settings.huggingface_text_model, "error", str(exc))
    return ModelProbeResult(settings.huggingface_text_model, "error", "empty_response")


def _probe_asr_model() -> ModelProbeResult:
    settings = get_settings()
    try:
        payload = get_hf_client().automatic_speech_recognition(
            _make_silence_wav_bytes(),
            content_type="audio/wav",
            model_id=settings.huggingface_asr_model,
        )
        if payload is not None:
            return ModelProbeResult(settings.huggingface_asr_model, "ok")
    except HFInferenceError as exc:
        return ModelProbeResult(settings.huggingface_asr_model, "error", str(exc))
    except Exception as exc:
        return ModelProbeResult(settings.huggingface_asr_model, "error", str(exc))
    return ModelProbeResult(settings.huggingface_asr_model, "error", "empty_response")


def _probe_audio_models() -> tuple[ModelProbeResult, str | None]:
    settings = get_settings()
    audio_bytes = _make_silence_wav_bytes()
    candidates = []
    seen: set[str] = set()
    for model_name in [settings.huggingface_audio_emotion_model, *str(settings.huggingface_audio_emotion_candidates or "").split(",")]:
        cleaned = model_name.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            candidates.append(cleaned)

    last_error: str | None = None
    for model_name in candidates:
        try:
            payload = get_hf_client().audio_classification(
                audio_bytes,
                content_type="audio/wav",
                model_id=model_name,
            )
            if payload is not None:
                set_preferred_audio_model(model_name)
                return ModelProbeResult(model_name, "ok"), model_name
        except HFInferenceError as exc:
            last_error = str(exc)
        except Exception as exc:
            last_error = str(exc)

    set_preferred_audio_model(None)
    return ModelProbeResult(settings.huggingface_audio_emotion_model, "error", last_error or "no_supported_audio_model"), None


def _probe_face_model() -> ModelProbeResult:
    settings = get_settings()
    face_bytes = _make_face_probe_bytes()
    if not face_bytes:
        return ModelProbeResult(settings.huggingface_face_emotion_model, "skipped", "opencv_or_numpy_unavailable")
    try:
        payload = get_hf_client().image_classification(
            face_bytes,
            model_id=settings.huggingface_face_emotion_model,
        )
        if payload is not None:
            return ModelProbeResult(settings.huggingface_face_emotion_model, "ok")
    except HFInferenceError as exc:
        return ModelProbeResult(settings.huggingface_face_emotion_model, "error", str(exc))
    except Exception as exc:
        return ModelProbeResult(settings.huggingface_face_emotion_model, "error", str(exc))
    return ModelProbeResult(settings.huggingface_face_emotion_model, "error", "empty_response")


def run_startup_model_health_checks() -> dict:
    """Probe hosted models once at startup and cache the result."""
    global _LAST_MODEL_HEALTH

    text = _probe_text_model()
    asr = _probe_asr_model()
    audio, preferred_audio_model = _probe_audio_models()
    face = _probe_face_model()

    report = ModelHealthReport(
        text=text,
        asr=asr,
        audio=audio,
        face=face,
        preferred_audio_model=preferred_audio_model,
    )
    _LAST_MODEL_HEALTH = {
        "text": asdict(text),
        "asr": asdict(asr),
        "audio": asdict(audio),
        "face": asdict(face),
        "preferred_audio_model": preferred_audio_model,
    }
    return _LAST_MODEL_HEALTH


def get_cached_model_health() -> dict | None:
    return _LAST_MODEL_HEALTH
