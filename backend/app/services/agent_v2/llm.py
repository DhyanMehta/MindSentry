from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import importlib
import logging
import threading
from typing import Any, Iterable, List, Dict

from app.services.llm.llm_client import chat_completion


def _try_load_dotenv() -> None:
    try:
        dotenv_module = importlib.import_module("dotenv")
        load_dotenv_fn = getattr(dotenv_module, "load_dotenv", None)
        if callable(load_dotenv_fn):
            load_dotenv_fn()
    except Exception:
        return


_try_load_dotenv()

logger = logging.getLogger(__name__)
_PREFERRED_PROVIDER = "groq"
_PROVIDER_LOCK = threading.Lock()


class _ChatCompletionProxy:
    def __init__(self, provider: str = "groq") -> None:
        self.provider = provider

    def invoke(self, prompt: Any):
        messages = prompt
        if not isinstance(messages, list):
            messages = [{"role": "user", "content": str(prompt)}]
        content, _provider_used = chat_completion(messages, temperature=0.3)
        return content


def get_llm(provider: str = "groq"):
    return _ChatCompletionProxy(provider=provider)


def _set_preferred_provider(provider: str) -> None:
    global _PREFERRED_PROVIDER
    with _PROVIDER_LOCK:
        _PREFERRED_PROVIDER = provider


def _get_preferred_provider() -> str:
    with _PROVIDER_LOCK:
        return _PREFERRED_PROVIDER


def safe_llm_call(llm, prompt):
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(llm.invoke, prompt)
            return future.result(timeout=5)
    except FuturesTimeoutError:
        print("[LLM ERROR] timeout after 5s")
        return "I'm having trouble responding right now. Please try again."
    except Exception as e:
        print(f"[LLM ERROR] {e}")
        return "I'm having trouble responding right now. Please try again."


def safe_llm_invoke(messages: Any, *, provider: str = "groq"):
    selected_provider = provider or _get_preferred_provider()
    try:
        response_text, provider_used = chat_completion(messages, temperature=0.3)
        _set_preferred_provider(provider_used)
        return response_text, provider_used
    except Exception as exc:
        logger.warning("LLM provider selection failed for %s: %s", selected_provider, exc)
        fallback_provider = "openai" if selected_provider == "groq" else "groq"
        _set_preferred_provider(fallback_provider)
        response_text, provider_used = chat_completion(messages, temperature=0.3)
        _set_preferred_provider(provider_used)
        return response_text, provider_used


def invoke_with_fallback(messages: Iterable, *, provider: str = "groq"):
    return safe_llm_invoke(messages, provider=provider)
