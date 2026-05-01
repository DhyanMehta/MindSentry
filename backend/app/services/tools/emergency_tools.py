"""
Emergency tools for the MindSentry chatbot.

Provides emergency number lookup based on user timezone/country
and logs the action to the database.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlmodel import Session, select

from app.models.assistant_models import CallAction
from app.models.user import User

logger = logging.getLogger(__name__)

# Emergency numbers by country/region code
# Source: International emergency numbers
EMERGENCY_NUMBERS: Dict[str, Dict[str, str]] = {
    "IN": {"number": "112", "name": "India Emergency Services", "alternative": "9152987821"},
    "US": {"number": "988", "name": "Suicide & Crisis Lifeline", "alternative": "911"},
    "GB": {"number": "116123", "name": "Samaritans UK", "alternative": "999"},
    "AU": {"number": "13 11 14", "name": "Lifeline Australia", "alternative": "000"},
    "CA": {"number": "988", "name": "Suicide Crisis Helpline", "alternative": "911"},
    "DE": {"number": "0800 111 0 111", "name": "Telefonseelsorge", "alternative": "112"},
    "FR": {"number": "3114", "name": "Numéro national de prévention du suicide", "alternative": "15"},
    "DEFAULT": {"number": "112", "name": "International Emergency", "alternative": ""},
}

# Timezone prefix → country code mapping
TIMEZONE_TO_COUNTRY: Dict[str, str] = {
    "asia/kolkata": "IN",
    "asia/calcutta": "IN",
    "asia/mumbai": "IN",
    "asia/chennai": "IN",
    "america/new_york": "US",
    "america/chicago": "US",
    "america/denver": "US",
    "america/los_angeles": "US",
    "america/phoenix": "US",
    "us/": "US",
    "europe/london": "GB",
    "australia/": "AU",
    "america/toronto": "CA",
    "america/vancouver": "CA",
    "canada/": "CA",
    "europe/berlin": "DE",
    "europe/paris": "FR",
}


def _detect_country_from_timezone(timezone: Optional[str]) -> str:
    """Detect country code from timezone string."""
    if not timezone:
        return "DEFAULT"

    tz_lower = timezone.strip().lower()

    # Direct match
    if tz_lower in TIMEZONE_TO_COUNTRY:
        return TIMEZONE_TO_COUNTRY[tz_lower]

    # Prefix match
    for prefix, country in TIMEZONE_TO_COUNTRY.items():
        if tz_lower.startswith(prefix):
            return country

    # Fallback: check if timezone contains a country hint
    if "india" in tz_lower or "kolkata" in tz_lower:
        return "IN"
    if "america" in tz_lower:
        return "US"

    return "DEFAULT"


def get_emergency_info(
    db: Session,
    user_id: int,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Look up the correct emergency number for the user and log the action.

    Returns a dict with emergency info + ui_payload for the frontend.
    """
    # Get user timezone
    user = db.exec(select(User).where(User.id == user_id)).first()
    timezone = getattr(user, "timezone", None) if user else None
    country_code = _detect_country_from_timezone(timezone)
    emergency_info = EMERGENCY_NUMBERS.get(country_code, EMERGENCY_NUMBERS["DEFAULT"])

    # Log the call action
    try:
        action = CallAction(
            user_id=user_id,
            session_id=session_id,
            clinic_id=f"emergency_{country_code.lower()}",
            reason="Crisis detected — emergency number provided",
            status="provided",
            consent_status="approved",
        )
        db.add(action)
        db.commit()
    except Exception as exc:
        logger.warning("Failed to log emergency call action: %s", exc)

    return {
        "country_code": country_code,
        "emergency_number": emergency_info["number"],
        "service_name": emergency_info["name"],
        "alternative_number": emergency_info.get("alternative", ""),
        "ui_payload": {
            "type": "emergency_call",
            "phone_number": emergency_info["number"],
            "service_name": emergency_info["name"],
            "alternative_number": emergency_info.get("alternative", ""),
            "message": (
                f"If you are in immediate danger, please call {emergency_info['name']} "
                f"at {emergency_info['number']} right now."
            ),
        },
    }
