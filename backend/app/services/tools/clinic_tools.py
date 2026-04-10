"""Clinic search tools and provider-backed lookups."""
from __future__ import annotations

from typing import Any, Dict

from sqlmodel import Session

from app.models.assistant_models import ClinicSearchLog
from app.services.tools.providers import clinic_provider


def find_nearby_clinics(
    db: Session,
    user_id: int,
    session_id: str,
    latitude: float,
    longitude: float,
    radius: float,
    specialty: str | None,
) -> Dict[str, Any]:
    warning = None
    try:
        clinics = clinic_provider.find_nearby(db, latitude, longitude, radius, specialty)
    except RuntimeError as exc:
        clinics = []
        detail = str(exc)
        if "GOOGLE_PLACES_API_KEY_MISSING" in detail:
            warning = "Live clinic search is not configured right now, so I could not verify nearby clinics."
        else:
            warning = "Clinic search could not be completed from the live provider right now."

    log = ClinicSearchLog(
        user_id=user_id,
        session_id=session_id,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius,
        specialty=specialty,
        result_count=len(clinics),
        provider="google_places",
    )
    db.add(log)
    db.commit()
    payload = {"clinics": clinics, "count": len(clinics)}
    if warning:
        payload["warning"] = warning
    return payload


def get_clinic_details(db: Session, clinic_id: str) -> Dict[str, Any]:
    # Data comes from cached provider results and may be partial.
    return {
        "clinic_id": clinic_id,
        "name": "Clinic details available from provider",
        "disclaimer": "Verify details directly with the clinic before visiting.",
    }


def get_booking_options(clinic_id: str) -> Dict[str, Any]:
    return {
        "clinic_id": clinic_id,
        "booking_modes": ["request_callback", "manual_call", "visit_frontdesk"],
        "note": "Live slot inventory is provider-dependent and may change.",
    }
