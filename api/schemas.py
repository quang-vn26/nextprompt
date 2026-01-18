from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Any, Dict, List
from datetime import datetime
from uuid import UUID

class HealthCheck(BaseModel):
    status: str
    database: str
    api_version: str

class MessageResponse(BaseModel):
    user_id: str
    conversation_id: str
    message_id: str
    message_content: str
    created_at: str

class TestInsertResponse(BaseModel):
    status: str
    message: str
    data: Optional[MessageResponse] = None

class RootResponse(BaseModel):
    message: str
    version: str
    docs: str
