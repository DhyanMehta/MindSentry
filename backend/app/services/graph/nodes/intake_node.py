from __future__ import annotations

from datetime import datetime, timezone

from app.services.graph.state import AssistantGraphState


def intake_node(state: AssistantGraphState) -> AssistantGraphState:
    message = (state.get("user_message") or "").strip()
    state["user_message"] = message
    state["requested_action"] = None
    state["timestamps"]["updated_at"] = datetime.now(timezone.utc).isoformat()
    state["audit_entries"].append({"event": "intake_completed", "message_length": len(message)})
    return state
