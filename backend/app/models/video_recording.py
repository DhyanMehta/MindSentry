"""Video recording model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class VideoRecording(Base):
    __tablename__ = "video_recordings"
    __table_args__ = (
        CheckConstraint("face_detected IN (0,1)", name="ck_vr_face"),
        CheckConstraint("pose_detected IN (0,1)", name="ck_vr_pose"),
        CheckConstraint("lighting_score BETWEEN 0 AND 1", name="ck_vr_light"),
        CheckConstraint("processing_status IN ('pending','completed','failed')", name="ck_vr_proc"),
        Index("idx_video_recordings_assessment_id", "assessment_id"),
        Index("idx_video_recordings_user_id", "user_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    storage_key = Column(String(512), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    fps = Column(Integer, nullable=True)
    resolution_width = Column(Integer, nullable=True)
    resolution_height = Column(Integer, nullable=True)
    face_detected = Column(Integer, default=0)
    pose_detected = Column(Integer, default=0)
    lighting_score = Column(Float, nullable=True)
    processing_status = Column(String(16), default="pending")
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="video_recordings")
