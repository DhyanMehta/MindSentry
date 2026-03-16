"""Model registry – tracks ML models used for inference."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, CheckConstraint, Index
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class ModelRegistry(Base):
    __tablename__ = "model_registry"
    __table_args__ = (
        CheckConstraint("active IN (0,1)", name="ck_mr_active"),
        Index("idx_model_registry_active", "active"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    model_name = Column(String(256))
    model_family = Column(String(64), nullable=True)
    modality_scope = Column(String(24), nullable=True)
    version = Column(String(32), nullable=True)
    framework = Column(String(64), nullable=True)
    source = Column(String(256), nullable=True)
    active = Column(Integer, default=1)
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())
