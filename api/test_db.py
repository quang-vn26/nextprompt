"""
Test database connection
"""
import sys
import asyncio
sys.path.insert(0, '.')

from database import test_connection

async def main():
    print("Testing database connection...")
    if await test_connection():
        print("✅ Database connection successful!")
    else:
        print("❌ Database connection failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
