from __future__ import annotations

from app.services.graph.state import AssistantGraphState
from app.services.tools.registry import ToolRegistry


def tool_execution_node(state: AssistantGraphState, registry: ToolRegistry) -> AssistantGraphState:
    tool_name = state.get("selected_tool")
    if not tool_name:
        return state

    if state.get("requires_consent") and state.get("consent_status") != "approved":
        state["audit_entries"].append({"event": "tool_execution_skipped", "reason": "consent_missing"})
        return state

    output = registry.execute(
        tool_name=tool_name,
        user_id=state["user_id"],
        session_id=state["session_id"],
        tool_input=state.get("tool_input", {}),
    )
    state["tool_output"] = output

    if tool_name == "find_nearby_clinics":
        clinics = output.get("clinics")
        if not isinstance(clinics, list):
            raise RuntimeError("TOOL_OUTPUT_INVALID: find_nearby_clinics must return clinics list")
        state["ui_payload"].append({"type": "clinic_cards", "clinics": clinics})
    else:
        state["ui_payload"].append(
            {
                "type": "tool_status",
                "tool_name": tool_name,
                "status": "completed",
                "details": output,
            }
        )

    state["audit_entries"].append(
        {
            "event": "tool_execution_completed",
            "tool_name": tool_name,
            "result_keys": list(output.keys()),
        }
    )

    return state
