"""
Chat message model — stores individual messages in a chat session.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel, Column, String
import uuid


def _uuid() -> str:
    return uuid.uuid4().hex


class ChatMessage(SQLModel, table=True):
    """Represents a single message in a chat session."""
    
    __tablename__ = "chat_messages"

    id: str = Field(default_factory=_uuid, primary_key=True)
    session_id: str = Field(foreign_key="chat_sessions.id")
    user_id: int = Field(foreign_key="users.id")
    role: str = Field(sa_column=Column(String(16), nullable=False))
    content: str = Field(sa_column=Column(String(5000), nullable=False))
    message_type: Optional[str] = Field(default="text", sa_column=Column(String(32)))  # text, action, system
    embedded_at: Optional[datetime] = Field(default=None)  # When message was embedded in vector store
    wellness_context_used: Optional[str] = Field(default=None, sa_column=Column(String(1000)))  # Which context docs were used
    agent_action: Optional[str] = Field(default=None, sa_column=Column(String(256)))  # If this triggered an agent action
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        from_attributes = True
