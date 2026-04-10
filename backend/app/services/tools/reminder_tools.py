"""Reminder workflow tools."""
from __future__ import annotations

from typing import Dict, Any

from sqlmodel import Session

from app.models.assistant_models import ReminderAction


def create_followup_reminder(
    db: Session,
    user_id: int,
    title: str,
    datetime_iso: str,
    context: str | None,
    session_id: str | None = None,
) -> Dict[str, Any]:
    row = ReminderAction(
        user_id=user_id,
        session_id=session_id,
        title=title,
        remind_at=datetime_iso,
        context=context,
        provider_reference=None,
        status="created",
        consent_status="approved",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "reminder_action_id": row.id,
        "title": row.title,
        "remind_at": row.remind_at,
        "status": row.status,
    }
