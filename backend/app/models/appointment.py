"""
Appointment model — stores booked appointments at clinics.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel, Column, String
import uuid


def _uuid() -> str:
    return uuid.uuid4().hex


class Appointment(SQLModel, table=True):
    """Represents a booked appointment at a clinic."""

    __tablename__ = "appointments"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    clinic_id: str = Field(foreign_key="health_clinics.id")
    appointment_date: datetime
    appointment_type: str = Field(default="consultation", sa_column=Column(String(64), nullable=False))
    reason: Optional[str] = Field(default=None, sa_column=Column(String(512)))
    notes: Optional[str] = Field(default=None, sa_column=Column(String(1000)))
    status: str = Field(default="confirmed", sa_column=Column(String(32), nullable=False, index=True))
    booking_agent_task_id: Optional[str] = Field(foreign_key="agent_tasks.id", default=None)
    confirmation_number: Optional[str] = Field(default=None, sa_column=Column(String(64)))
    reminder_sent: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    class Config:
        from_attributes = True
