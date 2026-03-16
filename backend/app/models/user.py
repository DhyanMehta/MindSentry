"""
User database model — matches the users table schema.
"""
from datetime import datetime, date
from typing import Optional
from sqlmodel import Field, SQLModel, Column, JSON


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(nullable=False)
    email: str = Field(unique=True, index=True, nullable=False)
    hashed_password: str = Field(nullable=False)
    birthday: Optional[date] = Field(default=None)
    gender: Optional[str] = Field(default=None)
    timezone: str = Field(default="UTC")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = Field(default=None)
    deleted_at: Optional[datetime] = Field(default=None)

    class Config:
        from_attributes = True
