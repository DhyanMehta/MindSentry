from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_MARKDOWN_TOKENS = ["**", "__", "##", "###", "####", "```", "`"]


def _strip_markdown(text: str) -> str:
    cleaned = text or ""
    for token in _MARKDOWN_TOKENS:
        cleaned = cleaned.replace(token, "")
    cleaned = re.sub(r"\[(.*?)\]\((.*?)\)", r"\1", cleaned)
    return cleaned


def _normalize_whitespace(text: str) -> str:
    text = re.sub(r"\s+(\d+\.)\s+", r"\n\1 ", text)
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _dedupe_sentences(text: str) -> str:
    seen = set()
    output = []
    for sentence in _SENTENCE_SPLIT.split(text):
        normalized = sentence.strip().lower()
        if not normalized:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        output.append(sentence.strip())
    return " ".join(output).strip()


def _extract_list_items(text: str) -> List[str]:
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    items = []
    for line in lines:
        if not re.match(r"^(\d+[.)]|[-*])\s+", line):
            continue
        candidate = re.sub(r"^(\d+[.)]|[-*])\s*", "", line).strip()
        if len(candidate) < 3:
            continue
        items.append(candidate)
    return items


def _to_ui_friendly_format(text: str, prefer_bullets: bool) -> str:
    def _compact_item(item: str) -> str:
        words = item.split()
        if len(words) > 18:
            item = " ".join(words[:18]).strip()
        item = item.rstrip(" ,;:")
        if item and item[-1] not in ".!?":
            item += "."
        return item

    inline_items = re.findall(r"\d+\.\s*([^\n]+?)(?=(?:\s+\d+\.\s)|$)", text)
    if prefer_bullets and len(inline_items) >= 2:
        limited = [_compact_item(item.strip()) for item in inline_items[:3] if item.strip()]
        if limited:
            return "\n".join(f"- {item}" for item in limited)

    items = _extract_list_items(text)
    if prefer_bullets and len(items) >= 2:
        limited = [_compact_item(item) for item in items[:3]]
        return "\n".join(f"- {item}" for item in limited)
    return text


def _enforce_length(text: str, max_chars: int = 520) -> str:
    if len(text) <= max_chars:
        return text
    trimmed = text[:max_chars].rsplit(" ", 1)[0].strip()
    if not trimmed.endswith(('.', '!', '?')):
        trimmed += "."
    return trimmed


def _truncate_to_sentences(text: str, max_sentences: int) -> str:
    pieces = [p.strip() for p in _SENTENCE_SPLIT.split(text) if p.strip()]
    if len(pieces) <= max_sentences:
        return text
    return " ".join(pieces[:max_sentences]).strip()


def normalize_response_text(
    text: str,
    query: str,
    intent: str,
    is_health_response: bool,
    memory_signals: Optional[Dict[str, Any]] = None,
) -> str:
    cleaned = _strip_markdown(text)
    cleaned = _normalize_whitespace(cleaned)
    cleaned = _dedupe_sentences(cleaned)

    prefer_bullets = any(term in (query or "").lower() for term in ["steps", "list", "tips", "what should i do"])
    cleaned = _to_ui_friendly_format(cleaned, prefer_bullets=prefer_bullets)
    if memory_signals and memory_signals.get("is_follow_up"):
        cleaned = _truncate_to_sentences(cleaned, max_sentences=3)
    cleaned = _enforce_length(cleaned, max_chars=420)

    # Keep health responses supportive and continuous for follow-ups
    if is_health_response:
        lower = cleaned.lower()
        if memory_signals and memory_signals.get("is_follow_up") and "still" in (query or "").lower():
            if "thanks for sharing" not in lower and "i hear" not in lower and "that sounds" not in lower:
                cleaned = "I hear you. Since you are still feeling this way, let's try a different small step. " + cleaned
        elif "i hear" not in lower and "that sounds" not in lower and "i understand" not in lower:
            if cleaned.startswith("-"):
                cleaned = "That sounds difficult. Here are a few small steps:\n" + cleaned
            else:
                cleaned = "That sounds difficult. " + cleaned

    return cleaned.strip()


def normalize_response_payload(payload: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {"response": normalize_response_text(str(payload), state.get("input", ""), "GENERAL", False)}

    response_text = str(payload.get("response", "")).strip()
    intent_data = state.get("intent") or state.get("intent_data") or {}
    intent = intent_data.get("intent", "GENERAL")
    memory_signals = state.get("memory_signals") or {}
    query_lower = (state.get("input") or "").lower()
    is_health_like = intent == "HEALTH_QUERY" or any(word in query_lower for word in ["mood", "anxious", "stress", "panic", "sad"])

    normalized = normalize_response_text(
        text=response_text,
        query=state.get("input", ""),
        intent=intent,
        is_health_response=is_health_like,
        memory_signals=memory_signals,
    )

    return {
        **payload,
        "response": normalized,
    }
