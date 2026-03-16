"""User profile – extends the existing users table with mental-health context info."""
import uuid
from sqlalchemy import Column, String, Integer, CheckConstraint, Index
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class UserProfile(Base):
    __tablename__ = "user_profiles"
    __table_args__ = (
        CheckConstraint("gender IN ('male','female','other')", name="ck_up_gender"),
        CheckConstraint("onboarding_status IN ('pending','completed')", name="ck_up_onboard"),
        Index("idx_user_profiles_user_id", "user_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    user_id = Column(Integer, nullable=False, unique=True)
    full_name = Column(String(128), nullable=True)
    dob = Column(String(16), nullable=True)
    gender = Column(String(8), nullable=True)
    timezone = Column(String(64), nullable=True)
    preferred_language = Column(String(8), nullable=True)
    country = Column(String(64), nullable=True)
    onboarding_status = Column(String(16), default="pending")
    baseline_established_at = Column(String(32), nullable=True)
