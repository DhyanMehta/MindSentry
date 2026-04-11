from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import importlib
import logging
import threading
from typing import Any, Iterable


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

GROQ_MODEL = "llama-3.1-8b-instant"
OPENAI_MODEL = "gpt-4o-mini"
_PREFERRED_PROVIDER = "groq"
_PROVIDER_LOCK = threading.Lock()


def _resolve_chat_openai_class():
    try:
        module = importlib.import_module("langchain.chat_models")
        return getattr(module, "ChatOpenAI")
    except Exception:
        module = importlib.import_module("langchain_openai")
        return getattr(module, "ChatOpenAI")


def _resolve_chat_groq_class():
    module = importlib.import_module("langchain_groq")
    return getattr(module, "ChatGroq")


def _build_groq_llm() -> Any:
    ChatGroq = _resolve_chat_groq_class()
    return ChatGroq(model=GROQ_MODEL, temperature=0.3)


def _build_openai_llm() -> Any:
    ChatOpenAI = _resolve_chat_openai_class()
    return ChatOpenAI(model=OPENAI_MODEL, temperature=0.3)


def get_llm(provider: str = "groq"):
    if provider == "openai":
        return _build_openai_llm()

    try:
        return _build_groq_llm()
    except Exception as exc:
        logger.warning("Groq initialization failed; falling back to OpenAI: %s", exc)
        return _build_openai_llm()


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
        llm = get_llm(selected_provider)
    except Exception as exc:
        logger.warning("LLM provider selection failed for %s: %s", selected_provider, exc)
        selected_provider = "openai"
        _set_preferred_provider(selected_provider)
        llm = get_llm(selected_provider)

    result = safe_llm_call(llm, messages)
    if isinstance(result, str) and result.startswith("I'm having trouble"):
        if selected_provider == "groq":
            _set_preferred_provider("openai")
        return result, selected_provider

    _set_preferred_provider(selected_provider)
    return result, selected_provider


def invoke_with_fallback(messages: Iterable, *, provider: str = "groq"):
    return safe_llm_invoke(messages, provider=provider)
