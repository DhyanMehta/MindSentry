"""
Agent task model — represents autonomous tasks executed by the agent system.
"""
import json
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel, Column, String, Text
import uuid


def _uuid() -> str:
    return uuid.uuid4().hex


class AgentTask(SQLModel, table=True):
    """Represents a task executed by the agentic AI system."""
    
    __tablename__ = "agent_tasks"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False)
    chat_session_id: Optional[str] = Field(foreign_key="chat_sessions.id", default=None)
    task_type: str = Field(sa_column=Column(String(64), nullable=False))
    status: str = Field(default="pending", sa_column=Column(String(32), nullable=False))
    input_params: str = Field(default="{}", sa_column=Column(Text))
    result: Optional[str] = Field(default=None, sa_column=Column(Text))
    error_message: Optional[str] = Field(default=None, sa_column=Column(String(1000)))
    tool_calls: Optional[str] = Field(default=None, sa_column=Column(Text))
    reasoning: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)
    
    def get_input_params(self):
        """Parse input parameters JSON."""
        try:
            return json.loads(self.input_params) if self.input_params else {}
        except json.JSONDecodeError:
            return {}
    
    def get_result(self):
        """Parse result JSON."""
        try:
            return json.loads(self.result) if self.result else None
        except json.JSONDecodeError:
            return None
    
    class Config:
        from_attributes = True
