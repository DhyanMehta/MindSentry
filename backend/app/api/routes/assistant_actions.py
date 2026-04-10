"""Assistant action audit routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.core.dependencies import get_db_session, get_authenticated_user
from app.models.user import User
from app.models.assistant_models import AssistantToolAction
from app.schemas.assistant_actions import AssistantActionStatusResponse, AssistantActionLogItem

router = APIRouter(prefix="/api/v3/assistant-actions", tags=["assistant-actions"])


@router.post("/approval")
def approval_removed():
    raise HTTPException(
        status_code=410,
        detail="ASSISTANT_ACTION_APPROVAL_MOVED: use POST /api/v3/chat/message with approval.action_id",
    )


@router.get("/logs", response_model=AssistantActionStatusResponse)
def get_action_logs(
    limit: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_authenticated_user),
):
    rows = db.exec(
        select(AssistantToolAction)
        .where(AssistantToolAction.user_id == current_user.id)
        .order_by(AssistantToolAction.created_at.desc())
        .limit(limit)
    ).all()

    actions = [
        AssistantActionLogItem(
            id=r.id,
            session_id=r.session_id,
            tool_name=r.tool_name,
            action_status=r.action_status,
            consent_status=r.consent_status,
            failure_reason=r.failure_reason,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return AssistantActionStatusResponse(count=len(actions), actions=actions)
