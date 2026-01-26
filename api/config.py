from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    database_url: str
    gemini_model: str = "gemini-2.5-flash"
    allowed_origins: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"

settings = Settings()
