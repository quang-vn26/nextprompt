from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db, test_connection
from contextlib import asynccontextmanager
from config import settings
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run on application startup and shutdown"""
    logger.info("🚀 Starting NextPrompt API...")

    # Test database connection
    if test_connection():
        logger.info("✅ Database connection successful")
    else:
        logger.error("❌ Database connection failed")

    yield

    logger.info("🛑 Stopping NextPrompt API...")

# Create FastAPI app
app = FastAPI(
    title=settings.APP_TITLE,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
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


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": settings.APP_TITLE,
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    Verifies API and database connectivity
    """
    from sqlalchemy import text
    # Test database
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ok",
        "database": db_status,
        "api_version": settings.APP_VERSION
    }


@app.get("/test-insert")
def test_insert(db: Session = Depends(get_db)):
    """
    Test endpoint to insert and read a sample message
    Day 1 acceptance criteria verification
    """
    from models import User, Conversation, Message
    import uuid
    
    try:
        # Create test user
        test_device_id = f"test-device-{uuid.uuid4()}"
        user = User(device_id=test_device_id)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create test conversation
        conversation = Conversation(user_id=user.id, title="Test Conversation")
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        # Create test message
        message = Message(
            conversation_id=conversation.id,
            role="user",
            content_text="This is a test message for Day 1 verification"
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        
        # Read back the message
        retrieved_message = db.query(Message).filter(Message.id == message.id).first()
        
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
        logger.error(f"Test insert failed: {e}")
        db.rollback()
        return {
            "status": "error",
            "message": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
