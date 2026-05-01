"""
Chat V2 API route — unified chatbot endpoint.

Uses ChatbotService for all message handling.
The legacy chat.py (v3 route) is kept for backward compatibility.
"""
from __future__ import annotations

import logging
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core.dependencies import get_db_session, get_authenticated_user
from app.models.user import User
from app.models.assistant_models import ChatSession, ChatMessage
from app.services.chatbot_service import ChatbotService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["assistant-chat-v2"])


# ── Request / Response schemas ──────────────────────────────────────────

class LocationPayload(BaseModel):
    latitude: float
    longitude: float


class ChatV2Request(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    source: Optional[str] = None
    session_id: Optional[str] = Field(default=None, max_length=128)
    location: Optional[LocationPayload] = None


class ChatV2Response(BaseModel):
    session_id: str
    response: str
    ui_payload: List[Dict[str, Any]] = []
    intent: Optional[str] = None
    distress_level: Optional[str] = None
    llm_provider: Optional[str] = None
    source: Optional[str] = None


class ChatV2SessionResponse(BaseModel):
    id: str
    title: str
    status: str
    conversation_summary: Optional[str] = None
    created_at: str
    updated_at: str


class ChatV2HistoryItem(BaseModel):
    id: str
    role: str
    content: str
    ui_payload: Optional[Dict[str, Any]] = None
    created_at: str


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/chat-v2", response_model=ChatV2Response)
def chat_v2(
    req: ChatV2Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_authenticated_user),
):
    """Send a message to the ArogyaAI chatbot."""
    service = ChatbotService(db)

    location_dict = None
    if req.location:
        location_dict = {
            "latitude": req.location.latitude,
            "longitude": req.location.longitude,
        }

    result = service.handle_message(
        user_id=current_user.id,
        message=req.message,
        session_id=req.session_id,
        location=location_dict,
        source=req.source,
    )

    return ChatV2Response(
        session_id=result.get("session_id", ""),
        response=result.get("response", ""),
        ui_payload=result.get("ui_payload", []),
        intent=result.get("intent"),
        distress_level=result.get("distress_level"),
        llm_provider=result.get("llm_provider"),
        source=result.get("source"),
    )


@router.get("/chat-v2/sessions")
def get_chat_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_authenticated_user),
):
    """List the user's recent chat sessions."""
    rows = db.exec(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
    ).all()

    return [
        ChatV2SessionResponse(
            id=r.id,
            title=r.title,
            status=r.status,
            conversation_summary=r.conversation_summary,
            created_at=str(r.created_at),
            updated_at=str(r.updated_at),
        )
        for r in rows
    ]


@router.get("/chat-v2/sessions/{session_id}/messages")
def get_session_messages(
    session_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_authenticated_user),
):
    """Get messages for a specific chat session."""
    session = db.exec(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    ).first()
    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.exec(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    ).all()

    return [
        ChatV2HistoryItem(
            id=m.id,
            role=m.role,
            content=m.message,
            ui_payload=m.ui_payload,
            created_at=str(m.created_at),
        )
        for m in messages
    ]
