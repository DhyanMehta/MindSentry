"""Recommendation model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        CheckConstraint("priority IN ('low','medium','high')", name="ck_rec_priority"),
        Index("idx_recommendations_assessment_id", "assessment_id"),
        Index("idx_recommendations_user_id", "user_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    title = Column(String(128))
    description = Column(Text)
    recommendation_type = Column(String(32))   # breathing / journaling / rest / social / professional
    priority = Column(String(8), default="medium")
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="recommendations")
