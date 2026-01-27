from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from database import get_db, test_connection
from dotenv import load_dotenv
import os
import logging
import schemas
from models import User, Conversation, Message
import uuid

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Gemini model configuration
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

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
    if await test_connection():
        logger.info("✅ Database connection successful")
    else:
        logger.error("❌ Database connection failed")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "NextPrompt API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint
    Verifies API and database connectivity
    """
    # Test database
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"
        logger.error(f"Health check failed: {e}")
    
    return {
        "status": "ok",
        "database": db_status,
        "api_version": "1.0.0"
    }


@app.get("/test-insert", response_model=schemas.TestInsertResponse)
async def test_insert(db: AsyncSession = Depends(get_db)):
    """
    Test endpoint to insert and read a sample message
    Day 1 acceptance criteria verification
    """
    
    try:
        # Create test user
        test_device_id = f"test-device-{uuid.uuid4()}"
        user = User(device_id=test_device_id)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Create test conversation
        conversation = Conversation(user_id=user.id, title="Test Conversation")
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        
        # Create test message
        message = Message(
            conversation_id=conversation.id,
            role="user",
            content_text="This is a test message for Day 1 verification"
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        
        # Read back the message
        result = await db.execute(select(Message).filter(Message.id == message.id))
        retrieved_message = result.scalars().first()
        
        if not retrieved_message:
             raise HTTPException(status_code=404, detail="Message not found after insertion")

        return schemas.TestInsertResponse(
            status="success",
            message="Sample message inserted and retrieved successfully",
            data=schemas.TestInsertData(
                user_id=str(user.id),
                conversation_id=str(conversation.id),
                message_id=str(message.id),
                message_content=retrieved_message.content_text,
                created_at=retrieved_message.created_at.isoformat()
            )
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Test insert failed: {e}")
        return schemas.TestInsertResponse(
            status="error",
            message=str(e),
            data=None
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
