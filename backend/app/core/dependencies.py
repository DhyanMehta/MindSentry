"""Shared FastAPI dependencies for assistant routes."""
from __future__ import annotations

from typing import Generator

from fastapi import Depends
from sqlmodel import Session

from app.api.auth import get_current_user
from app.core.database import get_session
from app.models.user import User


def get_db_session() -> Generator[Session, None, None]:
    yield from get_session()


def get_authenticated_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user
