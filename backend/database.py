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
    minPoolSize=5,
    maxIdleTimeMS=60000,
    connectTimeoutMS=10000,
    serverSelectionTimeoutMS=10000,
    socketTimeoutMS=20000,
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
async def _safe_index(coll, *args, **kwargs):
    """One failing index (e.g. name conflict) must not stop the rest from being created."""
    try:
        await coll.create_index(*args, **kwargs)
    except Exception as e:
        logging.warning(f"Index skipped on {coll.name}: {str(e)[:120]}")


async def create_indexes():
    """Create MongoDB indexes for better query performance"""
    try:
        await _safe_index(db.users, "id", unique=True, background=True)
        try:
            await db.users.drop_index("email_1")
        except Exception:
            pass
        try:
            await _safe_index(db.users, 
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
            await _safe_index(db.users, 
                "phone", unique=True, sparse=True, background=True, name="phone_unique"
            )
        except Exception as e:
            if "already exists" not in str(e):
                logging.warning(f"Phone index: {e}")

        await _safe_index(db.users, "gender", background=True)
        await _safe_index(db.users, "looking_for", background=True)
        await _safe_index(db.users, "location", background=True)
        await _safe_index(db.users, "is_online", background=True)
        await _safe_index(db.users, "last_active", background=True)
        await _safe_index(db.users, "verification_status", background=True)
        await _safe_index(db.users, "is_shadow_banned", background=True)
        await _safe_index(db.users, "is_permanently_banned", background=True)
        await _safe_index(db.users, "trust_badge_level", background=True)
        await _safe_index(db.users, "relationship_intent", background=True)
        await _safe_index(db.users, "profile_status", background=True)
        await _safe_index(db.users, "created_at", background=True)
        await _safe_index(db.users, [
            ("gender", 1), ("looking_for", 1),
            ("is_shadow_banned", 1), ("is_permanently_banned", 1)
        ], background=True)
        await _safe_index(db.users, [
            ("profile_status", 1), ("created_at", -1)
        ], background=True)
        await _safe_index(db.users, "is_ai_profile", background=True)

        await _safe_index(db.likes, "user_id", background=True)
        await _safe_index(db.likes, "liked_user_id", background=True)
        await _safe_index(db.likes, "action", background=True)
        await _safe_index(db.likes, [("user_id", 1), ("liked_user_id", 1)], unique=True, background=True)
        await _safe_index(db.likes, [("liked_user_id", 1), ("action", 1), ("is_matched", 1)], background=True)

        await _safe_index(db.matches, "user1_id", background=True)
        await _safe_index(db.matches, "user2_id", background=True)
        try:
            await _safe_index(db.matches, [("user1_id", 1), ("user2_id", 1)], unique=True, background=True)
        except Exception:
            await _safe_index(db.matches, [("user1_id", 1), ("user2_id", 1)], background=True)

        await _safe_index(db.matches, [("user1_id", 1), ("matched", 1)], background=True)
        await _safe_index(db.matches, [("user2_id", 1), ("matched", 1)], background=True)
        await _safe_index(db.messages, [("match_id", 1), ("created_at", -1)], background=True)
        await _safe_index(db.messages, [("receiver_id", 1), ("read", 1)], background=True)
        await _safe_index(db.messages, "match_id", background=True)
        await _safe_index(db.messages, "sender_id", background=True)
        await _safe_index(db.messages, [("match_id", 1), ("timestamp", 1)], background=True)
        await _safe_index(db.messages, "receiver_id", background=True)
        await _safe_index(db.messages, [("receiver_id", 1), ("delivered", 1)], background=True)

        await _safe_index(db.notifications, "user_id", background=True)
        await _safe_index(db.notifications, [("user_id", 1), ("read", 1)], background=True)
        await _safe_index(db.in_app_notifications, "user_id", background=True)
        await _safe_index(db.in_app_notifications, [("user_id", 1), ("created_at", -1)], background=True)

        await _safe_index(db.reports, "reporter_id", background=True)
        await _safe_index(db.reports, "reported_user_id", background=True)

        await _safe_index(db.ad_impressions, "user_id", background=True)
        await _safe_index(db.ad_impressions, [("user_id", 1), ("timestamp", 1)], background=True)

        await _safe_index(db.profile_views, "viewed_user_id", background=True)
        await _safe_index(db.profile_views, [("viewer_id", 1), ("viewed_user_id", 1)], background=True)

        # Crushes indexes
        await _safe_index(db.crushes, "crusher_id", background=True)
        await _safe_index(db.crushes, "crushed_id", background=True)
        await _safe_index(db.crushes, [("crusher_id", 1), ("crushed_id", 1)], unique=True, background=True)

        # Install tracking indexes
        await _safe_index(db.installs, "installation_id", unique=True, background=True)
        await _safe_index(db.installs, "first_open_at", background=True)
        
        # Signup OTP indexes
        await _safe_index(db.signup_otps, "email", unique=True, background=True)
        await _safe_index(db.signup_otps, "expires_at", background=True, expireAfterSeconds=900)  # Auto-cleanup after 15min
        await _safe_index(db.installs, "signup_status", background=True)
        await _safe_index(db.installs, "acquisition_source", background=True)
        await _safe_index(db.installs, "user_id", sparse=True, background=True)
        await _safe_index(db.installs, [("first_open_at", -1)], background=True)

        logging.info("MongoDB indexes created successfully")
    except Exception as e:
        logging.error(f"Error creating indexes: {e}")
