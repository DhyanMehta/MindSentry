from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.core.dependencies import get_db_session, get_authenticated_user
from app.models.user import User
from app.services.agent_v2.graph import ChatAgentV2Service

# OLD IMPLEMENTATION (DO NOT DELETE)
# The legacy chatbot route remains available in app/api/routes/chat.py.
# It is intentionally preserved for backward compatibility while this v2 agent runs alongside it.

router = APIRouter(prefix="", tags=["assistant-chat-v2"])


class ChatV2Request(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    source: Optional[str] = None
    session_id: Optional[str] = Field(default=None, max_length=128)


@router.post("/chat-v2")
def chat_v2(
    req: ChatV2Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_authenticated_user),
):
    service = ChatAgentV2Service(db)
    state = {
        "input": req.message,
        "user_id": current_user.id,
        "source": req.source,
        "session_id": req.session_id,
    }

    result = service.invoke(state)
    output = result.get("output")
    response_text = getattr(output, "content", None) or str(output)
    data_payload = None
    if isinstance(output, dict):
        response_text = str(output.get("response", ""))
        data_payload = output.get("data")

    return {
        "response": response_text,
        "data": data_payload,
        "intent_data": result.get("intent_data"),
        "context": result.get("context"),
        "source": req.source,
        "session_id": req.session_id,
        "llm_provider": result.get("llm_provider"),
    }
