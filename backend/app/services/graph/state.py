"""Typed shared state for the assistant LangGraph."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, TypedDict


RiskLevel = Literal["low", "medium", "high", "crisis"]
ConsentStatus = Literal["not_required", "pending", "approved", "denied"]


class AssistantGraphState(TypedDict):
    user_id: int
    session_id: str
    user_message: str
    conversation_summary: str
    recent_messages: List[Dict[str, Any]]
    wellness_score: Optional[float]
    wellness_trend: Optional[str]
    recent_scores: List[float]
    risk_level: RiskLevel
    requested_action: Optional[str]
    pending_action_id: Optional[str]
    requires_consent: bool
    consent_status: ConsentStatus
    selected_tool: Optional[str]
    tool_input: Dict[str, Any]
    tool_output: Dict[str, Any]
    assistant_response: str
    ui_payload: List[Dict[str, Any]]
    audit_entries: List[Dict[str, Any]]
    timestamps: Dict[str, str]


def initialize_state(
    *,
    user_id: int,
    session_id: str,
    user_message: str,
    conversation_summary: str = "",
    recent_messages: Optional[List[Dict[str, Any]]] = None,
    pending_action_id: Optional[str] = None,
    consent_status: ConsentStatus = "not_required",
    selected_tool: Optional[str] = None,
    tool_input: Optional[Dict[str, Any]] = None,
) -> AssistantGraphState:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "user_id": user_id,
        "session_id": session_id,
        "user_message": user_message,
        "conversation_summary": conversation_summary,
        "recent_messages": recent_messages or [],
        "wellness_score": None,
        "wellness_trend": None,
        "recent_scores": [],
        "risk_level": "low",
        "requested_action": None,
        "pending_action_id": pending_action_id,
        "requires_consent": False,
        "consent_status": consent_status,
        "selected_tool": selected_tool,
        "tool_input": tool_input or {},
        "tool_output": {},
        "assistant_response": "",
        "ui_payload": [],
        "audit_entries": [],
        "timestamps": {"started_at": now, "updated_at": now},
    }
