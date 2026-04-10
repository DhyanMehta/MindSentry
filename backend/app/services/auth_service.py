"""
Authentication service layer
"""
from datetime import datetime
from typing import Optional
from sqlmodel import Session, select
from sqlalchemy import func
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password, verify_password


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(session: Session, email: str) -> Optional[User]:
    normalized_email = normalize_email(email)
    statement = select(User).where(func.lower(User.email) == normalized_email, User.deleted_at.is_(None))  # type: ignore
    return session.exec(statement).first()


def get_user_by_id(session: Session, user_id: int) -> Optional[User]:
    statement = select(User).where(User.id == user_id, User.deleted_at.is_(None))  # type: ignore
    return session.exec(statement).first()


def create_user(session: Session, user_data: UserCreate) -> User:
    hashed = hash_password(user_data.password)
    db_user = User(
        name=user_data.name.strip(),
        email=normalize_email(user_data.email),
        hashed_password=hashed,
        birthday=user_data.birthday,
        gender=user_data.gender,
        timezone=user_data.timezone or "UTC",
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def authenticate_user(session: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(session, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    # Update last_login
    user.last_login = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def update_user(session: Session, user: User, updates: dict) -> User:
    for key, value in updates.items():
        if value is not None:
            if key == "name" and isinstance(value, str):
                value = value.strip()
            if key == "email" and isinstance(value, str):
                value = normalize_email(value)
            setattr(user, key, value)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def soft_delete_user(session: Session, user: User) -> User:
    user.deleted_at = datetime.utcnow()
    user.is_active = False
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
