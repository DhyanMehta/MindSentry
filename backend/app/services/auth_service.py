"""
Authentication service layer
"""
from typing import Optional
from sqlmodel import Session, select
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password, verify_password


def get_user_by_email(session: Session, email: str) -> Optional[User]:
    """
    Get user by email
    
    Args:
        session: Database session
        email: User email address
        
    Returns:
        User if found, None otherwise
    """
    statement = select(User).where(User.email == email)
    user = session.exec(statement).first()
    return user


def create_user(session: Session, user_data: UserCreate) -> User:
    """
    Create a new user
    
    Args:
        session: Database session
        user_data: User creation data
        
    Returns:
        Created user instance
    """
    hashed_password = hash_password(user_data.password)
    db_user = User(
        email=user_data.email,
        hashed_password=hashed_password
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def authenticate_user(session: Session, email: str, password: str) -> Optional[User]:
    """
    Authenticate a user
    
    Args:
        session: Database session
        email: User email
        password: Plain text password
        
    Returns:
        User if authentication successful, None otherwise
    """
    user = get_user_by_email(session, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
