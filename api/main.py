from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, test_connection
from dotenv import load_dotenv
import os
import logging
import uuid
from schemas import HealthCheckResponse, TestInsertResponse, TestInsertData, ErrorResponse
from models import User, Conversation, Message

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api.main")

# Gemini model configuration
GEMINI_MODEL = "gemini-2.5-flash"

# Create FastAPI app
app = FastAPI(
    title="NextPrompt API",
    description="AI Chatbot with Gemini - Multimodal chat with dynamic options and next-prompt suggestions",
    version="1.0.0"
)

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    logger.info("🚀 Starting NextPrompt API...")
    
    # Test database connection
    # Note: test_connection is synchronous, so we should run it carefully or accept it blocks startup briefly
    if test_connection():
        logger.info("✅ Database connection successful")
    else:
        logger.error("❌ Database connection failed")


@app.get("/", tags=["General"])
async def root():
    """Root endpoint"""
    return {
        "message": "NextPrompt API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthCheckResponse, tags=["General"])
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    Verifies API and database connectivity.
    Defined as sync function to avoid blocking event loop with sync DB driver.
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
        "api_version": "1.0.0"
    }


@app.get("/test-insert", response_model=TestInsertResponse, tags=["Dev"])
def test_insert(db: Session = Depends(get_db)):
    """
    Test endpoint to insert and read a sample message
    Day 1 acceptance criteria verification.
    Defined as sync function to avoid blocking event loop with sync DB driver.
    """
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
        
        if not retrieved_message:
             raise HTTPException(status_code=500, detail="Failed to retrieve inserted message")

        return TestInsertResponse(
            status="success",
            message="Sample message inserted and retrieved successfully",
            data=TestInsertData(
                user_id=str(user.id),
                conversation_id=str(conversation.id),
                message_id=str(message.id),
                message_content=retrieved_message.content_text,
                created_at=retrieved_message.created_at.isoformat()
            )
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Test insert failed: {e}")
        # Return error response structure fitting the schema or raise HTTPException
        # Since response_model is TestInsertResponse, returning a dict that matches is ok,
        # or raising HTTPException.
        # Here we raise HTTPException to be cleaner.
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
