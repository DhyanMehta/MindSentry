"""Consent model – records user consent grants and revocations."""
import uuid
from sqlalchemy import Column, String, Integer, CheckConstraint, Index
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class Consent(Base):
    __tablename__ = "consents"
    __table_args__ = (
        CheckConstraint("granted IN (0,1)", name="ck_con_granted"),
        Index("idx_consents_user_id", "user_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    user_id = Column(Integer, nullable=False)
    consent_type = Column(String(64))
    granted = Column(Integer, default=1)
    version = Column(String(16), nullable=True)
    granted_at = Column(String(32), nullable=True)
    revoked_at = Column(String(32), nullable=True)
    source_ip = Column(String(64), nullable=True)
    device_info = Column(String(256), nullable=True)
