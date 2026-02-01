from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    GEMINI_MODEL: str = "gemini-2.5-flash"

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
