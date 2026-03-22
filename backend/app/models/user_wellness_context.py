"""
User wellness context model — aggregated wellness data for RAG retrieval.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel, Column, String, Float
import uuid


def _uuid() -> str:
    return uuid.uuid4().hex


class UserWellnessContext(SQLModel, table=True):
    """
    Aggregated wellness data snapshot for each user.
    Used as context for the RAG pipeline to enrich AarogyaAI responses.
    """
    
    __tablename__ = "user_wellness_contexts"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True)
    
    # Overall wellness metrics
    overall_wellness_score: Optional[float] = Field(default=None)  # 0-100
    mental_health_score: Optional[float] = Field(default=None)  # 0-100
    emotional_stability_score: Optional[float] = Field(default=None)  # 0-100
    stress_level: Optional[float] = Field(default=None)  # 0-100
    anxiety_level: Optional[float] = Field(default=None)  # 0-100
    mood_score: Optional[float] = Field(default=None)  # 0-100
    sleep_quality_score: Optional[float] = Field(default=None)  # 0-100
    engagement_score: Optional[float] = Field(default=None)  # 0-100
    
    # Recent activity summary
    last_assessment_date: Optional[datetime] = Field(default=None)
    last_checkin_date: Optional[datetime] = Field(default=None)
    total_assessments: int = Field(default=0)
    total_checkins: int = Field(default=0)
    assessment_frequency: Optional[str] = Field(default=None, sa_column=Column(String(64)))  # daily, weekly, etc.
    
    # User profile context
    risk_level: str = Field(default="low", sa_column=Column(String(32), nullable=False))  # low, moderate, high, crisis
    has_crisis_flag: bool = Field(default=False)
    crisis_date: Optional[datetime] = Field(default=None)
    
    # Treatment context
    is_in_treatment: bool = Field(default=False)
    treatment_type: Optional[str] = Field(default=None, sa_column=Column(String(128)))  # therapy, medication, etc.
    clinician_assigned: bool = Field(default=False)
    
    # Aggregated context text for vector embedding
    context_text: str = Field(default="", sa_column=Column(String(5000), nullable=False))  # Plain text summary of wellness data
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_sync_at: Optional[datetime] = Field(default=None)  # When data was last synced from assessments
    
    class Config:
        from_attributes = True
