from __future__ import annotations

from typing import Any, Dict, Optional, TypedDict


class ChatAgentState(TypedDict, total=False):
    input: str
    user_id: int
    session_id: Optional[str]
    memory_key: str
    memory_history: list[Dict[str, Any]]
    memory_signals: Dict[str, Any]
    memory_context: Dict[str, Any]
    source: Optional[str]
    intent_data: Dict[str, Any]
    context: Optional[Dict[str, Any]]
    output: Any
    llm_provider: str
