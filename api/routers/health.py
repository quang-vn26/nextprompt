from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter(
    prefix="/health",
    tags=["health"]
)

@router.get("")
def health_check(db: Session = Depends(get_db)):
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
