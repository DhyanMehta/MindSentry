"""
Application configuration settings
"""
from pydantic_settings import BaseSettings
from pydantic import ConfigDict, Field, field_validator
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings"""

    # Application
    app_name: str = "MindSentry API"
    debug: bool = False
    environment: str = Field(
        default="development", 
        description="Deployment environment: development, staging, production"
    )

    # Database - Load from environment, with sensible defaults for development
    database_url: str = Field(
        default="sqlite:///./dev.db",
        description="Database URL. Format: postgresql+psycopg://user:password@host:port/dbname"
    )

    # JWT Settings - Secret key MUST come from environment in production
    secret_key: str = Field(
        default=None,
        description="Secret key for JWT. MUST be set via SECRET_KEY environment variable in production (minimum 32 characters)"
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200  # 30 days

    # Hugging Face Inference API (text emotion)
    huggingface_api_key: str = Field(
        default="",
        description="Hugging Face API key for text emotion analysis"
    )

    # Groq API (LLM for agent reasoning and RAG)
    groq_api_key: str = Field(
        default="",
        description="Groq API key for LLM-powered features"
    )
    groq_model: str = Field(
        default="llama-3.1-8b-instant",
        description="Groq model name for chatbot/agent inference"
    )

    # Google Maps API (optional for advanced location features)
    google_maps_api_key: str = Field(
        default="",
        description="Google Maps API key (optional)"
    )

    @field_validator("database_url", mode="after")
    @classmethod
    def validate_database_url(cls, v, info):
        """Validate database URL based on environment"""
        # For production, reject in-memory or local sqlite databases
        if info.data.get("environment") == "production" or not info.data.get("debug"):
            if not v or "memory" in v or "sqlite" in v:
                raise ValueError(
                    "Production database must be PostgreSQL. Set DATABASE_URL environment variable. "
                    "Format: postgresql+psycopg://user:password@host:port/dbname"
                )
        return v

    @field_validator("secret_key", mode="after")
    @classmethod
    def validate_secret_key(cls, v, info):
        """Validate secret key for production environments"""
        if info.data.get("environment") == "production":
            if not v:
                raise ValueError(
                    "SECRET_KEY environment variable is required in production. "
                    "Set it to a random 32+ character string."
                )
            if len(v) < 32:
                raise ValueError(
                    f"SECRET_KEY must be at least 32 characters long (got {len(v)}). "
                    "Generate a new key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
                )
        elif not v:  # Development: auto-generate if not set
            v = "dev-key-" + os.urandom(16).hex()
        return v

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"  # Allow extra fields from .env without raising an error
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
