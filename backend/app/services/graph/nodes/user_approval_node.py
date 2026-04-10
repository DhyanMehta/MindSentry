from __future__ import annotations

from app.services.graph.state import AssistantGraphState


def user_approval_node(state: AssistantGraphState) -> AssistantGraphState:
    if not state.get("requires_consent"):
        return state

    if state.get("consent_status") == "pending":
        state["ui_payload"].append(
            {
                "type": "approval_prompt",
                "action_id": state.get("pending_action_id") or "",
                "action": state.get("selected_tool"),
                "tool_name": state.get("selected_tool"),
                "tool_input": state.get("tool_input", {}),
                "reason": "This action may affect real-world outcomes and needs your explicit confirmation.",
            }
        )
        state["assistant_response"] = "ACTION_REQUIRES_EXPLICIT_APPROVAL"

    if state.get("consent_status") == "denied":
        state["assistant_response"] = "ACTION_DENIED_BY_USER"

    state["audit_entries"].append(
        {
            "event": "approval_evaluated",
            "consent_status": state.get("consent_status"),
            "selected_tool": state.get("selected_tool"),
        }
    )
    return state
