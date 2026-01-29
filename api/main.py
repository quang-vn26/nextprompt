from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db, test_connection
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import os

# Load environment variables
load_dotenv()

# Gemini model configuration
GEMINI_MODEL = "gemini-2.5-flash"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run on application startup"""
    print("🚀 Starting NextPrompt API...")

    # Test database connection
    if test_connection():
        print("✅ Database connection successful")
    else:
        print("❌ Database connection failed")
    yield


# Create FastAPI app
app = FastAPI(
    title="NextPrompt API",
    description="AI Chatbot with Gemini - Multimodal chat with dynamic options and next-prompt suggestions",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
if not os.getenv("ALLOWED_ORIGINS"):
    print("⚠️  ALLOWED_ORIGINS not set, defaulting to http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "NextPrompt API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
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
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ok",
        "database": db_status,
        "api_version": "1.0.0"
    }


# @app.get("/test-insert")
# async def test_insert(db: Session = Depends(get_db)):
#     """
#     Test endpoint to insert and read a sample message
#     Day 1 acceptance criteria verification
#     WARNING: DISABLED FOR SECURITY - Do not expose in production
#     """
#     from models import User, Conversation, Message
#     import uuid
#
#     try:
#         # Create test user
#         test_device_id = f"test-device-{uuid.uuid4()}"
#         user = User(device_id=test_device_id)
#         db.add(user)
#         db.commit()
#         db.refresh(user)
#
#         # Create test conversation
#         conversation = Conversation(user_id=user.id, title="Test Conversation")
#         db.add(conversation)
#         db.commit()
#         db.refresh(conversation)
#
#         # Create test message
#         message = Message(
#             conversation_id=conversation.id,
#             role="user",
#             content_text="This is a test message for Day 1 verification"
#         )
#         db.add(message)
#         db.commit()
#         db.refresh(message)
#
#         # Read back the message
#         retrieved_message = db.query(Message).filter(Message.id == message.id).first()
#
#         return {
#             "status": "success",
#             "message": "Sample message inserted and retrieved successfully",
#             "data": {
#                 "user_id": str(user.id),
#                 "conversation_id": str(conversation.id),
#                 "message_id": str(message.id),
#                 "message_content": retrieved_message.content_text,
#                 "created_at": retrieved_message.created_at.isoformat()
#             }
#         }
#     except Exception as e:
#         db.rollback()
#         return {
#             "status": "error",
#             "message": str(e)
#         }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
