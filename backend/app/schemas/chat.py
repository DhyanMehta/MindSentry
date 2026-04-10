"""Schemas for chat API contracts."""
from __future__ import annotations

from datetime import datetime
from typing import Optional, Any, Dict, List, Literal

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    session_id: Optional[str] = None
    approval: Optional["ApprovalDecision"] = None
    source: Optional[str] = Field(default=None, max_length=64)


class ApprovalDecision(BaseModel):
    approved: bool
    action_id: str


class ToolExecutionStatusPayload(BaseModel):
    type: Literal["tool_status"] = "tool_status"
    tool_name: str
    status: Literal["pending", "awaiting_approval", "executing", "completed", "failed"]
    details: Optional[Dict[str, Any]] = None


class ClinicCardPayload(BaseModel):
    type: Literal["clinic_cards"] = "clinic_cards"
    clinics: List[Dict[str, Any]]


class ApprovalPromptPayload(BaseModel):
    type: Literal["approval_prompt"] = "approval_prompt"
    action_id: str
    action: str
    reason: str
    tool_name: str


class ReminderPromptPayload(BaseModel):
    type: Literal["reminder_prompt"] = "reminder_prompt"
    title: str
    suggested_datetime: Optional[str] = None
    context: Optional[str] = None


class SafetyEscalationPayload(BaseModel):
    type: Literal["safety_escalation"] = "safety_escalation"
    risk_level: Literal["low", "medium", "high", "crisis"]
    crisis_resources: List[str]
    message: str


class ChatMessageResponse(BaseModel):
    session_id: str
    response: str
    risk_level: Literal["low", "medium", "high", "crisis"]
    requires_consent: bool = False
    consent_status: Literal["not_required", "pending", "approved", "denied"] = "not_required"
    selected_tool: Optional[str] = None
    tool_execution_status: Optional[str] = None
    ui_payload: List[Dict[str, Any]] = []
    used_data: List[str] = []
    warnings: List[str] = []
    suggested_actions: List[str] = []
    answer_intent: Optional[str] = None
    answer_topic: Optional[str] = None
    timestamp: datetime


class ChatHistoryItem(BaseModel):
    id: str
    role: str
    message: str
    selected_tool: Optional[str] = None
    consent_status: Optional[str] = None
    created_at: datetime


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    status: str
    created_at: datetime
    updated_at: datetime


ChatMessageRequest.model_rebuild()
