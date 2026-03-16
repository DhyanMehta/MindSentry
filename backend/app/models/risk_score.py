"""Risk scores – final fused risk output per assessment."""
import uuid
from sqlalchemy import Column, String, Float, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class RiskScore(Base):
    __tablename__ = "risk_scores"
    __table_args__ = (
        CheckConstraint("stress_score BETWEEN 0 AND 1", name="ck_rs_stress"),
        CheckConstraint("low_mood_score BETWEEN 0 AND 1", name="ck_rs_mood"),
        CheckConstraint("burnout_score BETWEEN 0 AND 1", name="ck_rs_burnout"),
        CheckConstraint("social_withdrawal_score BETWEEN 0 AND 1", name="ck_rs_social"),
        CheckConstraint("crisis_score BETWEEN 0 AND 1", name="ck_rs_crisis"),
        CheckConstraint("final_risk_level IN ('low','medium','high')", name="ck_rs_level"),
        Index("idx_risk_scores_assessment_id", "assessment_id"),
        Index("idx_risk_scores_user_id", "user_id"),
        Index("idx_risk_scores_final_risk_level", "final_risk_level"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    stress_score = Column(Float, nullable=True)
    low_mood_score = Column(Float, nullable=True)
    burnout_score = Column(Float, nullable=True)
    social_withdrawal_score = Column(Float, nullable=True)
    crisis_score = Column(Float, nullable=True)
    final_risk_level = Column(String(8), default="low")

    assessment = relationship("Assessment", back_populates="risk_scores")
