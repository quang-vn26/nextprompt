from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    database_url: str
    allowed_origins: str = "http://localhost:3000"
    gemini_model: str = "gemini-2.5-flash"
    gemini_api_key: str | None = None
    jwt_secret_key: str | None = None
    environment: str = "development"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

settings = Settings()
