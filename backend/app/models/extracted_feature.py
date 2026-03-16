"""Extracted features model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class ExtractedFeature(Base):
    __tablename__ = "extracted_features"
    __table_args__ = (
        CheckConstraint("modality_type IN ('text','audio','video','questionnaire','passive_behavior')", name="ck_ef_type"),
        Index("idx_extracted_features_assessment_id", "assessment_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    modality_type = Column(String(24))
    feature_namespace = Column(String(64), nullable=True)
    feature_json = Column(Text, nullable=True)        # JSON string
    feature_vector_ref = Column(String(256), nullable=True)
    extractor_name = Column(String(128), nullable=True)
    extractor_version = Column(String(32), nullable=True)
    computed_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="extracted_features")
