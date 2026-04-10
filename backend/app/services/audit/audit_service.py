"""Audit service for assistant actions and graph decisions."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlmodel import Session

from app.models.assistant_models import AssistantToolAction


class AuditService:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def append_entry(entries: List[Dict[str, Any]], event: str, details: Dict[str, Any]) -> List[Dict[str, Any]]:
        entries.append(
            {
                "event": event,
                "details": details,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return entries

    def log_tool_action(
        self,
        *,
        user_id: int,
        session_id: str,
        tool_name: str,
        tool_input: Dict[str, Any],
        tool_output: Dict[str, Any] | None,
        action_status: str,
        consent_status: str,
        requires_consent: bool,
        failure_reason: str | None,
        audit_entries: List[Dict[str, Any]],
    ) -> AssistantToolAction:
        row = AssistantToolAction(
            user_id=user_id,
            session_id=session_id,
            tool_name=tool_name,
            tool_input=tool_input,
            tool_output=tool_output,
            action_status=action_status,
            consent_status=consent_status,
            requires_consent=requires_consent,
            failure_reason=failure_reason,
            audit_entries={"entries": audit_entries},
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def create_pending_action(
        self,
        *,
        user_id: int,
        session_id: str,
        tool_name: str,
        tool_input: Dict[str, Any],
        audit_entries: List[Dict[str, Any]],
    ) -> AssistantToolAction:
        row = AssistantToolAction(
            user_id=user_id,
            session_id=session_id,
            tool_name=tool_name,
            tool_input=tool_input,
            tool_output=None,
            action_status="pending",
            consent_status="pending",
            requires_consent=True,
            failure_reason=None,
            audit_entries={"entries": audit_entries},
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def update_action(
        self,
        row: AssistantToolAction,
        *,
        tool_output: Dict[str, Any] | None,
        action_status: str,
        consent_status: str,
        failure_reason: str | None,
        audit_entries: List[Dict[str, Any]],
    ) -> AssistantToolAction:
        row.tool_output = tool_output
        row.action_status = action_status
        row.consent_status = consent_status
        row.failure_reason = failure_reason
        row.audit_entries = {"entries": audit_entries}
        row.updated_at = datetime.now(timezone.utc)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row
