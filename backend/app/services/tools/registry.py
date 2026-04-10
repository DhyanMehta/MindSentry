"""Tool registry and policy for assistant graph execution."""
from __future__ import annotations

from typing import Any, Dict, Callable

from sqlmodel import Session

from app.services.tools.wellness_tools import (
    get_wellness_context,
    get_recent_wellness_trend,
    detect_crisis_risk,
    get_user_saved_preferences,
    summarize_wellness_support_options,
)
from app.services.tools.clinic_tools import find_nearby_clinics, get_clinic_details, get_booking_options
from app.services.tools.appointment_tools import create_appointment_request
from app.services.tools.reminder_tools import create_followup_reminder
from app.services.tools.call_tools import initiate_clinic_call


TOOL_CONSENT_REQUIRED = {
    "find_nearby_clinics": True,
    "create_appointment_request": True,
    "initiate_clinic_call": True,
    "create_followup_reminder": True,
}


class ToolRegistry:
    def __init__(self, db: Session) -> None:
        self.db = db

    def requires_consent(self, tool_name: str) -> bool:
        return TOOL_CONSENT_REQUIRED.get(tool_name, False)

    def execute(self, tool_name: str, user_id: int, session_id: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        dispatcher: dict[str, Callable[[], Dict[str, Any]]] = {
            "get_wellness_context": lambda: get_wellness_context(self.db, user_id),
            "get_recent_wellness_trend": lambda: get_recent_wellness_trend(self.db, user_id),
            "detect_crisis_risk": lambda: detect_crisis_risk(
                tool_input.get("message", ""), tool_input.get("score_context", {})
            ),
            "get_user_saved_preferences": lambda: get_user_saved_preferences(self.db, user_id),
            "find_nearby_clinics": lambda: find_nearby_clinics(
                self.db,
                user_id,
                session_id,
                float(tool_input["latitude"]),
                float(tool_input["longitude"]),
                float(tool_input.get("radius", 10)),
                tool_input.get("specialty"),
            ),
            "get_clinic_details": lambda: get_clinic_details(self.db, tool_input["clinic_id"]),
            "get_booking_options": lambda: get_booking_options(tool_input["clinic_id"]),
            "create_appointment_request": lambda: create_appointment_request(
                self.db,
                user_id,
                tool_input["clinic_id"],
                tool_input["preferred_date"],
                tool_input["preferred_time"],
                tool_input.get("notes"),
                session_id=session_id,
            ),
            "create_followup_reminder": lambda: create_followup_reminder(
                self.db,
                user_id,
                tool_input["title"],
                tool_input["datetime"],
                tool_input.get("context"),
            ),
            "initiate_clinic_call": lambda: initiate_clinic_call(
                self.db,
                user_id,
                tool_input["clinic_id"],
                tool_input.get("reason"),
            ),
            "summarize_wellness_support_options": lambda: summarize_wellness_support_options(user_id),
        }

        if tool_name not in dispatcher:
            raise ValueError(f"Unsupported tool: {tool_name}")

        return dispatcher[tool_name]()
