"""
Shared Hugging Face hosted inference client for MindSentry model pipelines.

This module intentionally uses hosted inference only and does not download
model weights locally.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings


class HFInferenceError(RuntimeError):
    """Raised when hosted Hugging Face inference cannot be completed."""


DEFAULT_TEXT_MODEL = "j-hartmann/emotion-english-distilroberta-base"
DEFAULT_ASR_MODEL = "openai/whisper-large-v3-turbo"
DEFAULT_AUDIO_EMOTION_MODEL = "superb/wav2vec2-base-superb-er"
DEFAULT_FACE_EMOTION_MODEL = "dima806/facial_emotions_image_detection"


class HuggingFaceInferenceClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = "https://router.huggingface.co/hf-inference/models"

    def _headers(self, *, content_type: str | None = None, accept: str | None = "application/json", wait_for_model: bool = False) -> dict[str, str]:
        if not self.settings.huggingface_api_key:
            raise HFInferenceError("HUGGINGFACE_API_KEY not set")

        headers = {
            "Authorization": f"Bearer {self.settings.huggingface_api_key}",
        }
        if content_type:
            headers["Content-Type"] = content_type
        if accept:
            headers["Accept"] = accept
        if wait_for_model:
            headers["X-Wait-For-Model"] = "true"
        return headers

    def _request(
        self,
        *,
        model_id: str,
        payload: Any = None,
        content: bytes | None = None,
        content_type: str | None = None,
        accept: str | None = "application/json",
        timeout: float | None = None,
        wait_for_model: bool = False,
    ) -> Any:
        timeout = float(timeout if timeout is not None else self.settings.huggingface_timeout_seconds)
        retries = max(0, int(self.settings.huggingface_max_retries))
        url = f"{self.base_url}/{model_id}"
        last_error: Exception | None = None

        for _ in range(retries + 1):
            try:
                response = httpx.post(
                    url,
                    headers=self._headers(content_type=content_type, accept=accept, wait_for_model=wait_for_model),
                    json=payload,
                    content=content,
                    timeout=timeout,
                )
                if response.status_code == 200:
                    try:
                        return response.json()
                    except Exception:
                        return response.text

                detail = response.text.strip()
                if response.status_code in (401, 403):
                    raise HFInferenceError(f"hf_auth_{response.status_code}")
                if response.status_code == 503:
                    last_error = HFInferenceError("hf_model_loading")
                    continue
                if 400 <= response.status_code < 500:
                    raise HFInferenceError(f"hf_http_{response.status_code}:{detail[:160]}")
                last_error = HFInferenceError(f"hf_http_{response.status_code}:{detail[:160]}")
            except HFInferenceError as exc:
                last_error = exc
            except Exception as exc:
                last_error = exc

        raise HFInferenceError(str(last_error or "hf_inference_failed"))

    def text_classification(self, text: str, *, model_id: str | None = None) -> Any:
        return self._request(
            model_id=model_id or self.settings.huggingface_text_model,
            payload={"inputs": text, "options": {"wait_for_model": True}},
            timeout=self.settings.huggingface_text_timeout_seconds,
        )

    def automatic_speech_recognition(
        self,
        audio_bytes: bytes,
        *,
        content_type: str,
        model_id: str | None = None,
    ) -> Any:
        return self._request(
            model_id=model_id or self.settings.huggingface_asr_model,
            content=audio_bytes,
            content_type=content_type,
            timeout=self.settings.huggingface_asr_timeout_seconds,
        )

    def audio_classification(
        self,
        audio_bytes: bytes,
        *,
        content_type: str,
        model_id: str | None = None,
    ) -> Any:
        return self._request(
            model_id=model_id or self.settings.huggingface_audio_emotion_model,
            content=audio_bytes,
            content_type=content_type,
            timeout=self.settings.huggingface_audio_emotion_timeout_seconds,
            wait_for_model=True,
        )

    def image_classification(
        self,
        image_bytes: bytes,
        *,
        model_id: str | None = None,
    ) -> Any:
        return self._request(
            model_id=model_id or self.settings.huggingface_face_emotion_model,
            content=image_bytes,
            content_type="image/jpeg",
            timeout=self.settings.huggingface_face_timeout_seconds,
            wait_for_model=True,
        )


_client: HuggingFaceInferenceClient | None = None


def get_hf_client() -> HuggingFaceInferenceClient:
    global _client
    if _client is None:
        _client = HuggingFaceInferenceClient()
    return _client
