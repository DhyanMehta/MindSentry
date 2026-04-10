from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AssistantApprovalRequest(BaseModel):
    session_id: Optional[str] = None
    action_id: Optional[str] = None
    approved: bool
    tool_name: Optional[str] = None


class AssistantApprovalResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    action_id: Optional[str] = None


class AssistantActionLogItem(BaseModel):
    id: str
    session_id: Optional[str] = None
    tool_name: str
    action_status: str
    consent_status: str
    failure_reason: Optional[str] = None
    created_at: datetime


class AssistantActionStatusResponse(BaseModel):
    count: int
    actions: list[AssistantActionLogItem]
