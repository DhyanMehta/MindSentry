"""Safety flag model – records crisis / distress signals."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class SafetyFlag(Base):
    __tablename__ = "safety_flags"
    __table_args__ = (
        CheckConstraint("severity IN ('low','medium','high','critical')", name="ck_sf_severity"),
        CheckConstraint("resolved IN (0,1)", name="ck_sf_resolved"),
        Index("idx_safety_flags_assessment_id", "assessment_id"),
        Index("idx_safety_flags_user_id", "user_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    flag_type = Column(String(32))      # self_harm / crisis_language / severe_distress
    severity = Column(String(16), default="medium")
    reason = Column(Text, nullable=True)
    resolved = Column(Integer, default=0)
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="safety_flags")
