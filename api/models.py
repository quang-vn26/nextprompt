from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import uuid


class User(Base):
    """
    User model - device-based authentication
    No traditional signup, users identified by device_id
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    """
    Conversation model - represents a chat session
    """
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=True)  # Auto-generated from first message
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    summary = relationship("ConversationSummary", back_populates="conversation", uselist=False, cascade="all, delete-orphan")


class Message(Base):
    """
    Message model - individual messages in a conversation
    Stores both user and assistant messages
    """
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content_text = Column(Text, nullable=False)
    options_json = Column(JSON, nullable=True)  # Dynamic options (tone, length, etc.)
    model = Column(String(100), nullable=True)  # e.g., 'gemini-2.0-flash-exp'
    latency_ms = Column(Integer, nullable=True)  # Response time in milliseconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    images = relationship("Image", back_populates="message", cascade="all, delete-orphan")
    suggestions = relationship("Suggestion", back_populates="message", uselist=False, cascade="all, delete-orphan")


class Image(Base):
    """
    Image model - references to images stored in Google Drive
    """
    __tablename__ = "images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False, index=True)
    drive_file_id = Column(String(255), nullable=True)  # Google Drive file ID
    file_url = Column(Text, nullable=True)  # Original upload URL or Drive link
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)  # Size in bytes
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    message = relationship("Message", back_populates="images")


class Suggestion(Base):
    """
    Suggestion model - next-prompt suggestions for each assistant message
    """
    __tablename__ = "suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False, unique=True, index=True)
    suggestions = Column(JSON, nullable=False)  # Array of suggested prompts
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    message = relationship("Message", back_populates="suggestions")


class ConversationSummary(Base):
    """
    Conversation summary - compressed context for long conversations
    """
    __tablename__ = "conversation_summaries"

    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), primary_key=True)
    summary_text = Column(Text, nullable=False)
    topics = Column(JSON, nullable=True)  # Array of key topics discussed
    last_turn = Column(Integer, default=0)  # Last message number when summary was created
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="summary")


class TokenUsage(Base):
    """
    Token usage tracking - for cost monitoring
    """
    __tablename__ = "token_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True, index=True)
    model = Column(String(100), nullable=False)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_estimate = Column(Numeric(10, 6), default=0.0)  # Estimated cost in USD
    created_at = Column(DateTime(timezone=True), server_default=func.now())
