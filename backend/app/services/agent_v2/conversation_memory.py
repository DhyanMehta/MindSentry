from __future__ import annotations

from collections import defaultdict, deque
from typing import Any, Deque, Dict, List, Optional

_MAX_MESSAGES = 10
_MEMORY_STORE: Dict[str, Deque[Dict[str, Any]]] = defaultdict(lambda: deque(maxlen=_MAX_MESSAGES))


def get_memory_key(user_id: int, session_id: Optional[str]) -> str:
    if session_id:
        return f"session:{session_id}"
    return f"user:{user_id}"


def get_recent_history(memory_key: str) -> List[Dict[str, Any]]:
    return list(_MEMORY_STORE[memory_key])


def add_user_message(memory_key: str, text: str) -> None:
    _MEMORY_STORE[memory_key].append({"role": "user", "text": (text or "").strip()})


def add_assistant_message(memory_key: str, text: str, intent: Optional[str] = None) -> None:
    _MEMORY_STORE[memory_key].append(
        {
            "role": "assistant",
            "text": (text or "").strip(),
            "intent": intent,
        }
    )


def _detect_emotional_tone(text: str) -> str:
    lowered = (text or "").lower()
    distress_terms = {"sad", "bad mood", "anxious", "anxiety", "panic", "stressed", "overwhelmed", "same"}
    positive_terms = {"better", "good", "improved", "fine", "great"}

    if any(term in lowered for term in distress_terms):
        return "distressed"
    if any(term in lowered for term in positive_terms):
        return "positive"
    return "neutral"


def _detect_topic(text: str) -> str:
    lowered = (text or "").lower()
    if any(token in lowered for token in ["score", "history", "metric", "trend"]):
        return "scores"
    if any(token in lowered for token in ["mood", "anxiety", "panic", "stress", "sleep", "health"]):
        return "health"
    return "general"


def derive_memory_signals(history: List[Dict[str, Any]], current_query: str) -> Dict[str, Any]:
    previous_user = next((m for m in reversed(history) if m.get("role") == "user"), None)
    previous_assistant = next((m for m in reversed(history) if m.get("role") == "assistant"), None)

    previous_user_text = (previous_user or {}).get("text", "")
    previous_assistant_text = (previous_assistant or {}).get("text", "")
    previous_intent = (previous_assistant or {}).get("intent")

    follow_up_markers = {"still", "same", "again", "that", "it", "continue", "more"}
    current_tokens = set((current_query or "").lower().split())
    is_follow_up = bool(previous_user_text) and any(marker in current_tokens for marker in follow_up_markers)

    emotional_tone = _detect_emotional_tone(previous_user_text)
    ongoing_topic = _detect_topic(previous_user_text or current_query)

    return {
        "has_history": bool(history),
        "is_follow_up": is_follow_up,
        "previous_intent": previous_intent,
        "emotional_tone": emotional_tone,
        "ongoing_topic": ongoing_topic,
        "previous_user_message": previous_user_text[:220],
        "previous_assistant_message": previous_assistant_text[:260],
    }


def build_memory_context(history: List[Dict[str, Any]], memory_signals: Dict[str, Any]) -> Dict[str, Any]:
    if not history:
        return {}

    recent_turns = history[-6:]
    compact_turns = []
    for item in recent_turns:
        role = item.get("role", "unknown")
        text = (item.get("text") or "").strip()
        if text:
            compact_turns.append({"role": role, "text": text[:180]})

    guidance: List[str] = []
    if memory_signals.get("is_follow_up"):
        guidance.append("This is a follow-up. Avoid repeating previous suggestions verbatim.")
    if memory_signals.get("emotional_tone") == "distressed":
        guidance.append("Use a calm, supportive, and concise tone.")

    return {
        "memory_signals": {
            "is_follow_up": memory_signals.get("is_follow_up", False),
            "previous_intent": memory_signals.get("previous_intent"),
            "emotional_tone": memory_signals.get("emotional_tone", "neutral"),
            "ongoing_topic": memory_signals.get("ongoing_topic", "general"),
        },
        "response_guidance": guidance,
        "recent_turns": compact_turns,
    }
