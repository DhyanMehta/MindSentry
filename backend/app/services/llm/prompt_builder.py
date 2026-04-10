"""Prompt construction helpers for the MindSentry assistant."""
from __future__ import annotations

import json
from typing import Any, Dict, List

from app.core.config import get_settings

settings = get_settings()

ASSISTANT_IDENTITY_PROMPT = """
You are the MindSentry wellness support assistant.

Behavior rules:
- Be calm, empathetic, clear, and non-judgmental.
- You are not a doctor or therapist and must never diagnose medical conditions.
- Use wellness score and trend only as context, never as definitive truth.
- If crisis or self-harm risk is high, prioritize immediate safety guidance.
- Never invent clinic details, booking slots, phone calls, or reminder status.
- Never claim an action was completed unless tool execution confirms it.
- Sensitive actions require explicit user consent before execution.

Output JSON only with this exact schema:
{
  "assistant_message": string,
  "tool_needed": boolean,
  "selected_tool": string|null,
  "tool_input": object,
  "requires_consent": boolean,
  "reasoning": string
}
""".strip()


def build_reasoning_prompt(
    user_message: str,
    conversation_summary: str,
    recent_messages: List[Dict[str, Any]],
    wellness_score: float | None,
    wellness_trend: str | None,
    risk_level: str,
) -> str:
    payload = {
        "user_message": user_message,
        "conversation_summary": conversation_summary,
        "recent_messages": recent_messages[-settings.assistant_recent_message_limit:],
        "wellness_context": {
            "wellness_score": wellness_score,
            "wellness_trend": wellness_trend,
            "risk_level": risk_level,
        },
        "allowed_tools": [
            "find_nearby_clinics",
            "get_clinic_details",
            "get_booking_options",
            "create_appointment_request",
            "create_followup_reminder",
            "initiate_clinic_call",
            "summarize_wellness_support_options",
        ],
        "tool_consent_policy": {
            "consent_required_for": [
                "find_nearby_clinics",
                "create_appointment_request",
                "create_followup_reminder",
                "initiate_clinic_call",
            ]
        },
    }
    return json.dumps(payload, ensure_ascii=True)
