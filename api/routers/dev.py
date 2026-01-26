from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import User, Conversation, Message
from database import get_db
import uuid

router = APIRouter(
    prefix="/dev",
    tags=["dev"]
)

@router.get("/test-insert")
def test_insert(db: Session = Depends(get_db)):
    """
    Test endpoint to insert and read a sample message
    Day 1 acceptance criteria verification
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
        return {
            "status": "error",
            "message": str(e)
        }
