"""
Application settings loaded from environment variables.
All secrets must be provided via .env — never hardcode credentials here.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── Supabase ──────────────────────────────────────────────────────────────
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # ── Gemini (Google AI) ────────────────────────────────────────────────────
    GEMINI_API_KEY: str

    # ── Storage ───────────────────────────────────────────────────────────────
    STORAGE_BUCKET_MEMORIES: str = "memories"
    STORAGE_BUCKET_LOCKER: str = "locker"

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins, e.g. http://localhost:5500,https://vaylume.app
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500"

    # ── File upload limits ────────────────────────────────────────────────────
    MAX_MEMORY_IMAGE_SIZE_MB: int = 10
    MAX_LOCKER_FILE_SIZE_MB: int = 25

    # ── App metadata ──────────────────────────────────────────────────────────
    APP_NAME: str = "VAYLUME API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton — reads .env once."""
    return Settings()
