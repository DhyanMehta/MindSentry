"""Inference run – records one ML model prediction per assessment."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class InferenceRun(Base):
    __tablename__ = "inference_runs"
    __table_args__ = (
        CheckConstraint("confidence_score BETWEEN 0 AND 1", name="ck_ir_conf"),
        CheckConstraint("run_status IN ('pending','completed','failed')", name="ck_ir_status"),
        Index("idx_inference_runs_assessment_id", "assessment_id"),
        Index("idx_inference_runs_model_id", "model_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    model_id = Column(String(32), ForeignKey("model_registry.id"), nullable=True)
    input_snapshot_hash = Column(String(64), nullable=True)
    output_json = Column(Text, nullable=True)          # JSON string
    confidence_score = Column(Float, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    run_status = Column(String(16), default="pending")
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="inference_runs")
