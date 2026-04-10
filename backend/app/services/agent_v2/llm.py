from __future__ import annotations

import logging
from typing import Any, Iterable, Tuple
from dotenv import load_dotenv

try:
    from langchain.chat_models import ChatOpenAI
except Exception:  # pragma: no cover - import path differs across installed langchain versions
    from langchain_openai import ChatOpenAI  # type: ignore

try:
    from langchain_groq import ChatGroq
except Exception as exc:  # pragma: no cover - handled at runtime
    ChatGroq = None  # type: ignore[assignment]
    _GROQ_IMPORT_ERROR = exc
else:
    _GROQ_IMPORT_ERROR = None

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.1-8b-instant"
OPENAI_MODEL = "gpt-4o-mini"


def _build_groq_llm() -> ChatGroq:
    if ChatGroq is None:
        raise RuntimeError(f"LANGCHAIN_GROQ_UNAVAILABLE: {_GROQ_IMPORT_ERROR}")
    return ChatGroq(model=GROQ_MODEL, temperature=0.3)


def _build_openai_llm() -> ChatOpenAI:
    return ChatOpenAI(model=OPENAI_MODEL, temperature=0.3)


def get_llm(provider: str = "groq"):
    if provider == "openai":
        return _build_openai_llm()

    try:
        return _build_groq_llm()
    except Exception as exc:
        logger.warning("Groq initialization failed; falling back to OpenAI: %s", exc)
        return _build_openai_llm()


def safe_llm_invoke(messages: Any, *, provider: str = "groq"):
    try:
        llm = _build_groq_llm() if provider == "groq" else _build_openai_llm()
        return llm.invoke(messages), provider
    except Exception as exc:
        print("Groq failed, switching to OpenAI:", str(exc))
        logger.warning("Groq invocation failed; switching to OpenAI: %s", exc)
        llm = _build_openai_llm()
        return llm.invoke(messages), "openai"


def invoke_with_fallback(messages: Iterable, *, provider: str = "groq"):
    return safe_llm_invoke(messages, provider=provider)
