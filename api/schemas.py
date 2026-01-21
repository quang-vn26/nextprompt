from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, Dict, Any

class HealthCheckResponse(BaseModel):
    status: str
    database: str
    api_version: str

class TestInsertData(BaseModel):
    user_id: str
    conversation_id: str
    message_id: str
    message_content: str
    created_at: str

class TestInsertResponse(BaseModel):
    status: str
    message: str
    data: Optional[TestInsertData] = None

    model_config = ConfigDict(from_attributes=True)

class ErrorResponse(BaseModel):
    status: str
    message: str
