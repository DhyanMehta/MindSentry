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

db_url = make_url(settings.database_url)
engine_kwargs = {
    "echo": settings.debug,
    "pool_pre_ping": True,
}

if db_url.drivername.startswith("sqlite"):
    engine_kwargs["connect_args"] = {
        "check_same_thread": False,
        "timeout": 10,
    }
    # Use autocommit mode (isolation_level=None) to prevent implicit transactions on read-only queries
    # This eliminates unnecessary ROLLBACK operations on SELECT statements
    engine_kwargs["isolation_level"] = None

logger.info(f"Initializing database: {settings.database_url}")
engine = create_engine(settings.database_url, **engine_kwargs)
Base = declarative_base()


def create_db_and_tables():
    """Create all database tables on startup (auth + new non-auth tables)."""
    try:
        logger.info("Creating database tables...")
        SQLModel.metadata.create_all(engine)
        logger.info("? SQLModel tables created")
        Base.metadata.create_all(engine)
        logger.info("? SQLAlchemy tables created")

        with Session(engine) as session:
            with session.begin():
                from app.services.questionnaire_catalog_service import ensure_daily_checkin_template
                ensure_daily_checkin_template(session)
        logger.info("? Assistant schema compatibility check complete")
    except Exception as e:
        logger.error(f"? Error creating database tables: {str(e)}", exc_info=True)
        raise


def get_session():
    """Get database session with proper transaction handling.
    
    Uses autocommit mode (isolation_level=None) for SQLite to prevent implicit transactions.
    Each operation is auto-committed unless explicitly wrapped with session.begin().
    Write operations should use session.begin() to ensure atomicity.
    """
    with Session(engine) as session:
        yield session
