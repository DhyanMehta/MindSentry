"""Appointment workflow tools."""
from __future__ import annotations

from typing import Dict, Any

from sqlmodel import Session

from app.models.assistant_models import AppointmentRequest, AppointmentAction


def create_appointment_request(
    db: Session,
    user_id: int,
    clinic_id: str,
    preferred_date: str,
    preferred_time: str,
    notes: str | None,
    session_id: str | None = None,
) -> Dict[str, Any]:
    req = AppointmentRequest(
        user_id=user_id,
        session_id=session_id,
        clinic_id=clinic_id,
        preferred_date=preferred_date,
        preferred_time=preferred_time,
        notes=notes,
        status="requested",
        consent_status="approved",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    action = AppointmentAction(
        appointment_request_id=req.id,
        action_type="create_request",
        status="completed",
        metadata_json={"source": "assistant"},
    )
    db.add(action)
    db.commit()

    return {
        "appointment_request_id": req.id,
        "status": req.status,
        "clinic_id": req.clinic_id,
        "preferred_date": req.preferred_date,
        "preferred_time": req.preferred_time,
    }
