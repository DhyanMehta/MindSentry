"""
Application configuration settings
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    app_name: str = "MindSentry API"
    debug: bool = True
    
    # Database
    database_url: str = "sqlite:///./mindsentry.db"
    
    # JWT Settings
    secret_key: str = "your-secret-key-change-in-production-min-32-chars-long"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200  # 30 days
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
