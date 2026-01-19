import logging
import uuid
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from .database import get_db, engine
from .config import settings
from . import models, schemas

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    """
    logger.info("🚀 Starting NextPrompt API...")

    # Test database connection
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("✅ Database connection successful")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        # We might want to raise an error here if DB is critical,
        # but often we let the app start and fail on requests.

    yield

    logger.info("🛑 Shutting down NextPrompt API...")

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION,
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=dict)
async def root():
    """Root endpoint"""
    return {
        "message": settings.API_TITLE,
        "version": settings.API_VERSION,
        "docs": "/docs"
    }


@app.get("/health", response_model=schemas.HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    Verifies API and database connectivity
    """
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check DB error: {e}")
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ok",
        "database": db_status,
        "api_version": settings.API_VERSION,
        "message": "System operational"
    }


@app.get("/test-insert", response_model=schemas.TestInsertResponse)
async def test_insert(db: Session = Depends(get_db)):
    """
    Test endpoint to insert and read a sample message
    Day 1 acceptance criteria verification
    """
    # Note: Generally, test logic should be in test files, not production code.
    # However, keeping this for verification as per requirements, but refactored.
    
    try:
        # Create test user
        test_device_id = f"test-device-{uuid.uuid4()}"
        user = models.User(device_id=test_device_id)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create test conversation
        conversation = models.Conversation(user_id=user.id, title="Test Conversation")
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        # Create test message
        message = models.Message(
            conversation_id=conversation.id,
            role="user",
            content_text="This is a test message for Day 1 verification"
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        
        # Read back the message
        # In a real app we'd use schemas and repositories
        retrieved_message = db.query(models.Message).filter(models.Message.id == message.id).first()
        
        if not retrieved_message:
             raise HTTPException(status_code=500, detail="Failed to retrieve inserted message")

        return {
            "status": "success",
            "message": "Sample message inserted and retrieved successfully",
            "data": {
                "user_id": str(user.id),
                "conversation_id": str(conversation.id),
                "message_id": str(message.id),
                "message_content": retrieved_message.content_text,
                "created_at": retrieved_message.created_at.isoformat()
            }
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Test insert failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
