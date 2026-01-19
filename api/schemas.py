from pydantic import BaseModel, Field, UUID4
from typing import List, Optional, Any, Dict
from datetime import datetime

# --- Base Response Schemas ---

class BaseResponse(BaseModel):
    status: str
    message: Optional[str] = None

class HealthResponse(BaseResponse):
    database: str
    api_version: str

# --- Model Schemas ---

class UserBase(BaseModel):
    device_id: str

class UserCreate(UserBase):
    pass

class UserResponse(UserBase):
    id: UUID4
    created_at: datetime

    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    role: str
    content_text: str
    options_json: Optional[Dict[str, Any]] = None
    model: Optional[str] = None

class MessageResponse(MessageBase):
    id: UUID4
    conversation_id: UUID4
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationBase(BaseModel):
    title: Optional[str] = None

class ConversationResponse(ConversationBase):
    id: UUID4
    user_id: UUID4
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True

# --- Test Endpoint Schema ---

class TestData(BaseModel):
    user_id: str
    conversation_id: str
    message_id: str
    message_content: str
    created_at: str

class TestInsertResponse(BaseResponse):
    data: Optional[TestData] = None
