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

    # Database - locked to the project SQLite file
    database_url: str = Field(
        default="sqlite:///./mindsentry.db",
        description="Database URL (must point to mindsentry.db)"
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
    huggingface_timeout_seconds: float = Field(
        default=45.0,
        description="Timeout for hosted Hugging Face inference requests"
    )
    huggingface_max_retries: int = Field(
        default=1,
        description="Retry count for transient Hugging Face inference failures"
    )
    huggingface_text_model: str = Field(
        default="j-hartmann/emotion-english-distilroberta-base",
        description="Hosted Hugging Face model for text emotion inference"
    )
    huggingface_asr_model: str = Field(
        default="openai/whisper-large-v3-turbo",
        description="Hosted Hugging Face model for speech transcription"
    )
    huggingface_audio_emotion_model: str = Field(
        default="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
        description="Hosted Hugging Face model for audio emotion inference"
    )
    huggingface_face_emotion_model: str = Field(
        default="dima806/facial_emotions_image_detection",
        description="Hosted Hugging Face model for facial emotion inference"
    )

    # Groq API (LLM provider)
    groq_api_key: str = Field(
        default="",
        description="Groq API key for assistant reasoning"
    )
    groq_model: str = Field(
        default="llama-3.1-8b-instant",
        description="Groq model name for assistant inference"
    )
    assistant_llm_timeout_seconds: float = Field(
        default=12.0,
        description="Timeout for assistant LLM requests before falling back"
    )
    assistant_recent_message_limit: int = Field(
        default=4,
        description="How many recent chat turns to include in assistant prompts"
    )

    # LangGraph assistant settings
    assistant_api_version: str = Field(
        default="v3",
        description="Assistant API version label"
    )

    # Clinic search provider
    google_places_api_key: str = Field(
        default="",
        description="Google Places API key for clinic search"
    )

    # Twilio provider
    twilio_account_sid: str = Field(default="", description="Twilio Account SID")
    twilio_auth_token: str = Field(default="", description="Twilio auth token")
    twilio_from_number: str = Field(default="", description="Twilio source phone number")

    # Reminder provider
    calendar_provider_api_key: str = Field(
        default="",
        description="Calendar/reminder provider API key"
    )

    # Google Maps API (optional for general maps features)
    google_maps_api_key: str = Field(
        default="",
        description="Google Maps API key (optional)"
    )

    @field_validator("database_url", mode="after")
    @classmethod
    def validate_database_url(cls, v, info):
        """Enforce single-database policy: use mindsentry.db only."""
        if not v or "sqlite" not in v or "mindsentry.db" not in v:
            raise ValueError(
                "Database is locked to sqlite:///./mindsentry.db. "
                "Set DATABASE_URL=sqlite:///./mindsentry.db"
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
