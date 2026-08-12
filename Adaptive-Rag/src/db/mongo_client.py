"""
MongoDB client initialization.
Reads MONGODB_URI from environment — works for both local Docker and Atlas.
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "adaptive_rag"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
