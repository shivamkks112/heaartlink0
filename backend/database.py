"""
HeartLink Database Module
Shared MongoDB connection, caches, and database utilities.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from cachetools import TTLCache

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)

logger = logging.getLogger(__name__)

# MongoDB connection with connection pooling
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=100,
    minPoolSize=20,
    maxIdleTimeMS=60000,
    connectTimeoutMS=3000,
    serverSelectionTimeoutMS=3000,
    retryWrites=True,
    retryReads=True,
    compressors="zstd,snappy,zlib"
)
db = client[os.environ.get('DB_NAME')]

# ==================== CACHES ====================
user_cache = TTLCache(maxsize=1000, ttl=300)
discover_cache = TTLCache(maxsize=500, ttl=60)
online_status_cache = TTLCache(maxsize=2000, ttl=30)
likes_cache = TTLCache(maxsize=1000, ttl=120)
matches_cache = TTLCache(maxsize=500, ttl=120)
conversations_cache = TTLCache(maxsize=500, ttl=60)
admin_stats_cache = TTLCache(maxsize=10, ttl=300)


def get_cached_user(user_id: str):
    return user_cache.get(user_id)

def set_cached_user(user_id: str, user_data: dict):
    user_cache[user_id] = user_data

def invalidate_user_cache(user_id: str):
    user_cache.pop(user_id, None)

def get_cached_online_status(user_id: str):
    return online_status_cache.get(user_id)

def set_cached_online_status(user_id: str, is_online: bool, last_active: str):
    online_status_cache[user_id] = {"is_online": is_online, "last_active": last_active}


# ==================== INDEX CREATION ====================
async def create_indexes():
    """Create MongoDB indexes for better query performance"""
    try:
        await db.users.create_index("id", unique=True, background=True)
        try:
            await db.users.drop_index("email_1")
        except Exception:
            pass
        try:
            await db.users.create_index(
                "email", unique=True, sparse=True, background=True, name="email_unique"
            )
        except Exception as e:
            if "already exists" not in str(e):
                logging.warning(f"Email index: {e}")
        try:
            await db.users.drop_index("phone_1")
        except Exception:
            pass
        try:
            await db.users.create_index(
                "phone", unique=True, sparse=True, background=True, name="phone_unique"
            )
        except Exception as e:
            if "already exists" not in str(e):
                logging.warning(f"Phone index: {e}")

        await db.users.create_index("gender", background=True)
        await db.users.create_index("looking_for", background=True)
        await db.users.create_index("location", background=True)
        await db.users.create_index("is_online", background=True)
        await db.users.create_index("last_active", background=True)
        await db.users.create_index("verification_status", background=True)
        await db.users.create_index("is_shadow_banned", background=True)
        await db.users.create_index("is_permanently_banned", background=True)
        await db.users.create_index("trust_badge_level", background=True)
        await db.users.create_index("relationship_intent", background=True)
        await db.users.create_index("profile_status", background=True)
        await db.users.create_index("created_at", background=True)
        await db.users.create_index([
            ("gender", 1), ("looking_for", 1),
            ("is_shadow_banned", 1), ("is_permanently_banned", 1)
        ], background=True)
        await db.users.create_index([
            ("profile_status", 1), ("created_at", -1)
        ], background=True)
        await db.users.create_index("is_ai_profile", background=True)

        await db.likes.create_index("user_id", background=True)
        await db.likes.create_index("liked_user_id", background=True)
        await db.likes.create_index("action", background=True)
        await db.likes.create_index([("user_id", 1), ("liked_user_id", 1)], unique=True, background=True)
        await db.likes.create_index([("liked_user_id", 1), ("action", 1), ("is_matched", 1)], background=True)

        await db.matches.create_index("user1_id", background=True)
        await db.matches.create_index("user2_id", background=True)
        try:
            await db.matches.create_index([("user1_id", 1), ("user2_id", 1)], unique=True, background=True)
        except Exception:
            await db.matches.create_index([("user1_id", 1), ("user2_id", 1)], background=True)

        await db.messages.create_index("match_id", background=True)
        await db.messages.create_index("sender_id", background=True)
        await db.messages.create_index([("match_id", 1), ("timestamp", 1)], background=True)
        await db.messages.create_index("receiver_id", background=True)
        await db.messages.create_index([("receiver_id", 1), ("delivered", 1)], background=True)

        await db.notifications.create_index("user_id", background=True)
        await db.notifications.create_index([("user_id", 1), ("read", 1)], background=True)
        await db.in_app_notifications.create_index("user_id", background=True)
        await db.in_app_notifications.create_index([("user_id", 1), ("created_at", -1)], background=True)

        await db.reports.create_index("reporter_id", background=True)
        await db.reports.create_index("reported_user_id", background=True)

        await db.ad_impressions.create_index("user_id", background=True)
        await db.ad_impressions.create_index([("user_id", 1), ("timestamp", 1)], background=True)

        await db.profile_views.create_index("viewed_user_id", background=True)
        await db.profile_views.create_index([("viewer_id", 1), ("viewed_user_id", 1)], background=True)

        # Crushes indexes
        await db.crushes.create_index("crusher_id", background=True)
        await db.crushes.create_index("crushed_id", background=True)
        await db.crushes.create_index([("crusher_id", 1), ("crushed_id", 1)], unique=True, background=True)

        # Install tracking indexes
        await db.installs.create_index("installation_id", unique=True, background=True)
        await db.installs.create_index("first_open_at", background=True)
        
        # Signup OTP indexes
        await db.signup_otps.create_index("email", unique=True, background=True)
        await db.signup_otps.create_index("expires_at", background=True, expireAfterSeconds=900)  # Auto-cleanup after 15min
        await db.installs.create_index("signup_status", background=True)
        await db.installs.create_index("acquisition_source", background=True)
        await db.installs.create_index("user_id", sparse=True, background=True)
        await db.installs.create_index([("first_open_at", -1)], background=True)

        logging.info("MongoDB indexes created successfully")
    except Exception as e:
        logging.error(f"Error creating indexes: {e}")
