"""Clinic call tools."""
from __future__ import annotations

from typing import Dict, Any

from sqlmodel import Session

from app.services.tools.providers import call_provider


def initiate_clinic_call(db: Session, user_id: int, clinic_id: str, reason: str | None) -> Dict[str, Any]:
    return call_provider.initiate_call(db, user_id, clinic_id, reason)
