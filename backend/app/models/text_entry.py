"""Text entry model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class TextEntry(Base):
    __tablename__ = "text_entries"
    __table_args__ = (
        Index("idx_text_entries_assessment_id", "assessment_id"),
        Index("idx_text_entries_user_id", "user_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    raw_text = Column(Text, nullable=True)
    language = Column(String(8), default="en")
    word_count = Column(Integer, nullable=True)
    sentiment_summary = Column(String(32), nullable=True)
    embedding_vector_ref = Column(String(256), nullable=True)
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="text_entries")
