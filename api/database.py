from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Ensure URL is async compatible
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create SQLAlchemy async engine
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using
    pool_size=5,
    max_overflow=10
)

# Async Session factory
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

# Base class for models
Base = declarative_base()


# Dependency for FastAPI routes
async def get_db():
    """
    Dependency that creates a new database session for each request
    and closes it when the request is done.
    """
    async with AsyncSessionLocal() as db:
        try:
            yield db
        finally:
            await db.close()


# Test database connection
async def test_connection():
    """Test database connection"""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False
