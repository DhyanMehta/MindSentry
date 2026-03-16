"""
Analysis result – fused emotion/wellness output per assessment.
Stores per-modality emotion labels and composite wellness scores.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    __table_args__ = (
        CheckConstraint("stress_score BETWEEN 0 AND 1", name="ck_ar2_stress"),
        CheckConstraint("mood_score BETWEEN 0 AND 1", name="ck_ar2_mood"),
        CheckConstraint("emotional_distress_score BETWEEN 0 AND 1", name="ck_ar2_distress"),
        CheckConstraint("confidence_score BETWEEN 0 AND 1", name="ck_ar2_conf"),
        CheckConstraint("wellness_flag IN (0,1)", name="ck_ar2_wflag"),
        CheckConstraint("crisis_flag IN (0,1)", name="ck_ar2_crisis"),
        CheckConstraint("support_level IN ('low','medium','high')", name="ck_ar2_support"),
        Index("idx_analysis_results_assessment_id", "assessment_id"),
        Index("idx_analysis_results_user_id", "user_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    # Per-modality emotion labels
    text_emotion = Column(String(32), nullable=True)
    audio_emotion = Column(String(32), nullable=True)
    video_emotion = Column(String(32), nullable=True)
    # Composite scores (0–1)
    stress_score = Column(Float, nullable=True)
    mood_score = Column(Float, nullable=True)
    emotional_distress_score = Column(Float, nullable=True)
    # Flags / levels
    wellness_flag = Column(Integer, default=0)          # 1 = needs attention
    support_level = Column(String(8), default="low")    # low / medium / high
    crisis_flag = Column(Integer, default=0)            # 1 = crisis detected
    confidence_score = Column(Float, nullable=True)
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="analysis_results")
