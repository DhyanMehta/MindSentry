from __future__ import annotations

import logging
import re

from app.services.graph.state import AssistantGraphState
from app.services.llm.groq_client import get_groq_client
from app.services.llm.prompt_builder import ASSISTANT_IDENTITY_PROMPT, build_reasoning_prompt, detect_llm_intent


COORD_REGEX = re.compile(r"(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)")
logger = logging.getLogger(__name__)


def _is_clinic_intent(message: str) -> bool:
    return any(k in message for k in ("clinic", "clinics", "nearby", "near me", "hospital", "doctor"))


def _extract_clinic_tool_input(state: AssistantGraphState) -> dict | None:
    message = (state.get("user_message") or "").lower()
    clinic_intent = _is_clinic_intent(message)
    if not clinic_intent:
        return None

    match = COORD_REGEX.search(message)
    if not match:
        return None

    lat = float(match.group(1))
    lng = float(match.group(2))
    # Basic coordinate sanity check.
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None

    return {"latitude": lat, "longitude": lng, "radius": 10}


def _build_local_support_reply(state: AssistantGraphState) -> str:
    risk_level = state.get("risk_level", "low")
    trend = state.get("wellness_trend") or "stable"
    message = (state.get("user_message") or "").strip()

    if risk_level == "high":
        return (
            "Thank you for telling me that. It sounds like things feel very heavy right now. "
            "Please focus on one immediate grounding step and reach out to a trusted person if you can."
        )

    if trend == "declining":
        return (
            f"I hear you. Based on what you've shared, it may help to slow down and take one small supportive step today. "
            f"What feels most manageable right now about: \"{message[:80]}\"?"
        )

    return (
        f"Thank you for sharing that with me. I'm here with you, and we can take this one step at a time. "
        f"What feels most important for us to focus on next?"
    )


def assistant_reasoning_node(state: AssistantGraphState) -> AssistantGraphState:
    if state["risk_level"] == "crisis":
        state["requested_action"] = "crisis_escalation"
        return state

    if state.get("selected_tool") and state.get("consent_status") in {"approved", "denied"}:
        state["requested_action"] = state.get("selected_tool")
        state["audit_entries"].append(
            {
                "event": "assistant_reasoning_resume_action",
                "selected_tool": state.get("selected_tool"),
                "consent_status": state.get("consent_status"),
                "pending_action_id": state.get("pending_action_id"),
            }
        )
        return state

    message = (state.get("user_message") or "").lower()
    clinic_tool_input = _extract_clinic_tool_input(state)
    if clinic_tool_input:
        state["assistant_response"] = "I can search nearby clinics using your shared location. Please confirm to continue."
        state["selected_tool"] = "find_nearby_clinics"
        state["tool_input"] = clinic_tool_input
        state["requires_consent"] = True
        state["requested_action"] = "find_nearby_clinics"
        state["audit_entries"].append(
            {
                "event": "assistant_reasoning_clinic_direct",
                "selected_tool": "find_nearby_clinics",
                "tool_input": clinic_tool_input,
            }
        )
        return state

    if _is_clinic_intent(message):
        state["assistant_response"] = (
            "I can help find nearby clinics. Please share your latitude and longitude, or use the location option in the app."
        )
        state["selected_tool"] = None
        state["tool_input"] = {}
        state["requires_consent"] = False
        state["requested_action"] = None
        state["audit_entries"].append(
            {
                "event": "assistant_reasoning_clinic_missing_location",
            }
        )
        return state

    llm_intent = detect_llm_intent(state.get("user_message", ""))
    include_wellness_context = llm_intent == "SCORE_QUERY"
    injected_context = {
        "wellness_score": state.get("wellness_score"),
        "wellness_trend": state.get("wellness_trend"),
        "risk_level": state.get("risk_level", "low"),
    } if include_wellness_context else {}

    prompt = build_reasoning_prompt(
        user_message=state["user_message"],
        conversation_summary=state.get("conversation_summary", ""),
        recent_messages=state.get("recent_messages", []),
        wellness_score=state.get("wellness_score"),
        wellness_trend=state.get("wellness_trend"),
        risk_level=state.get("risk_level", "low"),
        include_wellness_context=include_wellness_context,
    )

    logger.info(
        "assistant_llm_request session_id=%s intent=%s user_query=%r injected_context=%s prompt=%s",
        state.get("session_id"),
        llm_intent,
        (state.get("user_message") or "").strip(),
        injected_context,
        prompt,
    )

    try:
        llm = get_groq_client()
        result = llm.chat_json(ASSISTANT_IDENTITY_PROMPT, prompt)
    except Exception as exc:
        state["assistant_response"] = _build_local_support_reply(state)
        state["selected_tool"] = None
        state["tool_input"] = {}
        state["requires_consent"] = False
        state["requested_action"] = None
        state["audit_entries"].append(
            {
                "event": "assistant_reasoning_fallback",
                "reason": str(exc),
            }
        )
        return state

    assistant_message = result.get("assistant_message")
    if not assistant_message:
        raise RuntimeError("LLM_RESPONSE_INVALID: assistant_message missing")

    selected_tool = result.get("selected_tool")
    tool_input = result.get("tool_input")
    if selected_tool and not isinstance(tool_input, dict):
        raise RuntimeError("LLM_RESPONSE_INVALID: tool_input must be an object when selected_tool is present")

    state["assistant_response"] = assistant_message
    state["selected_tool"] = selected_tool
    state["tool_input"] = tool_input or {}
    state["requires_consent"] = bool(result.get("requires_consent", False))
    state["requested_action"] = state["selected_tool"]

    state["audit_entries"].append(
        {
            "event": "assistant_reasoning_completed",
            "tool_needed": bool(result.get("tool_needed")),
            "selected_tool": state["selected_tool"],
            "reasoning": result.get("reasoning"),
        }
    )
    return state
