"""
Application settings loaded from environment variables via pydantic-settings.
Never hardcode production secrets in source code.
"""

from functools import lru_cache
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # General
    APP_NAME: str = "TR STUDIO"
    APP_VERSION: str = "0.2.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Server
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # Security & JWT
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # PostgreSQL Database
    DATABASE_URL: str
    DATABASE_URL_UNPOOLED: Optional[str] = None

    @field_validator("DATABASE_URL", "DATABASE_URL_UNPOOLED", mode="before")
    @classmethod
    def normalize_database_url(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        cleaned = v.strip().strip('"').strip("'")
        if cleaned.startswith("postgresql://"):
            return cleaned.replace("postgresql://", "postgresql+psycopg://", 1)
        return cleaned

    # Redis (prepared for future background jobs)
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI Story Creation Engine Configuration (Step 2)
    # Supported providers: "gemini", "openai", "openai_compatible"
    AI_PROVIDER: str = "gemini"
    AI_API_KEY: Optional[str] = None
    AI_MODEL: str = "gemini-2.0-flash"
    AI_BASE_URL: Optional[str] = None
    AI_TIMEOUT_SECONDS: float = 90.0
    AI_MAX_OUTPUT_TOKENS: int = 8192
    AI_MAX_RETRIES: int = 3
    AI_RETRY_DELAY_SECONDS: float = 2.0
    AI_USER_RATE_LIMIT_PER_MINUTE: int = 15

    # AI Character Image Generation Configuration (Step 3)
    # Supported providers: "gemini", "openai", "openai_compatible"
    IMAGE_PROVIDER: str = "gemini"
    IMAGE_API_KEY: Optional[str] = None
    IMAGE_MODEL: str = "imagen-3.0-generate-002"
    IMAGE_BASE_URL: Optional[str] = None
    IMAGE_TIMEOUT_SECONDS: float = 90.0

    # Secure Character Asset Storage Configuration (Step 3)
    # Supported backends: "local", "s3"
    STORAGE_BACKEND: str = "local"
    STORAGE_LOCAL_DIR: str = "./storage"
    MAX_UPLOAD_SIZE_MB: int = 10
    SIGNED_URL_EXPIRE_SECONDS: int = 3600
    S3_BUCKET: Optional[str] = None
    S3_REGION: str = "us-east-1"
    S3_ENDPOINT_URL: Optional[str] = None

    # AI Voice & Audio Generation Configuration (Step 8)
    # Supported providers: "google", "elevenlabs", "mock"
    VOICE_PROVIDER: str = "google"
    VOICE_API_KEY: Optional[str] = None
    VOICE_MODEL: str = "en-US-Neural2-F"
    VOICE_BASE_URL: Optional[str] = None
    VOICE_TIMEOUT_SECONDS: float = 60.0
    MAX_AUDIO_UPLOAD_SIZE_MB: int = 50

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_ai_configured(self) -> bool:
        if not self.AI_API_KEY:
            return False
        cleaned = self.AI_API_KEY.strip()
        if not cleaned or cleaned.startswith("your_") or cleaned == "replace_with_your_ai_api_key":
            return False
        return True

    @property
    def is_image_ai_configured(self) -> bool:
        if not self.IMAGE_API_KEY:
            return False
        cleaned = self.IMAGE_API_KEY.strip()
        if (
            not cleaned
            or cleaned.startswith("your_")
            or cleaned == "replace_with_your_image_api_key"
        ):
            return False
        return True

    @property
    def is_voice_configured(self) -> bool:
        if not self.VOICE_API_KEY:
            return False
        cleaned = self.VOICE_API_KEY.strip()
        if (
            not cleaned
            or cleaned.startswith("your_")
            or cleaned == "replace_with_your_voice_api_key"
        ):
            return False
        return True

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if not cleaned or len(cleaned) < 16:
            raise ValueError("SECRET_KEY must be set in environment and be at least 16 characters long.")
        if "replace_with" in cleaned.lower() or cleaned == "change_me_to_a_random_secret_in_production":
            import os
            env = os.getenv("ENVIRONMENT", "development").lower()
            if env == "production":
                raise ValueError("Insecure default SECRET_KEY detected in production environment.")
        return cleaned


@lru_cache
def get_settings() -> Settings:
    return Settings()
