from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # Application Info
    APP_TITLE: str = "NextPrompt API"
    APP_DESCRIPTION: str = "AI Chatbot with Gemini - Multimodal chat with dynamic options and next-prompt suggestions"
    APP_VERSION: str = "1.0.0"

    # Database
    DATABASE_URL: str

    # AI Models
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Security
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Environment
    ENVIRONMENT: str = "development"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
