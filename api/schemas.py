from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID

class HealthResponse(BaseModel):
    status: str
    database: str
    api_version: str

class UserBase(BaseModel):
    device_id: str

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    role: str
    content_text: str
    options_json: Optional[Any] = None

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: UUID
    conversation_id: UUID
    created_at: datetime
    model: Optional[str] = None
    latency_ms: Optional[int] = None

    class Config:
        from_attributes = True

class ConversationBase(BaseModel):
    title: Optional[str] = None

class ConversationCreate(ConversationBase):
    user_id: UUID

class Conversation(ConversationBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    messages: List[Message] = []

    class Config:
        from_attributes = True
