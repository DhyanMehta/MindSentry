"""
Chat session model — stores conversation sessions for AarogyaAI.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel, Column, String
import uuid


def _uuid() -> str:
    return uuid.uuid4().hex


class ChatSession(SQLModel, table=True):
    """Represents a conversation session with AarogyaAI."""
    
    __tablename__ = "chat_sessions"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False)
    title: str = Field(default="AarogyaAI Chat", sa_column=Column(String(256), nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_message_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    is_active: bool = Field(default=True)
    context_summary: Optional[str] = Field(default=None, sa_column=Column(String(1000)))
    wellness_context_used: bool = Field(default=False)
    
    class Config:
        from_attributes = True
