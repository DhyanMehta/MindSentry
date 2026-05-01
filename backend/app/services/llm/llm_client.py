"""
Unified LLM client for the MindSentry chatbot.

Uses Groq (free, fast) as primary provider and OpenAI as fallback.
Direct SDK calls — no LangChain dependency.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _call_groq(
    messages: List[Dict[str, str]],
    *,
    json_mode: bool = False,
    temperature: float = 0.3,
    timeout: float = 15.0,
) -> str:
    """Call Groq API directly via the groq SDK."""
    from groq import Groq

    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY not configured")

    client = Groq(api_key=settings.groq_api_key, timeout=timeout, max_retries=0)
    kwargs: Dict[str, Any] = {
        "model": settings.groq_model,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("Groq returned empty content")
    return content


def _call_openai(
    messages: List[Dict[str, str]],
    *,
    json_mode: bool = False,
    temperature: float = 0.3,
    timeout: float = 20.0,
) -> str:
    """Call OpenAI API directly via the openai SDK."""
    from openai import OpenAI

    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY not configured")

    client = OpenAI(api_key=settings.openai_api_key, timeout=timeout, max_retries=0)
    kwargs: Dict[str, Any] = {
        "model": settings.openai_model,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("OpenAI returned empty content")
    return content


def chat_completion(
    messages: List[Dict[str, str]],
    *,
    json_mode: bool = False,
    temperature: float = 0.3,
) -> Tuple[str, str]:
    """
    Send a chat completion request with automatic fallback.

    Returns:
        (response_text, provider_used)
    """
    # Try Groq first (free)
    try:
        content = _call_groq(
            messages,
            json_mode=json_mode,
            temperature=temperature,
            timeout=settings.assistant_llm_timeout_seconds,
        )
        return content, "groq"
    except Exception as exc:
        logger.warning("Groq call failed, falling back to OpenAI: %s", exc)

    # Fallback to OpenAI
    try:
        content = _call_openai(
            messages,
            json_mode=json_mode,
            temperature=temperature,
        )
        return content, "openai"
    except Exception as exc:
        logger.error("OpenAI fallback also failed: %s", exc)
        raise RuntimeError(f"All LLM providers failed. Last error: {exc}") from exc


def chat_completion_json(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.2,
) -> Tuple[Dict[str, Any], str]:
    """
    Chat completion that parses the response as JSON.

    Returns:
        (parsed_dict, provider_used)
    """
    raw, provider = chat_completion(messages, json_mode=True, temperature=temperature)
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed, provider
    except json.JSONDecodeError:
        pass

    # Try to extract JSON from the response
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(raw[start : end + 1])
            if isinstance(parsed, dict):
                return parsed, provider
        except json.JSONDecodeError:
            pass

    raise RuntimeError(f"LLM ({provider}) returned non-JSON content: {raw[:200]}")
