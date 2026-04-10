"""Grounded assistant chat routes for the active MindSentry assistant."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.core.dependencies import get_db_session, get_authenticated_user
from app.models.user import User
from app.models.assistant_models import AssistantToolAction, ChatSession, ChatMessage, CrisisFlag
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse, ChatSessionResponse, ChatHistoryItem
from app.services.assistant.grounded_assistant_service import GroundedAssistantService
from app.services.audit.audit_service import AuditService

router = APIRouter(prefix="/api/v3/chat", tags=["assistant-chat"])


def _get_or_create_session(db: Session, user_id: int, session_id: str | None) -> ChatSession:
    if session_id:
        row = db.exec(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)).first()
        if row:
            return row
    now = datetime.now(timezone.utc)
    row = ChatSession(
        user_id=user_id,
        title="MindSentry Assistant Session",
        last_message_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _get_pending_action(
    db: Session,
    *,
    user_id: int,
    session_id: str,
    action_id: str,
) -> AssistantToolAction:
    row = db.exec(
        select(AssistantToolAction).where(
            AssistantToolAction.id == action_id,
            AssistantToolAction.user_id == user_id,
            AssistantToolAction.session_id == session_id,
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="ASSISTANT_ACTION_NOT_FOUND")
    if row.action_status != "pending" or row.consent_status != "pending":
        raise HTTPException(status_code=409, detail="ASSISTANT_ACTION_NOT_PENDING")
    return row


@router.post("/message", response_model=ChatMessageResponse)
def chat_message(
    request: ChatMessageRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_authenticated_user),
):
    session = _get_or_create_session(db, current_user.id, request.session_id)
    assistant = GroundedAssistantService(db)
    audit = AuditService(db)

    user_message = ChatMessage(
        session_id=session.id,
        user_id=current_user.id,
        role="user",
        message=request.message,
    )
    db.add(user_message)
    db.commit()

    warnings: list[str] = []
    suggested_actions: list[str] = []
    used_data: list[str] = []
    ui_payload: list[dict] = []
    selected_tool = None
    tool_execution_status = None
    requires_consent = False
    consent_status = "not_required"
    risk_level = "low"
    audit_entries: list[dict] = []
    answer_intent = None
    answer_topic = None

    if request.approval:
        pending_action = _get_pending_action(
            db,
            user_id=current_user.id,
            session_id=session.id,
            action_id=request.approval.action_id,
        )
        selected_tool = pending_action.tool_name
        consent_status = "approved" if request.approval.approved else "denied"
        risk_level = assistant.detect_risk(request.message, assistant.load_context_bundle(current_user.id))

        if request.approval.approved:
            try:
                tool_output = assistant.execute_action(
                    pending_action.tool_name,
                    current_user.id,
                    session.id,
                    pending_action.tool_input or {},
                )
                tool_execution_status = "completed"
            except Exception as exc:
                tool_output = {"error": str(exc)}
                tool_execution_status = "failed"
                warnings.append(str(exc))

            followup = assistant.build_action_followup(
                pending_action.tool_name,
                tool_output,
                consent_status,
            )
            response_text = followup["response"]
            ui_payload = followup["ui_payload"]
            warnings.extend(followup["warnings"])
            suggested_actions.extend(followup["suggested_actions"])
            audit_entries.append(
                {
                    "event": "grounded_action_executed",
                    "tool_name": pending_action.tool_name,
                    "status": tool_execution_status,
                }
            )
            audit.update_action(
                pending_action,
                tool_output=tool_output if tool_execution_status == "completed" else tool_output,
                action_status="completed" if tool_execution_status == "completed" else "failed",
                consent_status=consent_status,
                failure_reason=tool_output.get("error") if tool_execution_status == "failed" else None,
                audit_entries=audit_entries,
            )
        else:
            followup = assistant.build_action_followup(
                pending_action.tool_name,
                {},
                consent_status,
            )
            response_text = followup["response"]
            ui_payload = followup["ui_payload"]
            warnings.extend(followup["warnings"])
            suggested_actions.extend(followup["suggested_actions"])
            tool_execution_status = None
            audit_entries.append(
                {
                    "event": "grounded_action_denied",
                    "tool_name": pending_action.tool_name,
                }
            )
            audit.update_action(
                pending_action,
                tool_output=None,
                action_status="denied",
                consent_status=consent_status,
                failure_reason="user_denied",
                audit_entries=audit_entries,
            )
    else:
        action_request = assistant.detect_action_request(request.message)
        if action_request:
            risk_level = assistant.detect_risk(request.message, assistant.load_context_bundle(current_user.id))
            selected_tool = action_request["tool_name"]
            consent_status = "pending"
            requires_consent = True
            pending_action = audit.create_pending_action(
                user_id=current_user.id,
                session_id=session.id,
                tool_name=action_request["tool_name"],
                tool_input=action_request["tool_input"],
                audit_entries=[{"event": "grounded_action_pending", "tool_name": action_request["tool_name"]}],
            )
            response_text = f"I can help with that. Please confirm before I continue with {action_request['tool_name']}."
            ui_payload = [
                {
                    "type": "approval_prompt",
                    "action_id": pending_action.id,
                    "action": action_request["tool_name"],
                    "reason": action_request["reason"],
                    "tool_name": action_request["tool_name"],
                }
            ]
            suggested_actions.append("Approve the action if you want me to continue.")
        else:
            info = assistant.handle_information_message(request.message, current_user.id, session_id=session.id)
            response_text = info["response"]
            risk_level = info["risk_level"]
            ui_payload = info["ui_payload"]
            warnings.extend(info["warnings"])
            suggested_actions.extend(info["suggested_actions"])
            used_data.extend(info["used_data"])
            audit_entries.extend(info["audit_entries"])
            answer_intent = info.get("answer_intent")
            answer_topic = info.get("answer_topic")

            if risk_level == "crisis":
                crisis_row = CrisisFlag(
                    user_id=current_user.id,
                    session_id=session.id,
                    risk_level="crisis",
                    trigger_message=request.message,
                    detector_output={"audit": audit_entries},
                    escalation_message=response_text,
                )
                db.add(crisis_row)
                db.commit()

    assistant_message = ChatMessage(
        session_id=session.id,
        user_id=current_user.id,
        role="assistant",
        message=response_text,
        ui_payload={"items": ui_payload, "warnings": warnings, "used_data": used_data},
        selected_tool=selected_tool,
        consent_status=consent_status,
    )
    db.add(assistant_message)

    now = datetime.now(timezone.utc)
    session.last_message_at = now
    session.updated_at = now
    session.conversation_summary = response_text[:500]
    db.add(session)
    db.commit()

    return ChatMessageResponse(
        session_id=session.id,
        response=response_text,
        risk_level=risk_level,
        requires_consent=requires_consent,
        consent_status=consent_status,
        selected_tool=selected_tool,
        tool_execution_status=tool_execution_status,
        ui_payload=ui_payload,
        used_data=sorted(set(used_data)),
        warnings=warnings,
        suggested_actions=suggested_actions[:5],
        answer_intent=answer_intent,
        answer_topic=answer_topic,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/sessions", response_model=list[ChatSessionResponse])
def get_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_authenticated_user),
):
    rows = db.exec(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
    ).all()
    return rows


@router.get("/sessions/{session_id}/messages", response_model=list[ChatHistoryItem])
def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_authenticated_user),
):
    session = db.exec(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.exec(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    ).all()
    return [
        ChatHistoryItem(
            id=m.id,
            role=m.role,
            message=m.message,
            selected_tool=m.selected_tool,
            consent_status=m.consent_status,
            created_at=m.created_at,
        )
        for m in messages
    ]
