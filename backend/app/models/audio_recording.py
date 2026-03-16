"""Audio recording model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class AudioRecording(Base):
    __tablename__ = "audio_recordings"
    __table_args__ = (
        CheckConstraint("diarization_available IN (0,1)", name="ck_ar_diar"),
        CheckConstraint("snr_score BETWEEN 0 AND 1", name="ck_ar_snr"),
        CheckConstraint("processing_status IN ('pending','completed','failed')", name="ck_ar_proc"),
        Index("idx_audio_recordings_assessment_id", "assessment_id"),
        Index("idx_audio_recordings_user_id", "user_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    storage_key = Column(String(512), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    sample_rate = Column(Integer, nullable=True)
    channels = Column(Integer, nullable=True)
    transcript_text = Column(Text, nullable=True)
    transcript_language = Column(String(8), nullable=True)
    diarization_available = Column(Integer, default=0)
    snr_score = Column(Float, nullable=True)
    processing_status = Column(String(16), default="pending")
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="audio_recordings")
