"""Passive behaviour metrics model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class PassiveBehaviorMetric(Base):
    __tablename__ = "passive_behavior_metrics"
    __table_args__ = (
        CheckConstraint("sleep_quality BETWEEN 0 AND 1", name="ck_pbm_quality"),
        Index("idx_passive_behavior_metrics_user_id", "user_id"),
        Index("idx_passive_behavior_metrics_assessment_id", "assessment_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    user_id = Column(Integer, nullable=False)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=True)
    metric_date = Column(String(16), default=lambda: datetime.utcnow().date().isoformat())
    sleep_hours = Column(Float, nullable=True)
    sleep_quality = Column(Float, nullable=True)
    steps_count = Column(Integer, nullable=True)
    sedentary_minutes = Column(Integer, nullable=True)
    app_opens = Column(Integer, nullable=True)
    journaling_frequency = Column(Integer, nullable=True)
    response_latency_ms = Column(Integer, nullable=True)
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="passive_metrics")
