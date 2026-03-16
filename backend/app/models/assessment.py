"""
Assessment-related SQLAlchemy models.

Covers:
  - assessments
  - assessment_modalities
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class Assessment(Base):
    __tablename__ = "assessments"
    __table_args__ = (
        CheckConstraint("session_type IN ('checkin','scheduled_assessment','crisis_screen','clinician_review')", name="ck_assessments_session_type"),
        CheckConstraint("status IN ('pending','completed','failed')", name="ck_assessments_status"),
        CheckConstraint("overall_confidence BETWEEN 0 AND 1", name="ck_assessments_confidence"),
        Index("idx_assessments_user_id", "user_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    user_id = Column(Integer, nullable=False)
    session_type = Column(String(32))
    started_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())
    completed_at = Column(String(32), nullable=True)
    status = Column(String(16), default="pending")
    overall_confidence = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    # relationships
    modalities = relationship("AssessmentModality", back_populates="assessment", cascade="all, delete-orphan")
    text_entries = relationship("TextEntry", back_populates="assessment", cascade="all, delete-orphan")
    audio_recordings = relationship("AudioRecording", back_populates="assessment", cascade="all, delete-orphan")
    video_recordings = relationship("VideoRecording", back_populates="assessment", cascade="all, delete-orphan")
    questionnaire_responses = relationship("QuestionnaireResponse", back_populates="assessment", cascade="all, delete-orphan")
    passive_metrics = relationship("PassiveBehaviorMetric", back_populates="assessment", cascade="all, delete-orphan")
    extracted_features = relationship("ExtractedFeature", back_populates="assessment", cascade="all, delete-orphan")
    inference_runs = relationship("InferenceRun", back_populates="assessment", cascade="all, delete-orphan")
    risk_scores = relationship("RiskScore", back_populates="assessment", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="assessment", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="assessment", cascade="all, delete-orphan")
    safety_flags = relationship("SafetyFlag", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentModality(Base):
    __tablename__ = "assessment_modalities"
    __table_args__ = (
        CheckConstraint("modality_type IN ('text','audio','video','questionnaire','passive_behavior')", name="ck_am_type"),
        CheckConstraint("availability_status IN ('available','unavailable')", name="ck_am_avail"),
        CheckConstraint("quality_score BETWEEN 0 AND 1", name="ck_am_quality"),
        CheckConstraint("processing_status IN ('pending','completed','failed')", name="ck_am_proc"),
        Index("idx_assessment_modalities_assessment_id", "assessment_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    modality_type = Column(String(24))
    availability_status = Column(String(16), default="available")
    quality_score = Column(Float, nullable=True)
    processing_status = Column(String(16), default="pending")

    assessment = relationship("Assessment", back_populates="modalities")
