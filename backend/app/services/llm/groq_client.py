"""Groq client adapter used by the assistant graph."""
from __future__ import annotations

import json
import logging
from typing import Any, Dict

from groq import Groq

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GroqClient:
    """Thin adapter around Groq chat completions with safe defaults."""

    def __init__(self) -> None:
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY_MISSING: assistant LLM is not configured")
        self.client = Groq(
            api_key=settings.groq_api_key,
            timeout=settings.assistant_llm_timeout_seconds,
            max_retries=0,
        )
        self.model = settings.groq_model

    def chat_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                temperature=0.2,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            logger.error("Groq request failed: %s", exc)
            raise RuntimeError(f"LLM_REQUEST_FAILED: {exc}") from exc
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("LLM_RESPONSE_EMPTY: Groq returned empty content")
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            logger.error("Groq returned non-JSON content")
            raise RuntimeError("LLM_RESPONSE_INVALID_JSON: Groq response was not valid JSON")


_groq_client: GroqClient | None = None


def get_groq_client() -> GroqClient:
    global _groq_client
    if _groq_client is None:
        _groq_client = GroqClient()
    return _groq_client
