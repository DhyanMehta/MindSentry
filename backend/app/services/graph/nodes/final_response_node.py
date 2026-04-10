from __future__ import annotations

from app.services.graph.state import AssistantGraphState


def _build_tool_followup(state: AssistantGraphState) -> str:
    tool_name = state.get("selected_tool")
    tool_output = state.get("tool_output") or {}
    consent_status = state.get("consent_status")

    if consent_status == "denied":
        return "Okay, I won't continue with that action. If you'd like, I can help you explore another option."

    if tool_name == "find_nearby_clinics":
        clinics = tool_output.get("clinics") or []
        if not clinics:
            return "I checked nearby options, but I couldn't find any clinics from the information available right now."
        top_names = [clinic.get("name") for clinic in clinics[:3] if clinic.get("name")]
        if top_names:
            return f"I found {len(clinics)} nearby clinics. A few good options are {', '.join(top_names)}."
        return f"I found {len(clinics)} nearby clinics and shared them below."

    if tool_name == "create_appointment_request":
        clinic_id = tool_output.get("clinic_id", "the selected clinic")
        return f"I submitted an appointment request for {clinic_id}. Please verify the details before you rely on it."

    if tool_name == "create_followup_reminder":
        return "Your follow-up reminder was created."

    if tool_name == "initiate_clinic_call":
        return "I processed the clinic call request."

    return "I completed that action."


def final_response_node(state: AssistantGraphState) -> AssistantGraphState:
    if state.get("selected_tool") and state.get("consent_status") in {"approved", "denied"}:
        state["assistant_response"] = _build_tool_followup(state)

    if not state.get("assistant_response"):
        raise RuntimeError("ASSISTANT_RESPONSE_MISSING: no response was produced by the agent")

    state["audit_entries"].append(
        {
            "event": "final_response_ready",
            "risk_level": state.get("risk_level"),
            "selected_tool": state.get("selected_tool"),
            "consent_status": state.get("consent_status"),
        }
    )
    return state
