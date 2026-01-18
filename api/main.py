from contextlib import asynccontextmanager
import os
import uuid
from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv

from database import get_db, test_connection
from models import User, Conversation, Message
from schemas import HealthCheck, TestInsertResponse, RootResponse, MessageResponse

# Load environment variables
load_dotenv()

# Gemini model configuration
GEMINI_MODEL = "gemini-2.5-flash"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events"""
    print("🚀 Starting NextPrompt API...")

    # Test database connection
    if test_connection():
        print("✅ Database connection successful")
    else:
        print("❌ Database connection failed")

    yield

    print("🛑 Shutting down NextPrompt API...")

# Create FastAPI app
app = FastAPI(
    title="NextPrompt API",
    description="AI Chatbot with Gemini - Multimodal chat with dynamic options and next-prompt suggestions",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=RootResponse)
async def root():
    """Root endpoint"""
    return {
        "message": "NextPrompt API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthCheck)
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    Verifies API and database connectivity
    """
    # Test database
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ok",
        "database": db_status,
        "api_version": "1.0.0"
    }


@app.get("/test-insert", response_model=TestInsertResponse)
async def test_insert(db: Session = Depends(get_db)):
    """
    Test endpoint to insert and read a sample message.
    WARNING: This creates real data. Use for verification only.
    """
    try:
        # Create test user
        test_device_id = f"test-device-{uuid.uuid4()}"
        user = User(device_id=test_device_id)
        db.add(user)
        db.flush()
        
        # Create test conversation
        conversation = Conversation(user_id=user.id, title="Test Conversation")
        db.add(conversation)
        db.flush()
        
        # Create test message
        message = Message(
            conversation_id=conversation.id,
            role="user",
            content_text="This is a test message for Day 1 verification"
        )
        db.add(message)

        # Commit all changes transactionally
        db.commit()
        db.refresh(user)
        db.refresh(conversation)
        db.refresh(message)
        
        return {
            "status": "success",
            "message": "Sample message inserted and retrieved successfully",
            "data": {
                "user_id": str(user.id),
                "conversation_id": str(conversation.id),
                "message_id": str(message.id),
                "message_content": message.content_text,
                "created_at": message.created_at.isoformat()
            }
        }
    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "message": str(e),
            "data": None
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
