"""
Assistant persistence models for the LangGraph-based MindSentry assistant.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from sqlmodel import SQLModel, Field, Column, String, Text
from sqlalchemy import JSON as SAJSON


def _uuid() -> str:
    return uuid.uuid4().hex


class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_sessions"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    title: str = Field(default="MindSentry Assistant Session", sa_column=Column(String(256), nullable=False))
    last_message_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    is_active: bool = Field(default=True)
    wellness_context_used: Optional[bool] = Field(default=None)
    context_summary: Optional[str] = Field(default=None, sa_column=Column(String(1000)))
    conversation_summary: Optional[str] = Field(default=None, sa_column=Column(String(2000)))
    status: str = Field(default="active", sa_column=Column(String(32), nullable=False, index=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: str = Field(default_factory=_uuid, primary_key=True)
    session_id: str = Field(foreign_key="chat_sessions.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    role: str = Field(sa_column=Column(String(16), nullable=False))
    message: str = Field(sa_column=Column("content", Text, nullable=False))
    message_type: Optional[str] = Field(default=None, sa_column=Column(String(32)))
    embedded_at: Optional[datetime] = Field(default=None)
    wellness_context_used: Optional[str] = Field(default=None, sa_column=Column(String(1000)))
    agent_action: Optional[str] = Field(default=None, sa_column=Column(String(256)))
    ui_payload: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(SAJSON))
    selected_tool: Optional[str] = Field(default=None, sa_column=Column(String(128)))
    consent_status: Optional[str] = Field(default=None, sa_column=Column(String(32)))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class AssistantToolAction(SQLModel, table=True):
    __tablename__ = "assistant_tool_actions"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    session_id: str = Field(foreign_key="chat_sessions.id", index=True)
    tool_name: str = Field(sa_column=Column(String(128), nullable=False, index=True))
    tool_input: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(SAJSON))
    tool_output: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(SAJSON))
    action_status: str = Field(default="pending", sa_column=Column(String(32), nullable=False, index=True))
    requires_consent: bool = Field(default=False)
    consent_status: str = Field(default="not_required", sa_column=Column(String(32), nullable=False, index=True))
    failure_reason: Optional[str] = Field(default=None, sa_column=Column(String(1024)))
    audit_entries: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClinicSearchLog(SQLModel, table=True):
    __tablename__ = "clinic_search_logs"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    session_id: str = Field(foreign_key="chat_sessions.id", index=True)
    latitude: float
    longitude: float
    radius_km: float = 10.0
    specialty: Optional[str] = Field(default=None, sa_column=Column(String(128)))
    result_count: int = 0
    provider: str = Field(default="google_places", sa_column=Column(String(64), nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class ClinicResultsCache(SQLModel, table=True):
    __tablename__ = "clinic_results_cache"

    id: str = Field(default_factory=_uuid, primary_key=True)
    cache_key: str = Field(sa_column=Column(String(256), unique=True, nullable=False, index=True))
    provider: str = Field(default="google_places", sa_column=Column(String(64), nullable=False))
    raw_result: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(SAJSON, nullable=False))
    expires_at: datetime = Field(index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class AppointmentRequest(SQLModel, table=True):
    __tablename__ = "appointment_requests"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    session_id: Optional[str] = Field(default=None, foreign_key="chat_sessions.id", index=True)
    clinic_id: str = Field(sa_column=Column(String(128), nullable=False, index=True))
    preferred_date: str = Field(sa_column=Column(String(32), nullable=False))
    preferred_time: str = Field(sa_column=Column(String(32), nullable=False))
    notes: Optional[str] = Field(default=None, sa_column=Column(String(1024)))
    status: str = Field(default="requested", sa_column=Column(String(32), nullable=False, index=True))
    consent_status: str = Field(default="approved", sa_column=Column(String(32), nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class AppointmentAction(SQLModel, table=True):
    __tablename__ = "appointment_actions"

    id: str = Field(default_factory=_uuid, primary_key=True)
    appointment_request_id: str = Field(foreign_key="appointment_requests.id", index=True)
    action_type: str = Field(sa_column=Column(String(64), nullable=False))
    status: str = Field(default="completed", sa_column=Column(String(32), nullable=False))
    metadata_json: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class ReminderAction(SQLModel, table=True):
    __tablename__ = "reminder_actions"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    session_id: Optional[str] = Field(default=None, foreign_key="chat_sessions.id", index=True)
    title: str = Field(sa_column=Column(String(256), nullable=False))
    remind_at: str = Field(sa_column=Column(String(64), nullable=False, index=True))
    context: Optional[str] = Field(default=None, sa_column=Column(String(1024)))
    provider_reference: Optional[str] = Field(default=None, sa_column=Column(String(256)))
    status: str = Field(default="created", sa_column=Column(String(32), nullable=False))
    consent_status: str = Field(default="approved", sa_column=Column(String(32), nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class CallAction(SQLModel, table=True):
    __tablename__ = "call_actions"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    session_id: Optional[str] = Field(default=None, foreign_key="chat_sessions.id", index=True)
    clinic_id: str = Field(sa_column=Column(String(128), nullable=False, index=True))
    reason: Optional[str] = Field(default=None, sa_column=Column(String(512)))
    provider_reference: Optional[str] = Field(default=None, sa_column=Column(String(256)))
    status: str = Field(default="requested", sa_column=Column(String(32), nullable=False, index=True))
    consent_status: str = Field(default="approved", sa_column=Column(String(32), nullable=False))
    failure_reason: Optional[str] = Field(default=None, sa_column=Column(String(1024)))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class UserAssistantPreference(SQLModel, table=True):
    __tablename__ = "user_assistant_preferences"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, unique=True)
    preferred_radius_km: float = 10.0
    preferred_specialty: Optional[str] = Field(default=None, sa_column=Column(String(128)))
    timezone: str = Field(default="UTC", sa_column=Column(String(64), nullable=False))
    allow_proactive_followups: bool = Field(default=True)
    notification_channel: str = Field(default="in_app", sa_column=Column(String(32), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class CrisisFlag(SQLModel, table=True):
    __tablename__ = "crisis_flags"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    session_id: Optional[str] = Field(default=None, foreign_key="chat_sessions.id", index=True)
    risk_level: str = Field(sa_column=Column(String(32), nullable=False, index=True))
    trigger_message: str = Field(sa_column=Column(Text, nullable=False))
    detector_output: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(SAJSON))
    escalation_message: Optional[str] = Field(default=None, sa_column=Column(String(2000)))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class WellnessContextSnapshot(SQLModel, table=True):
    __tablename__ = "wellness_context_snapshots"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    session_id: Optional[str] = Field(default=None, foreign_key="chat_sessions.id", index=True)
    wellness_score: Optional[float] = Field(default=None)
    wellness_trend: Optional[str] = Field(default=None, sa_column=Column(String(64)))
    score_context_json: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(SAJSON))
    source: str = Field(default="history", sa_column=Column(String(32), nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


def serialize_json(value: Optional[Dict[str, Any]]) -> str:
    if value is None:
        return "{}"
    return json.dumps(value)
