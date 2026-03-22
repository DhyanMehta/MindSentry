"""
Health clinic model — stores clinic information for finding nearby clinics.
"""
from datetime import datetime, timezone
from typing import Optional
from pydantic import field_validator
from sqlmodel import Field, SQLModel, Column, String, Float
import uuid


def _uuid() -> str:
    return uuid.uuid4().hex


class HealthClinic(SQLModel, table=True):
    """Represents a health clinic in the system."""
    
    __tablename__ = "health_clinics"

    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str = Field(sa_column=Column(String(256), nullable=False, index=True))
    address: str = Field(sa_column=Column(String(512), nullable=False))
    city: str = Field(sa_column=Column(String(128), nullable=False, index=True))
    state: Optional[str] = Field(default=None, sa_column=Column(String(128)))
    postal_code: Optional[str] = Field(default=None, sa_column=Column(String(12)))
    country: Optional[str] = Field(default=None, sa_column=Column(String(128)))
    latitude: float
    longitude: float
    phone: Optional[str] = Field(default=None, sa_column=Column(String(20)))
    email: Optional[str] = Field(default=None, sa_column=Column(String(128)))
    website: Optional[str] = Field(default=None, sa_column=Column(String(512)))
    clinic_type: str = Field(default="general", sa_column=Column(String(64), nullable=False))  # general, mental_health, emergency, specialist
    specialties: Optional[str] = Field(default=None, sa_column=Column(String(512)))  # Comma-separated
    has_emergency: bool = Field(default=False)
    has_ambulance: bool = Field(default=False)
    opening_hours: Optional[str] = Field(default=None, sa_column=Column(String(512)))  # JSON format
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    
    @field_validator("latitude", mode="after")
    @classmethod
    def validate_latitude(cls, v):
        """Validate latitude is between -90 and 90"""
        if v is not None and not (-90 <= v <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        return v
    
    @field_validator("longitude", mode="after")
    @classmethod
    def validate_longitude(cls, v):
        """Validate longitude is between -180 and 180"""
        if v is not None and not (-180 <= v <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        return v
    
    class Config:
        from_attributes = True
