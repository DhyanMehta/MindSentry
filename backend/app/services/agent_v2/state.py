from __future__ import annotations

from typing import Any, Dict, Optional, TypedDict


class ChatAgentState(TypedDict, total=False):
    input: str
    user_id: int
    source: Optional[str]
    intent_data: Dict[str, Any]
    context: Optional[Dict[str, Any]]
    output: Any
    llm_provider: str
