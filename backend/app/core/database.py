"""
Database configuration and session management.
- SQLModel engine is kept for the existing auth/user tables (User model).
- SQLAlchemy declarative Base is used for all new non-auth tables.
- create_db_and_tables() initialises both metadata sets on startup.
"""
import logging
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Shared engine (used by both auth and new models).
# SQLite requires check_same_thread=False; PostgreSQL and others do not.
db_url = make_url(settings.database_url)
engine_kwargs = {
    "echo": settings.debug,
    "pool_pre_ping": True,
}

if db_url.drivername.startswith("sqlite"):
    engine_kwargs["connect_args"] = {
        "check_same_thread": False,
        "timeout": 10,  # 10 second timeout for SQLite
    }

logger.info(f"Initializing database: {settings.database_url}")
engine = create_engine(settings.database_url, **engine_kwargs)

# Base for all new non-auth SQLAlchemy models
Base = declarative_base()


def create_db_and_tables():
    """Create all database tables on startup (auth + new non-auth tables)."""
    try:
        logger.info("Creating database tables...")
        # Auth tables managed by SQLModel
        SQLModel.metadata.create_all(engine)
        logger.info("✅ SQLModel tables created")
        
        # New non-auth tables managed by SQLAlchemy declarative Base
        Base.metadata.create_all(engine)
        logger.info("✅ SQLAlchemy tables created")
        
    except Exception as e:
        logger.error(f"❌ Error creating database tables: {str(e)}", exc_info=True)
        raise


def get_session():
    """
    FastAPI dependency – yields a SQLModel Session (works for all tables
    since both share the same engine).
    """
    with Session(engine) as session:
        yield session
