"""
Pydantic schemas for request/response validation
"""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


# ─── User Schemas ─────────────────────────────────────────────

class UserCreate(BaseModel):
    """Schema for user registration"""
    name: str
    email: EmailStr
    password: str
    confirmPassword: str
    birthday: Optional[date] = None
    gender: Optional[str] = None
    timezone: Optional[str] = "UTC"

    @field_validator("confirmPassword")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    birthday: Optional[date] = None
    gender: Optional[str] = None
    timezone: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: str

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    id: int
    email: str
    name: str
    birthday: Optional[date] = None
    gender: Optional[str] = None
    timezone: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Token Schemas ────────────────────────────────────────────

class TokenResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None
