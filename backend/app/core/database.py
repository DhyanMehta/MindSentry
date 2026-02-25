"""
Database configuration and session management
"""
from sqlmodel import SQLModel, create_engine, Session
from app.core.config import get_settings

settings = get_settings()

# Create database engine
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},  # Needed for SQLite
    echo=settings.debug  # Log SQL queries in debug mode
)


def create_db_and_tables():
    """Create all database tables"""
    SQLModel.metadata.create_all(engine)


def get_session():
    """
    Dependency function to get database session
    
    Yields:
        Session: SQLModel database session
    """
    with Session(engine) as session:
        yield session
