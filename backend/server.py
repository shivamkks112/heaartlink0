from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Request, Depends, Response
from fastapi.responses import JSONResponse, ORJSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import base64
import hashlib
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import asyncio
import re
import orjson  # Fast JSON serialization

# Import shared database module
from database import (
    db, client,
    user_cache, discover_cache, online_status_cache, likes_cache,
    matches_cache, conversations_cache, admin_stats_cache,
    get_cached_user, set_cached_user, invalidate_user_cache,
    get_cached_online_status, set_cached_online_status,
    create_indexes,
)

# Import Pydantic models from models package
from models.schemas import (
    User, Match, InAppNotification, Message,
    UserSignup, UserLogin, PhoneLogin, PhoneSignup,
    ForgotPasswordRequest, ResetPasswordRequest, RefreshTokenRequest, ChangePasswordRequest,
    DeleteAccountRequest, LinkEmailRequest, LinkPhoneRequest, MergeAccountsRequest,
    PrivacyUpdate, GenderLockUpdate, ProfileEnhancementUpdate, WomenSafetyUpdate,
    LocationUpdate, DeviceBlock, SelfieVerificationRequest,
    LikeAction, BlockUser, MuteUser, ReportUser, DiscoverFilters,
    ScreenshotAlert, DeleteMessageRequest, MessageReaction,
    AdminUserUpdate, AdminVerification, MakeAdminRequest, AdminResetPasswordRequest,
    VerifySelfieRequest, ReVerifyRequest, ProfileApprovalRequest, DatabaseClearRequest,
    BulkNotificationRequest, ScheduledNotificationRequest, AdminNotificationWithEmail,
    NotificationTemplateCreate, PushNotificationRequest, FCMTokenRequest,
    AdImpressionRequest, AdRewardRequest, SubscriptionCreateRequest,
)

# Import shared helper functions
from services.helpers import (
    is_indian_location, INDIAN_STATES, INDIAN_CITIES,
    hash_password, verify_password,
    clean_user_data, serialize_user_for_response,
    sanitize_mongo_input,
    mask_phone_email, check_money_scam,
    create_in_app_notification,
)

# Load environment variables FIRST before importing firebase_config
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)  # Don't override K8s environment variables

# Now import firebase_config after env vars are loaded
from firebase_config import (
    send_verification_notification,
    send_notification_to_multiple,
    send_promotional_notification,
    send_daily_reminder,
    send_inactive_user_notification
)

# Import FCM service — single source of truth for all push notifications
import fcm_service

# Import AI Chatbot Module
from ai_chatbot import (
    seed_ai_profiles,
    auto_match_ai_profiles,
    handle_ai_message,
    get_ai_profiles,
    delete_ai_profile,
    toggle_ai_profile,
)

# Import Security Module
from security import (
    hash_password_secure,
    verify_password_secure,
    needs_password_rehash,
    create_access_token,
    create_refresh_token,
    verify_access_token,
    verify_refresh_token,
    sanitize_string,
    validate_email,
    validate_phone,
    validate_password_strength,
    limiter,
    RATE_LIMITS,
    activity_detector,
    session_manager,
    audit_log,
    generate_secure_token
)
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Indian location data and helpers imported from services.helpers

# MongoDB connection imported from database.py
# db and client are shared across all modules

# Create the main app with rate limiting and performance optimizations
app = FastAPI(
    title="HeartLink API", 
    description="Secure Dating App API",
    default_response_class=ORJSONResponse  # Faster JSON serialization
)

# Add GZip compression for all responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# Add Cache-Control headers for faster repeat loads
from starlette.middleware.base import BaseHTTPMiddleware

class CacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        path = request.url.path
        # Cache static-like API responses
        if path.startswith("/api/admin/feature-flags"):
            response.headers["Cache-Control"] = "public, max-age=60"
        elif path.startswith("/api/init/"):
            response.headers["Cache-Control"] = "private, max-age=10"
        elif path.startswith("/api/health"):
            response.headers["Cache-Control"] = "no-cache"
        return response

# === ADMIN AUTH MIDDLEWARE (temporarily disabled for Android compatibility) ===
# Will be re-enabled after proper testing with CapacitorHttp
ADMIN_AUTH_SKIP_PATHS = {"/api/admin/make-me-admin-once"}

class AdminAuthMiddleware(BaseHTTPMiddleware):
    """Admin auth middleware - currently in pass-through mode for compatibility."""
    async def dispatch(self, request, call_next):
        return await call_next(request)

# === SECURITY HEADERS MIDDLEWARE ===
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # XSS Protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Strict Transport Security (HTTPS enforce)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Permissions Policy - disable unnecessary browser features
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self), payment=()"
        # Prevent content embedding
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AdminAuthMiddleware)
app.add_middleware(CacheMiddleware)

# === REQUEST BODY SIZE LIMIT (5MB max) ===
from starlette.requests import Request as StarletteRequest

@app.middleware("http")
async def limit_request_size(request: StarletteRequest, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 5 * 1024 * 1024:  # 5MB
        from starlette.responses import JSONResponse
        return JSONResponse({"detail": "Request too large"}, status_code=413)
    return await call_next(request)

# sanitize_mongo_input imported from services.helpers

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

# Include extracted route modules
from routes.ads import router as ads_router
from routes.games import router as games_router
from routes.boost import router as boost_router
from routes.welcome import router as welcome_router
api_router.include_router(ads_router)
api_router.include_router(games_router)
api_router.include_router(boost_router)
api_router.include_router(welcome_router)

# Health check endpoint for Kubernetes/deployment health checks
@app.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring"""
    try:
        # Quick MongoDB ping
        await client.admin.command('ping')
        return {
            "status": "healthy",
            "service": "HeartLink API",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "HeartLink API",
            "database": "disconnected",
            "error": str(e)
        }

# Also add /api/health for API-prefixed health checks
@api_router.get("/health")
async def api_health_check():
    """API health check endpoint with version for hybrid app updates"""
    return {"status": "healthy", "service": "HeartLink API", "version": "2.5.0", "timestamp": datetime.now(timezone.utc).isoformat()}

# === COMBINED INIT ENDPOINT - Single call for all page data ===
@api_router.get("/init/{user_id}")
async def get_init_data(user_id: str):
    """Combined endpoint - returns user data, counts, feature flags in ONE call"""
    try:
        # Run all queries in parallel
        user_task = db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        likes_task = db.likes.count_documents({"liked_user_id": user_id, "action": "like", "is_matched": False})
        notif_task = db.notifications.count_documents({"user_id": user_id, "read": False})
        unread_task = db.messages.count_documents({"receiver_id": user_id, "read": False})
        flags_task = db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
        
        user, likes_count, notif_count, unread_msgs, flags = await asyncio.gather(
            user_task, likes_task, notif_task, unread_task, flags_task
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        feature_flags = {k: v for k, v in (flags or {}).items() if k != "type"} if flags else {"referral_system": True, "daily_rewards": True}
        
        return {
            "user": user,
            "likes_count": likes_count,
            "notification_count": notif_count,
            "unread_messages": unread_msgs,
            "feature_flags": feature_flags,
            "bonus_superlikes": user.get("bonus_superlikes", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"error": str(e)}

# Caches, cache helpers, and create_indexes are imported from database.py
from functools import lru_cache
import time

@app.on_event("startup")
async def startup_event():
    """Run on app startup"""
    await create_indexes()
    logging.info("🚀 HeartLink server started with optimized indexes")
    
    # Seed AI girl profiles
    await seed_ai_profiles(db)
    logging.info("🤖 AI girl profiles seeded")
    
    # Keep AI profiles looking "online"
    asyncio.create_task(keep_ai_profiles_online(db))
    
    # Start background notification scheduler
    asyncio.create_task(notification_scheduler())
    logging.info("📬 Notification scheduler started")
    
    # Start weekly growth email scheduler
    asyncio.create_task(weekly_growth_email_scheduler())
    logging.info("📧 Weekly growth email scheduler started")
    
    # Auto-send update notification if app version changed
    asyncio.create_task(auto_update_notification())
    
    # Catch existing users who never got AI matches
    asyncio.create_task(_backfill_ai_matches())


async def _backfill_ai_matches():
    """On startup, find male users who have 0 AI matches and create them."""
    try:
        await asyncio.sleep(30)  # Wait for DB + AI profiles to be ready
        
        # Get all male users looking for female
        male_users = await db.users.find(
            {"is_ai_profile": {"$ne": True}, "gender": {"$regex": "^male$", "$options": "i"}, "looking_for": {"$regex": "^female$", "$options": "i"}},
            {"_id": 0, "id": 1, "name": 1, "gender": 1, "looking_for": 1}
        ).to_list(None)
        
        backfilled = 0
        for user in male_users:
            # Check if user already has AI matches
            ai_match = await db.matches.find_one({
                "$or": [{"user1_id": user["id"]}, {"user2_id": user["id"]}],
                "matched": True, "is_ai_match": True
            })
            if ai_match:
                continue
            
            # No AI matches — create them now (no delay for backfill)
            await auto_match_ai_profiles(db, user["id"], user.get("gender", "male"), user.get("looking_for", "female"))
            backfilled += 1
        
        if backfilled > 0:
            logging.info(f"Backfilled AI matches for {backfilled} existing users")
    except Exception as e:
        logging.error(f"Backfill AI matches error: {e}")


APP_VERSION = "3.2.6"  # Increment this on each release


async def auto_update_notification():
    """On deploy, check if version changed and auto-send push notification to all users."""
    try:
        # Small delay to let FCM service initialize
        await asyncio.sleep(10)
        
        last_version = await db.app_settings.find_one({"type": "app_version"})
        stored_version = last_version.get("version") if last_version else None
        
        if stored_version == APP_VERSION:
            logging.info(f"📱 App version unchanged ({APP_VERSION}), skipping update push")
            return
        
        # Version changed — update DB and send notification
        await db.app_settings.update_one(
            {"type": "app_version"},
            {"$set": {"version": APP_VERSION, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
        if stored_version is None:
            # First deploy — don't spam users
            logging.info(f"📱 First version recorded: {APP_VERSION}, skipping initial push")
            return
        
        logging.info(f"📱 Version changed: {stored_version} → {APP_VERSION}, sending update push!")
        
        result = await fcm_service.send_to_all(
            db,
            "HeartLink Update Available! \u2728",
            "Please update the app for a smooth and bugless experience! New features aur improvements aapka wait kar rahe hain.",
            data={"type": "app_update", "url": "https://play.google.com/store/apps/details?id=com.heartlink.app", "click_action": "OPEN_PLAY_STORE"}
        )
        
        # Log it
        await db.app_settings.update_one(
            {"type": "update_notifications"},
            {"$push": {"history": {
                "title": f"Auto: v{stored_version} → v{APP_VERSION}",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "auto": True,
                "result": str(result)
            }}, "$inc": {"total_sent": 1}},
            upsert=True
        )
        
        logging.info(f"📱 Update notification sent: {result}")
        
    except Exception as e:
        logging.error(f"Auto update notification error: {e}")


async def keep_ai_profiles_online(db_ref):
    """Background task to keep AI profiles online and clean stale online statuses."""
    while True:
        try:
            # Keep AI profiles online
            await db_ref.users.update_many(
                {"is_ai_profile": True, "is_active_ai": True},
                {"$set": {
                    "is_online": True,
                    "last_active": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Mark stale users as offline (no activity for 5 minutes, not AI)
            cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
            await db_ref.users.update_many(
                {
                    "is_online": True,
                    "is_ai_profile": {"$ne": True},
                    "last_active": {"$lt": cutoff},
                    "id": {"$nin": list(manager.active_connections.keys())}
                },
                {"$set": {"is_online": False}}
            )
        except Exception as e:
            logging.error(f"Error in online status cleanup: {e}")
        await asyncio.sleep(300)  # Every 5 minutes




# === AUTOMATIC NOTIFICATION HELPERS ===

async def _send_push_to_user(user_id: str, title: str, message: str, data: dict = None):
    """Central helper — sends push via FCM service."""
    try:
        result = await fcm_service.send_to_user(db, user_id, title, message, data)
        if not result.get("success"):
            logger.warning(f"Push to {user_id} failed: {result.get('error')}")
        return result
    except Exception as e:
        logger.error(f"Push to {user_id} error: {e}")
        return {"success": False, "error": str(e)}



async def _delayed_ai_match(user_id: str, gender: str, looking_for: str):
    """Delay AI matching by 5-15 minutes — quick enough to engage, slow enough to feel natural."""
    delay_minutes = random.uniform(5, 15)
    delay_seconds = delay_minutes * 60
    logger.info(f"AI match for {user_id} scheduled in {delay_minutes:.0f} minutes")
    await asyncio.sleep(delay_seconds)
    await auto_match_ai_profiles(db, user_id, gender, looking_for)


async def _notify_new_user_joined(user_id: str, name: str, gender: str, location: str):
    """Send gender-based notification: new female → notify males, new male → notify females."""
    try:
        await asyncio.sleep(5)
        
        # Check notification_config toggle
        notif_cfg = await db.app_settings.find_one({"type": "notification_config"}, {"_id": 0})
        if notif_cfg and not notif_cfg.get("new_user_discovery_enabled", True):
            return
        
        # Check admin feature flag
        flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
        if flags and not flags.get("new_user_gender_notifications", True):
            return
        
        # Check gender-specific admin toggles
        gender_lower = gender.lower() if gender else ""
        if gender_lower == "female" and flags and not flags.get("new_user_notif_to_males", True):
            return
        if gender_lower == "male" and flags and not flags.get("new_user_notif_to_females", True):
            return
        
        # Determine target gender (opposite)
        if gender_lower == "female":
            target_gender = "male"
        elif gender_lower == "male":
            target_gender = "female"
        else:
            return  # Unknown gender, skip
        
        # Duplicate prevention — check if we already sent for this user
        already_sent = await db.app_settings.find_one({
            "type": "new_user_notif_log",
            "new_user_id": user_id
        })
        if already_sent:
            return
        
        # Log to prevent duplicates
        await db.app_settings.insert_one({
            "type": "new_user_notif_log",
            "new_user_id": user_id,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "target_gender": target_gender
        })
        
        city = location.split(",")[0].strip() if location else "India"
        first_name = name.split()[0] if name else "Someone"
        
        result = await fcm_service.send_to_gender(
            db,
            target_gender=target_gender,
            title="New people joined HeartLink",
            body="Discover who's new today and find someone interesting to connect with.",
            data={"type": "new_user", "route": "/discover", "action": "open_discover"},
            exclude_user_id=user_id
        )
        
        # Log for analytics
        await db.notification_logs.insert_one({
            "user_id": user_id, "type": "new_user_discovery",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "target_gender": target_gender,
            "targeted_count": result.get("total_targeted", 0)
        })
        await db.app_settings.update_one(
            {"type": "notification_analytics"},
            {"$inc": {"new_user_discovery_sent": 1}},
            upsert=True
        )
        
        logger.info(f"Gender notification: {gender_lower} joined → sent to {target_gender}s ({result.get('total_targeted', 0)} targeted)")
        
    except Exception as e:
        logger.error(f"Gender-based new user notification error: {e}")


async def _notify_matches_user_online(user_id: str, name: str):
    """Smart notification: Tell matched users that someone came online.
    - Throttled: max once per 2 hours per user (persisted in DB)
    - Batched AI check (no N+1 queries)
    - Respects mute settings
    - Varied engaging messages
    """
    try:
        await asyncio.sleep(5)  # Wait 5s to confirm user actually stayed online
        
        # Verify user is still connected
        if user_id not in manager.active_connections:
            return
        
        # Check feature flag
        flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
        if flags and flags.get("online_notifications") is False:
            return

        # Throttle: check last notification time (2 hours)
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "last_online_notif_at": 1, "profile_picture": 1})
        if not user_doc:
            return
        
        last_notif = user_doc.get("last_online_notif_at")
        if last_notif:
            try:
                elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(last_notif.replace("Z", "+00:00"))).total_seconds()
                if elapsed < 7200:  # 2 hours
                    return
            except (ValueError, TypeError):
                pass
        
        user_name = user_doc.get("name", name or "Someone")
        
        # Get all matched user IDs in one query
        matches = await db.matches.find(
            {"$or": [{"user1_id": user_id}, {"user2_id": user_id}], "matched": True},
            {"_id": 0, "user1_id": 1, "user2_id": 1}
        ).limit(50).to_list(None)
        
        if not matches:
            return
        
        other_ids = list(set(
            m["user2_id"] if m["user1_id"] == user_id else m["user1_id"]
            for m in matches
        ))
        
        # Batch check: filter out AI profiles and muted users in ONE query
        real_users = await db.users.find(
            {
                "id": {"$in": other_ids},
                "is_ai_profile": {"$ne": True},
                "muted_users": {"$nin": [user_id]},  # Respect mute
            },
            {"_id": 0, "id": 1, "gender": 1}
        ).to_list(None)
        
        if not real_users:
            return
        
        eligible_ids = [u["id"] for u in real_users]
        
        # Send WebSocket notification to online matched users
        for eid in eligible_ids:
            await manager.send_message(eid, {
                "type": "user_online",
                "user_id": user_id,
                "user_name": user_name
            })
        
        # Send FCM push to all eligible (fcm_service handles token lookup)
        if eligible_ids:
            try:
                await fcm_service.notify_online_status(db, eligible_ids, user_name, online_user_id=user_id)
            except Exception as e:
                logger.error(f"Online push failed: {e}")
        
        # Update throttle timestamp
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"last_online_notif_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"Online notification sent to {len(eligible_ids)} matches of {user_name}")
        
    except Exception as e:
        logger.error(f"Online notification error: {e}")


# Kept for backward compatibility — delegates to the main function
async def _send_online_notification_to_matches(user_id: str):
    """Alias: delegates to _notify_matches_user_online."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1})
    if user:
        await _notify_matches_user_online(user_id, user.get("name", "Someone"))



async def _send_daily_engagement_notifications():
    """Send daily engagement notifications."""
    try:
        now = datetime.now(timezone.utc)

        # "New matches available" to active users
        active_users = await db.users.find(
            {
                "is_ai_profile": {"$ne": True},
                "profile_status": "approved",
                "last_active": {"$gte": (now - timedelta(days=3)).isoformat()}
            },
            {"_id": 0, "id": 1}
        ).limit(500).to_list(None)

        if active_users:
            user_ids = [u["id"] for u in active_users]
            await fcm_service.send_to_users(db, 
                user_ids,
                "New matches waiting for you! 💝",
                "Aaj ke new profiles dekho - shayad tumhara perfect match mil jaye!"
            )
            logger.info(f"Sent daily engagement to {len(user_ids)} active users")

        # "We miss you" to inactive users (3-7 days)
        inactive_users = await db.users.find(
            {
                "is_ai_profile": {"$ne": True},
                "last_active": {
                    "$lt": (now - timedelta(days=3)).isoformat(),
                    "$gt": (now - timedelta(days=7)).isoformat()
                }
            },
            {"_id": 0, "id": 1}
        ).limit(200).to_list(None)

        if inactive_users:
            user_ids = [u["id"] for u in inactive_users]
            await fcm_service.send_to_users(db, 
                user_ids,
                "Tumhe miss kar rahe hain! 🥺",
                "Bahut din ho gaye tumhare bina. Naye log join ho rahe hain, wapas aao!"
            )
            logger.info(f"Sent miss-you notification to {len(user_ids)} inactive users")

    except Exception as e:
        logger.error(f"Daily engagement notification error: {e}")


async def _send_unread_message_reminders():
    """Send reminders to users with unread messages (runs every 2 hours)."""
    try:
        # Find users with unread messages who are NOT online
        pipeline = [
            {"$match": {"read": False}},
            {"$group": {"_id": "$receiver_id", "count": {"$sum": 1}}},
            {"$match": {"count": {"$gte": 1}}}
        ]
        unread_groups = await db.messages.aggregate(pipeline).to_list(None)
        
        if not unread_groups:
            return
        
        for group in unread_groups:
            user_id = group["_id"]
            count = group["count"]
            
            # Skip users who are currently online
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_online": 1, "is_ai_profile": 1})
            if not user or user.get("is_online") or user.get("is_ai_profile"):
                continue
            
            # Check if we already sent a reminder in the last 4 hours
            four_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat()
            existing_reminder = await db.in_app_notifications.find_one({
                "user_id": user_id,
                "type": "unread_reminder",
                "created_at": {"$gt": four_hours_ago}
            })
            if existing_reminder:
                continue
            
            # Send unread reminder via OneSignal
            try:
                await fcm_service.notify_unread_reminder(db, user_id, count)
            except Exception as e:
                logger.error(f"Unread reminder push failed for {user_id}: {e}")
            
            # Store in-app notification
            await create_in_app_notification(
                user_id,
                f"{count} unread messages",
                "Your matches are waiting for your reply! Don't keep them waiting.",
                "unread_reminder",
                {"action": "open_matches", "route": "/matches"}
            )
        
        logger.info(f"Sent unread reminders to {len(unread_groups)} users")
    except Exception as e:
        logger.error(f"Unread message reminder error: {e}")


async def _send_smart_reengagement_notifications():
    """Smart re-engagement: personalized notifications based on real data"""
    try:
        now = datetime.now(timezone.utc)
        cutoff_2day = (now - timedelta(days=2)).isoformat()
        cutoff_7day = (now - timedelta(days=7)).isoformat()
        
        # Get inactive users (2-7 days)
        inactive_users = await db.users.find({
            "last_active": {"$lt": cutoff_2day, "$gt": cutoff_7day},
            "fcm_token": {"$exists": True, "$ne": None},
            "is_ai_profile": {"$ne": True}
        }, {"_id": 0, "id": 1, "name": 1, "location": 1, "gender": 1}).to_list(200)
        
        for user in inactive_users:
            uid = user["id"]
            location = user.get("location", "your area")
            
            # Get real stats for this user
            view_count = await db.profile_views.count_documents({
                "viewed_user_id": uid,
                "viewed_at": {"$gte": cutoff_2day}
            })
            crush_count = await db.crushes.count_documents({"crushed_id": uid})
            new_users_nearby = await db.users.count_documents({
                "location": {"$regex": location.split(",")[0] if location else "", "$options": "i"},
                "created_at": {"$gte": cutoff_2day},
                "is_ai_profile": {"$ne": True}
            }) if location else 0
            
            # Pick the most compelling notification
            if crush_count > 0:
                title = "Secret Crush Alert!"
                body = f"Kisi ne tumhe Crush mark kiya hai! Kholke dekho kaun hai."
            elif view_count > 0:
                title = f"{view_count} logon ne profile dekhi!"
                body = f"Tumhari profile {view_count} logon ne dekhi. Wapas aao aur match karo!"
            elif new_users_nearby > 0:
                city = location.split(",")[0] if location else "your area"
                title = f"{new_users_nearby} naye profiles!"
                body = f"{city} mein {new_users_nearby} naye log aaye hain. Check karo!"
            else:
                title = "Naye matches tumhara wait kar rahe hain!"
                body = "HeartLink pe bahut kuch naya hai. Aao dekho!"
            
            try:
                await fcm_service.send_to_user(db, uid, title, body)
            except Exception:
                pass
        
        if inactive_users:
            logging.info(f"📬 Sent smart re-engagement to {len(inactive_users)} users")
    except Exception as e:
        logging.error(f"Smart re-engagement error: {e}")


async def _send_daily_picks():
    """Send 5 personalized match suggestions to each active user every morning"""
    try:
        # Get all active users with FCM tokens (active in last 7 days)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        active_users = await db.users.find({
            "last_active": {"$gte": cutoff},
            "fcm_token": {"$exists": True, "$ne": None},
            "is_ai_profile": {"$ne": True},
            "is_permanently_banned": {"$ne": True}
        }, {"_id": 0, "id": 1, "name": 1, "gender": 1, "looking_for": 1,
            "interests": 1, "location": 1, "blocked_users": 1}).to_list(500)
        
        sent = 0
        for user in active_users:
            uid = user["id"]
            blocked = set(user.get("blocked_users", []))
            user_interests = set(user.get("interests", []))
            user_city = user.get("location", "").split(",")[0].strip().lower()
            
            # Find top 5 matches for this user
            target_gender = user.get("looking_for", "both")
            gender_filter = {}
            if target_gender != "both":
                gender_filter["gender"] = target_gender
            
            candidates = await db.users.find({
                "id": {"$ne": uid, "$nin": list(blocked)},
                "is_ai_profile": {"$ne": True},
                "is_permanently_banned": {"$ne": True},
                "is_shadow_banned": {"$ne": True},
                "profile_picture": {"$exists": True, "$ne": None},
                **gender_filter
            }, {"_id": 0, "id": 1, "name": 1, "interests": 1, "location": 1,
                "is_online": 1, "verified": 1, "profile_picture": 1}).to_list(50)
            
            # Score and pick top 5
            def pick_score(c):
                s = 0
                c_interests = set(c.get("interests", []))
                s += len(user_interests & c_interests) * 10
                c_city = c.get("location", "").split(",")[0].strip().lower()
                if user_city and c_city == user_city:
                    s += 30
                if c.get("is_online"):
                    s += 15
                if c.get("verified"):
                    s += 10
                if c.get("profile_picture"):
                    s += 5
                return s
            
            candidates.sort(key=pick_score, reverse=True)
            top5 = candidates[:5]
            
            if not top5:
                continue
            
            names = ", ".join(c["name"] for c in top5[:3])
            count = len(top5)
            
            title = f"Good Morning! {count} picks for you"
            body = f"{names} and more are waiting. Open HeartLink!"
            
            await create_in_app_notification(
                uid, title, body, "daily_picks",
                {"action": "open_discover", "route": "/discover", "picks": [c["id"] for c in top5]}
            )
            try:
                await fcm_service.send_to_user(db, uid, title, body)
                sent += 1
            except Exception:
                pass
        
        if sent:
            logging.info(f"☀️ Sent daily picks to {sent} users")
    except Exception as e:
        logging.error(f"Daily picks error: {e}")


async def weekly_growth_email_scheduler():
    """Send weekly growth digest email every Monday 9 AM IST"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            ist_offset = timedelta(hours=5, minutes=30)
            now_ist = now + ist_offset
            
            # Calculate next Monday 9 AM IST
            days_until_monday = (7 - now_ist.weekday()) % 7
            if days_until_monday == 0 and now_ist.hour >= 9:
                days_until_monday = 7
            
            next_monday = now_ist.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=days_until_monday)
            sleep_seconds = (next_monday - now_ist).total_seconds()
            
            logging.info(f"📧 Weekly email: sleeping {sleep_seconds/3600:.1f}h until next Monday 9AM IST")
            await asyncio.sleep(max(sleep_seconds, 60))
            
            # Generate and send the digest
            await _send_weekly_growth_digest()
            
        except Exception as e:
            logging.error(f"Weekly email scheduler error: {e}")
            await asyncio.sleep(3600)  # Retry in 1 hour


async def _send_weekly_growth_digest():
    """Generate and send the weekly growth email digest"""
    try:
        from email_service import send_email
        
        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).isoformat()
        prev_week_ago = (now - timedelta(days=14)).isoformat()
        
        # This week stats
        installs_week = await db.installs.count_documents({"first_open_at": {"$gte": week_ago}})
        signups_week = await db.users.count_documents({"created_at": {"$gte": week_ago}, "is_ai_profile": {"$ne": True}})
        active_week = await db.users.count_documents({"last_active": {"$gte": week_ago}, "is_ai_profile": {"$ne": True}})
        total_users = await db.users.count_documents({"is_ai_profile": {"$ne": True}})
        total_installs = await db.installs.count_documents({})
        male_signups = await db.users.count_documents({"created_at": {"$gte": week_ago}, "gender": {"$regex": "^male$", "$options": "i"}, "is_ai_profile": {"$ne": True}})
        female_signups = await db.users.count_documents({"created_at": {"$gte": week_ago}, "gender": {"$regex": "^female$", "$options": "i"}, "is_ai_profile": {"$ne": True}})
        not_registered = await db.installs.count_documents({"signup_status": "not_registered"})
        conversion = round((signups_week / installs_week * 100), 1) if installs_week > 0 else 0
        
        # Previous week for comparison
        prev_installs = await db.installs.count_documents({"first_open_at": {"$gte": prev_week_ago, "$lt": week_ago}})
        prev_signups = await db.users.count_documents({"created_at": {"$gte": prev_week_ago, "$lt": week_ago}, "is_ai_profile": {"$ne": True}})
        
        # Source breakdown
        sources = {}
        for src in ["meta_ads", "google_ads", "organic", "referral", "direct"]:
            cnt = await db.installs.count_documents({"acquisition_source": src, "first_open_at": {"$gte": week_ago}})
            if cnt > 0:
                sources[src] = cnt
        
        # ── Ad Revenue Stats ──
        total_impressions = await db.ad_impressions.count_documents({})
        week_impressions = await db.ad_impressions.count_documents({"created_at": {"$gte": week_ago}})
        prev_week_impressions = await db.ad_impressions.count_documents({"created_at": {"$gte": prev_week_ago, "$lt": week_ago}})
        
        # Breakdown by type this week
        ad_type_pipeline = [
            {"$match": {"created_at": {"$gte": week_ago}}},
            {"$group": {"_id": "$ad_type", "count": {"$sum": 1}}},
        ]
        ad_type_data = await db.ad_impressions.aggregate(ad_type_pipeline).to_list(None)
        ad_types = {t["_id"]: t["count"] for t in ad_type_data}
        
        interstitial_imp = ad_types.get("interstitial", 0)
        rewarded_imp = ad_types.get("rewarded", 0)
        banner_imp = ad_types.get("banner", 0)
        
        # eCPM-based estimated revenue (India market)
        est_revenue = round((interstitial_imp * 0.75 + rewarded_imp * 2.0 + banner_imp * 0.15) / 1000, 2)
        
        week_rewards = await db.ad_rewards.count_documents({"created_at": {"$gte": week_ago}})
        unique_ad_users = len(await db.ad_impressions.distinct("user_id", {"created_at": {"$gte": week_ago}}))
        
        def trend(current, previous):
            if previous == 0:
                return "🆕" if current > 0 else "—"
            diff = current - previous
            pct = round((diff / previous) * 100)
            return f"{'📈' if diff >= 0 else '📉'} {'+' if diff >= 0 else ''}{pct}%"
        
        source_rows = ""
        for src, cnt in sources.items():
            source_rows += f"""<tr><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;">{src.replace('_',' ').title()}</td><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">{cnt}</td></tr>"""
        
        html = f"""
        <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px;"><tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        
        <tr><td style="background:linear-gradient(135deg,#ec4899,#f97316);padding:32px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;">💕 HeartLink Weekly Growth</h1>
            <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Week of {(now - timedelta(days=7)).strftime('%d %b')} — {now.strftime('%d %b %Y')}</p>
        </td></tr>
        
        <tr><td style="padding:24px;">
            <table width="100%" cellspacing="0" cellpadding="0">
            <tr>
                <td style="padding:12px;background:#eef2ff;border-radius:12px;text-align:center;width:33%;">
                    <p style="margin:0;font-size:28px;font-weight:bold;color:#4f46e5;">{installs_week}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Installs {trend(installs_week, prev_installs)}</p>
                </td>
                <td style="width:8px;"></td>
                <td style="padding:12px;background:#ecfdf5;border-radius:12px;text-align:center;width:33%;">
                    <p style="margin:0;font-size:28px;font-weight:bold;color:#059669;">{signups_week}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Signups {trend(signups_week, prev_signups)}</p>
                </td>
                <td style="width:8px;"></td>
                <td style="padding:12px;background:#fdf2f8;border-radius:12px;text-align:center;width:33%;">
                    <p style="margin:0;font-size:28px;font-weight:bold;color:#db2777;">{conversion}%</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Conversion Rate</p>
                </td>
            </tr>
            </table>
        </td></tr>
        
        <tr><td style="padding:0 24px 24px;">
            <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr style="background:#f9fafb;"><td style="padding:10px 16px;font-weight:bold;font-size:13px;">Metric</td><td style="padding:10px 16px;font-weight:bold;font-size:13px;text-align:right;">Value</td></tr>
            <tr><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;">Total Users</td><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">{total_users}</td></tr>
            <tr><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;">Total Installs</td><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">{total_installs}</td></tr>
            <tr><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;">Active This Week</td><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">{active_week}</td></tr>
            <tr><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;">Male Signups</td><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">{male_signups}</td></tr>
            <tr><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;">Female Signups</td><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">{female_signups}</td></tr>
            <tr><td style="padding:8px 16px;">Installed but Not Registered</td><td style="padding:8px 16px;text-align:right;font-weight:bold;color:#f59e0b;">{not_registered}</td></tr>
            </table>
        </td></tr>
        
        {"<tr><td style='padding:0 24px 24px;'><h3 style='margin:0 0 8px;font-size:14px;color:#374151;'>Acquisition Sources</h3><table width='100%' cellspacing='0' cellpadding='0' style='border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;'>" + source_rows + "</table></td></tr>" if source_rows else ""}
        
        <tr><td style="padding:0 24px 24px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:#374151;">📊 Ad Revenue & Impressions</h3>
            <table width="100%" cellspacing="0" cellpadding="0">
            <tr>
                <td style="padding:12px;background:#fffbeb;border-radius:12px;text-align:center;width:33%;">
                    <p style="margin:0;font-size:24px;font-weight:bold;color:#d97706;">${est_revenue}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Est. Revenue</p>
                </td>
                <td style="width:8px;"></td>
                <td style="padding:12px;background:#eff6ff;border-radius:12px;text-align:center;width:33%;">
                    <p style="margin:0;font-size:24px;font-weight:bold;color:#2563eb;">{week_impressions}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Impressions {trend(week_impressions, prev_week_impressions)}</p>
                </td>
                <td style="width:8px;"></td>
                <td style="padding:12px;background:#f0fdf4;border-radius:12px;text-align:center;width:33%;">
                    <p style="margin:0;font-size:24px;font-weight:bold;color:#16a34a;">{unique_ad_users}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Users Reached</p>
                </td>
            </tr>
            </table>
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr style="background:#f9fafb;"><td style="padding:8px 16px;font-weight:bold;font-size:12px;">Ad Type</td><td style="padding:8px 16px;font-weight:bold;font-size:12px;text-align:right;">Count</td></tr>
            <tr><td style="padding:6px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;">Interstitial</td><td style="padding:6px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">{interstitial_imp}</td></tr>
            <tr><td style="padding:6px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;">Rewarded</td><td style="padding:6px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">{rewarded_imp}</td></tr>
            <tr><td style="padding:6px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;">Banner</td><td style="padding:6px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">{banner_imp}</td></tr>
            <tr><td style="padding:6px 16px;font-size:13px;">Rewards Given</td><td style="padding:6px 16px;text-align:right;font-weight:bold;color:#7c3aed;">{week_rewards}</td></tr>
            </table>
        </td></tr>
        
        <tr><td style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">HeartLink Admin • Auto-generated weekly digest</p>
        </td></tr>
        
        </table></td></tr></table></body></html>
        """
        
        # Send to admin emails
        admin_emails = ["shivamkks112@gmail.com"]
        subject = f"💕 HeartLink Weekly: {installs_week} installs, {signups_week} signups, ${est_revenue} ad revenue"
        
        for email in admin_emails:
            result = send_email(email, subject, html)
            logging.info(f"📧 Weekly digest sent to {email}: {result}")
        
    except Exception as e:
        logging.error(f"Weekly growth digest error: {e}")


async def notification_scheduler():
    """Background task: smart retention notifications with frequency control."""
    
    # Notification config defaults (overridable from admin)
    DEFAULT_NOTIF_CONFIG = {
        "type": "notification_config",
        "welcome_enabled": True,
        "profile_reminder_enabled": True,
        "new_user_discovery_enabled": True,
        "comeback_3d_enabled": True,
        "comeback_7d_enabled": True,
        "daily_engagement_enabled": True,
        "weekend_special_enabled": True,
        "max_notifications_per_user_per_day": 3,
    }
    
    while True:
        try:
            await asyncio.sleep(6 * 60 * 60)  # Run every 6 hours
            
            now = datetime.now(timezone.utc)
            current_hour = now.hour
            
            # Only send during active hours (9 AM to 9 PM IST = 3:30 AM to 3:30 PM UTC)
            if current_hour < 3 or current_hour > 15:
                continue
            
            logging.info("Running scheduled notification check...")
            
            # Load admin config
            notif_config = await db.app_settings.find_one({"type": "notification_config"}, {"_id": 0})
            if not notif_config:
                notif_config = {**DEFAULT_NOTIF_CONFIG}
            
            max_daily = notif_config.get("max_notifications_per_user_per_day", 3)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            
            async def can_notify(uid):
                """Check per-user daily notification limit."""
                count = await db.notification_logs.count_documents({
                    "user_id": uid, "sent_at": {"$gte": today_start}
                })
                return count < max_daily
            
            async def log_notification(uid, notif_type):
                """Log notification for frequency tracking + analytics."""
                await db.notification_logs.insert_one({
                    "user_id": uid,
                    "type": notif_type,
                    "sent_at": now.isoformat(),
                })
                await db.app_settings.update_one(
                    {"type": "notification_analytics"},
                    {"$inc": {f"{notif_type}_sent": 1}},
                    upsert=True
                )
            
            # ── 1. PROFILE COMPLETION REMINDER (24hr after signup, no photo) ──
            if notif_config.get("profile_reminder_enabled", True):
                cutoff_24h = (now - timedelta(hours=24)).isoformat()
                cutoff_30h = (now - timedelta(hours=30)).isoformat()
                incomplete_users = await db.users.find({
                    "created_at": {"$gt": cutoff_30h, "$lt": cutoff_24h},
                    "is_ai_profile": {"$ne": True},
                    "$or": [
                        {"profile_picture": {"$in": [None, ""]}},
                        {"photos": {"$in": [None, []]}},
                        {"bio": {"$in": [None, ""]}}
                    ],
                    "profile_reminder_sent": {"$ne": True},
                }, {"_id": 0, "id": 1}).to_list(50)
                
                for u in incomplete_users:
                    if await can_notify(u["id"]):
                        await fcm_service.send_to_user(db, u["id"],
                            "Complete your HeartLink profile",
                            "Add a photo and a few details so people can get to know you better.",
                            data={"type": "profile_reminder", "route": "/profile/edit"})
                        await db.users.update_one({"id": u["id"]}, {"$set": {"profile_reminder_sent": True}})
                        await log_notification(u["id"], "profile_reminder")
                
                if incomplete_users:
                    logging.info(f"Sent profile reminders to {len(incomplete_users)} users")
            
            # ── 2. 3-DAY COMEBACK ──
            if notif_config.get("comeback_3d_enabled", True):
                cutoff_3d = (now - timedelta(days=3)).isoformat()
                cutoff_3d_window = (now - timedelta(days=3, hours=6)).isoformat()
                inactive_3d = await db.users.find({
                    "last_active": {"$lt": cutoff_3d, "$gt": cutoff_3d_window},
                    "is_ai_profile": {"$ne": True},
                    "last_comeback_3d_at": {"$not": {"$gte": cutoff_3d}},
                }, {"_id": 0, "id": 1}).to_list(100)
                
                for u in inactive_3d:
                    if await can_notify(u["id"]):
                        await fcm_service.send_to_user(db, u["id"],
                            "We haven't seen you in a while",
                            "New people may have joined HeartLink. Come back and take a look.",
                            data={"type": "comeback_3d", "route": "/discover"})
                        await db.users.update_one({"id": u["id"]}, {"$set": {"last_comeback_3d_at": now.isoformat()}})
                        await log_notification(u["id"], "comeback_3d")
                
                if inactive_3d:
                    logging.info(f"Sent 3-day comeback to {len(inactive_3d)} users")
            
            # ── 3. 7-DAY COMEBACK ──
            if notif_config.get("comeback_7d_enabled", True):
                cutoff_7d = (now - timedelta(days=7)).isoformat()
                cutoff_7d_window = (now - timedelta(days=7, hours=6)).isoformat()
                inactive_7d = await db.users.find({
                    "last_active": {"$lt": cutoff_7d, "$gt": cutoff_7d_window},
                    "is_ai_profile": {"$ne": True},
                    "last_comeback_7d_at": {"$not": {"$gte": cutoff_7d}},
                }, {"_id": 0, "id": 1}).to_list(100)
                
                for u in inactive_7d:
                    if await can_notify(u["id"]):
                        await fcm_service.send_to_user(db, u["id"],
                            "Your HeartLink journey is waiting",
                            "See who's new and continue discovering meaningful connections.",
                            data={"type": "comeback_7d", "route": "/discover"})
                        await db.users.update_one({"id": u["id"]}, {"$set": {"last_comeback_7d_at": now.isoformat()}})
                        await log_notification(u["id"], "comeback_7d")
                
                if inactive_7d:
                    logging.info(f"Sent 7-day comeback to {len(inactive_7d)} users")
            
            # ── 4. WEEKEND SPECIAL ──
            if notif_config.get("weekend_special_enabled", True):
                if now.weekday() in [5, 6] and 9 <= current_hour <= 11:
                    await fcm_service.send_to_all(db,
                        "Weekend Special!",
                        "More people are online on weekends. Perfect time to find your match!")
                    logging.info("Sent weekend special")
            
            # ── 5. DAILY ENGAGEMENT + SMART RE-ENGAGEMENT ──
            if notif_config.get("daily_engagement_enabled", True):
                await _send_daily_engagement_notifications()
                await _send_unread_message_reminders()
                await _send_smart_reengagement_notifications()
                if 3 <= current_hour <= 4:
                    await _send_daily_picks()
        
        except Exception as e:
            logging.error(f"Notification scheduler error: {e}")
            await asyncio.sleep(60)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_message(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception:
                self.disconnect(user_id)
    
    async def send_badge_update(self, user_id: str):
        """Send updated badge counts to a user"""
        try:
            # Get user's likes_seen_at to only count new likes
            user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "likes_seen_at": 1})
            likes_query = {"user2_id": user_id, "user1_liked": True, "matched": False}
            if user_doc and user_doc.get("likes_seen_at"):
                likes_query["created_at"] = {"$gt": user_doc["likes_seen_at"]}
            likes_count = await db.matches.count_documents(likes_query)
            unread_msgs = await db.messages.count_documents({"receiver_id": user_id, "read": False})
            notif_count = await db.in_app_notifications.count_documents({"user_id": user_id, "is_read": False})
            await self.send_message(user_id, {
                "type": "badge_update",
                "likes_count": likes_count,
                "unread_messages": unread_msgs,
                "notification_count": notif_count
            })
        except Exception:
            pass
    
    async def broadcast_status_update(self, user_id: str, is_online: bool):
        """Broadcast user online/offline status to all connected users"""
        status_message = {
            "type": "status_update",
            "user_id": user_id,
            "is_online": is_online,
            "last_active": datetime.now(timezone.utc).isoformat()
        }
        
        # Send to all connected users
        for connected_user_id in list(self.active_connections.keys()):
            await self.send_message(connected_user_id, status_message)

manager = ConnectionManager()

# Pydantic models imported from models.schemas
# Helper functions imported from services.helpers

async def calculate_ai_compatibility(user1: dict, user2: dict) -> tuple:
    """Calculate AI-powered compatibility score"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"compat_{user1['id']}_{user2['id']}",
            system_message="You are a relationship compatibility expert. Analyze user profiles and provide compatibility score."
        ).with_model("openai", "gpt-4o-mini")
        
        prompt = f"""
        Analyze compatibility between two users:
        
        User 1: {user1['name']}, {user1['age']}, {user1['gender']}
        Bio: {user1.get('bio', 'No bio')}
        Interests: {', '.join(user1.get('interests', []))}
        Location: {user1.get('location', 'Unknown')}
        
        User 2: {user2['name']}, {user2['age']}, {user2['gender']}
        Bio: {user2.get('bio', 'No bio')}
        Interests: {', '.join(user2.get('interests', []))}
        Location: {user2.get('location', 'Unknown')}
        
        Provide:
        1. Compatibility score (0-100)
        2. Brief analysis (2-3 sentences)
        
        Format: SCORE: [number]\nANALYSIS: [text]
        """
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse response
        score = 75.0  # default
        analysis = "Good potential match based on profiles."
        
        if "SCORE:" in response:
            try:
                score_str = response.split("SCORE:")[1].split("\n")[0].strip()
                score = float(''.join(filter(str.isdigit, score_str[:3])))
            except Exception:
                pass
        
        if "ANALYSIS:" in response:
            analysis = response.split("ANALYSIS:")[1].strip()
        
        return score, analysis
    except Exception as e:
        logging.error(f"AI compatibility error: {e}")
        return 70.0, "Profiles show good compatibility potential."

async def verify_profile_with_ai(user_data: dict) -> tuple:
    """AI-powered profile verification - More lenient approach"""
    try:
        # Basic validation checks first
        name = user_data.get('name', '')
        age = user_data.get('age', 0)
        bio = user_data.get('bio', '')
        interests = user_data.get('interests', [])
        
        # Auto-reject obvious spam/fake profiles
        spam_keywords = ['http://', 'https://', 'www.', 'whatsapp', 'telegram', 'snapchat', 'instagram', 'onlyfans']
        if any(keyword in name.lower() for keyword in spam_keywords):
            return False, "Profile contains suspicious content (URLs/Social media handles)"
        
        if any(keyword in bio.lower() for keyword in spam_keywords):
            return False, "Bio contains suspicious links or social media handles"
        
        # Check age validity
        if age < 18 or age > 100:
            return False, "Invalid age - Must be between 18-100"
        
        # Check if profile has minimum information
        if not name or len(name) < 2:
            return False, "Name is too short"
        
        # If basic checks pass, auto-verify for now (can enable AI later)
        # AI verification can be too strict, so we'll use basic rules
        if len(bio) > 10 and len(interests) > 0:
            return True, "✅ Profile verified successfully!"
        else:
            return False, "Profile needs more information (bio and interests required)"
            
        # Optional: AI verification (currently disabled for better UX)
        # api_key = os.environ.get('EMERGENT_LLM_KEY')
        # chat = LlmChat(
        #     api_key=api_key,
        #     session_id=f"verify_{user_data['id']}",
        #     system_message="You are a profile verification expert. Check if profile seems authentic."
        # ).with_model("openai", "gpt-4o-mini")
        # 
        # prompt = f"""
        # Verify this dating profile for authenticity:
        # 
        # Name: {name}
        # Age: {age}
        # Bio: {bio}
        # Interests: {', '.join(interests)}
        # 
        # Check for:
        # 1. Realistic information
        # 2. Appropriate content
        # 3. Spam/scam indicators
        # 
        # Respond with: VERIFIED or REJECTED
        # Reason: [brief explanation]
        # """
        # 
        # response = await chat.send_message(UserMessage(text=prompt))
        # 
        # if "VERIFIED" in response.upper():
        #     return True, "Profile verified by AI"
        # else:
        #     return False, "Profile needs manual review"
    except Exception as e:
        logging.error(f"AI verification error: {e}")
        return False, "Verification system error - Please try again"

# Authentication Routes

# ==================== EMAIL OTP FOR SIGNUP ====================

@api_router.post("/auth/send-signup-otp")
@limiter.limit("5/minute")
async def send_signup_otp(request: Request):
    """Send 6-digit OTP to email for signup verification. Rate limited."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request")
    
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    
    # Check if email already registered
    existing = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered. Please login instead.")
    
    # Generate 6-digit OTP
    otp_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    otp_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store OTP in DB (upsert — replaces any previous OTP for this email)
    await db.signup_otps.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "otp_code": otp_code,
            "expires_at": otp_expires.isoformat(),
            "attempts": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Send OTP email
    try:
        from email_service import send_otp_email
        result = send_otp_email(to_email=email, otp_code=otp_code, user_name="HeartLink User")
        if result.get("success"):
            logger.info(f"Signup OTP sent to {email}")
            return {"message": "OTP sent to your email", "email": email}
        else:
            logger.error(f"Failed to send signup OTP: {result}")
            raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup OTP email error: {e}")
        raise HTTPException(status_code=500, detail="Email service error. Please try again.")


@api_router.post("/auth/verify-signup-otp")
@limiter.limit("10/minute")
async def verify_signup_otp(request: Request):
    """Verify the signup OTP code."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request")
    
    email = (data.get("email") or "").strip().lower()
    otp_input = (data.get("otp") or "").strip()
    
    if not email or not otp_input:
        raise HTTPException(status_code=400, detail="Email and OTP are required")
    
    # Find stored OTP
    stored = await db.signup_otps.find_one({"email": email})
    if not stored:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new OTP.")
    
    # Check attempts (max 5)
    if stored.get("attempts", 0) >= 5:
        await db.signup_otps.delete_one({"email": email})
        raise HTTPException(status_code=400, detail="Too many attempts. Please request a new OTP.")
    
    # Increment attempts
    await db.signup_otps.update_one({"email": email}, {"$inc": {"attempts": 1}})
    
    # Check expiry
    expires = stored.get("expires_at", "")
    if expires:
        try:
            exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp_dt:
                await db.signup_otps.delete_one({"email": email})
                raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP.")
        except (ValueError, TypeError):
            pass
    
    # Verify code
    if stored.get("otp_code") != otp_input:
        remaining = 5 - stored.get("attempts", 0) - 1
        raise HTTPException(status_code=400, detail=f"Incorrect OTP. {remaining} attempts remaining.")
    
    # OTP verified — mark email as verified and clean up
    await db.signup_otps.update_one(
        {"email": email},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Email verified successfully", "email": email, "verified": True}


@api_router.post("/auth/signup")
@limiter.limit(RATE_LIMITS["register"])
async def signup(request: Request, user_data: UserSignup):
    """
    User signup endpoint - SECURE VERSION
    - Rate limited to prevent spam registrations
    - Input validation and sanitization
    - Strong password hashing with bcrypt
    - JWT token generation
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Verify email OTP was completed before allowing signup
    if user_data.email:
        otp_record = await db.signup_otps.find_one({"email": user_data.email.strip().lower(), "verified": True})
        if not otp_record:
            raise HTTPException(status_code=400, detail="Please verify your email with OTP before signing up.")
    
    # Validate email format
    if user_data.email and not validate_email(user_data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Validate phone format
    if user_data.phone and not validate_phone(user_data.phone):
        raise HTTPException(status_code=400, detail="Invalid phone format")
    
    # Validate password strength
    is_strong, message = validate_password_strength(user_data.password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=message)
    
    # Sanitize inputs
    sanitized_name = sanitize_string(user_data.name, max_length=100)
    sanitized_bio = sanitize_string(user_data.bio, max_length=500) if user_data.bio else ""
    
    # === MANDATORY CHECKS ===
    
    # 1. At least email OR phone must be provided
    if not user_data.email and not user_data.phone:
        raise HTTPException(status_code=400, detail="Email ya Mobile Number mein se ek dena zaroori hai")
    
    # 2. Block social media handles, telegram, whatsapp mentions in name/bio
    blocked_patterns = [
        r'\btelegram\b', r'\btele\s*gram\b', r'\bt\.me\b', r'\b@\w+',
        r'\bwhatsapp\b', r'\bwhats\s*app\b', r'\bwa\.me\b',
        r'\binstagram\b', r'\binsta\b', r'\bsnapchat\b', r'\bsnap\b',
        r'\bfacebook\b', r'\bfb\b', r'\btwitter\b',
        r'\bsignal\b', r'\bdiscord\b', r'\bskype\b',
        r'\btg\s*:\s*\w+', r'\btg\b',
    ]
    
    text_to_check = f"{sanitized_name} {sanitized_bio}".lower()
    for pattern in blocked_patterns:
        if re.search(pattern, text_to_check, re.IGNORECASE):
            raise HTTPException(status_code=400, detail="Name ya Bio mein social media handles (Telegram, WhatsApp, Instagram etc.) allowed nahi hai. Safety ke liye sirf app ke andar chat karein.")
    
    # 4. Block numeric values / phone numbers in name and bio
    # Name should not contain digits at all
    if re.search(r'\d', sanitized_name):
        raise HTTPException(status_code=400, detail="Name mein numbers allowed nahi hain")
    
    # Bio should not contain phone-like numbers (5+ consecutive digits)
    if sanitized_bio and re.search(r'\d{5,}', sanitized_bio):
        raise HTTPException(status_code=400, detail="Bio mein phone number ya numeric values allowed nahi hain. Safety ke liye apna number share na karein.")
    
    # Check if user exists - CASE INSENSITIVE for email, NORMALIZED for phone
    if user_data.email:
        email_lower = user_data.email.lower().strip()
        existing = await db.users.find_one({
            "$or": [
                {"email": email_lower},
                {"email": {"$regex": f"^{email_lower}$", "$options": "i"}}
            ]
        })
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    if user_data.phone:
        # Normalize phone - remove spaces, dashes, and ensure +91 format
        phone_normalized = user_data.phone.strip().replace(" ", "").replace("-", "")
        if not phone_normalized.startswith('+'):
            phone_normalized = '+91' + phone_normalized.lstrip('0')
        
        # Check all variations of this phone
        phone_digits = phone_normalized.replace('+', '').replace('91', '', 1) if phone_normalized.startswith('+91') else phone_normalized
        existing = await db.users.find_one({
            "$or": [
                {"phone": phone_normalized},
                {"phone": phone_digits},
                {"phone": "+91" + phone_digits},
                {"phone": "91" + phone_digits},
                {"phone": {"$regex": phone_digits + "$"}}
            ]
        })
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # CROSS-CHECK: If email provided, check if phone already linked to another account & vice versa
    if user_data.email and user_data.phone:
        email_lower = user_data.email.lower().strip()
        phone_normalized = user_data.phone.strip().replace(" ", "").replace("-", "")
        if not phone_normalized.startswith('+'):
            phone_normalized = '+91' + phone_normalized.lstrip('0')
        phone_digits = phone_normalized.replace('+', '').replace('91', '', 1) if phone_normalized.startswith('+91') else phone_normalized
        
        cross_check = await db.users.find_one({
            "$or": [
                {"phone": phone_normalized},
                {"phone": phone_digits},
                {"phone": "+91" + phone_digits},
                {"phone": {"$regex": phone_digits + "$"}},
                {"email": email_lower},
                {"email": {"$regex": f"^{email_lower}$", "$options": "i"}}
            ]
        })
        if cross_check:
            raise HTTPException(status_code=400, detail="An account already exists with this email or phone number. Please login instead.")
    
    # DEVICE/IP duplicate check - prevent same device creating multiple accounts
    existing_from_ip = await db.users.count_documents({
        "registered_ip": client_ip,
        "registered_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
    })
    if existing_from_ip >= 2:
        raise HTTPException(status_code=429, detail="Too many accounts created from this device. Please try again later.")
    
    # ADVANCED DUPLICATE DETECTION - Same email (case insensitive) is the primary check
    # Removed overly aggressive name+location+age check that blocks legitimate users
    
    # INDIA-ONLY RESTRICTION - Block non-Indian locations
    location = user_data.location.strip().lower() if user_data.location else ""
    if location and not is_indian_location(location):
        raise HTTPException(
            status_code=400,
            detail="HeartLink is currently available only in India. Please enter an Indian city or state."
        )
    
    try:
        # Create user dict from signup data
        user_dict = user_data.dict() if hasattr(user_data, 'dict') else user_data.model_dump()
        
        # Use bcrypt for password hashing (more secure than SHA256)
        user_dict["password_hash"] = hash_password_secure(user_data.password)
        del user_dict["password"]
        
        # Apply sanitized values
        user_dict["name"] = sanitized_name
        user_dict["bio"] = sanitized_bio
        
        # Add security metadata
        user_dict["registered_ip"] = client_ip
        user_dict["registered_at"] = datetime.now(timezone.utc).isoformat()
        
        # Create User object to get all defaults (privacy_settings, etc.)
        user = User(**user_dict)
        user_dict_for_db = user.dict() if hasattr(user, 'dict') else user.model_dump()
        
        # Remove null/None phone and email to avoid sparse unique index conflicts
        if not user_dict_for_db.get("phone"):
            user_dict_for_db.pop("phone", None)
        if not user_dict_for_db.get("email"):
            user_dict_for_db.pop("email", None)
        
        # Insert into database
        insert_result = await db.users.insert_one(user_dict_for_db)
        
        # Fetch the created user from database
        created_user = await db.users.find_one({"id": user.id})
        if not created_user:
            raise HTTPException(status_code=500, detail="User created but not found")
        
        # Send welcome notification via in-app + FCM push (respects admin toggle)
        try:
            notif_cfg = await db.app_settings.find_one({"type": "notification_config"}, {"_id": 0})
            welcome_on = notif_cfg.get("welcome_enabled", True) if notif_cfg else True
            if welcome_on:
                await create_in_app_notification(
                    user_id=user.id,
                    title="Welcome to HeartLink!",
                    body="Your profile is being reviewed by our team. You'll be notified once approved. This usually takes 24-48 hours.",
                    notification_type="welcome",
                    data={"action": "open_discover", "route": "/discover"}
                )
                await fcm_service.notify_welcome(db, user.id, sanitized_name)
                # Log for analytics
                await db.notification_logs.insert_one({
                    "user_id": user.id, "type": "welcome",
                    "sent_at": datetime.now(timezone.utc).isoformat()
                })
                await db.app_settings.update_one(
                    {"type": "notification_analytics"},
                    {"$inc": {"welcome_sent": 1}},
                    upsert=True
                )
        except Exception as notif_error:
            logger.warning(f"Failed to send signup notification: {notif_error}")
        
        # Create JWT tokens for immediate login
        token_data = {"user_id": user.id, "email": user_data.email}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        # Audit log
        audit_log.log_event("signup_success", user_id=user.id, ip=client_ip)
        
        # Link install record if installation_id provided
        installation_id = user_data.dict().get("installation_id") if hasattr(user_data, 'installation_id') else None
        if not installation_id:
            # Try from request body directly
            try:
                body = await request.body()
                import json as _json
                raw = _json.loads(body)
                installation_id = raw.get("installation_id")
            except Exception:
                pass
        if installation_id:
            await db.installs.update_one(
                {"installation_id": installation_id},
                {"$set": {
                    "signup_status": "registered",
                    "signup_at": datetime.now(timezone.utc).isoformat(),
                    "user_id": user.id
                },
                "$push": {"events": {"type": "signup_completed", "timestamp": datetime.now(timezone.utc).isoformat()}}},
                upsert=False
            )
        
        # === AUTOMATIC NOTIFICATIONS ===
        # Notify all users about new user joining
        asyncio.create_task(_notify_new_user_joined(user.id, sanitized_name, user_dict.get("gender", ""), user_dict.get("location", "")))
        
        # Auto-match AI girl profiles — DELAYED to feel natural (2-6 hours after signup)
        asyncio.create_task(
            _delayed_ai_match(user.id, user_dict.get("gender", ""), user_dict.get("looking_for", ""))
        )
        
        # Serialize for response (removes _id, password_hash, cleans None values)
        clean_user = serialize_user_for_response(created_user, exclude_password=True)
        
        # Clean up OTP record after successful signup
        if user_data.email:
            await db.signup_otps.delete_one({"email": user_data.email.strip().lower()})
        
        return {
            "message": "Signup successful",
            "user_id": user.id,
            "user": clean_user,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

@api_router.post("/auth/login")
@limiter.limit(RATE_LIMITS["login"])
async def login(request: Request, credentials: UserLogin):
    """
    User login endpoint - SECURE VERSION
    - Rate limited to prevent brute force
    - Suspicious activity detection
    - JWT token based authentication
    - Password rehashing for migration
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Find user by email or phone
    user = await db.users.find_one({
        "$or": [
            {"email": credentials.email_or_phone},
            {"phone": credentials.email_or_phone}
        ]
    })
    
    if not user:
        # Record failed login attempt
        is_suspicious = activity_detector.record_failed_login(client_ip)
        if is_suspicious:
            audit_log.log_event("suspicious_login_attempts", ip=client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if account is temporarily locked
    failed_attempts = user.get("failed_login_attempts", 0)
    locked_until = user.get("account_locked_until")
    if locked_until:
        lock_time = datetime.fromisoformat(locked_until)
        if datetime.now(timezone.utc) < lock_time:
            remaining = int((lock_time - datetime.now(timezone.utc)).total_seconds() / 60)
            raise HTTPException(status_code=423, detail=f"Account locked. Try again in {remaining} minutes.")
        else:
            # Lock expired, reset
            await db.users.update_one({"id": user["id"]}, {"$set": {"failed_login_attempts": 0}, "$unset": {"account_locked_until": ""}})
            failed_attempts = 0
    
    # Verify password (supports both bcrypt and legacy SHA256)
    if not verify_password_secure(credentials.password, user["password_hash"]):
        # Increment failed attempts
        new_attempts = failed_attempts + 1
        update = {"$set": {"failed_login_attempts": new_attempts}}
        
        # Lock account after 5 failed attempts for 15 minutes
        if new_attempts >= 5:
            lock_until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
            update["$set"]["account_locked_until"] = lock_until
            
        await db.users.update_one({"id": user["id"]}, update)
        
        is_suspicious = activity_detector.record_failed_login(client_ip)
        if is_suspicious:
            audit_log.log_event("suspicious_login_attempts", user_id=user["id"], ip=client_ip)
        
        remaining = 5 - new_attempts
        if remaining > 0:
            raise HTTPException(status_code=401, detail=f"Invalid credentials. {remaining} attempts remaining.")
        else:
            raise HTTPException(status_code=423, detail="Account locked for 15 minutes due to too many failed attempts.")
    
    # Check if user is banned
    if user.get("is_permanently_banned"):
        raise HTTPException(status_code=403, detail="Account has been permanently banned")
    
    # Clear failed login records on successful login
    activity_detector.clear_failed_logins(client_ip)
    await db.users.update_one({"id": user["id"]}, {"$set": {"failed_login_attempts": 0}, "$unset": {"account_locked_until": ""}})
    
    # Rehash password if using old SHA256 (migration to bcrypt)
    if needs_password_rehash(user["password_hash"]):
        new_hash = hash_password_secure(credentials.password)
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"password_hash": new_hash}}
        )
    
    # Create JWT tokens
    token_data = {"user_id": user["id"], "email": user.get("email")}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    # Update last login — store prev_last_active for welcome-back check
    prev_last_active = user.get("last_active")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "last_login": datetime.now(timezone.utc).isoformat(),
            "last_login_ip": client_ip,
            "is_online": True,
            "last_active": datetime.now(timezone.utc).isoformat(),
            "prev_last_active": prev_last_active
        }}
    )
    
    # Audit log
    audit_log.log_event("login_success", user_id=user["id"], ip=client_ip)
    
    # === AUTOMATIC NOTIFICATIONS ===
    # Notify matched users that this user is online
    asyncio.create_task(_notify_matches_user_online(user["id"], user.get("name", "Someone")))
    
    # Serialize for response (removes _id, password_hash, cleans None values)
    clean_user = serialize_user_for_response(user, exclude_password=True)
    
    # Flag profile as incomplete if no profile photo
    has_photo = bool(user.get("profile_picture") or (user.get("photos") and len(user.get("photos", [])) > 0))
    clean_user["profile_incomplete"] = not has_photo
    
    return {
        "message": "Login successful",
        "user": clean_user,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@api_router.post("/auth/phone-login")
async def phone_login(credentials: PhoneLogin):
    """
    Phone OTP login - Firebase verified
    """
    # Normalize phone number
    phone = credentials.phone
    if not phone.startswith('+'):
        phone = '+' + phone
    
    # Find user by phone
    user = await db.users.find_one({
        "$or": [
            {"phone": phone},
            {"phone": phone.replace('+91', '')},
            {"phone": phone.replace('+', '')}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please sign up first.")
    
    # Update firebase_uid if not set
    if not user.get("firebase_uid"):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"firebase_uid": credentials.firebase_uid}}
        )
    
    # Invalidate cache
    invalidate_user_cache(user["id"])
    
    # Notify matched users that this user is online
    asyncio.create_task(_notify_matches_user_online(user["id"], user.get("name", "Someone")))
    
    # Serialize for response
    clean_user = serialize_user_for_response(user, exclude_password=True)
    
    has_photo = bool(user.get("profile_picture") or (user.get("photos") and len(user.get("photos", [])) > 0))
    clean_user["profile_incomplete"] = not has_photo
    
    return {"message": "Login successful", "user": clean_user}



@api_router.post("/auth/phone-signup")
async def phone_signup(data: PhoneSignup):
    """
    Phone signup - for users who verified via OTP
    """
    # === MANDATORY CHECKS ===
    # 1. Profile photo is mandatory
    if not data.photos or len(data.photos) == 0:
        raise HTTPException(status_code=400, detail="Profile photo upload karna zaroori hai")
    
    # 2. Block social media handles in name/bio
    blocked_patterns = [
        r'\btelegram\b', r'\btele\s*gram\b', r'\bt\.me\b', r'\b@\w+',
        r'\bwhatsapp\b', r'\bwhats\s*app\b', r'\bwa\.me\b',
        r'\binstagram\b', r'\binsta\b', r'\bsnapchat\b', r'\bsnap\b',
        r'\bfacebook\b', r'\bfb\b', r'\btwitter\b',
        r'\bsignal\b', r'\bdiscord\b', r'\bskype\b',
        r'\btg\s*:\s*\w+', r'\btg\b',
    ]
    
    text_to_check = f"{data.name} {data.bio}".lower()
    for pattern in blocked_patterns:
        if re.search(pattern, text_to_check, re.IGNORECASE):
            raise HTTPException(status_code=400, detail="Name ya Bio mein social media handles allowed nahi hai. Safety ke liye sirf app ke andar chat karein.")
    
    # 3. Block numbers in name
    if re.search(r'\d', data.name):
        raise HTTPException(status_code=400, detail="Name mein numbers allowed nahi hain")
    
    # 4. Block phone numbers in bio
    if data.bio and re.search(r'\d{5,}', data.bio):
        raise HTTPException(status_code=400, detail="Bio mein phone number ya numeric values allowed nahi hain.")
    
    # Normalize phone - comprehensive normalization
    phone = data.phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith('+'):
        if phone.startswith('91'):
            phone = '+' + phone
        else:
            phone = '+91' + phone.lstrip('0')
    
    # Extract just the digits for matching
    phone_digits = phone.replace('+', '').replace('91', '', 1) if phone.startswith('+91') else phone.replace('+', '')
    
    # Check if user already exists - check all phone variations AND email cross-check
    existing = await db.users.find_one({
        "$or": [
            {"phone": phone},
            {"phone": phone_digits},
            {"phone": "+91" + phone_digits},
            {"phone": "91" + phone_digits},
            {"phone": {"$regex": phone_digits + "$"}},
            {"firebase_uid": data.firebase_uid}
        ]
    })
    
    if existing:
        # If account exists, auto-link phone and return existing user (instead of creating duplicate)
        if not existing.get("phone") or existing.get("phone") != phone:
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {"phone": phone, "firebase_uid": data.firebase_uid, "verified": True}}
            )
        updated_user = await db.users.find_one({"id": existing["id"]})
        clean_user = serialize_user_for_response(updated_user, exclude_password=True)
        return {"message": "Account found and phone linked. Please login.", "user": clean_user, "existing": True}
    
    # Create user
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        phone=phone,
        password_hash=hash_password(str(uuid.uuid4())),  # Random password since using OTP
        name=data.name,
        age=data.age,
        gender=data.gender,
        looking_for=data.looking_for,
        location=data.location,
        bio=data.bio,
        interests=data.interests,
        photos=data.photos,
        relationship_status=data.relationship_status,
        verified=True  # Phone verified via OTP
    )
    
    user_dict = user.dict()
    user_dict["firebase_uid"] = data.firebase_uid
    user_dict.pop("_id", None)
    # Remove null email to avoid sparse unique index conflicts
    if not user_dict.get("email"):
        user_dict.pop("email", None)
    
    await db.users.insert_one(user_dict)
    
    # Fetch created user
    created_user = await db.users.find_one({"id": user_id})
    clean_user = serialize_user_for_response(created_user, exclude_password=True)
    
    # Send welcome notification via in-app + FCM push
    try:
        await create_in_app_notification(
            user_id=user_id,
            title="Welcome to HeartLink!",
            body="Your profile is being reviewed by our team. You'll be notified once approved. This usually takes 24-48 hours.",
            notification_type="welcome",
            data={"action": "open_discover", "route": "/discover"}
        )
        await fcm_service.notify_welcome(db, user_id, data.name)
    except Exception as notif_error:
        logger.warning(f"Failed to send phone signup notification: {notif_error}")
    
    # Notify all users about new user joining
    asyncio.create_task(_notify_new_user_joined(user_id, data.name, data.gender, data.location))
    
    # Auto-match AI girl profiles — DELAYED to feel natural
    asyncio.create_task(
        _delayed_ai_match(user_id, data.gender, data.looking_for)
    )
    
    return {"message": "Signup successful", "user": clean_user}


@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Request password reset - generates 6-digit OTP"""
    # Find user
    user = await db.users.find_one({
        "$or": [
            {"email": request.email_or_phone},
            {"phone": request.email_or_phone}
        ]
    })
    
    if not user:
        # For security, don't reveal if user exists
        return {"message": "If account exists, reset code has been sent"}
    
    # Generate 6-digit OTP
    import random
    reset_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    reset_expires = datetime.now(timezone.utc) + timedelta(minutes=15)  # 15 min expiry
    
    # Store reset code in database
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_reset_code": reset_code,
            "password_reset_expires": reset_expires.isoformat()
        }}
    )
    
    # Send OTP via email (if user has email)
    if user.get("email"):
        try:
            from email_service import send_otp_email
            
            # Send OTP email using Titan SMTP
            result = send_otp_email(
                to_email=user.get('email'),
                otp_code=reset_code,
                user_name=user.get('name', 'User')
            )
            
            if result.get('success'):
                logger.info(f"✅ OTP email sent successfully to {user.get('email')}")
                return {
                    "message": "Reset code sent to your email",
                    "email": user.get('email')
                }
            else:
                logger.error(f"❌ Failed to send OTP email: {result.get('error')}")
                return {
                    "message": "Reset code generated but email failed",
                    "dev_otp": reset_code,  # Fallback for development
                    "note": "Email service error. OTP: " + reset_code
                }
        except Exception as e:
            logger.error(f"Failed to send OTP email: {e}")
            return {
                "message": "Reset code generated but email failed",
                "dev_otp": reset_code,  # For development
                "note": "Email service error. OTP: " + reset_code
            }
    else:
        # For phone-based users (SMS not implemented)
        logger.info(f"Password reset OTP for phone user: {reset_code}")
        return {
            "message": "Reset code generated",
            "dev_otp": reset_code,  # For development
            "note": "SMS service not configured. OTP: " + reset_code
        }

@api_router.post("/auth/verify-reset-code")
async def verify_reset_code(email_or_phone: str, reset_code: str):
    """Verify the reset code"""
    user = await db.users.find_one({
        "$or": [
            {"email": email_or_phone},
            {"phone": email_or_phone}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if code exists and matches
    if not user.get("password_reset_code"):
        raise HTTPException(status_code=400, detail="No reset code requested")
    
    if user["password_reset_code"] != reset_code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    # Check if code expired
    expires_at = datetime.fromisoformat(user["password_reset_expires"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset code expired")
    
    return {"message": "Code verified", "valid": True}

@api_router.post("/auth/reset-password")
@limiter.limit(RATE_LIMITS["forgot_password"])
async def reset_password(request: Request, data: ResetPasswordRequest):
    """Reset password using verified code - SECURE VERSION"""
    # Validate new password strength
    is_strong, message = validate_password_strength(data.new_password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=message)
    
    # Find user
    user = await db.users.find_one({
        "$or": [
            {"email": data.email_or_phone},
            {"phone": data.email_or_phone}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify code
    if not user.get("password_reset_code"):
        raise HTTPException(status_code=400, detail="No reset code requested")
    
    if user["password_reset_code"] != data.reset_code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    # Check if code expired
    expires_at = datetime.fromisoformat(user["password_reset_expires"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset code expired")
    
    # Update password with bcrypt
    new_password_hash = hash_password_secure(data.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": new_password_hash,
            "password_reset_code": None,
            "password_reset_expires": None
        }}
    )
    
    # Audit log
    audit_log.log_event("password_reset", user_id=user["id"])
    
    return {"message": "Password reset successful"}


# ===========================================
# SECURE TOKEN & SESSION ENDPOINTS
# ===========================================



@api_router.post("/auth/refresh-token")
async def refresh_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token"""
    payload = verify_refresh_token(request.refresh_token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    # Create new access token
    token_data = {"user_id": payload.get("user_id"), "email": payload.get("email")}
    new_access_token = create_access_token(token_data)
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }

@api_router.post("/auth/logout/{user_id}")
async def logout(user_id: str):
    """Logout user and update online status"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_online": False,
            "last_active": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Revoke all sessions (optional - for complete logout)
    session_manager.revoke_all_sessions(user_id)
    
    # Audit log
    audit_log.log_event("logout", user_id=user_id)
    
    return {"message": "Logged out successfully"}

@api_router.get("/auth/verify-token")
async def verify_token(token: str):
    """Verify if a token is valid"""
    payload = verify_access_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return {
        "valid": True,
        "user_id": payload.get("user_id"),
        "expires_at": payload.get("exp")
    }

@api_router.get("/security/sessions/{user_id}")
async def get_user_sessions(user_id: str):
    """Get all active sessions for a user"""
    sessions = session_manager.get_active_sessions(user_id)
    return {"sessions": sessions}

@api_router.post("/security/revoke-session")
async def revoke_session(user_id: str, session_id: str):
    """Revoke a specific session"""
    session_manager.revoke_session(user_id, session_id)
    audit_log.log_event("session_revoked", user_id=user_id, details={"session_id": session_id})
    return {"message": "Session revoked"}

@api_router.post("/security/revoke-all-sessions/{user_id}")
async def revoke_all_user_sessions(user_id: str, current_session: Optional[str] = None):
    """Revoke all sessions except current one (logout from all devices)"""
    session_manager.revoke_all_sessions(user_id, except_session=current_session)
    audit_log.log_event("all_sessions_revoked", user_id=user_id)
    return {"message": "All other sessions revoked"}



@api_router.post("/security/change-password")
async def change_password(request: ChangePasswordRequest):
    """Change password (requires current password)"""
    # Validate new password strength
    is_strong, message = validate_password_strength(request.new_password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=message)
    
    # Find user
    user = await db.users.find_one({"id": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password_secure(request.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Check if new password is same as old
    if verify_password_secure(request.new_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    
    # Update password
    new_hash = hash_password_secure(request.new_password)
    await db.users.update_one(
        {"id": request.user_id},
        {"$set": {
            "password_hash": new_hash,
            "password_changed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Revoke all other sessions for security
    session_manager.revoke_all_sessions(request.user_id)
    
    # Audit log
    audit_log.log_event("password_changed", user_id=request.user_id)
    
    return {"message": "Password changed successfully. Please login again on all devices."}

@api_router.get("/security/audit-log/{user_id}")
async def get_security_audit_log(user_id: str):
    """Get security audit log for user (login history, etc.)"""
    # In production, fetch from database
    # For now, return recent login info from user document
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "last_login": 1, "last_login_ip": 1, "registered_at": 1})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "last_login": user.get("last_login"),
        "last_login_ip": user.get("last_login_ip"),
        "account_created": user.get("registered_at")
    }



@api_router.post("/delete-account-request")
async def delete_account_request(request: DeleteAccountRequest):
    """Handle account deletion request - stores request for admin review"""
    try:
        # Check if user exists
        user = await db.users.find_one({"email": request.email})
        
        if not user:
            # For security, don't reveal if user exists
            return {
                "message": "Deletion request received. If account exists, it will be processed within 24-48 hours.",
                "success": True
            }
        
        # Store deletion request in database
        deletion_request = {
            "id": str(uuid.uuid4()),
            "email": request.email,
            "user_id": user.get("id"),
            "user_name": user.get("name"),
            "reason": request.reason,
            "requested_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending",  # pending, processed, completed
            "processed_at": None
        }
        
        await db.deletion_requests.insert_one(deletion_request)
        
        # Send notification email to user
        try:
            from email_service import send_email
            
            email_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 30px; border-radius: 15px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Account Deletion Request Received</h1>
                </div>
                
                <div style="background: #f9fafb; padding: 30px; border-radius: 15px; margin-top: 20px;">
                    <p style="font-size: 16px; color: #374151;">Hello {user.get('name', 'User')},</p>
                    
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        We've received your request to delete your HeartLink account and all associated data.
                    </p>
                    
                    <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ef4444;">
                        <h3 style="color: #ef4444; margin-top: 0;">⏱️ What happens next?</h3>
                        <ul style="color: #374151; line-height: 1.8;">
                            <li>Your request will be processed within <strong>24-48 hours</strong></li>
                            <li>All your data (profile, photos, messages, matches) will be permanently deleted</li>
                            <li>You'll receive a confirmation email once deletion is complete</li>
                        </ul>
                    </div>
                    
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        If you didn't request this deletion or changed your mind, please contact us immediately at 
                        <a href="mailto:help@heartlink.co.in" style="color: #ec4899; text-decoration: none; font-weight: bold;">help@heartlink.co.in</a>
                    </p>
                    
                    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                        Best regards,<br>
                        <strong>HeartLink Team</strong>
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
                    <p>© 2025 HeartLink. All rights reserved.</p>
                </div>
            </body>
            </html>
            """
            
            send_email(
                to_email=request.email,
                subject="HeartLink - Account Deletion Request Received",
                html_body=email_body
            )
            logger.info(f"✅ Deletion request confirmation email sent to {request.email}")
        except Exception as email_error:
            logger.error(f"Failed to send deletion confirmation email: {email_error}")
            # Continue even if email fails
        
        return {
            "message": "Deletion request submitted successfully. You'll receive a confirmation email shortly.",
            "success": True
        }
        
    except Exception as e:
        logger.error(f"Error processing deletion request: {e}")
        raise HTTPException(status_code=500, detail="Failed to process deletion request")

# Profile Routes
@api_router.get("/profile/{user_id}")
async def get_profile(user_id: str):
    """Get user profile - OPTIMIZED with caching"""
    # Check cache first
    cached = get_cached_user(user_id)
    if cached:
        return cached
    
    # Use projection to fetch only needed fields (faster query)
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0}  # Exclude these fields in query itself
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Clean and cache
    clean_user = clean_user_data(user)
    set_cached_user(user_id, clean_user)
    return clean_user

@api_router.put("/profile/{user_id}")
async def update_profile(user_id: str, updates: dict):
    """Update user profile - OPTIMIZED"""
    # Remove sensitive/locked fields that should NEVER be changed directly
    # Email and phone can only be updated via dedicated link endpoints
    locked_fields = ["password_hash", "id", "_id", "name", "gender", "email", "phone", "firebase_uid", "created_at"]
    for field in locked_fields:
        updates.pop(field, None)
    
    # Filter out None values to prevent validation errors
    filtered_updates = {k: v for k, v in updates.items() if v is not None}
    
    # === CONTENT VALIDATION on bio/about_me ===
    blocked_patterns = [
        r'\btelegram\b', r'\btele\s*gram\b', r'\bt\.me\b', r'\b@\w+',
        r'\bwhatsapp\b', r'\bwhats\s*app\b', r'\bwa\.me\b',
        r'\binstagram\b', r'\binsta\b', r'\bsnapchat\b', r'\bsnap\b',
        r'\bfacebook\b', r'\bfb\b', r'\btwitter\b',
        r'\bsignal\b', r'\bdiscord\b', r'\bskype\b',
        r'\btg\s*:\s*\w+', r'\btg\b',
    ]
    
    text_fields = []
    if filtered_updates.get("bio"):
        text_fields.append(filtered_updates["bio"])
    if filtered_updates.get("about_me"):
        text_fields.append(filtered_updates["about_me"])
    
    for text in text_fields:
        for pattern in blocked_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                raise HTTPException(status_code=400, detail="Bio mein social media handles (Telegram, WhatsApp, Instagram etc.) allowed nahi hai.")
        if re.search(r'\d{5,}', text):
            raise HTTPException(status_code=400, detail="Bio mein phone number ya numeric values allowed nahi hain.")
    
    # Update user
    result = await db.users.update_one({"id": user_id}, {"$set": filtered_updates})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Invalidate cache
    invalidate_user_cache(user_id)
    
    # Fetch updated user with projection
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found after update")
    
    # Clean and update cache
    clean_user = clean_user_data(user)
    set_cached_user(user_id, clean_user)
    return clean_user


# ==================== EMAIL/PHONE LINKING ====================




@api_router.post("/profile/{user_id}/link-email")
async def link_email_to_profile(user_id: str, data: LinkEmailRequest):
    """
    Link email to existing account (for phone-signup users)
    - Validates email format
    - Checks if email already used by another account
    - If email exists with different account, offers to merge
    """
    # Validate email
    if not validate_email(data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    email_lower = data.email.lower().strip()
    
    # Get current user
    current_user = await db.users.find_one({"id": user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already has email
    if current_user.get("email"):
        raise HTTPException(status_code=400, detail="Account already has an email linked")
    
    # Check if email exists with another account
    existing_email_user = await db.users.find_one({
        "email": {"$regex": f"^{email_lower}$", "$options": "i"},
        "id": {"$ne": user_id}
    })
    
    if existing_email_user:
        # Email exists - check if that account has no phone (can merge)
        if not existing_email_user.get("phone") and current_user.get("phone"):
            # Merge: Transfer email account data to phone account
            return {
                "status": "merge_available",
                "message": "This email is linked to another account. Would you like to merge accounts?",
                "existing_user_id": existing_email_user.get("id"),
                "action": "call /profile/{user_id}/merge-accounts to merge"
            }
        else:
            raise HTTPException(status_code=400, detail="Email already registered with another account")
    
    # Validate password strength
    is_strong, message = validate_password_strength(data.password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=message)
    
    # Link email to account
    password_hash = hash_password_secure(data.password)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "email": email_lower,
            "password_hash": password_hash,
            "email_linked_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Invalidate cache
    invalidate_user_cache(user_id)
    
    return {
        "status": "success",
        "message": "Email linked successfully! You can now login with email and password."
    }


@api_router.post("/profile/{user_id}/link-phone")
async def link_phone_to_profile(user_id: str, data: LinkPhoneRequest):
    """
    Link phone to existing account (for email-signup users)
    - Normalizes phone number
    - Checks if phone already used by another account
    - If phone exists with different account, offers to merge
    """
    # Normalize phone
    phone = data.phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith('+'):
        if phone.startswith('91'):
            phone = '+' + phone
        else:
            phone = '+91' + phone.lstrip('0')
    
    # Validate phone
    if not validate_phone(phone):
        raise HTTPException(status_code=400, detail="Invalid phone format")
    
    # Get current user
    current_user = await db.users.find_one({"id": user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already has phone
    if current_user.get("phone"):
        raise HTTPException(status_code=400, detail="Account already has a phone linked")
    
    # Check all phone variations
    phone_digits = phone.replace('+', '').replace('91', '', 1) if phone.startswith('+91') else phone
    existing_phone_user = await db.users.find_one({
        "$or": [
            {"phone": phone},
            {"phone": phone_digits},
            {"phone": "+91" + phone_digits},
            {"phone": {"$regex": phone_digits + "$"}}
        ],
        "id": {"$ne": user_id}
    })
    
    if existing_phone_user:
        # Phone exists - check if that account has no email (can merge)
        if not existing_phone_user.get("email") and current_user.get("email"):
            return {
                "status": "merge_available",
                "message": "This phone is linked to another account. Would you like to merge accounts?",
                "existing_user_id": existing_phone_user.get("id"),
                "action": "call /profile/{user_id}/merge-accounts to merge"
            }
        else:
            raise HTTPException(status_code=400, detail="Phone already registered with another account")
    
    # Link phone to account
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "phone": phone,
            "phone_linked_at": datetime.now(timezone.utc).isoformat(),
            "phone_verified": data.otp_verified
        }}
    )
    
    # Invalidate cache
    invalidate_user_cache(user_id)
    
    return {
        "status": "success",
        "message": "Phone linked successfully!"
    }




@api_router.post("/profile/{user_id}/merge-accounts")
async def merge_accounts(user_id: str, data: MergeAccountsRequest):
    """
    Merge two accounts into one
    - Keeps the current user (user_id) as primary
    - Transfers email/phone from source account
    - Transfers matches, messages, likes to primary account
    - Deletes source account
    """
    # Get both users
    primary_user = await db.users.find_one({"id": user_id})
    source_user = await db.users.find_one({"id": data.source_user_id})
    
    if not primary_user:
        raise HTTPException(status_code=404, detail="Primary account not found")
    if not source_user:
        raise HTTPException(status_code=404, detail="Source account not found")
    
    # Verify ownership - if source has password, verify it
    if source_user.get("password_hash") and source_user.get("email"):
        if not data.password:
            raise HTTPException(status_code=400, detail="Password required to merge email account")
        if not verify_password_secure(data.password, source_user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid password for source account")
    
    # Determine what to merge
    merge_updates = {}
    
    # Transfer email if primary doesn't have one
    if not primary_user.get("email") and source_user.get("email"):
        merge_updates["email"] = source_user["email"]
        merge_updates["password_hash"] = source_user.get("password_hash")
    
    # Transfer phone if primary doesn't have one
    if not primary_user.get("phone") and source_user.get("phone"):
        merge_updates["phone"] = source_user["phone"]
        merge_updates["phone_verified"] = source_user.get("phone_verified", False)
    
    # Transfer firebase_uid if needed
    if not primary_user.get("firebase_uid") and source_user.get("firebase_uid"):
        merge_updates["firebase_uid"] = source_user["firebase_uid"]
    
    if not merge_updates:
        raise HTTPException(status_code=400, detail="Nothing to merge - both accounts have same credentials")
    
    merge_updates["merged_from"] = data.source_user_id
    merge_updates["merged_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update primary account
    await db.users.update_one({"id": user_id}, {"$set": merge_updates})
    
    # Transfer matches
    await db.matches.update_many(
        {"user1_id": data.source_user_id},
        {"$set": {"user1_id": user_id}}
    )
    await db.matches.update_many(
        {"user2_id": data.source_user_id},
        {"$set": {"user2_id": user_id}}
    )
    
    # Transfer messages
    await db.messages.update_many(
        {"sender_id": data.source_user_id},
        {"$set": {"sender_id": user_id}}
    )
    await db.messages.update_many(
        {"receiver_id": data.source_user_id},
        {"$set": {"receiver_id": user_id}}
    )
    
    # Delete source account
    await db.users.delete_one({"id": data.source_user_id})
    
    # Invalidate caches
    invalidate_user_cache(user_id)
    invalidate_user_cache(data.source_user_id)
    
    return {
        "status": "success",
        "message": "Accounts merged successfully!",
        "merged_fields": list(merge_updates.keys())
    }


@api_router.get("/profile/{user_id}/stats")
async def get_user_stats(user_id: str):
    """Get user activity statistics - likes sent, likes received, matches count"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Count likes sent by this user (where they initiated the like)
    likes_sent = await db.matches.count_documents({
        "user1_id": user_id,
        "user1_liked": True
    })
    
    # Count likes received (where they were liked by others)
    likes_received = await db.matches.count_documents({
        "user2_id": user_id,
        "user1_liked": True
    })
    
    # Count mutual matches
    mutual_matches = await db.matches.count_documents({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
        "matched": True
    })
    
    # Count superlikes sent
    superlikes_sent = await db.matches.count_documents({
        "user1_id": user_id,
        "is_superlike": True
    })
    
    # Count superlikes received
    superlikes_received = await db.matches.count_documents({
        "user2_id": user_id,
        "is_superlike": True
    })
    
    # Profile views count
    profile_views = user.get("profile_views", 0)
    
    return {
        "likes_sent": likes_sent,
        "likes_received": likes_received,
        "mutual_matches": mutual_matches,
        "superlikes_sent": superlikes_sent,
        "superlikes_received": superlikes_received,
        "profile_views": profile_views
    }

@api_router.get("/profile/{user_id}/completeness")
async def get_profile_completeness(user_id: str):
    """Get profile completeness score and suggestions"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    checks = {
        "profile_photo": bool(user.get("profile_picture")),
        "bio": bool(user.get("bio") and len(user.get("bio", "")) > 10),
        "interests": len(user.get("interests", [])) >= 3,
        "location": bool(user.get("location")),
        "relationship_intent": bool(user.get("relationship_intent")),
        "values": len(user.get("values", [])) >= 1,
        "lifestyle_tags": len(user.get("lifestyle_tags", [])) >= 1,
        "about_me": bool(user.get("about_me") and len(user.get("about_me", "")) > 10),
        "multiple_photos": len(user.get("photos", [])) >= 3,
    }
    
    weights = {
        "profile_photo": 20,
        "bio": 15,
        "interests": 15,
        "location": 10,
        "relationship_intent": 10,
        "values": 8,
        "lifestyle_tags": 7,
        "about_me": 10,
        "multiple_photos": 5,
    }
    
    score = sum(weights[k] for k, v in checks.items() if v)
    
    suggestions = []
    if not checks["bio"]:
        suggestions.append({"field": "bio", "text": "Add a bio to tell others about yourself"})
    if not checks["interests"]:
        suggestions.append({"field": "interests", "text": "Add at least 3 interests for better matches"})
    if not checks["relationship_intent"]:
        suggestions.append({"field": "relationship_intent", "text": "Set your relationship preference"})
    if not checks["multiple_photos"]:
        suggestions.append({"field": "photos", "text": "Add more photos to get 3x more likes"})
    if not checks["about_me"]:
        suggestions.append({"field": "about_me", "text": "Write about yourself in About Me section"})
    if not checks["values"]:
        suggestions.append({"field": "values", "text": "Add your values for meaningful connections"})
    
    return {
        "score": score,
        "checks": checks,
        "suggestions": suggestions[:3]
    }

@api_router.post("/profile/{user_id}/verify")
async def request_verification(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # AI verification
    is_verified, reason = await verify_profile_with_ai(user)
    
    status = "verified" if is_verified else "pending"
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"verification_status": status, "verified": is_verified}}
    )
    
    return {"status": status, "message": reason}

@api_router.post("/profile/{user_id}/photos")
async def upload_photo(user_id: str, photo_data: str = Form(...)):
    """Upload photo as base64"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    photos = user.get("photos", [])
    photos.append(photo_data)
    
    await db.users.update_one({"id": user_id}, {"$set": {"photos": photos}})
    return {"message": "Photo uploaded", "photo_count": len(photos)}

@api_router.post("/profile/{user_id}/profile-picture")
async def upload_profile_picture(user_id: str, image_data: str = Form(...)):
    """Upload profile picture as base64"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update profile picture
    await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"profile_picture": image_data}}
    )
    
    return {"message": "Profile picture updated successfully", "profile_picture": image_data}

@api_router.delete("/profile/{user_id}/profile-picture")
async def delete_profile_picture(user_id: str):
    """Delete profile picture"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"profile_picture": None}}
    )
    
    return {"message": "Profile picture deleted"}

# Privacy Routes
@api_router.put("/privacy/{user_id}")
async def update_privacy(user_id: str, privacy: PrivacyUpdate):
    """Update all privacy settings including chat privacy"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings = user.get("privacy_settings", {})
    
    # Profile privacy
    if privacy.show_profile is not None:
        settings["show_profile"] = privacy.show_profile
    if privacy.show_photos is not None:
        settings["show_photos"] = privacy.show_photos
    if privacy.incognito_mode is not None:
        settings["incognito_mode"] = privacy.incognito_mode
    
    # Chat privacy settings
    if privacy.hide_online_status is not None:
        settings["hide_online_status"] = privacy.hide_online_status
    if privacy.hide_read_receipts is not None:
        settings["hide_read_receipts"] = privacy.hide_read_receipts
    if privacy.hide_typing_indicator is not None:
        settings["hide_typing_indicator"] = privacy.hide_typing_indicator
    if privacy.hide_phone_number is not None:
        settings["hide_phone_number"] = privacy.hide_phone_number
    if privacy.blur_photos_for_non_matches is not None:
        settings["blur_photos_for_non_matches"] = privacy.blur_photos_for_non_matches
    if privacy.disappearing_messages is not None:
        settings["disappearing_messages"] = privacy.disappearing_messages
    if privacy.disappearing_messages_duration is not None:
        settings["disappearing_messages_duration"] = privacy.disappearing_messages_duration
    if privacy.screenshot_alert is not None:
        settings["screenshot_alert"] = privacy.screenshot_alert
    
    await db.users.update_one({"id": user_id}, {"$set": {"privacy_settings": settings}})
    
    # Invalidate cache
    invalidate_user_cache(user_id)
    
    return {"message": "Privacy settings updated", "settings": settings}


@api_router.get("/privacy/{user_id}")
async def get_privacy_settings(user_id: str):
    """Get user's privacy settings"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "privacy_settings": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return with defaults for any missing settings
    default_settings = {
        "show_profile": True,
        "show_photos": True,
        "incognito_mode": False,
        "hide_online_status": False,
        "hide_read_receipts": False,
        "hide_typing_indicator": False,
        "hide_phone_number": True,
        "blur_photos_for_non_matches": True,
        "disappearing_messages": False,
        "disappearing_messages_duration": 86400,
        "screenshot_alert": True
    }
    
    settings = user.get("privacy_settings", {})
    return {**default_settings, **settings}


# ==================== CHAT PRIVACY ENDPOINTS ====================

@api_router.post("/messages/{message_id}/delete")
async def delete_message(message_id: str, request: DeleteMessageRequest, user_id: str):
    """Delete a message (for self or for everyone)"""
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Verify user is sender or receiver
    if user_id not in [message.get("sender_id"), message.get("receiver_id")]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if request.delete_for_all:
        # Only sender can delete for everyone, within 1 hour
        if message.get("sender_id") != user_id:
            raise HTTPException(status_code=403, detail="Only sender can delete for everyone")
        
        created_at = datetime.fromisoformat(message.get("created_at", ""))
        if datetime.now(timezone.utc) - created_at > timedelta(hours=1):
            raise HTTPException(status_code=400, detail="Can only delete for everyone within 1 hour")
        
        await db.messages.update_one(
            {"id": message_id},
            {"$set": {"is_deleted_for_all": True, "content": "This message was deleted"}}
        )
        
        # Notify other user via websocket
        other_user_id = message.get("receiver_id") if user_id == message.get("sender_id") else message.get("sender_id")
        await manager.send_message(other_user_id, {
            "type": "message_deleted",
            "message_id": message_id,
            "deleted_for_all": True
        })
    else:
        # Delete only for current user
        if user_id == message.get("sender_id"):
            await db.messages.update_one({"id": message_id}, {"$set": {"is_deleted_for_sender": True}})
        else:
            await db.messages.update_one({"id": message_id}, {"$set": {"is_deleted_for_receiver": True}})
    
    return {"message": "Message deleted", "deleted_for_all": request.delete_for_all}


@api_router.post("/chat/{match_id}/screenshot-alert")
async def send_screenshot_alert(match_id: str, alert: ScreenshotAlert):
    """Send alert when user takes screenshot"""
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Get other user
    other_user_id = match.get("user2_id") if alert.screenshot_by == match.get("user1_id") else match.get("user1_id")
    
    # Check if other user has screenshot alerts enabled
    other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "privacy_settings": 1, "name": 1})
    if other_user and other_user.get("privacy_settings", {}).get("screenshot_alert", True):
        # Send notification
        screenshot_user = await db.users.find_one({"id": alert.screenshot_by}, {"_id": 0, "name": 1})
        
        await manager.send_message(other_user_id, {
            "type": "screenshot_alert",
            "match_id": match_id,
            "screenshot_by": alert.screenshot_by,
            "screenshot_by_name": screenshot_user.get("name", "Someone")
        })
        
        # Also send push notification
        await fcm_service.send_to_user(db, 
            other_user_id,
            "📸 Screenshot Detected!",
            f"{screenshot_user.get('name', 'Someone')} took a screenshot of your chat",
            {"type": "screenshot_alert", "match_id": match_id}
        )
        
        # Log the screenshot
        await db.screenshot_logs.insert_one({
            "match_id": match_id,
            "screenshot_by": alert.screenshot_by,
            "alerted_user": other_user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Screenshot alert sent"}


@api_router.post("/chat/{match_id}/typing")
async def send_typing_indicator(match_id: str, user_id: str, is_typing: bool = True):
    """Send typing indicator to match"""
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Get other user
    other_user_id = match.get("user2_id") if user_id == match.get("user1_id") else match.get("user1_id")
    
    # Check if sender has typing indicator hidden
    sender = await db.users.find_one({"id": user_id}, {"_id": 0, "privacy_settings": 1})
    if sender and sender.get("privacy_settings", {}).get("hide_typing_indicator", False):
        return {"message": "Typing indicator hidden by privacy settings"}
    
    # Send typing indicator via websocket
    await manager.send_message(other_user_id, {
        "type": "typing_indicator",
        "match_id": match_id,
        "user_id": user_id,
        "is_typing": is_typing
    })
    
    return {"message": "Typing indicator sent"}


@api_router.get("/chat/{match_id}/messages")
async def get_chat_messages(match_id: str, user_id: str, limit: int = 50, skip: int = 0):
    """Get chat messages with privacy filters applied"""
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Verify user is part of match
    if user_id not in [match.get("user1_id"), match.get("user2_id")]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build query - exclude deleted messages
    query = {
        "match_id": match_id,
        "is_deleted_for_all": {"$ne": True}
    }
    
    # Exclude messages deleted for this user
    is_user1 = user_id == match.get("user1_id")
    if is_user1:
        query["is_deleted_for_sender"] = {"$ne": True}
    else:
        query["is_deleted_for_receiver"] = {"$ne": True}
    
    # Get messages
    messages = await db.messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(None)
    
    # Check for expired disappearing messages
    now = datetime.now(timezone.utc)
    valid_messages = []
    for msg in messages:
        if msg.get("expires_at"):
            expires = datetime.fromisoformat(msg["expires_at"])
            if now > expires:
                # Mark as expired
                await db.messages.update_one(
                    {"id": msg["id"]},
                    {"$set": {"is_deleted_for_all": True, "content": "Message expired"}}
                )
                continue
        valid_messages.append(msg)
    
    return valid_messages[::-1]  # Return in chronological order

# Old block and report endpoints removed - using new endpoints at /user/{user_id}/block and /user/{user_id}/report

# Admin Routes
# NOTE: Main /admin/all-users endpoint with pagination is defined later in the file

@api_router.post("/admin/make-admin/{user_id}")
async def make_user_admin(user_id: str):
    """Make a user admin (for testing purposes)"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_admin": True}}
    )
    
    return {"message": f"User {user['name']} is now an admin"}

@api_router.post("/admin/make-admin-by-email")
async def make_user_admin_by_email(email: str = "admin@heartlink.com"):
    """Make a user admin by email (for testing purposes)"""
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"email": email},
        {"$set": {"is_admin": True}}
    )
    
    return {"message": f"User {user['name']} with email {email} is now an admin"}

@api_router.get("/admin/users")
async def get_users_for_verification(status: str = "pending"):
    """Get users by verification status for admin review"""
    query = {"verification_status": status}
    users = await db.users.find(query).limit(100).to_list(None)
    
    return [{
        "id": u["id"],
        "name": u["name"],
        "age": u["age"],
        "email": u.get("email"),
        "phone": u.get("phone"),
        "gender": u["gender"],
        "looking_for": u["looking_for"],
        "bio": u.get("bio", ""),
        "location": u.get("location", ""),
        "interests": u.get("interests", []),
        "profile_picture": u.get("profile_picture"),
        "verification_status": u.get("verification_status", "pending"),
        "verified": u.get("verified", False),
        "rejection_reason": u.get("rejection_reason"),
        "created_at": u.get("created_at")
    } for u in users]

@api_router.post("/admin/verify-user")
async def admin_verify_user(verification: AdminVerification):
    """Admin manually verifies or rejects a user"""
    user = await db.users.find_one({"id": verification.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if verification.action == "approve":
        # Approve user
        await db.users.update_one(
            {"id": verification.user_id},
            {"$set": {
                "verified": True,
                "verification_status": "verified",
                "verified_by": verification.verified_by,
                "verified_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Log verification
        await db.verification_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": verification.user_id,
            "action": "approved",
            "verified_by": verification.verified_by,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Send push notification via FCM (legacy)
        if user.get('fcm_token'):
            send_verification_notification(
                token=user['fcm_token'],
                status="approved"
            )
        
        # Send via OneSignal (primary)
        try:
            await fcm_service.notify_verification(db, verification.user_id, "approved")
        except Exception as e:
            logger.error(f"OneSignal verification notification failed: {e}")
        
        # Store in-app notification
        await create_in_app_notification(
            verification.user_id,
            "Profile Verified!",
            "Congratulations! Your profile has been verified by admin.",
            "verification",
            {"status": "approved", "action": "open_profile", "route": "/profile"}
        )
        
        return {"message": "User verified successfully"}
    
    elif verification.action == "reject":
        # Reject user
        await db.users.update_one(
            {"id": verification.user_id},
            {"$set": {
                "verified": False,
                "verification_status": "rejected",
                "rejection_reason": verification.reason,
                "rejected_by": verification.verified_by,
                "rejected_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Log rejection
        await db.verification_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": verification.user_id,
            "action": "rejected",
            "reason": verification.reason,
            "rejected_by": verification.verified_by,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Send push notification via FCM (legacy)
        if user.get('fcm_token'):
            send_verification_notification(
                token=user['fcm_token'],
                status="rejected"
            )
        
        # Send via OneSignal (primary)
        try:
            await fcm_service.notify_verification(db, verification.user_id, "rejected", verification.reason or "")
        except Exception as e:
            logger.error(f"OneSignal rejection notification failed: {e}")
        
        # Store in-app notification
        await create_in_app_notification(
            verification.user_id,
            "Profile Update Needed",
            f"Your profile needs changes. {verification.reason}" if verification.reason else "Your profile verification was not approved. Please update your profile.",
            "verification",
            {"status": "rejected", "action": "open_profile", "route": "/profile"}
        )
        
        return {"message": "User rejected"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@api_router.get("/admin/stats")
async def get_admin_stats():
    """Get verification statistics"""
    total_users = await db.users.count_documents({})
    pending = await db.users.count_documents({"verification_status": "pending"})
    verified = await db.users.count_documents({"verification_status": "verified"})
    rejected = await db.users.count_documents({"verification_status": "rejected"})
    
    return {
        "total_users": total_users,
        "pending_verification": pending,
        "verified": verified,
        "rejected": rejected
    }


# ==================== BLOCK/MUTE/REPORT FEATURES ====================

@api_router.post("/user/{user_id}/block")
async def block_user(user_id: str, block_data: BlockUser):
    """Block a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    blocked_users = user.get("blocked_users", [])
    if block_data.blocked_user_id not in blocked_users:
        blocked_users.append(block_data.blocked_user_id)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"blocked_users": blocked_users}}
        )
    
    return {"message": "User blocked successfully"}

@api_router.post("/user/{user_id}/unblock")
async def unblock_user(user_id: str, block_data: BlockUser):
    """Unblock a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    blocked_users = user.get("blocked_users", [])
    if block_data.blocked_user_id in blocked_users:
        blocked_users.remove(block_data.blocked_user_id)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"blocked_users": blocked_users}}
        )
    
    return {"message": "User unblocked successfully"}

@api_router.post("/user/{user_id}/mute")
async def mute_user(user_id: str, mute_data: MuteUser):
    """Mute a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    muted_users = user.get("muted_users", [])
    if mute_data.muted_user_id not in muted_users:
        muted_users.append(mute_data.muted_user_id)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"muted_users": muted_users}}
        )
    
    return {"message": "User muted successfully"}

@api_router.post("/user/{user_id}/unmute")
async def unmute_user(user_id: str, mute_data: MuteUser):
    """Unmute a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    muted_users = user.get("muted_users", [])
    if mute_data.muted_user_id in muted_users:
        muted_users.remove(mute_data.muted_user_id)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"muted_users": muted_users}}
        )
    
    return {"message": "User unmuted successfully"}

@api_router.post("/user/{user_id}/report")
async def report_user(user_id: str, report_data: ReportUser):
    """Report a user for inappropriate behavior"""
    # Store report in database
    report_doc = {
        "id": str(uuid.uuid4()),
        "reporter_id": user_id,
        "reported_user_id": report_data.reported_user_id,
        "reason": report_data.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"  # pending, reviewed, action_taken
    }
    
    await db.reports.insert_one(report_doc)
    
    return {"message": "User reported successfully. Our team will review this."}


# Discovery Routes
@api_router.get("/discover/{user_id}")
async def discover_users(user_id: str, limit: int = 10, relationship_intent: str = None, trust_badge_level: str = None, last_active_hours: int = None, city: str = None):
    """
    Discover users with safety filters - OPTIMIZED
    - Uses projection to fetch only needed fields
    - Parallel queries for better performance
    - Indexed queries
    """
    # Use projection to fetch only needed fields from current user
    current_user = await db.users.find_one(
        {"id": user_id},
        {
            "_id": 0, "id": 1, "gender": 1, "looking_for": 1,
            "blocked_users": 1, "blocked_device_ids": 1,
            "gender_lock_enabled": 1, "show_to_gender": 1,
            "interests": 1, "values": 1, "lifestyle_tags": 1,
            "latitude": 1, "longitude": 1, "location": 1
        }
    )
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get blocked users and device IDs
    blocked_users = current_user.get("blocked_users", [])
    blocked_device_ids = current_user.get("blocked_device_ids", [])
    
    # Run blocking queries in parallel for speed
    blockers_task = db.users.find(
        {"blocked_users": user_id},
        {"_id": 0, "id": 1}
    ).limit(500).to_list(None)
    
    matches_task = db.matches.find(
        {"$or": [{"user1_id": user_id}, {"user2_id": user_id}]},
        {"_id": 0, "user1_id": 1, "user2_id": 1}
    ).limit(500).to_list(None)
    
    # Await both tasks concurrently
    blockers, matches = await asyncio.gather(blockers_task, matches_task)
    
    blocker_ids = [u["id"] for u in blockers]
    interacted_ids = set()
    for m in matches:
        interacted_ids.add(m["user1_id"])
        interacted_ids.add(m["user2_id"])
    
    # Gender preferences
    looking_for_gender = current_user.get("looking_for", "").lower()
    current_gender = current_user.get("gender", "").lower()
    
    # Build optimized query
    exclude_ids = list(set(blocked_users + blocker_ids + list(interacted_ids)))
    exclude_ids.append(user_id)
    
    query = {
        "id": {"$nin": exclude_ids},
        "privacy_settings.show_profile": {"$ne": False},
        "is_shadow_banned": {"$ne": True},
        "is_permanently_banned": {"$ne": True},
        "is_ai_profile": {"$ne": True}
    }
    
    # Gender lock logic
    if current_user.get("gender_lock_enabled"):
        show_to = current_user.get("show_to_gender", "both")
        if show_to != "both":
            query["gender"] = show_to
    
    # Gender preferences filter
    if looking_for_gender:
        query["gender"] = looking_for_gender
    
    # Optional filters
    if relationship_intent:
        query["relationship_intent"] = relationship_intent
    if trust_badge_level:
        query["trust_badge_level"] = trust_badge_level
    if last_active_hours:
        cutoff_time = (datetime.now(timezone.utc) - timedelta(hours=last_active_hours)).isoformat()
        query["last_active"] = {"$gte": cutoff_time}
    if blocked_device_ids:
        query["device_ids"] = {"$nin": blocked_device_ids}
    
    # City filter
    if city:
        query["location"] = {"$regex": city, "$options": "i"}
    
    # Projection for discover - only fields needed for cards
    discover_projection = {
        "_id": 0, "id": 1, "name": 1, "age": 1, "bio": 1,
        "photos": 1, "interests": 1, "verified": 1, "location": 1,
        "profile_picture": 1, "is_online": 1, "last_active": 1,
        "trust_badge_level": 1, "relationship_intent": 1,
        "values": 1, "lifestyle_tags": 1,
        "gender_lock_enabled": 1, "show_to_gender": 1, "hide_profile_from_gender": 1,
        "boost_active": 1, "boost_end": 1,
        "latitude": 1, "longitude": 1
    }
    
    users = await db.users.find(query, discover_projection).limit(limit * 3).to_list(None)
    
    # Post-process: Check gender lock from other user's perspective and Indian location
    filtered_users = []
    for u in users:
        # INDIAN LOCATION FILTER - Only show users from India
        user_location = u.get("location", "")
        if not is_indian_location(user_location):
            continue
        
        # Check if other user hides from our gender
        hide_from = u.get("hide_profile_from_gender", "none")
        if hide_from != "none" and current_gender and hide_from == current_gender:
            continue
        
        # Check if other user's gender_lock allows them to see current user
        if u.get("gender_lock_enabled"):
            other_show_to = u.get("show_to_gender", "both")
            if other_show_to != "both" and current_gender and current_gender != other_show_to:
                continue
        
        filtered_users.append(u)
        if len(filtered_users) >= limit * 2:
            break
    
    # === SMART RANKING ===
    current_interests = set(current_user.get("interests", []))
    current_values = set(current_user.get("values", []))
    current_lifestyle = set(current_user.get("lifestyle_tags", []))
    current_location = current_user.get("location", "")
    current_city = current_location.split(",")[0].strip().lower() if current_location else ""
    current_lat = current_user.get("latitude")
    current_lng = current_user.get("longitude")
    
    def rank_score(profile):
        score = 0
        # LADIES FIRST — Female profiles get auto-boost for male viewers
        if profile.get("gender", "").lower() == "female" and current_gender == "male":
            score += 30
        # BOOSTED profile gets massive priority
        if profile.get("boost_active"):
            try:
                end = datetime.fromisoformat(profile.get("boost_end", "").replace("Z", "+00:00"))
                if datetime.now(timezone.utc) < end:
                    score += 500
            except Exception:
                pass
        # Shared interests (highest weight)
        p_interests = set(profile.get("interests", []))
        shared = len(current_interests & p_interests)
        score += shared * 15
        # Shared values
        p_values = set(profile.get("values", []))
        score += len(current_values & p_values) * 10
        # Shared lifestyle
        p_lifestyle = set(profile.get("lifestyle_tags", []))
        score += len(current_lifestyle & p_lifestyle) * 8
        # Verified profile bonus
        if profile.get("verified"):
            score += 20
        # Online / recently active bonus
        if profile.get("is_online"):
            score += 25
        elif profile.get("last_active"):
            try:
                la = datetime.fromisoformat(profile["last_active"].replace("Z", "+00:00"))
                hours_ago = (datetime.now(timezone.utc) - la).total_seconds() / 3600
                if hours_ago < 24:
                    score += 15
                elif hours_ago < 72:
                    score += 5
            except Exception:
                pass
        # Profile completeness bonus
        if profile.get("profile_picture"):
            score += 10
        if profile.get("bio"):
            score += 5
        if profile.get("relationship_intent"):
            score += 5
        # Trust badge
        badge = profile.get("trust_badge_level", "low")
        if badge == "high":
            score += 15
        elif badge == "medium":
            score += 8
        # Same city bonus (big impact)
        p_location = profile.get("location", "")
        p_city = p_location.split(",")[0].strip().lower() if p_location else ""
        if current_city and p_city and current_city == p_city:
            score += 50
        # Nearby distance bonus
        p_lat = profile.get("latitude")
        p_lng = profile.get("longitude")
        if current_lat and current_lng and p_lat and p_lng:
            dist = calculate_distance(current_lat, current_lng, p_lat, p_lng)
            if dist < 5:
                score += 40
            elif dist < 15:
                score += 25
            elif dist < 50:
                score += 10
        return score
    
    filtered_users.sort(key=rank_score, reverse=True)
    ranked_users = filtered_users[:limit]
    
    # Build response with shared interest count
    result = []
    for u in ranked_users:
        u_interests = set(u.get("interests", []))
        shared_count = len(current_interests & u_interests)
        shared_list = list(current_interests & u_interests)[:3]
        
        entry = {
            "id": u["id"], 
            "name": u["name"], 
            "age": u["age"], 
            "bio": u.get("bio", ""), 
            "photos": u.get("photos", []),
            "interests": u.get("interests", []), 
            "verified": u.get("verified", False),
            "location": u.get("location", ""), 
            "profile_picture": u.get("profile_picture"),
            "is_online": u.get("is_online", False),
            "last_active": u.get("last_active"),
            "trust_badge_level": u.get("trust_badge_level", "low"),
            "relationship_intent": u.get("relationship_intent", ""),
            "values": u.get("values", []),
            "lifestyle_tags": u.get("lifestyle_tags", []),
            "shared_interests_count": shared_count,
            "shared_interests": shared_list,
        }
        # Calculate distance if both have coordinates
        u_lat = u.get("latitude")
        u_lng = u.get("longitude")
        if current_lat and current_lng and u_lat and u_lng:
            entry["distance_km"] = calculate_distance(current_lat, current_lng, u_lat, u_lng)
        
        result.append(entry)
    
    return result

# ==================== LOCATION & NEARBY MATCHES ====================

@api_router.post("/user/{user_id}/update-location")
async def update_location(user_id: str, location_data: LocationUpdate):
    """Update user location for nearby matches"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "latitude": location_data.latitude,
            "longitude": location_data.longitude,
            "location": location_data.location
        }}
    )
    
    return {"message": "Location updated successfully"}

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in km using Haversine formula"""
    from math import radians, sin, cos, sqrt, atan2
    
    R = 6371  # Earth's radius in kilometers
    
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = R * c
    
    return round(distance, 1)

@api_router.get("/discover/nearby/{user_id}")
async def discover_nearby(user_id: str, max_distance: int = 25, limit: int = 20):
    """Discover users nearby based on location"""
    current_user = await db.users.find_one({"id": user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not current_user.get("latitude") or not current_user.get("longitude"):
        raise HTTPException(status_code=400, detail="Please enable location to find nearby matches")
    
    # Get blocked users
    blocked_users = current_user.get("blocked_users", [])
    
    # Find users who blocked current user
    blockers = await db.users.find({"blocked_users": user_id}).limit(1000).to_list(None)
    blocker_ids = [u["id"] for u in blockers]
    
    # Get already interacted users
    matches = await db.matches.find({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}]
    }).limit(1000).to_list(None)
    interacted_ids = set()
    for m in matches:
        interacted_ids.add(m["user1_id"])
        interacted_ids.add(m["user2_id"])
    
    # Find potential matches with location
    query = {
        "id": {"$ne": user_id, "$nin": blocked_users + blocker_ids + list(interacted_ids)},
        "latitude": {"$exists": True, "$ne": None},
        "longitude": {"$exists": True, "$ne": None},
        "privacy_settings.show_profile": {"$ne": False}
    }
    
    # Add gender filters
    looking_for_gender = current_user["looking_for"].lower() if current_user.get("looking_for") else None
    current_gender = current_user["gender"].lower() if current_user.get("gender") else None
    
    if looking_for_gender and current_gender:
        query["$or"] = [
            {
                "gender": {"$regex": f"^{looking_for_gender}$", "$options": "i"},
                "looking_for": {"$regex": f"^{current_gender}$", "$options": "i"}
            }
        ]
    
    users = await db.users.find(query).limit(limit * 3).to_list(None)  # Get more to filter by distance
    
    # Calculate distances and filter
    nearby_users = []
    for u in users:
        if u.get("latitude") and u.get("longitude"):
            distance = calculate_distance(
                current_user["latitude"],
                current_user["longitude"],
                u["latitude"],
                u["longitude"]
            )
            
            if distance <= max_distance:
                nearby_users.append({
                    "id": u["id"],
                    "name": u["name"],
                    "age": u["age"],
                    "bio": u.get("bio", ""),
                    "photos": u.get("photos", []),
                    "interests": u.get("interests", []),
                    "verified": u.get("verified", False),
                    "location": u.get("location", ""),
                    "distance": distance,
                    "profile_picture": u.get("profile_picture")
                })
    
    # Sort by distance
    nearby_users.sort(key=lambda x: x["distance"])
    
    return nearby_users[:limit]

# ==================== PROFILE VIEWS & ACTIVITY ====================

@api_router.post("/profile/{user_id}/view")
async def track_profile_view(user_id: str, viewer_id: str = None):
    """Track profile view"""
    # Check if viewer is in incognito mode
    viewer_incognito = False
    if viewer_id:
        viewer = await db.users.find_one({"id": viewer_id}, {"_id": 0, "privacy_settings": 1})
        if viewer and viewer.get("privacy_settings", {}).get("incognito_mode", False):
            viewer_incognito = True
    
    # Increment profile views
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"profile_views": 1}}
    )
    
    # Only store who viewed if NOT in incognito mode
    if viewer_id and not viewer_incognito:
        view_doc = {
            "profile_id": user_id,
            "viewer_id": viewer_id,
            "viewed_at": datetime.now(timezone.utc).isoformat()
        }
        await db.profile_views.insert_one(view_doc)
        
        # Send real-time WebSocket notification
        viewer_data = await db.users.find_one({"id": viewer_id}, {"_id": 0, "name": 1, "profile_picture": 1})
        viewer_name = viewer_data.get("name", "Someone") if viewer_data else "Someone"
        await manager.send_message(user_id, {
            "type": "profile_view",
            "viewer_id": viewer_id,
            "viewer_name": viewer_name
        })
        
        # Store in-app notification for profile view
        await create_in_app_notification(
            user_id,
            "👀 Profile Viewed",
            f"{viewer_name} viewed your profile.",
            "profile_view",
            {"viewer_id": viewer_id, "action": "open_profile", "route": f"/profile/{viewer_id}"}
        )
        
        # Send OneSignal push notification for profile view
        try:
            await fcm_service.notify_profile_view(db, user_id, viewer_name, viewer_id)
        except Exception as e:
            logger.error(f"Profile view push notification failed: {e}")
        
        # Update badge
        asyncio.create_task(manager.send_badge_update(user_id))
    
    return {"message": "Profile view tracked", "incognito": viewer_incognito}

@api_router.post("/user/{user_id}/update-activity")
async def update_last_active(user_id: str):
    """Update user's last active timestamp"""
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"last_active": now, "is_online": True}}
    )
    # Update cache
    set_cached_online_status(user_id, True, now)
    return {"message": "Activity updated"}

@api_router.post("/users/online-status")
async def get_batch_online_status(user_ids: List[str]):
    """Get online status for multiple users - OPTIMIZED for real-time"""
    result = {}
    uncached_ids = []
    
    # Check cache first
    for uid in user_ids:
        cached = get_cached_online_status(uid)
        if cached:
            result[uid] = cached
        else:
            uncached_ids.append(uid)
    
    # Fetch uncached from DB
    if uncached_ids:
        users = await db.users.find(
            {"id": {"$in": uncached_ids}},
            {"_id": 0, "id": 1, "is_online": 1, "last_active": 1}
        ).to_list(None)
        
        for user in users:
            status = {
                "is_online": user.get("is_online", False),
                "last_active": user.get("last_active")
            }
            result[user["id"]] = status
            set_cached_online_status(user["id"], status["is_online"], status["last_active"])
    
    return result

@api_router.get("/user/{user_id}/online-status")
async def get_single_online_status(user_id: str):
    """Get online status for single user"""
    # Check cache first
    cached = get_cached_online_status(user_id)
    if cached:
        return cached
    
    # Fetch from DB
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "is_online": 1, "last_active": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    status = {
        "is_online": user.get("is_online", False),
        "last_active": user.get("last_active")
    }
    set_cached_online_status(user_id, status["is_online"], status["last_active"])
    return status

# ==================== ICEBREAKERS ====================

ICEBREAKERS = [
    "What's your favorite way to spend a weekend?",
    "If you could travel anywhere right now, where would you go?",
    "What's your go-to karaoke song?",
    "Coffee or tea? ☕",
    "What's the best advice you've ever received?",
    "If you could have dinner with anyone, dead or alive, who would it be?",
    "What's your favorite childhood memory?",
    "Beach vacation or mountain retreat? 🏖️⛰️",
    "What's something you're really good at?",
    "What's your favorite food?",
    "Early bird or night owl? 🌅🌙",
    "What's on your bucket list?",
    "Favorite movie or series?",
    "Dog person or cat person? 🐕🐈",
    "What's your hidden talent?"
]

@api_router.get("/icebreakers")
async def get_icebreakers():
    """Get random icebreaker questions"""
    import random
    return {"icebreakers": random.sample(ICEBREAKERS, 5)}

# Like/Match Routes
async def _post_match_tasks(match_id, user_id, target_id, user_name, target_name, user_pic, target_pic):
    """Background: notifications, WS, FCM after match. Runs after API response sent for speed."""
    try:
        await manager.send_message(target_id, {
            "type": "new_match", "match_id": match_id,
            "user": {"id": user_id, "name": user_name, "profile_picture": user_pic}
        })
        await manager.send_message(user_id, {
            "type": "new_match", "match_id": match_id,
            "user": {"id": target_id, "name": target_name, "profile_picture": target_pic}
        })
        await create_in_app_notification(target_id, "It's a Match!", f"You matched with {user_name}! Start chatting now.", "match",
            {"match_id": match_id, "user_id": user_id, "action": "open_chat", "route": f"/chat/{match_id}"})
        await create_in_app_notification(user_id, "It's a Match!", f"You matched with {target_name}! Start chatting now.", "match",
            {"match_id": match_id, "user_id": target_id, "action": "open_chat", "route": f"/chat/{match_id}"})
        await fcm_service.notify_new_match(db, target_id, user_name, match_id)
        await fcm_service.notify_new_match(db, user_id, target_name, match_id)
        asyncio.create_task(manager.send_badge_update(target_id))
        asyncio.create_task(manager.send_badge_update(user_id))
    except Exception as e:
        logger.error(f"Post-match tasks error: {e}")

    # Update match counts for rating prompt trigger
    for uid in (user_id, target_id):
        await db.users.update_one({"id": uid}, {"$inc": {"total_match_count": 1}})




@api_router.post("/action/{user_id}")
async def user_action(user_id: str, action: LikeAction):
    # Check if there's an existing record where target user liked current user
    existing_like = await db.matches.find_one({
        "user1_id": action.target_user_id,
        "user2_id": user_id,
        "user1_liked": True
    })
    
    if action.action == "pass":
        # If someone liked us and we pass, mark user2_liked as False
        if existing_like:
            await db.matches.update_one(
                {"_id": existing_like["_id"]},
                {"$set": {"user2_liked": False, "user2_action": "pass"}}
            )
            return {"action": "passed", "removed_from_likes": True}
        
        # Just record the pass
        match_doc = {
            "user1_id": user_id,
            "user2_id": action.target_user_id,
            "user1_liked": False,
            "matched": False
        }
        match = Match(**match_doc)
        await db.matches.insert_one(match.dict())
        return {"action": "passed"}
    
    # Check if opposite action exists (they liked us first)
    existing = existing_like
    
    if existing and existing.get("user1_liked"):
        # It's a match!
        user1 = await db.users.find_one({"id": user_id})
        user2 = await db.users.find_one({"id": action.target_user_id})
        
        # Calculate AI compatibility
        score, analysis = await calculate_ai_compatibility(user1, user2)
        
        await db.matches.update_one(
            {"id": existing["id"]},
            {"$set": {
                "user2_liked": True,
                "matched": True,
                "compatibility_score": score,
                "ai_analysis": analysis
            }}
        )
        
        # Invalidate matches cache for both users
        for uid in [user_id, action.target_user_id]:
            cache_key = f"matches_{uid}"
            matches_cache.pop(cache_key, None)
        
        # Return FAST — move notifications to background
        match_id = existing["id"]
        asyncio.create_task(_post_match_tasks(
            match_id, user_id, action.target_user_id,
            user1["name"], user2["name"],
            user1.get("profile_picture"), user2.get("profile_picture")
        ))
        
        return {
            "action": "matched",
            "match_id": match_id,
            "compatibility_score": score,
            "analysis": analysis
        }
    else:
        # Record like
        match_doc = {
            "user1_id": user_id,
            "user2_id": action.target_user_id,
            "user1_liked": True,
            "matched": False,
            "is_superlike": action.action == "superlike"
        }
        match = Match(**match_doc)
        await db.matches.insert_one(match.dict())
        
        # Get user details for notification
        user1 = await db.users.find_one({"id": user_id})
        user2 = await db.users.find_one({"id": action.target_user_id})
        
        if action.action == "superlike":
            # Notify target user via WebSocket
            await manager.send_message(action.target_user_id, {
                "type": "superlike",
                "user_id": user_id
            })
            
            # Send push notification via FCM - dedicated superlike function
            await fcm_service.notify_superlike(db, action.target_user_id, user1['name'], liker_id=user_id)
            
            # Store in-app notification for superlike
            await create_in_app_notification(
                action.target_user_id,
                "⭐ Superlike!",
                f"{user1['name']} superliked your profile!",
                "superlike",
                {"user_id": user_id, "action": "open_likes", "route": "/likes"}
            )
        elif action.action == "like":
            # Send WebSocket notification for regular likes
            await manager.send_message(action.target_user_id, {
                "type": "new_like",
                "user_id": user_id,
                "user_name": user1["name"] if user1 else "Someone"
            })
            
            # Store in-app notification for like
            await create_in_app_notification(
                action.target_user_id,
                "❤️ Someone liked you!",
                f"{user1['name'] if user1 else 'Someone'} liked your profile.",
                "like",
                {"user_id": user_id, "action": "open_likes", "route": "/likes"}
            )
            
            # Send push notification via FCM
            await fcm_service.notify_new_like(db, action.target_user_id, user1['name'], liker_id=user_id)
        
        # Update badge count for target user
        asyncio.create_task(manager.send_badge_update(action.target_user_id))
        
        return {"action": "liked"}
    
    # Badge update runs after response via background task

# ==================== ANONYMOUS CRUSH FEATURE ====================

@api_router.post("/crush/{user_id}")
async def mark_crush(user_id: str, target_user_id: str):
    """Mark someone as anonymous crush"""
    # Check if crush feature is enabled
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if not (flags or {}).get("crush_feature", False):
        raise HTTPException(status_code=403, detail="Crush feature is currently paused")
    
    if user_id == target_user_id:
        raise HTTPException(status_code=400, detail="Cannot crush yourself")
    
    # Check if already crushed
    existing = await db.crushes.find_one({"crusher_id": user_id, "crushed_id": target_user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already marked as crush")
    
    crusher = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "gender": 1})
    if not crusher:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Save crush
    crush_doc = {
        "id": str(uuid.uuid4()),
        "crusher_id": user_id,
        "crushed_id": target_user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "revealed": False
    }
    await db.crushes.insert_one(crush_doc)
    
    # Check for mutual crush
    mutual = await db.crushes.find_one({"crusher_id": target_user_id, "crushed_id": user_id})
    if mutual:
        # Mutual crush! Notify both
        target = await db.users.find_one({"id": target_user_id}, {"_id": 0, "name": 1})
        await create_in_app_notification(
            user_id, "Mutual Crush!", f"You and {target['name'] if target else 'someone'} have a mutual crush!",
            "crush", {"action": "open_matches", "route": "/matches", "mutual": True}
        )
        await create_in_app_notification(
            target_user_id, "Mutual Crush!", f"You and {crusher['name']} have a mutual crush!",
            "crush", {"action": "open_matches", "route": "/matches", "mutual": True}
        )
        # Send push
        try:
            await fcm_service.send_to_user(db, target_user_id, "Mutual Crush!", f"You and {crusher['name']} both crushed on each other!")
            await fcm_service.send_to_user(db, user_id, "Mutual Crush!", f"You and {target['name'] if target else 'someone'} both crushed on each other!")
        except Exception:
            pass
        return {"action": "mutual_crush", "mutual": True}
    
    # Send anonymous notification to crushed user
    await create_in_app_notification(
        target_user_id, "Secret Crush!", "Someone has a crush on you! Upgrade to Premium to reveal who.",
        "crush", {"action": "open_crushes", "route": "/likes", "anonymous": True}
    )
    try:
        await fcm_service.send_to_user(db, target_user_id, "Secret Crush!", "Someone has a crush on you! Open HeartLink to find out.")
    except Exception:
        pass
    
    return {"action": "crush_sent", "mutual": False}

@api_router.get("/crushes/{user_id}")
async def get_crushes(user_id: str):
    """Get users who crushed on you"""
    crushes = await db.crushes.find({"crushed_id": user_id}).sort("created_at", -1).limit(50).to_list(None)
    
    result = []
    for c in crushes:
        crusher = await db.users.find_one(
            {"id": c["crusher_id"]},
            {"_id": 0, "id": 1, "name": 1, "age": 1, "profile_picture": 1, "location": 1}
        )
        if crusher:
            result.append({
                "crush_id": c["id"],
                "user": crusher,
                "created_at": c["created_at"],
                "revealed": c.get("revealed", False),
                "is_premium_locked": not c.get("revealed", False)
            })
    
    # Check mutual crushes
    my_crushes = await db.crushes.find({"crusher_id": user_id}).to_list(None)
    my_crush_ids = {c["crushed_id"] for c in my_crushes}
    
    for r in result:
        r["is_mutual"] = r["user"]["id"] in my_crush_ids
    
    total = await db.crushes.count_documents({"crushed_id": user_id})
    return {"crushes": result, "total": total}

@api_router.get("/crushes/{user_id}/sent")
async def get_sent_crushes(user_id: str):
    """Get users you crushed on"""
    crushes = await db.crushes.find({"crusher_id": user_id}).sort("created_at", -1).to_list(None)
    crush_ids = [c["crushed_id"] for c in crushes]
    return {"sent_crush_ids": crush_ids, "total": len(crush_ids)}

# ==================== WHO VIEWED PROFILE (ENHANCED) ====================

@api_router.get("/profile-viewers/{user_id}")
async def get_profile_viewers_enhanced(user_id: str, is_premium: bool = False):
    """Get who viewed your profile - blurred for free, full for premium"""
    views = await db.profile_views.find(
        {"viewed_user_id": user_id}
    ).sort("viewed_at", -1).limit(50).to_list(None)
    
    total_views = await db.profile_views.count_documents({"viewed_user_id": user_id})
    today_views = await db.profile_views.count_documents({
        "viewed_user_id": user_id,
        "viewed_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
    })
    
    viewers = []
    for v in views:
        viewer = await db.users.find_one(
            {"id": v.get("viewer_id")},
            {"_id": 0, "id": 1, "name": 1, "age": 1, "profile_picture": 1, "location": 1, "gender": 1}
        )
        if viewer:
            # Check if user is premium
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1})
            is_user_premium = user.get("is_premium", False) if user else False
            
            if is_user_premium or is_premium:
                viewers.append({
                    "user": viewer,
                    "viewed_at": v.get("viewed_at"),
                    "locked": False
                })
            else:
                # Blur for free users - show only first letter and age
                viewers.append({
                    "user": {
                        "id": viewer["id"],
                        "name": viewer["name"][0] + "***",
                        "age": viewer.get("age"),
                        "profile_picture": None,
                        "location": viewer.get("location", "").split(",")[0] if viewer.get("location") else "",
                        "gender": viewer.get("gender")
                    },
                    "viewed_at": v.get("viewed_at"),
                    "locked": True
                })
    
    return {
        "viewers": viewers,
        "total_views": total_views,
        "today_views": today_views,
        "is_premium": is_premium
    }

# Matches Routes
@api_router.get("/matches/{user_id}")
async def get_matches(user_id: str):
    """Get user matches - OPTIMIZED with caching and batch queries"""
    # Check cache first
    cache_key = f"matches_{user_id}"
    cached = matches_cache.get(cache_key)
    if cached:
        return cached
    
    # Get current user blocked list only
    current_user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "blocked_users": 1}
    )
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    blocked_users = set(current_user.get("blocked_users", []))
    
    # Get matches with projection
    matches = await db.matches.find(
        {
            "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
            "matched": True
        },
        {"_id": 0, "id": 1, "user1_id": 1, "user2_id": 1, "compatibility_score": 1, "ai_analysis": 1, "created_at": 1}
    ).limit(100).to_list(None)
    
    # Get all other user IDs
    other_user_ids = []
    for match in matches:
        other_id = match["user2_id"] if match["user1_id"] == user_id else match["user1_id"]
        if other_id not in blocked_users:
            other_user_ids.append(other_id)
    
    if not other_user_ids:
        return []
    
    # Batch fetch all matched users in ONE query
    matched_users = await db.users.find(
        {"id": {"$in": other_user_ids}},
        {
            "_id": 0, "id": 1, "name": 1, "age": 1, "verified": 1,
            "is_online": 1, "last_active": 1, "photos": 1,
            "profile_picture": 1, "privacy_settings": 1, "blocked_users": 1
        }
    ).to_list(None)
    
    # Create lookup dict
    users_dict = {u["id"]: u for u in matched_users}
    
    result = []
    for match in matches:
        other_id = match["user2_id"] if match["user1_id"] == user_id else match["user1_id"]
        
        if other_id in blocked_users:
            continue
        
        other_user = users_dict.get(other_id)
        if not other_user:
            continue
        
        # Check if other user blocked current user
        if user_id in other_user.get("blocked_users", []):
            continue
        
        # Privacy settings
        privacy_settings = other_user.get("privacy_settings", {})
        show_photos = privacy_settings.get("show_photos", True)
        
        user_data = {
            "id": other_user["id"],
            "name": other_user["name"],
            "age": other_user["age"],
            "verified": other_user.get("verified", False),
            "is_online": other_user.get("is_online", False),
            "last_active": other_user.get("last_active")
        }
        
        if show_photos:
            user_data["photos"] = other_user.get("photos", [])
            user_data["profile_picture"] = other_user.get("profile_picture")
        else:
            user_data["photos"] = []
            user_data["profile_picture"] = None
        
        result.append({
            "match_id": match["id"],
            "user": user_data,
            "compatibility_score": match.get("compatibility_score"),
            "ai_analysis": match.get("ai_analysis", ""),
            "created_at": match.get("created_at")
        })
    
    # Cache result
    matches_cache[cache_key] = result
    return result

@api_router.post("/likes/{user_id}/mark-seen")
async def mark_likes_seen(user_id: str):
    """Mark all current likes as seen - resets the likes badge count"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"likes_seen_at": datetime.now(timezone.utc).isoformat()}}
    )
    asyncio.create_task(manager.send_badge_update(user_id))
    return {"success": True}

@api_router.get("/likes/{user_id}")
async def get_likes(user_id: str):
    """Get users who liked the current user"""
    # Find all matches where user2_id is current user and user1 has liked
    # Exclude profiles where already matched or user2 has passed
    likes = await db.matches.find({
        "user2_id": user_id,
        "user1_liked": True,
        "matched": False
    }).to_list(None)
    
    result = {
        "regular_likes": [],
        "super_likes": [],
        "total_count": 0
    }
    
    for like in likes:
        # Skip if user2 already passed
        if like.get("user2_action") == "pass":
            continue
            
        liker_user = await db.users.find_one({"id": like["user1_id"]})
        
        if liker_user:
            user_data = {
                "id": liker_user["id"],
                "name": liker_user["name"],
                "age": liker_user.get("age"),
                "bio": liker_user.get("bio", ""),
                "photos": liker_user.get("photos", []),
                "profile_picture": liker_user.get("profile_picture"),
                "interests": liker_user.get("interests", []),
                "verified": liker_user.get("verified", False),
                "location": liker_user.get("location", ""),
                "is_online": liker_user.get("is_online", False),
                "last_active": liker_user.get("last_active"),
                "liked_at": like.get("created_at"),
                "is_superlike": like.get("is_superlike", False)
                # Note: phone and email are intentionally NOT included for privacy
            }
            
            # Check if it's a superlike
            if like.get("is_superlike"):
                result["super_likes"].append(user_data)
            else:
                result["regular_likes"].append(user_data)
    
    result["total_count"] = len(result["regular_likes"]) + len(result["super_likes"])
    
    return result

@api_router.get("/active-users/{user_id}")
async def get_active_users(user_id: str, limit: int = 20):
    """Get recently active users who are not blocked and not matched"""
    current_user = await db.users.find_one({"id": user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get blocked users
    blocked_users = current_user.get("blocked_users", [])
    
    # Find users who blocked current user
    blockers = await db.users.find({"blocked_users": user_id}).limit(1000).to_list(None)
    blocker_ids = [u["id"] for u in blockers]
    
    # Get already matched users
    matches = await db.matches.find({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
        "matched": True
    }).limit(1000).to_list(None)
    matched_ids = set()
    for m in matches:
        matched_ids.add(m["user1_id"])
        matched_ids.add(m["user2_id"])
    
    # Active threshold: users active in last 30 minutes or connected via WS
    active_threshold = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    
    # Get currently WebSocket-connected user IDs
    ws_connected_ids = [uid for uid in manager.active_connections.keys() if uid != user_id]
    
    # Exclude list: blocked + blockers (NOT matched users — they can be active too)
    exclude_ids = list(set(blocked_users + blocker_ids + [user_id]))
    
    # Case-insensitive gender matching using regex (escape special chars for safety)
    looking_for = re.escape(current_user.get("looking_for", "female").strip())
    my_gender = re.escape(current_user.get("gender", "male").strip())
    
    query = {
        "id": {"$nin": exclude_ids},
        "gender": {"$regex": f"^{looking_for}$", "$options": "i"},
        "looking_for": {"$regex": f"^{my_gender}$", "$options": "i"},
        "privacy_settings.show_profile": {"$ne": False},
        "is_ai_profile": {"$ne": True},
        "is_permanently_banned": {"$ne": True},
        "is_shadow_banned": {"$ne": True},
        "$or": [
            {"id": {"$in": ws_connected_ids}},
            {"last_active": {"$gte": active_threshold}}
        ]
    }
    
    users = await db.users.find(query).sort("last_active", -1).limit(limit).to_list(None)
    
    # Determine online status: WS-connected OR active in last 5 minutes
    five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    
    return [{
        "id": u["id"],
        "name": u["name"],
        "age": u.get("age", 0),
        "bio": u.get("bio", ""),
        "photos": u.get("photos", []),
        "profile_picture": u.get("profile_picture"),
        "interests": u.get("interests", []),
        "verified": u.get("verified", False),
        "location": u.get("location", ""),
        "last_active": u.get("last_active"),
        "is_online": (u["id"] in ws_connected_ids) or (u.get("last_active", "") >= five_min_ago if u.get("last_active") else False)
    } for u in users]


@api_router.get("/conversations/{user_id}")
async def get_conversations(user_id: str):
    """Get all conversations with last message and unread count in ONE query — avoids N+1"""
    # Get all matched matches
    matches = await db.matches.find({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
        "matched": True
    }).to_list(None)
    
    if not matches:
        return []
    
    ws_connected_ids = set(manager.active_connections.keys())
    five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    conversations = []
    
    for match in matches:
        match_id = match["id"]
        other_user_id = match["user2_id"] if match["user1_id"] == user_id else match["user1_id"]
        
        # Get last message and unread count in parallel
        pipeline_last = [
            {"$match": {"match_id": match_id, "is_deleted_for_all": {"$ne": True}}},
            {"$sort": {"created_at": -1}},
            {"$limit": 1},
            {"$project": {"_id": 0}}
        ]
        pipeline_unread = [
            {"$match": {"match_id": match_id, "receiver_id": user_id, "read": False, "is_deleted_for_all": {"$ne": True}}},
            {"$count": "count"}
        ]
        
        last_msgs = await db.messages.aggregate(pipeline_last).to_list(1)
        unread_result = await db.messages.aggregate(pipeline_unread).to_list(1)
        
        last_message = last_msgs[0] if last_msgs else None
        unread_count = unread_result[0]["count"] if unread_result else 0
        
        if not last_message:
            continue
        
        # Get other user info
        other_user = await db.users.find_one({"id": other_user_id}, {
            "_id": 0, "id": 1, "name": 1, "age": 1, "profile_picture": 1, "photos": 1,
            "is_online": 1, "last_active": 1, "verified": 1, "is_ai_profile": 1
        })
        if not other_user:
            continue
        
        is_online = (other_user_id in ws_connected_ids) or (other_user.get("last_active", "") >= five_min_ago if other_user.get("last_active") else False)
        
        conversations.append({
            "match_id": match_id,
            "user": {
                "id": other_user["id"],
                "name": other_user.get("name", ""),
                "age": other_user.get("age", 0),
                "profile_picture": other_user.get("profile_picture"),
                "photos": other_user.get("photos", []),
                "is_online": is_online,
                "last_active": other_user.get("last_active"),
                "verified": other_user.get("verified", False),
                "is_ai_profile": other_user.get("is_ai_profile", False),
            },
            "lastMessage": serialize_user_for_response(last_message, exclude_password=False),
            "unreadCount": unread_count,
            "hasMessages": True,
        })
    
    # Sort by last message time, newest first
    conversations.sort(key=lambda c: c["lastMessage"].get("created_at", ""), reverse=True)
    return conversations


# Chat Routes
@api_router.get("/messages/{match_id}")
async def get_messages(match_id: str, user_id: Optional[str] = None, limit: int = 100, skip: int = 0, order: str = "asc"):
    """Get chat messages with pagination and privacy filters
    
    Args:
        order: 'asc' for oldest first (default for chat display), 'desc' for newest first (for getting last message)
    """
    query = {
        "match_id": match_id,
        "is_deleted_for_all": {"$ne": True}
    }
    
    # If user_id provided, filter out messages deleted for this user
    if user_id:
        # Get match to determine if user is user1 or user2
        match = await db.matches.find_one({"id": match_id})
        if match:
            is_user1 = user_id == match.get("user1_id")
            if is_user1:
                query["is_deleted_for_sender"] = {"$ne": True}
            else:
                query["is_deleted_for_receiver"] = {"$ne": True}
    
    # Check for expired disappearing messages
    now = datetime.now(timezone.utc)
    
    # Sort order: ascending for chat history, descending for getting latest
    sort_order = 1 if order == "asc" else -1
    
    messages = await db.messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", sort_order).skip(skip).limit(limit).to_list(None)
    
    # Filter expired messages and clean response
    valid_messages = []
    for msg in messages:
        # Check if message expired
        if msg.get("expires_at"):
            try:
                expires = datetime.fromisoformat(msg["expires_at"].replace('Z', '+00:00'))
                if now > expires:
                    # Mark as expired in DB
                    await db.messages.update_one(
                        {"id": msg["id"]},
                        {"$set": {"is_deleted_for_all": True, "content": "Message expired"}}
                    )
                    continue
            except Exception:
                pass
        
        # Clean the message for response
        clean_msg = {
            "id": msg.get("id"),
            "match_id": msg.get("match_id"),
            "sender_id": msg.get("sender_id"),
            "receiver_id": msg.get("receiver_id"),
            "content": msg.get("content"),
            "read": msg.get("read", False),
            "delivered": msg.get("delivered", False),
            "created_at": msg.get("created_at"),
            "message_type": msg.get("message_type", "text"),
            "personal_info_detected": msg.get("personal_info_detected", False),
            "expires_at": msg.get("expires_at"),
            "is_deleted_for_all": msg.get("is_deleted_for_all", False),
            "reactions": msg.get("reactions", {})
        }
        valid_messages.append(clean_msg)
    
    # If descending order was used, reverse for display
    if order == "desc" and limit > 1:
        valid_messages.reverse()
    
    return valid_messages


@api_router.get("/messages/{match_id}/last")
async def get_last_message(match_id: str):
    """Get the last message in a conversation - for message list preview"""
    message = await db.messages.find_one(
        {
            "match_id": match_id,
            "is_deleted_for_all": {"$ne": True}
        },
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    return message

@api_router.get("/messages/{match_id}/unread-count/{user_id}")
async def get_unread_message_count(match_id: str, user_id: str):
    """Get count of unread messages in a conversation for a specific user"""
    count = await db.messages.count_documents({
        "match_id": match_id,
        "receiver_id": user_id,
        "read": {"$ne": True}
    })
    return {"count": count}

@api_router.post("/messages/{match_id}/mark-read/{user_id}")
async def mark_messages_as_read(match_id: str, user_id: str):
    """Mark all messages in a conversation as read for a specific user"""
    result = await db.messages.update_many(
        {
            "match_id": match_id,
            "receiver_id": user_id,
            "read": {"$ne": True}
        },
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify sender that messages were read via WebSocket
    if result.modified_count > 0:
        match = await db.matches.find_one({"id": match_id}, {"_id": 0, "user1_id": 1, "user2_id": 1})
        if match:
            sender_id = match["user1_id"] if match["user2_id"] == user_id else match["user2_id"]
            try:
                await manager.send_message(sender_id, {
                    "type": "messages_read",
                    "match_id": match_id,
                    "read_by": user_id,
                    "count": result.modified_count
                })
            except Exception:
                pass
    
    # Always send badge update to self-heal stale counts
    asyncio.create_task(manager.send_badge_update(user_id))
    
    return {"marked_read": result.modified_count}




@api_router.post("/messages/{message_id}/react")
async def react_to_message(message_id: str, data: MessageReaction):
    """Add or remove a reaction on a message."""
    valid_reactions = ['heart', 'laugh', 'thumbsup', 'sad', 'angry']
    if data.reaction not in valid_reactions:
        raise HTTPException(status_code=400, detail=f"Invalid reaction. Use: {valid_reactions}")
    
    msg = await db.messages.find_one({"id": message_id})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    reactions = msg.get("reactions", {})
    
    # Toggle: if same user already reacted with same emoji, remove it
    if reactions.get(data.user_id) == data.reaction:
        reactions.pop(data.user_id, None)
    else:
        reactions[data.user_id] = data.reaction
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"reactions": reactions}}
    )
    
    # Notify other user via WebSocket
    other_id = msg["receiver_id"] if msg["sender_id"] == data.user_id else msg["sender_id"]
    await manager.send_message(other_id, {
        "type": "message_reaction",
        "message_id": message_id,
        "user_id": data.user_id,
        "reaction": data.reaction if data.user_id in reactions else None,
        "match_id": msg.get("match_id", "")
    })
    
    return {"success": True, "reactions": reactions}



@api_router.post("/messages")
async def send_message_http(message_data: Message):
    """Send message with women safety checks"""
    # Get sender and receiver
    sender = await db.users.find_one({"id": message_data.sender_id})
    receiver = await db.users.find_one({"id": message_data.receiver_id})
    
    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Skip safety checks if receiver is an AI profile
    is_ai_receiver = receiver.get("is_ai_profile", False)
    
    # === WOMEN SAFETY MODE CHECKS ===
    if not is_ai_receiver and receiver.get("women_safety_mode"):
        sender_gender = sender.get("gender", "").lower()
        
        # Only verified males can message
        if sender_gender == "male" and not sender.get("is_verified_male"):
            raise HTTPException(
                status_code=403, 
                detail="Only verified males can message this user. Please complete verification."
            )
        
        # Check night quiet hours (10pm - 7am IST)
        if receiver.get("night_quiet_hours_enabled"):
            now_utc = datetime.now(timezone.utc)
            ist_offset = timedelta(hours=5, minutes=30)
            now_ist = now_utc + ist_offset
            hour_ist = now_ist.hour
            
            if hour_ist >= 22 or hour_ist < 7:
                raise HTTPException(
                    status_code=403,
                    detail="This user has quiet hours enabled (10 PM - 7 AM). Please try again later."
                )
        
        # First message delay for males (2 min)
        if sender_gender == "male" and not sender.get("first_message_delay_exempt"):
            # Check if this is first message to this user
            existing_message = await db.messages.find_one({
                "sender_id": message_data.sender_id,
                "receiver_id": message_data.receiver_id
            })
            
            if not existing_message:
                # Check if delay has passed (stored in a temp collection)
                delay_record = await db.message_delays.find_one({
                    "sender_id": message_data.sender_id,
                    "receiver_id": message_data.receiver_id
                })
                
                if not delay_record:
                    # Start delay timer
                    await db.message_delays.insert_one({
                        "sender_id": message_data.sender_id,
                        "receiver_id": message_data.receiver_id,
                        "started_at": datetime.now(timezone.utc).isoformat()
                    })
                    raise HTTPException(
                        status_code=403,
                        detail="First message requires a 2-minute wait. Please try again in 2 minutes."
                    )
                else:
                    # Check if 2 minutes have passed
                    started = datetime.fromisoformat(delay_record["started_at"])
                    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
                    if elapsed < 120:
                        remaining = int(120 - elapsed)
                        raise HTTPException(
                            status_code=403,
                            detail=f"Please wait {remaining} more seconds before sending your first message."
                        )
    
    # Proceed with message
    message_dict = message_data.dict()
    original_content = message_dict["content"]
    
    # === PERSONAL INFO DETECTION & MASKING ===
    # Detect phone numbers and mask them
    import re
    
    # Indian phone number patterns
    phone_patterns = [
        r'\b(?:\+91[\-\s]?)?[6-9]\d{9}\b',  # +91 9876543210 or 9876543210
        r'\b(?:\+91[\-\s]?)?\d{5}[\-\s]?\d{5}\b',  # 98765 43210
        r'\b(?:0\d{2,4}[\-\s]?)?\d{6,8}\b',  # Landline: 011-12345678
    ]
    
    # Email pattern
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    
    # Social media patterns
    social_patterns = [
        r'(?:instagram|insta|ig)[\s:@]*[A-Za-z0-9._]+',  # Instagram handles
        r'(?:snapchat|snap)[\s:@]*[A-Za-z0-9._]+',  # Snapchat
        r'(?:telegram|tg)[\s:@]*[A-Za-z0-9._]+',  # Telegram
        r'(?:whatsapp|wa|wp)[\s:]*[\+]?\d+',  # WhatsApp numbers
    ]
    
    detected_personal_info = []
    masked_content = original_content
    
    # Check for phone numbers
    for pattern in phone_patterns:
        matches = re.findall(pattern, original_content, re.IGNORECASE)
        for match in matches:
            if len(re.sub(r'\D', '', match)) >= 10:  # At least 10 digits
                detected_personal_info.append({"type": "phone", "value": match})
                # Mask: show first 2 and last 2 digits
                digits = re.sub(r'\D', '', match)
                masked = digits[:2] + '*' * (len(digits) - 4) + digits[-2:]
                masked_content = masked_content.replace(match, f"[📱 {masked}]")
    
    # Check for emails
    email_matches = re.findall(email_pattern, original_content, re.IGNORECASE)
    for email in email_matches:
        detected_personal_info.append({"type": "email", "value": email})
        # Mask email: show first 2 chars and domain
        parts = email.split('@')
        masked_email = parts[0][:2] + '****@' + parts[1]
        masked_content = masked_content.replace(email, f"[📧 {masked_email}]")
    
    # Check for social media handles
    for pattern in social_patterns:
        matches = re.findall(pattern, original_content, re.IGNORECASE)
        for match in matches:
            detected_personal_info.append({"type": "social", "value": match})
            masked_content = masked_content.replace(match, "[🔗 Social handle hidden]")
    
    # If personal info detected, handle it
    if detected_personal_info:
        # Store original but show masked
        message_dict["content"] = masked_content
        message_dict["original_content_encrypted"] = original_content  # Store original (could encrypt)
        message_dict["personal_info_detected"] = True
        message_dict["detected_info_types"] = list(set([i["type"] for i in detected_personal_info]))
        
        # Send warning notification to BOTH users
        warning_message = {
            "id": str(uuid.uuid4()),
            "match_id": message_data.match_id,
            "sender_id": "system",
            "receiver_id": message_data.sender_id,
            "content": "⚠️ Personal information detected and masked for your safety. Sharing phone numbers, emails, or social media handles is not recommended until you've built trust.",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "message_type": "system_warning"
        }
        await db.messages.insert_one(warning_message)
        
        # Send warning via WebSocket
        await manager.send_message(message_data.sender_id, {
            "type": "system_warning",
            "message": "⚠️ Your message contained personal information which has been masked for safety. Please be careful about sharing personal details."
        })
        
        # Also warn receiver
        await manager.send_message(message_data.receiver_id, {
            "type": "system_warning", 
            "message": "⚠️ A message with personal information was received. The details have been masked for your safety."
        })
        
        # Log for admin review
        await db.safety_logs.insert_one({
            "type": "personal_info_shared",
            "sender_id": message_data.sender_id,
            "receiver_id": message_data.receiver_id,
            "match_id": message_data.match_id,
            "detected_info": detected_personal_info,
            "original_content": original_content,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # === MONEY / FINANCIAL SCAM DETECTION ===
    money_keywords = [
        # Hindi/Hinglish
        r'\bpaisa\b', r'\bpaise\b', r'\brupaiye\b', r'\brupaye\b', r'\brupay\b',
        r'\bbhej\s*(?:do|de|dena|dijiye)\b', r'\btransfer\s*(?:kar|karo|kardo|kijiye)\b',
        r'\bpayment\s*(?:kar|karo|bhej)\b', r'\bkhata\b', r'\budhar\b', r'\bkarz\b',
        r'\bpaytm\b', r'\bgpay\b', r'\bphonepe\b', r'\bbhim\b',
        # English
        r'\bsend\s*(?:me\s*)?money\b', r'\btransfer\s*(?:money|amount|funds)\b',
        r'\bbank\s*(?:account|details|number)\b', r'\baccount\s*(?:number|details)\b',
        r'\bupi\s*(?:id|number)?\b', r'\bpay\s*(?:me|now)\b',
        r'\bcash\b', r'\bloan\b', r'\binvest(?:ment)?\b',
        r'\bcrypto(?:currency)?\b', r'\bbitcoin\b',
        r'\b(?:gift\s*card|voucher)\b', r'\bemi\b',
        # Financial amounts with rupee symbol
        r'(?:rs\.?|₹)\s*\d+', r'\d+\s*(?:rs\.?|₹|rupees?)',
    ]
    
    money_detected = False
    for pattern in money_keywords:
        if re.search(pattern, original_content, re.IGNORECASE):
            money_detected = True
            break
    
    if money_detected:
        # Insert system warning about money
        money_warning = {
            "id": str(uuid.uuid4()),
            "match_id": message_data.match_id,
            "sender_id": "system",
            "receiver_id": message_data.receiver_id,
            "content": "⚠️ Financial topic detected! Never send money, share bank details, or make payments to someone you met online. Scammers often build trust before asking for money. Stay safe!",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "message_type": "system_warning"
        }
        await db.messages.insert_one(money_warning)
        
        # WebSocket warnings
        await manager.send_message(message_data.receiver_id, {
            "type": "system_warning",
            "message": "⚠️ A message about money/payments was received. Never send money to someone you met online!"
        })
        await manager.send_message(message_data.sender_id, {
            "type": "system_warning",
            "message": "⚠️ Discussing money or payments on a dating app is risky. Be careful and protect yourself!"
        })
        
        # Log for admin
        await db.safety_logs.insert_one({
            "type": "money_discussion",
            "sender_id": message_data.sender_id,
            "receiver_id": message_data.receiver_id,
            "match_id": message_data.match_id,
            "original_content": original_content,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Check if sender has disappearing messages enabled
    sender_privacy = sender.get("privacy_settings", {})
    if sender_privacy.get("disappearing_messages", False):
        duration = sender_privacy.get("disappearing_messages_duration", 86400)  # Default 24 hours
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=duration)).isoformat()
        message_dict["expires_at"] = expires_at
    
    await db.messages.insert_one(message_dict)
    
    # Clean message dict for response (remove MongoDB ObjectId)
    clean_message = serialize_user_for_response(message_dict, exclude_password=False)
    
    message_payload = {
        "type": "message",
        "message": clean_message
    }
    
    # Send via WebSocket to BOTH sender and receiver
    await manager.send_message(message_data.receiver_id, message_payload)
    await manager.send_message(message_data.sender_id, message_payload)
    
    # Mark as delivered if receiver is online (connected via WebSocket)
    if message_data.receiver_id in manager.active_connections:
        await db.messages.update_one(
            {"id": message_dict["id"]},
            {"$set": {"delivered": True, "delivered_at": datetime.now(timezone.utc).isoformat()}}
        )
        # Notify sender about delivery
        await manager.send_message(message_data.sender_id, {
            "type": "message_delivered",
            "message_id": message_dict["id"],
            "match_id": message_data.match_id
        })
    
    # Check if sender is muted by receiver
    muted_users = receiver.get('muted_users', [])
    sender_not_muted = message_data.sender_id not in muted_users
    
    # Send push notification via FCM — skip if receiver is online via WS, skip for AI
    receiver_online_ws = message_data.receiver_id in manager.active_connections
    if not is_ai_receiver and sender and sender_not_muted and not receiver_online_ws:
        # Throttle: max 1 FCM per sender→receiver per 30s
        import time as _time
        throttle_key = f"msg_fcm_{message_data.sender_id}_{message_data.receiver_id}"
        last_sent = getattr(manager, '_fcm_throttle', {}).get(throttle_key, 0)
        now_ts = _time.time()
        if now_ts - last_sent > 30:
            if not hasattr(manager, '_fcm_throttle'):
                manager._fcm_throttle = {}
            manager._fcm_throttle[throttle_key] = now_ts
            asyncio.create_task(_send_push_to_user(
                user_id=message_data.receiver_id,
                title=f"New message from {sender['name']}",
                message=message_data.content[:100],
                data={"type": "message", "action": "open_chat", "match_id": message_data.match_id, "route": f"/chat/{message_data.match_id}"}
            ))
        
        # Store in-app notification for message
        await create_in_app_notification(
            message_data.receiver_id,
            f"New message from {sender['name']}",
            message_data.content[:100],
            "message",
            {"match_id": message_data.match_id, "sender_id": message_data.sender_id, "action": "open_chat", "route": f"/chat/{message_data.match_id}"}
        )
    
    # === AI CHATBOT: If receiver is an AI profile, generate auto-reply ===
    if receiver.get("is_ai_profile") and receiver.get("is_active_ai"):
        asyncio.create_task(
            handle_ai_message(
                db, manager, message_data.match_id,
                message_data.sender_id, receiver,
                message_data.content, sender.get("name", "User")
            )
        )
    
    # Update badge count for receiver
    asyncio.create_task(manager.send_badge_update(message_data.receiver_id))
    
    return clean_message

# WebSocket for real-time chat
@api_router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    
    # Set user online
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "is_online": True,
                "last_active": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Broadcast online status to all connected users
    await manager.broadcast_status_update(user_id, True)
    
    # Notify matches that user is online (throttled: max once per 30 min per user)
    asyncio.create_task(_send_online_notification_to_matches(user_id))
    
    # Send initial badge counts to user on connect
    try:
        likes_count = await db.matches.count_documents({"user2_id": user_id, "user1_liked": True, "matched": False})
        unread_msgs = await db.messages.count_documents({"receiver_id": user_id, "read": False})
        notif_count_doc = await db.in_app_notifications.count_documents({"user_id": user_id, "is_read": False})
        await manager.send_message(user_id, {
            "type": "badge_update",
            "likes_count": likes_count,
            "unread_messages": unread_msgs,
            "notification_count": notif_count_doc
        })
    except Exception:
        pass
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Handle ping/heartbeat — update last_active to keep presence fresh
            if message_data.get("type") == "ping":
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"last_active": datetime.now(timezone.utc).isoformat(), "is_online": True}}
                )
                # Send pong back so client can detect zombie connections
                try:
                    await websocket.send_json({"type": "pong"})
                except Exception:
                    pass
                continue
            
            # Handle typing indicator via WS (fast path)
            if message_data.get("type") == "typing":
                match = await db.matches.find_one({"id": message_data.get("match_id")}, {"_id": 0, "user1_id": 1, "user2_id": 1})
                if match:
                    other_id = match["user2_id"] if user_id == match["user1_id"] else match["user1_id"]
                    await manager.send_message(other_id, {
                        "type": "typing_indicator",
                        "match_id": message_data.get("match_id"),
                        "user_id": user_id,
                        "is_typing": message_data.get("is_typing", True)
                    })
                continue
            
            # Save message
            message = Message(
                match_id=message_data["match_id"],
                sender_id=user_id,
                receiver_id=message_data["receiver_id"],
                content=message_data["content"]
            )
            message_dict = message.dict()
            await db.messages.insert_one(message_dict)
            
            # Clean message dict for WebSocket (remove MongoDB ObjectId)
            clean_message = serialize_user_for_response(message_dict, exclude_password=False)
            
            # Send to BOTH sender and receiver
            message_payload = {
                "type": "message",
                "message": clean_message
            }
            
            # Send to receiver
            await manager.send_message(message_data["receiver_id"], message_payload)
            
            # Send back to sender (for confirmation)
            await manager.send_message(user_id, message_payload)
            
            # Send push notification to receiver if not muted
            # SKIP FCM if receiver is connected via WebSocket (they get real-time message)
            receiver = await db.users.find_one({"id": message_data["receiver_id"]})
            sender = await db.users.find_one({"id": user_id})
            receiver_online_ws = message_data["receiver_id"] in manager.active_connections
            
            if receiver and sender and not receiver_online_ws:
                muted_users = receiver.get('muted_users', [])
                if user_id not in muted_users:
                    # Throttle: max 1 FCM per sender→receiver per 30s
                    throttle_key = f"msg_fcm_{user_id}_{message_data['receiver_id']}"
                    last_sent = getattr(manager, '_fcm_throttle', {}).get(throttle_key, 0)
                    import time as _time
                    now_ts = _time.time()
                    if now_ts - last_sent > 30:
                        if not hasattr(manager, '_fcm_throttle'):
                            manager._fcm_throttle = {}
                        manager._fcm_throttle[throttle_key] = now_ts
                        try:
                            await fcm_service.notify_new_message(
                                db,
                                receiver_id=message_data["receiver_id"],
                                sender_name=sender['name'],
                                preview=message_data["content"],
                                match_id=message_data.get("match_id", "")
                            )
                        except Exception as e:
                            logger.error(f"FCM message notification failed: {e}")
            
            # AI Chatbot: If receiver is AI, generate auto-reply
            if receiver and receiver.get("is_ai_profile") and receiver.get("is_active_ai"):
                asyncio.create_task(
                    handle_ai_message(
                        db, manager, message_data["match_id"],
                        user_id, receiver,
                        message_data["content"], sender.get("name", "User") if sender else "User"
                    )
                )
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        
        # Set user offline
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "is_online": False,
                    "last_active": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Broadcast offline status
        await manager.broadcast_status_update(user_id, False)

# ============================================
# FCM PUSH NOTIFICATIONS ENDPOINTS
# ============================================



@api_router.post("/fcm/register-token")
async def register_fcm_token(request: FCMTokenRequest):
    """Register or update FCM token for a user."""
    try:
        result = await db.users.update_one(
            {"id": request.user_id},
            {"$set": {
                "fcm_token": request.fcm_token,
                "fcm_token_updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.modified_count == 0 and result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        logger.info(f"FCM token registered for user {request.user_id}: {request.fcm_token[:30]}...")
        return {"success": True, "message": "FCM token registered"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering FCM token: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/fcm/diagnostics/{user_id}")
async def fcm_diagnostics(user_id: str):
    """Notification diagnostics for a specific user."""
    user = await db.users.find_one({"id": user_id}, {
        "_id": 0, "id": 1, "name": 1, "email": 1,
        "fcm_token": 1, "fcm_token_updated_at": 1, "is_ai_profile": 1
    })
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    token = user.get("fcm_token", "")
    has_token = bool(token)
    
    # Test send if token exists
    send_result = None
    if has_token:
        send_result = await fcm_service.send_to_user(db, user_id, "Diagnostics", "FCM test from diagnostics")
    
    # Count in-app notifications
    notif_count = await db.in_app_notifications.count_documents({"user_id": user_id})
    
    return {
        "user_id": user_id,
        "name": user.get("name"),
        "email": user.get("email"),
        "has_fcm_token": has_token,
        "fcm_token_prefix": token[:30] + "..." if token else None,
        "fcm_token_updated_at": user.get("fcm_token_updated_at"),
        "firebase_initialized": fcm_service.is_fcm_ready(),
        "test_send_result": send_result,
        "in_app_notification_count": notif_count,
    }

@api_router.post("/fcm/send-test")
async def send_test_notification(user_id: str):
    """Send a test notification to a user"""
    try:
        user = await db.users.find_one({"id": user_id})
        if not user or not user.get('fcm_token'):
            raise HTTPException(status_code=404, detail="User or FCM token not found")
        
        from firebase_config import send_notification
        result = send_notification(
            token=user['fcm_token'],
            title="🔔 Test Notification",
            body="This is a test notification from HeartLink!",
            data={"type": "test"}
        )
        
        return result
    except Exception as e:
        logger.error(f"Error sending test notification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ONE-TIME ADMIN CREATION ENDPOINT
# ⚠️ USE THIS ONCE AND THEN DISABLE IT FOR SECURITY


@api_router.post("/admin/make-me-admin-once")
async def make_me_admin_once(request: MakeAdminRequest):
    """
    🔐 ONE-TIME USE ONLY: Make a user admin
    
    How to use:
    1. First signup on the site with your email
    2. Call this endpoint with secret code and your email
    3. You become admin
    4. After using, set ADMIN_SETUP_COMPLETE=true in .env to disable this
    
    Security: Uses secret code from environment variable
    """
    # Check if already setup (security)
    if os.environ.get('ADMIN_SETUP_COMPLETE', 'false').lower() == 'true':
        raise HTTPException(
            status_code=403, 
            detail="Admin setup already completed. This endpoint is disabled for security."
        )
    
    # Verify secret code
    expected_secret = os.environ.get('ADMIN_SECRET_CODE', 'HeartLink@Admin#2024')
    if request.secret_code != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid secret code")
    
    # Make user admin
    try:
        result = await db.users.update_one(
            {"email": request.user_email},
            {"$set": {"is_admin": True, "verified": True, "verification_status": "verified"}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=404, 
                detail=f"User with email {request.user_email} not found. Please signup first."
            )
        
        if result.modified_count > 0:
            # Get updated user
            admin_user = await db.users.find_one({"email": request.user_email}, {"_id": 0})
            
            return {
                "success": True,
                "message": "✅ Admin account created successfully!",
                "user": {
                    "email": admin_user['email'],
                    "name": admin_user['name'],
                    "is_admin": admin_user['is_admin'],
                    "id": admin_user['id']
                },
                "next_steps": [
                    "1. Login with your email and password",
                    "2. Go to /admin route to access admin dashboard",
                    "3. IMPORTANT: Set ADMIN_SETUP_COMPLETE=true in .env to disable this endpoint"
                ]
            }
        else:
            return {
                "success": True,
                "message": "User was already admin",
                "note": "Set ADMIN_SETUP_COMPLETE=true in .env to disable this endpoint"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error making admin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# NEW SAFETY & TRUST ENDPOINTS
# ============================================

# === GENDER LOCK SETTINGS ===
@api_router.put("/user/{user_id}/gender-lock")
async def update_gender_lock(user_id: str, settings: GenderLockUpdate):
    """Update gender lock settings for a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    updates = {}
    if settings.gender_lock_enabled is not None:
        updates["gender_lock_enabled"] = settings.gender_lock_enabled
    if settings.show_to_gender is not None:
        if settings.show_to_gender not in ["male", "female", "both"]:
            raise HTTPException(status_code=400, detail="Invalid show_to_gender value")
        updates["show_to_gender"] = settings.show_to_gender
    if settings.hide_profile_from_gender is not None:
        if settings.hide_profile_from_gender not in ["male", "female", "none"]:
            raise HTTPException(status_code=400, detail="Invalid hide_profile_from_gender value")
        updates["hide_profile_from_gender"] = settings.hide_profile_from_gender
    
    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    
    return {"message": "Gender lock settings updated", "updates": updates}

# === PROFILE ENHANCEMENT ===
@api_router.put("/user/{user_id}/profile-enhancement")
async def update_profile_enhancement(user_id: str, updates: ProfileEnhancementUpdate):
    """Update profile with values, intent, lifestyle tags, voice/video intro"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {}
    
    if updates.about_me is not None:
        update_dict["about_me"] = updates.about_me
    if updates.bio_voice_intro_url is not None:
        update_dict["bio_voice_intro_url"] = updates.bio_voice_intro_url
    if updates.intro_video_url is not None:
        update_dict["intro_video_url"] = updates.intro_video_url
    if updates.values is not None:
        # Validate values
        valid_values = ["respect", "family", "ambition", "spirituality", "freedom"]
        for v in updates.values:
            if v not in valid_values:
                raise HTTPException(status_code=400, detail=f"Invalid value: {v}. Valid values: {valid_values}")
        update_dict["values"] = updates.values
    if updates.relationship_intent is not None:
        valid_intents = ["serious", "casual", "friendship", "marriage", ""]
        if updates.relationship_intent not in valid_intents:
            raise HTTPException(status_code=400, detail=f"Invalid relationship_intent")
        update_dict["relationship_intent"] = updates.relationship_intent
    if updates.lifestyle_tags is not None:
        valid_tags = ["non-smoker", "vegetarian", "fitness", "travel", "night-owl", "early-bird", "pet-lover", "foodie"]
        for tag in updates.lifestyle_tags:
            if tag not in valid_tags:
                raise HTTPException(status_code=400, detail=f"Invalid lifestyle tag: {tag}")
        update_dict["lifestyle_tags"] = updates.lifestyle_tags
    
    if update_dict:
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    # Fetch and return updated user
    updated_user = await db.users.find_one({"id": user_id})
    return serialize_user_for_response(updated_user, exclude_password=True)

# === WOMEN SAFETY MODE ===
@api_router.put("/user/{user_id}/women-safety")
async def update_women_safety(user_id: str, settings: WomenSafetyUpdate):
    """Enable/disable women safety features"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    updates = {}
    if settings.women_safety_mode is not None:
        updates["women_safety_mode"] = settings.women_safety_mode
    if settings.night_quiet_hours_enabled is not None:
        updates["night_quiet_hours_enabled"] = settings.night_quiet_hours_enabled
    
    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    
    return {"message": "Women safety settings updated", "settings": updates}

# === PROFILE VIEWERS (Last 5) ===
@api_router.get("/user/{user_id}/profile-viewers")
async def get_profile_viewers(user_id: str):
    """Get last 5 users who viewed the profile"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    viewers = user.get("profile_viewers", [])[-5:]  # Last 5
    
    # Get viewer details
    viewer_details = []
    for viewer in viewers:
        viewer_user = await db.users.find_one({"id": viewer.get("user_id")})
        if viewer_user:
            viewer_details.append({
                "id": viewer_user["id"],
                "name": viewer_user["name"],
                "age": viewer_user.get("age"),
                "profile_picture": viewer_user.get("profile_picture"),
                "viewed_at": viewer.get("viewed_at")
            })
    
    return {"viewers": viewer_details, "total_views": user.get("profile_views", 0)}

# === TRACK PROFILE VIEW (Enhanced) ===
@api_router.post("/user/{user_id}/track-view")
async def track_profile_view_enhanced(user_id: str, viewer_id: str):
    """Track who viewed a profile and store in profile_viewers"""
    # Check if viewer is in incognito mode
    viewer = await db.users.find_one({"id": viewer_id})
    if not viewer:
        return {"tracked": False, "reason": "Viewer not found"}
    
    viewer_incognito = viewer.get("privacy_settings", {}).get("incognito_mode", False)
    
    # Increment profile views
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"profile_views": 1}}
    )
    
    # Only store viewer if NOT in incognito
    if not viewer_incognito:
        view_entry = {
            "user_id": viewer_id,
            "viewed_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Add to profile_viewers array, keep only last 10
        await db.users.update_one(
            {"id": user_id},
            {
                "$push": {
                    "profile_viewers": {
                        "$each": [view_entry],
                        "$slice": -10  # Keep only last 10
                    }
                }
            }
        )
    
    return {"tracked": True, "incognito": viewer_incognito}

# === DEVICE BLOCKING ===
@api_router.post("/user/{user_id}/block-device")
async def block_device(user_id: str, device: DeviceBlock):
    """Block a device ID"""
    await db.users.update_one(
        {"id": user_id},
        {"$addToSet": {"blocked_device_ids": device.device_id}}
    )
    return {"message": "Device blocked"}

@api_router.post("/user/{user_id}/register-device")
async def register_device(user_id: str, device: DeviceBlock):
    """Register a device ID for the user"""
    await db.users.update_one(
        {"id": user_id},
        {"$addToSet": {"device_ids": device.device_id}}
    )
    return {"message": "Device registered"}

# === SCREENSHOT ALERT ===
@api_router.post("/user/{user_id}/screenshot-alert")
async def screenshot_alert(user_id: str, screenshotter_id: str):
    """Alert user that someone took a screenshot"""
    # Store screenshot event
    screenshot_event = {
        "id": str(uuid.uuid4()),
        "target_user_id": user_id,
        "screenshotter_id": screenshotter_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.screenshot_events.insert_one(screenshot_event)
    
    # Send real-time notification
    await manager.send_message(user_id, {
        "type": "screenshot_alert",
        "screenshotter_id": screenshotter_id,
        "timestamp": screenshot_event["timestamp"]
    })
    
    return {"message": "Screenshot alert sent"}

# === ADMIN: USER MANAGEMENT ===
@api_router.put("/admin/user-settings")
async def admin_update_user(updates: AdminUserUpdate):
    """Admin endpoint to update user safety settings"""
    user = await db.users.find_one({"id": updates.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {}
    
    if updates.gender_lock_enabled is not None:
        update_dict["gender_lock_enabled"] = updates.gender_lock_enabled
    if updates.is_verified_male is not None:
        update_dict["is_verified_male"] = updates.is_verified_male
    if updates.trust_badge_level is not None:
        if updates.trust_badge_level not in ["low", "medium", "high"]:
            raise HTTPException(status_code=400, detail="Invalid trust_badge_level")
        update_dict["trust_badge_level"] = updates.trust_badge_level
    if updates.risk_score is not None:
        if updates.risk_score < 0 or updates.risk_score > 100:
            raise HTTPException(status_code=400, detail="risk_score must be 0-100")
        update_dict["risk_score"] = updates.risk_score
    if updates.is_shadow_banned is not None:
        update_dict["is_shadow_banned"] = updates.is_shadow_banned
    if updates.is_permanently_banned is not None:
        update_dict["is_permanently_banned"] = updates.is_permanently_banned
    if updates.ban_reason is not None:
        update_dict["ban_reason"] = updates.ban_reason
    
    if update_dict:
        await db.users.update_one({"id": updates.user_id}, {"$set": update_dict})
    
    return {"message": "User settings updated", "updates": update_dict}

@api_router.get("/admin/pending-intros")
async def get_pending_intros():
    """Get users with voice/video intros pending approval"""
    users = await db.users.find({
        "$or": [
            {"bio_voice_intro_url": {"$exists": True, "$ne": None}},
            {"intro_video_url": {"$exists": True, "$ne": None}}
        ]
    }).limit(50).to_list(None)
    
    return [{
        "id": u["id"],
        "name": u["name"],
        "bio_voice_intro_url": u.get("bio_voice_intro_url"),
        "intro_video_url": u.get("intro_video_url"),
        "created_at": u.get("created_at")
    } for u in users]

@api_router.get("/admin/high-risk-users")
async def get_high_risk_users():
    """Get users with risk_score > 50"""
    users = await db.users.find({"risk_score": {"$gt": 50}}).limit(100).to_list(None)
    
    return [{
        "id": u["id"],
        "name": u["name"],
        "email": u.get("email"),
        "risk_score": u.get("risk_score", 0),
        "trust_badge_level": u.get("trust_badge_level", "low"),
        "is_shadow_banned": u.get("is_shadow_banned", False),
        "is_permanently_banned": u.get("is_permanently_banned", False)
    } for u in users]

# === ADMIN: ALL USERS LIST ===
@api_router.get("/admin/all-users")
async def get_all_users(
    response: Response,
    search: str = "", 
    page: int = 1, 
    limit: int = 20,
    gender: str = None,
    status: str = None,
    sort: str = "newest"
):
    """Get all users with search, filters, sorting and pagination for admin"""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    skip = (page - 1) * limit
    
    # Build search query (exclude AI profiles)
    query = {"is_ai_profile": {"$ne": True}}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    # Gender filter
    if gender and gender.lower() in ["male", "female"]:
        query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}
    
    # Status filter
    if status:
        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).isoformat()
        
        if status == "active":
            query["last_active"] = {"$gte": week_ago}
        elif status == "inactive":
            query["last_active"] = {"$lt": week_ago}
        elif status == "premium":
            query["is_premium"] = True
        elif status == "verified":
            query["verified"] = True
        elif status == "banned":
            query["$or"] = [
                {"is_shadow_banned": True},
                {"is_permanently_banned": True}
            ]
    
    # Sorting
    sort_options = {
        "newest": [("created_at", -1)],
        "oldest": [("created_at", 1)],
        "last_active": [("last_active", -1)],
        "name": [("name", 1)]
    }
    sort_order = sort_options.get(sort, [("created_at", -1)])
    
    # Optimized projection for faster queries
    projection = {
        "_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "age": 1,
        "gender": 1, "location": 1, "looking_for": 1, "bio": 1,
        "interests": 1, "profile_picture": 1, "verified": 1,
        "verification_status": 1, "is_online": 1, "is_shadow_banned": 1,
        "is_permanently_banned": 1, "is_premium": 1, "is_admin": 1,
        "trust_badge_level": 1, "risk_score": 1, "created_at": 1,
        "last_active": 1, "total_matches": 1, "total_likes_received": 1,
        "selfie_verification_url": 1, "selfie_verification_status": 1
    }
    
    # Get total count (use count_documents with hint for speed)
    total = await db.users.count_documents(query)
    
    # Get users with pagination and sorting
    users = await db.users.find(query, projection).sort(sort_order).skip(skip).limit(limit).to_list(None)
    
    return {
        "users": [{
            "id": u["id"],
            "name": u["name"],
            "email": u.get("email"),
            "phone": u.get("phone"),
            "age": u.get("age"),
            "gender": u.get("gender"),
            "location": u.get("location"),
            "looking_for": u.get("looking_for"),
            "bio": u.get("bio"),
            "interests": u.get("interests", []),
            "profile_picture": u.get("profile_picture"),
            "verified": u.get("verified", False),
            "verification_status": u.get("verification_status", "pending"),
            "is_online": u.get("is_online", False),
            "is_shadow_banned": u.get("is_shadow_banned", False),
            "is_permanently_banned": u.get("is_permanently_banned", False),
            "is_premium": u.get("is_premium", False),
            "is_admin": u.get("is_admin", False),
            "trust_badge_level": u.get("trust_badge_level", "low"),
            "risk_score": u.get("risk_score", 0),
            "created_at": u.get("created_at"),
            "last_active": u.get("last_active"),
            "total_matches": u.get("total_matches", 0),
            "total_likes_received": u.get("total_likes_received", 0),
            "selfie_verification_url": u.get("selfie_verification_url"),
            "selfie_verification_status": u.get("selfie_verification_status", "none")
        } for u in users],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# === ADMIN: DASHBOARD STATS ===
@api_router.get("/admin/dashboard-stats")
async def get_dashboard_stats(response: Response):
    """Get comprehensive dashboard statistics - always fresh, no cache"""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    
    try:
        now = datetime.now(timezone.utc)
        # Use IST (UTC+5:30) for "today" since this is an Indian app
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = now + ist_offset
        today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_utc = today_start_ist - ist_offset  # Convert back to UTC
        today_start = today_start_utc
        week_ago = now - timedelta(days=7)
    
        # Total users (exclude AI profiles)
        total_users = await db.users.count_documents({"is_ai_profile": {"$ne": True}})
    
        # Gender breakdown (exclude AI)
        male_users = await db.users.count_documents({"gender": {"$regex": "^male$", "$options": "i"}, "is_ai_profile": {"$ne": True}})
        female_users = await db.users.count_documents({"gender": {"$regex": "^female$", "$options": "i"}, "is_ai_profile": {"$ne": True}})
        
        # New users today
        new_today = await db.users.count_documents({
            "created_at": {"$gte": today_start.isoformat()}
        })
        
        # New users this week
        new_this_week = await db.users.count_documents({
            "created_at": {"$gte": week_ago.isoformat()}
        })
        
        # Active users today
        active_today = await db.users.count_documents({
            "last_active": {"$gte": today_start.isoformat()}
        })
        
        # Online NOW (last 5 minutes) - Real-time online count
        five_min_ago = (now - timedelta(minutes=5)).isoformat()
        online_now = await db.users.count_documents({
            "last_active": {"$gte": five_min_ago}
        })
        
        # Inactive users (7+ days)
        inactive_users = await db.users.count_documents({
            "$or": [
                {"last_active": {"$lt": week_ago.isoformat()}},
                {"last_active": {"$exists": False}}
            ]
        })
        
        # Premium users
        premium_users = await db.users.count_documents({"is_premium": True})
        
        # Verified users
        verified_users = await db.users.count_documents({"verified": True})
        
        # Banned users
        banned_users = await db.users.count_documents({
            "$or": [
                {"is_shadow_banned": True},
                {"is_permanently_banned": True}
            ]
        })
        
        # Pending verifications
        pending_verifications = await db.users.count_documents({
            "selfie_verification_status": "pending"
        })
        
        # Total matches
        total_matches = await db.matches.count_documents({})
        
        # Total messages
        total_messages = await db.messages.count_documents({})
        
        # Recent signups (last 10)
        recent_signups_cursor = db.users.find({}).sort("created_at", -1).limit(10)
        recent_signups = await recent_signups_cursor.to_list(None)
        
        return {
            "total_users": total_users,
            "male_users": male_users,
            "female_users": female_users,
            "new_today": new_today,
            "new_this_week": new_this_week,
            "active_today": active_today,
            "online_now": online_now,
            "inactive_users": inactive_users,
            "premium_users": premium_users,
            "verified_users": verified_users,
            "banned_users": banned_users,
            "pending_verifications": pending_verifications,
            "total_matches": total_matches,
            "total_messages": total_messages,
            "recent_signups": [{
                "id": u["id"],
                "name": u["name"],
                "email": u.get("email"),
                "gender": u.get("gender"),
                "profile_picture": u.get("profile_picture"),
                "created_at": u.get("created_at")
            } for u in recent_signups],
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard stats: {str(e)}")

# === ADMIN: DELETE USER ===
@api_router.delete("/admin/user/{user_id}")
async def admin_delete_user(user_id: str):
    """Permanently delete a user and all their data"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    # Delete user's matches
    await db.matches.delete_many({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}]
    })
    
    # Delete user's messages
    await db.messages.delete_many({
        "$or": [{"sender_id": user_id}, {"receiver_id": user_id}]
    })
    
    # Delete user's reports
    await db.reports.delete_many({
        "$or": [{"reporter_id": user_id}, {"reported_user_id": user_id}]
    })
    
    # Invalidate cache
    invalidate_user_cache(user_id)
    
    return {"message": f"User {user['name']} deleted successfully"}

# === ADMIN: BLOCK/UNBLOCK USER ===
@api_router.post("/admin/user/{user_id}/block")
async def admin_block_user(user_id: str, permanent: bool = False, reason: str = ""):
    """Block or shadow ban a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if permanent:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "is_permanently_banned": True,
                "ban_reason": reason,
                "banned_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": f"User {user['name']} permanently banned"}
    else:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "is_shadow_banned": True,
                "ban_reason": reason,
                "shadow_banned_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": f"User {user['name']} shadow banned"}

@api_router.post("/admin/user/{user_id}/unblock")
async def admin_unblock_user(user_id: str):
    """Unblock a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_shadow_banned": False,
            "is_permanently_banned": False,
            "ban_reason": None
        }}
    )
    
    invalidate_user_cache(user_id)
    return {"message": f"User {user['name']} unblocked"}

# === ADMIN: RESET USER PASSWORD ===


@api_router.post("/admin/reset-user-password")
async def admin_reset_user_password(request: AdminResetPasswordRequest):
    """Admin endpoint to reset any user's password"""
    # Validate new password strength
    is_strong, message = validate_password_strength(request.new_password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=message)
    
    user = await db.users.find_one({"id": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_hash = hash_password_secure(request.new_password)
    await db.users.update_one(
        {"id": request.user_id},
        {"$set": {
            "password_hash": new_hash,
            "password_changed_at": datetime.now(timezone.utc).isoformat(),
            "password_reset_code": None,
            "password_reset_expires": None
        }}
    )
    
    # Revoke all sessions for security
    session_manager.revoke_all_sessions(request.user_id)
    
    audit_log.log_event("admin_password_reset", user_id=request.user_id)
    
    return {"message": f"Password reset successfully for {user.get('name', 'user')}"}

# === PHOTO VERIFICATION SYSTEM ===


@api_router.post("/user/submit-selfie-verification")
async def submit_selfie_verification(data: SelfieVerificationRequest):
    """User submits selfie for verification"""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": data.user_id},
        {"$set": {
            "selfie_verification_url": data.selfie_url,
            "selfie_verification_status": "pending",
            "selfie_submitted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    invalidate_user_cache(data.user_id)
    return {"message": "Selfie submitted for verification"}

@api_router.get("/admin/pending-verifications")
async def get_pending_verifications():
    """Get all users with pending selfie verification"""
    users = await db.users.find({
        "selfie_verification_status": "pending"
    }).to_list(100)
    
    return [{
        "id": u["id"],
        "name": u["name"],
        "email": u.get("email"),
        "phone": u.get("phone"),
        "profile_picture": u.get("profile_picture"),
        "selfie_verification_url": u.get("selfie_verification_url"),
        "selfie_submitted_at": u.get("selfie_submitted_at"),
        "photos": u.get("photos", [])
    } for u in users]



@api_router.post("/admin/verify-selfie")
async def admin_verify_selfie(data: VerifySelfieRequest):
    """Admin approves or rejects selfie verification"""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.action == "approve":
        await db.users.update_one(
            {"id": data.user_id},
            {"$set": {
                "selfie_verification_status": "verified",
                "verified": True,
                "verification_status": "verified",
                "trust_badge_level": "high",
                "selfie_verified_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Send notification via OneSignal
        try:
            await fcm_service.send_to_user(db, 
                user_id=data.user_id,
                title="✅ Verification Approved!",
                message="Your profile is now verified. You'll get a blue badge!"
            )
        except Exception as e:
            logger.error(f"Verification notification failed: {e}")
        
        invalidate_user_cache(data.user_id)
        return {"message": "Selfie verification approved"}
    
    elif data.action == "reject":
        await db.users.update_one(
            {"id": data.user_id},
            {"$set": {
                "selfie_verification_status": "rejected",
                "selfie_rejection_reason": data.reason,
                "selfie_rejected_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Send notification
        if user.get('fcm_token'):
            send_verification_notification(user['fcm_token'], "rejected")
        
        invalidate_user_cache(data.user_id)
        return {"message": "Selfie verification rejected", "reason": data.reason}
    
    raise HTTPException(status_code=400, detail="Invalid action")


@api_router.get("/admin/verified-users")
async def get_verified_users(page: int = 1, limit: int = 20):
    """Get all verified users for potential re-verification"""
    skip = (page - 1) * limit
    
    users = await db.users.find({
        "verified": True
    }, {
        "_id": 0, "id": 1, "name": 1, "profile_picture": 1,
        "selfie_verification_url": 1, "selfie_verified_at": 1,
        "email": 1, "phone": 1, "photos": 1
    }).sort("selfie_verified_at", -1).skip(skip).limit(limit).to_list(None)
    
    return [{
        "id": u["id"],
        "name": u.get("name"),
        "email": u.get("email"),
        "phone": u.get("phone"),
        "profile_picture": u.get("profile_picture"),
        "selfie_verification_url": u.get("selfie_verification_url"),
        "selfie_verified_at": u.get("selfie_verified_at"),
        "photos": u.get("photos", [])[:2]
    } for u in users]




@api_router.post("/admin/request-reverify")
async def admin_request_reverify(data: ReVerifyRequest):
    """Admin requests user to re-verify (removes verified status)"""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": data.user_id},
        {"$set": {
            "verified": False,
            "verification_status": "reverify_requested",
            "selfie_verification_status": "reverify_requested",
            "trust_badge_level": "low",
            "reverify_requested_at": datetime.now(timezone.utc).isoformat(),
            "reverify_reason": data.reason
        }}
    )
    
    # Send notification to user
    try:
        await fcm_service.send_to_user(db, 
            user_id=data.user_id,
            title="🔄 Re-verification Required",
            message=f"Please verify your profile again. {data.reason}" if data.reason else "Please upload a new selfie for verification."
        )
    except Exception as e:
        logger.error(f"Re-verify notification failed: {e}")
    
    invalidate_user_cache(data.user_id)
    return {"success": True, "message": "Re-verification requested"}


# ==================== PROFILE APPROVAL (Admin) ====================

@api_router.get("/admin/pending-profiles")
async def get_pending_profiles(page: int = 1, limit: int = 20):
    """Get profiles pending admin approval with pagination"""
    skip = (page - 1) * limit
    
    # Optimized projection - only fetch needed fields
    projection = {
        "_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1,
        "age": 1, "gender": 1, "location": 1, "bio": 1,
        "profile_picture": 1, "photos": 1, "interests": 1,
        "created_at": 1, "profile_status": 1
    }
    
    users = await db.users.find(
        {"profile_status": {"$in": ["pending", None]}},
        projection
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(None)
    
    return [{
        "id": u["id"],
        "name": u.get("name", ""),
        "email": u.get("email"),
        "phone": u.get("phone"),
        "age": u.get("age"),
        "gender": u.get("gender"),
        "location": u.get("location"),
        "bio": u.get("bio"),
        "profile_picture": u.get("profile_picture"),
        "photos": u.get("photos", [])[:3],  # Limit photos for faster load
        "interests": u.get("interests", [])[:5],  # Limit interests
        "created_at": u.get("created_at"),
        "profile_status": u.get("profile_status", "pending")
    } for u in users]


@api_router.get("/admin/profile-approval-stats")
async def get_profile_approval_stats():
    """Get profile approval statistics - optimized with parallel queries"""
    # Run all count queries in parallel
    pending_task = db.users.count_documents({"profile_status": {"$in": ["pending", None]}})
    approved_task = db.users.count_documents({"profile_status": "approved"})
    rejected_task = db.users.count_documents({"profile_status": "rejected"})
    
    pending, approved, rejected = await asyncio.gather(
        pending_task, approved_task, rejected_task
    )
    
    return {
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "total": pending + approved + rejected
    }




@api_router.post("/admin/approve-profile")
async def admin_approve_profile(data: ProfileApprovalRequest):
    """Admin approves or rejects a user profile"""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.action == "approve":
        await db.users.update_one(
            {"id": data.user_id},
            {"$set": {
                "profile_status": "approved",
                "profile_approved_at": datetime.now(timezone.utc).isoformat(),
                "profile_approved_by": "admin"
            }}
        )
        
        # Send push notification via OneSignal
        try:
            await fcm_service.notify_photo_approval(db, data.user_id, True)
        except Exception as e:
            logger.error(f"Failed to send approval notification: {e}")
        
        # Store in-app notification
        await create_in_app_notification(
            data.user_id,
            "Profile Approved!",
            "Your profile has been approved. Start finding your match now!",
            "photo_approved",
            {"action": "open_discover", "route": "/discover"}
        )
        
        invalidate_user_cache(data.user_id)
        return {"success": True, "message": "Profile approved successfully"}
    
    elif data.action == "reject":
        await db.users.update_one(
            {"id": data.user_id},
            {"$set": {
                "profile_status": "rejected",
                "profile_rejected_at": datetime.now(timezone.utc).isoformat(),
                "profile_rejection_reason": data.reason
            }}
        )
        
        # Send push notification via OneSignal
        try:
            await fcm_service.notify_photo_approval(db, data.user_id, False)
        except Exception as e:
            logger.error(f"Failed to send rejection notification: {e}")
        
        # Store in-app notification
        await create_in_app_notification(
            data.user_id,
            "Photo Not Approved",
            f"Your profile needs changes: {data.reason}" if data.reason else "Please upload a clear face photo and try again.",
            "photo_rejected",
            {"action": "open_profile", "route": "/profile"}
        )
        
        invalidate_user_cache(data.user_id)
        return {"success": True, "message": "Profile rejected", "reason": data.reason}
    
    raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'")


@api_router.post("/admin/bulk-approve-profiles")
async def bulk_approve_profiles(user_ids: List[str]):
    """Bulk approve multiple profiles"""
    result = await db.users.update_many(
        {"id": {"$in": user_ids}},
        {"$set": {
            "profile_status": "approved",
            "profile_approved_at": datetime.now(timezone.utc).isoformat(),
            "profile_approved_by": "admin"
        }}
    )
    
    # Send notifications to all approved users
    for user_id in user_ids:
        try:
            await fcm_service.notify_photo_approval(db, user_id, True)
            await create_in_app_notification(
                user_id,
                "Profile Approved!",
                "Your profile has been approved. Start finding your match now!",
                "photo_approved",
                {"action": "open_discover", "route": "/discover"}
            )
        except Exception as e:
            logger.error(f"Failed to send bulk approval notification to {user_id}: {e}")
    
    return {"success": True, "approved_count": result.modified_count}


# ==================== WOMEN SAFETY: MESSAGE CHECKS ====================
def check_women_safety_restrictions(sender: dict, receiver: dict) -> tuple:
    """
    Check if message can be sent based on women safety mode
    Returns (can_send: bool, reason: str, delay_seconds: int)
    """
    # If receiver has women_safety_mode enabled
    if receiver.get("women_safety_mode"):
        sender_gender = sender.get("gender", "").lower()
        
        # Only verified males can message
        if sender_gender == "male" and not sender.get("is_verified_male"):
            return False, "Only verified males can message this user", 0
        
        # Check night quiet hours (10pm - 7am IST)
        if receiver.get("night_quiet_hours_enabled"):
            # IST is UTC+5:30
            now_utc = datetime.now(timezone.utc)
            ist_offset = timedelta(hours=5, minutes=30)
            now_ist = now_utc + ist_offset
            hour_ist = now_ist.hour
            
            if hour_ist >= 22 or hour_ist < 7:
                return False, "This user has enabled quiet hours (10 PM - 7 AM)", 0
        
        # First message delay for males (2 min)
        if sender_gender == "male" and not sender.get("first_message_delay_exempt"):
            # Check if this is first message - handled in message endpoint
            return True, "first_message_check_needed", 120  # 2 min delay
    
    return True, "", 0

# ==================== NOTIFICATION APIS ====================




@api_router.post("/admin/send-notification")
async def send_bulk_notification(data: BulkNotificationRequest):
    """
    Send notification to all users or specific group
    Target options: all, male, female, inactive
    """
    # Build query based on target
    query = {"fcm_token": {"$exists": True, "$nin": [None, ""]}}
    
    if data.target == "male":
        query["gender"] = {"$regex": "^male$", "$options": "i"}
    elif data.target == "female":
        query["gender"] = {"$regex": "^female$", "$options": "i"}
    elif data.target == "inactive":
        # Users not active in last 7 days
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["last_active"] = {"$lt": week_ago}
    
    # Get all FCM tokens
    users = await db.users.find(query, {"fcm_token": 1, "name": 1}).to_list(None)
    tokens = [u["fcm_token"] for u in users if u.get("fcm_token")]
    
    if not tokens:
        return {
            "success": False, 
            "message": "No users with FCM tokens found. Users need to login from the Android app and allow notifications first.",
            "total_users_checked": len(users),
            "users_with_tokens": 0
        }
    
    # Send notifications in batches of 500 (FCM limit)
    total_success = 0
    total_failure = 0
    
    for i in range(0, len(tokens), 500):
        batch_tokens = tokens[i:i+500]
        result = send_notification_to_multiple(batch_tokens, data.title, data.body)
        if result.get("success"):
            total_success += result.get("success_count", 0)
            total_failure += result.get("failure_count", 0)
    
    # Log notification
    await db.notification_logs.insert_one({
        "id": str(uuid.uuid4()),
        "title": data.title,
        "body": data.body,
        "target": data.target,
        "total_sent": len(tokens),
        "success_count": total_success,
        "failure_count": total_failure,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "total_users": len(tokens),
        "success_count": total_success,
        "failure_count": total_failure
    }

@api_router.get("/admin/fcm-status")
async def get_fcm_status():
    """Check how many users have FCM tokens"""
    total = await db.users.count_documents({})
    
    # Get all users and check tokens properly
    users = await db.users.find({}, {"fcm_token": 1, "name": 1, "email": 1}).to_list(None)
    with_token = sum(1 for u in users if u.get("fcm_token") and str(u.get("fcm_token")).strip())
    
    # Get details of users with tokens
    users_with_tokens = [
        {"name": u.get("name"), "email": u.get("email"), "has_token": True}
        for u in users if u.get("fcm_token") and str(u.get("fcm_token")).strip()
    ]
    
    return {
        "total_users": total,
        "users_with_fcm_token": with_token,
        "users_without_token": total - with_token,
        "can_send_notifications": with_token > 0,
        "message": "Users need to login from Android app and allow notifications" if with_token == 0 else f"{with_token} users can receive notifications",
        "users_with_tokens_list": users_with_tokens[:10]  # Show first 10
    }

@api_router.get("/admin/fcm-debug")
async def fcm_debug():
    """Debug FCM configuration and Firebase status"""
    debug_info = {
        "firebase_initialized": False,
        "service_account_configured": False,
        "can_send_notifications": False,
        "errors": []
    }
    
    try:
        import firebase_admin
        debug_info["firebase_initialized"] = len(firebase_admin._apps) > 0
        
        import os
        firebase_creds = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
        debug_info["service_account_configured"] = bool(firebase_creds)
        
        if firebase_creds:
            import json
            creds = json.loads(firebase_creds)
            debug_info["project_id"] = creds.get("project_id", "Unknown")
            debug_info["client_email"] = creds.get("client_email", "Unknown")[:30] + "..."
        
        # Check if we can import messaging
        from firebase_admin import messaging
        debug_info["messaging_available"] = True
        debug_info["can_send_notifications"] = debug_info["firebase_initialized"] and debug_info["service_account_configured"]
        
    except Exception as e:
        debug_info["errors"].append(str(e))
    
    return debug_info

@api_router.post("/admin/send-test-to-user")
async def send_test_to_specific_user(email: str):
    """Send test notification to a specific user by email"""
    user = await db.users.find_one({"email": email})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get("fcm_token"):
        return {
            "success": False,
            "message": f"User {user.get('name')} does not have FCM token. They need to login from Android app first.",
            "user_name": user.get("name")
        }
    
    from firebase_config import send_notification
    result = send_notification(
        token=user['fcm_token'],
        title="🔔 Test from Admin",
        body=f"Hi {user.get('name', 'User')}! This is a test notification.",
        data={"type": "admin_test"}
    )
    
    return {
        "success": result.get("success", False),
        "user_name": user.get("name"),
        "result": result
    }

# ============================================
# IN-APP NOTIFICATIONS (Alternative to FCM)
# ============================================

# create_in_app_notification imported from services.helpers

@api_router.get("/notifications/{user_id}")
async def get_user_notifications(user_id: str, limit: int = 50, skip: int = 0):
    """Get all notifications for a user"""
    notifications = await db.in_app_notifications.find(
        {"user_id": user_id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(None)
    
    # Clean MongoDB _id
    for n in notifications:
        n.pop("_id", None)
    
    # Get unread count
    unread_count = await db.in_app_notifications.count_documents({
        "user_id": user_id,
        "is_read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total": len(notifications)
    }

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user_id: str):
    """Mark a notification as read"""
    result = await db.in_app_notifications.update_one(
        {"id": notification_id, "user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    if result.modified_count > 0:
        await db.users.update_one(
            {"id": user_id, "unread_notifications": {"$gt": 0}},
            {"$inc": {"unread_notifications": -1}}
        )
        asyncio.create_task(manager.send_badge_update(user_id))
    
    return {"success": True}

@api_router.post("/notifications/{user_id}/read-all")
async def mark_all_notifications_read(user_id: str):
    """Mark all notifications as read for a user"""
    result = await db.in_app_notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"unread_notifications": 0}}
    )
    
    asyncio.create_task(manager.send_badge_update(user_id))
    return {"success": True, "marked_count": result.modified_count}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, user_id: str):
    """Delete a specific notification"""
    notification = await db.in_app_notifications.find_one({"id": notification_id, "user_id": user_id})
    
    if notification and not notification.get("is_read"):
        await db.users.update_one(
            {"id": user_id, "unread_notifications": {"$gt": 0}},
            {"$inc": {"unread_notifications": -1}}
        )
    
    await db.in_app_notifications.delete_one({"id": notification_id, "user_id": user_id})
    return {"success": True}



@api_router.post("/admin/send-notification-all")
async def send_notification_all_methods(data: AdminNotificationWithEmail):
    """
    Send notification using ALL available methods:
    1. FCM Push (for users with tokens)
    2. In-App Notification (stored for all users)
    3. Email (for users with email)
    """
    results = {
        "fcm": {"sent": 0, "failed": 0},
        "in_app": {"created": 0},
        "email": {"sent": 0, "failed": 0}
    }
    
    # Build query based on target
    query = {}
    if data.target == "male":
        query["gender"] = {"$regex": "^male$", "$options": "i"}
    elif data.target == "female":
        query["gender"] = {"$regex": "^female$", "$options": "i"}
    elif data.target == "inactive":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["last_active"] = {"$lt": week_ago}
    
    # Get all users matching query
    users = await db.users.find(query, {"id": 1, "name": 1, "email": 1, "fcm_token": 1}).to_list(None)
    
    if not users:
        return {"success": False, "message": "No users found", "results": results}
    
    # 1. Send FCM Push (to users with tokens)
    fcm_tokens = [u["fcm_token"] for u in users if u.get("fcm_token")]
    if fcm_tokens:
        for i in range(0, len(fcm_tokens), 500):
            batch = fcm_tokens[i:i+500]
            try:
                result = send_notification_to_multiple(batch, data.title, data.body)
                results["fcm"]["sent"] += result.get("success_count", 0)
                results["fcm"]["failed"] += result.get("failure_count", 0)
            except Exception as e:
                logger.error(f"FCM batch error: {e}")
    
    # 2. Create In-App Notifications for ALL users
    if data.send_in_app:
        notifications = []
        for user in users:
            notification = InAppNotification(
                user_id=user["id"],
                title=data.title,
                body=data.body,
                type="admin"
            )
            notifications.append(notification.dict())
        
        if notifications:
            await db.in_app_notifications.insert_many(notifications)
            results["in_app"]["created"] = len(notifications)
            
            # Update unread counts
            user_ids = [u["id"] for u in users]
            await db.users.update_many(
                {"id": {"$in": user_ids}},
                {"$inc": {"unread_notifications": 1}}
            )
    
    # 3. Send Email to users with email
    if data.send_email:
        from email_service import send_email
        
        for user in users:
            if user.get("email"):
                try:
                    html_body = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">💕 HeartLink</h1>
                        </div>
                        <div style="padding: 30px; background: #fff;">
                            <h2 style="color: #333;">{data.title}</h2>
                            <p style="color: #666; font-size: 16px; line-height: 1.6;">{data.body}</p>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="https://heartlink.co.in" style="background: #ff6b9d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Open HeartLink</a>
                            </div>
                        </div>
                        <div style="padding: 20px; background: #f5f5f5; text-align: center; color: #999; font-size: 12px;">
                            <p>You received this because you're a HeartLink member.</p>
                        </div>
                    </div>
                    """
                    result = send_email(user["email"], data.title, html_body)
                    if result.get("success"):
                        results["email"]["sent"] += 1
                    else:
                        results["email"]["failed"] += 1
                except Exception as e:
                    logger.error(f"Email error for {user.get('email')}: {e}")
                    results["email"]["failed"] += 1
    
    # Log notification
    await db.notification_logs.insert_one({
        "id": str(uuid.uuid4()),
        "title": data.title,
        "body": data.body,
        "target": data.target,
        "methods": ["fcm", "in_app", "email"],
        "results": results,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "total_users": len(users),
        "results": results,
        "message": f"Notifications sent via all methods to {len(users)} users"
    }
async def get_notification_templates():
    """Get pre-defined and custom notification templates"""
    # Pre-defined templates
    default_templates = [
        {
            "id": "good_morning",
            "title": "🌅 Good Morning!",
            "body": "Start your day with new matches. Who knows, today might be special!",
            "category": "daily",
            "is_custom": False
        },
        {
            "id": "new_matches",
            "title": "💕 New matches waiting!",
            "body": "Someone special liked your profile. Open HeartLink now!",
            "category": "engagement",
            "is_custom": False
        },
        {
            "id": "daily_reminder",
            "title": "❤️ Don't miss out!",
            "body": "New profiles are waiting for you. Start swiping!",
            "category": "daily",
            "is_custom": False
        },
        {
            "id": "inactive_reminder",
            "title": "😢 We miss you!",
            "body": "It's been a while! Come back and find your match.",
            "category": "re-engagement",
            "is_custom": False
        },
        {
            "id": "weekend_special",
            "title": "🎉 Weekend Special!",
            "body": "More users are online on weekends. Find your match now!",
            "category": "promotion",
            "is_custom": False
        },
        {
            "id": "profile_boost",
            "title": "🚀 Boost your profile!",
            "body": "Get more visibility with a free profile boost. Limited time!",
            "category": "promotion",
            "is_custom": False
        },
        {
            "id": "new_feature",
            "title": "✨ New Feature Alert!",
            "body": "Check out our latest features. Update your app now!",
            "category": "announcement",
            "is_custom": False
        },
        {
            "id": "evening_reminder",
            "title": "🌙 Evening Check-in",
            "body": "Wind down with some swiping. Your match might be online now!",
            "category": "daily",
            "is_custom": False
        },
        {
            "id": "profile_incomplete",
            "title": "📝 Complete Your Profile",
            "body": "Profiles with photos get 10x more matches. Add yours now!",
            "category": "engagement",
            "is_custom": False
        },
        {
            "id": "safety_tip",
            "title": "🛡️ Safety Reminder",
            "body": "Your safety matters! Always video call before meeting. Stay safe!",
            "category": "safety",
            "is_custom": False
        },
        {
            "id": "match_expiring",
            "title": "⏰ Match Expiring Soon!",
            "body": "You have unread messages. Reply before they expire!",
            "category": "urgency",
            "is_custom": False
        },
        {
            "id": "premium_offer",
            "title": "👑 Premium Offer!",
            "body": "Unlock unlimited swipes and see who liked you. 50% off today!",
            "category": "monetization",
            "is_custom": False
        }
    ]
    
    # Fetch custom templates from database
    custom_templates = await db.notification_templates.find({}).to_list(None)
    custom_list = [{
        "id": t.get("id"),
        "title": t.get("title"),
        "body": t.get("body"),
        "category": t.get("category", "custom"),
        "is_custom": True,
        "created_at": t.get("created_at")
    } for t in custom_templates]
    
    return default_templates + custom_list


# Custom Template CRUD


@api_router.get("/admin/notification-templates")
async def get_all_notification_templates():
    """Get all notification templates (pre-defined + custom) in array format"""
    # Convert engagement templates to array format
    engagement_templates = []
    for key, value in fcm_service.ENGAGEMENT_TEMPLATES.items():
        engagement_templates.append({
            "id": key,
            "title": value["title"],
            "body": value.get("body", value.get("message", "")),
            "category": value["data"].get("type", "engagement"),
            "is_engagement": True
        })
    
    # Get custom templates from database
    custom_templates = await db.notification_templates.find(
        {},
        {"_id": 0}
    ).to_list(None)
    
    for t in custom_templates:
        t["is_custom"] = True
    
    # Combine and return
    return engagement_templates + custom_templates


@api_router.get("/admin/custom-templates")
async def get_custom_templates():
    """Get only custom templates from database"""
    templates = await db.notification_templates.find(
        {},
        {"_id": 0}
    ).to_list(None)
    return templates


@api_router.post("/admin/notification-templates")
async def create_notification_template(template: NotificationTemplateCreate):
    """Create a custom notification template"""
    template_doc = {
        "id": str(uuid.uuid4()),
        "title": template.title,
        "body": template.body,
        "category": template.category,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notification_templates.insert_one(template_doc)
    
    return {
        "success": True,
        "message": "Template created",
        "template": {
            "id": template_doc["id"],
            "title": template_doc["title"],
            "body": template_doc["body"],
            "category": template_doc["category"],
            "is_custom": True
        }
    }


@api_router.put("/admin/notification-templates/{template_id}")
async def update_notification_template(template_id: str, template: NotificationTemplateCreate):
    """Update a custom notification template"""
    result = await db.notification_templates.update_one(
        {"id": template_id},
        {"$set": {
            "title": template.title,
            "body": template.body,
            "category": template.category,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"success": True, "message": "Template updated"}


@api_router.delete("/admin/notification-templates/{template_id}")
async def delete_notification_template(template_id: str):
    """Delete a custom notification template"""
    result = await db.notification_templates.delete_one({"id": template_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"success": True, "message": "Template deleted"}

@api_router.get("/admin/notification-history")
async def get_notification_history(limit: int = 20):
    """Get history of sent notifications"""
    logs = await db.notification_logs.find({}).sort("sent_at", -1).limit(limit).to_list(None)
    return [{
        "id": log.get("id"),
        "title": log.get("title"),
        "body": log.get("body"),
        "target": log.get("target"),
        "total_sent": log.get("total_sent"),
        "success_count": log.get("success_count"),
        "sent_at": log.get("sent_at")
    } for log in logs]

@api_router.post("/admin/schedule-notification")
async def schedule_notification(data: ScheduledNotificationRequest):
    """Schedule a notification for later"""
    scheduled_doc = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "body": data.body,
        "target": data.target,
        "schedule_time": data.schedule_time,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.scheduled_notifications.insert_one(scheduled_doc)
    
    return {
        "success": True,
        "message": "Notification scheduled",
        "scheduled_id": scheduled_doc["id"],
        "schedule_time": data.schedule_time
    }

@api_router.get("/admin/scheduled-notifications")
async def get_scheduled_notifications():
    """Get all pending scheduled notifications"""
    notifications = await db.scheduled_notifications.find(
        {"status": "pending"}
    ).sort("schedule_time", 1).to_list(None)
    
    return [{
        "id": n.get("id"),
        "title": n.get("title"),
        "body": n.get("body"),
        "target": n.get("target"),
        "schedule_time": n.get("schedule_time"),
        "status": n.get("status")
    } for n in notifications]

@api_router.delete("/admin/scheduled-notification/{notification_id}")
async def cancel_scheduled_notification(notification_id: str):
    """Cancel a scheduled notification"""
    result = await db.scheduled_notifications.update_one(
        {"id": notification_id},
        {"$set": {"status": "cancelled"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Notification cancelled"}

# ==================== ADS & MONETIZATION APIS ====================
# Moved to routes/ads.py

# ==================== PREMIUM SUBSCRIPTION APIS ====================



# ==================== PREMIUM SUBSCRIPTION APIS ====================



@api_router.post("/subscription/create")
async def create_subscription(data: SubscriptionCreateRequest):
    """
    Create a subscription order
    In production, this would integrate with Razorpay/Stripe
    """
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Plan pricing (in INR)
    plans = {
        "monthly": {"price": 299, "days": 30, "name": "Premium Monthly"},
        "quarterly": {"price": 699, "days": 90, "name": "Premium Quarterly"},
        "yearly": {"price": 1999, "days": 365, "name": "Premium Yearly"}
    }
    
    if data.plan_id not in plans:
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    plan = plans[data.plan_id]
    
    # Create order record
    order_doc = {
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "plan_id": data.plan_id,
        "plan_name": plan["name"],
        "amount": plan["price"],
        "currency": "INR",
        "status": "pending",  # pending, completed, failed
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.subscription_orders.insert_one(order_doc)
    
    # In production, integrate with payment gateway here
    # For now, return order details
    return {
        "order_id": order_doc["id"],
        "amount": plan["price"],
        "currency": "INR",
        "plan_name": plan["name"],
        "days": plan["days"],
        "message": "Payment integration coming soon"
    }

@api_router.post("/subscription/activate/{user_id}")
async def activate_subscription(user_id: str, plan_id: str, order_id: str = None):
    """
    Activate premium subscription for user
    Called after successful payment verification
    """
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Plan durations
    plan_days = {
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365
    }
    
    if plan_id not in plan_days:
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    # Calculate subscription end date
    days = plan_days[plan_id]
    end_date = datetime.now(timezone.utc) + timedelta(days=days)
    
    # Update user to premium
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_premium": True,
            "premium_plan": plan_id,
            "premium_start": datetime.now(timezone.utc).isoformat(),
            "premium_end": end_date.isoformat()
        }}
    )
    
    # Update order status if provided
    if order_id:
        await db.subscription_orders.update_one(
            {"id": order_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    invalidate_user_cache(user_id)
    
    return {
        "success": True,
        "message": "Premium activated successfully",
        "plan": plan_id,
        "expires_at": end_date.isoformat()
    }

@api_router.get("/subscription/status/{user_id}")
async def get_subscription_status(user_id: str):
    """Get user's subscription status"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_premium = user.get("is_premium", False)
    
    # Check if subscription expired
    if is_premium and user.get("premium_end"):
        end_date = datetime.fromisoformat(user["premium_end"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > end_date:
            # Subscription expired, update user
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"is_premium": False}}
            )
            invalidate_user_cache(user_id)
            is_premium = False
    
    return {
        "user_id": user_id,
        "is_premium": is_premium,
        "plan": user.get("premium_plan"),
        "started_at": user.get("premium_start"),
        "expires_at": user.get("premium_end"),
        "features": {
            "no_ads": is_premium,
            "unlimited_swipes": is_premium,
            "see_who_liked": is_premium,
            "profile_boost": is_premium,
            "super_likes": is_premium,
            "rewind": is_premium
        }
    }

# CORS - Allow web + Capacitor Android app origins
cors_origins = os.environ.get('CORS_ORIGINS', 'https://heartlink.co.in,https://www.heartlink.co.in,capacitor://localhost,https://localhost,http://localhost').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
)


# ADMIN: Complete Database Cleanup Endpoint (DANGEROUS - USE WITH CAUTION)


@api_router.post("/admin/clear-all-data")
async def clear_all_database_data(request: DatabaseClearRequest):
    """
    ⚠️ DANGER: This endpoint completely wipes ALL data from database
    Use only for testing/development purposes
    Requires confirmation string and admin password
    """
    
    # Safety check 1: Confirmation string
    if request.confirm != "DELETE_ALL_DATA_PERMANENTLY":
        raise HTTPException(status_code=400, detail="Invalid confirmation string")
    
    # Safety check 2: Admin password (required from environment)
    admin_password = os.environ.get('ADMIN_PASSWORD')
    if not admin_password:
        raise HTTPException(status_code=500, detail="ADMIN_PASSWORD not configured")
    if request.admin_password != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin password")
    
    try:
        # Get all collections
        collections = await db.list_collection_names()
        
        deleted_counts = {}
        total_deleted = 0
        
        # Delete all documents from each collection
        for collection in collections:
            result = await db[collection].delete_many({})
            deleted_counts[collection] = result.deleted_count
            total_deleted += result.deleted_count
        
        return {
            "message": "Database completely cleared",
            "total_documents_deleted": total_deleted,
            "collections_cleared": deleted_counts,
            "warning": "All data has been permanently deleted"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database cleanup failed: {str(e)}")

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== DAILY NOTIFICATION CRON ====================

# Daily notification messages (random selection)
DAILY_NOTIFICATION_MESSAGES = [
    {"title": "💕 New matches waiting!", "body": "Someone special might be waiting for you. Open HeartLink now!"},
    {"title": "❤️ Find your match today!", "body": "New profiles have been added. Start swiping!"},
    {"title": "🌟 Your daily match is here!", "body": "Check out today's top profiles selected for you."},
    {"title": "💫 Love is in the air!", "body": "Many new users joined today. Don't miss out!"},
    {"title": "🔥 Hot profiles near you!", "body": "New matches in your area. Open HeartLink now!"},
    {"title": "😊 Good morning!", "body": "Start your day by finding your perfect match on HeartLink."},
    {"title": "💝 Someone liked you!", "body": "Check who liked your profile. Open HeartLink now!"},
]

async def send_daily_notifications():
    """
    Background task to send daily notifications to all users with FCM tokens
    Called automatically once per day
    """
    import random
    
    try:
        # Get all users with FCM tokens
        users_with_tokens = await db.users.find({
            "fcm_token": {"$exists": True, "$nin": [None, ""]}
        }).to_list(None)
        
        if not users_with_tokens:
            logger.info("Daily Notification: No users with FCM tokens found")
            return {"sent": 0, "message": "No users with FCM tokens"}
        
        # Get random message
        message = random.choice(DAILY_NOTIFICATION_MESSAGES)
        
        # Collect all tokens
        tokens = [u["fcm_token"] for u in users_with_tokens if u.get("fcm_token")]
        
        if not tokens:
            return {"sent": 0, "message": "No valid tokens"}
        
        # Send to all at once
        result = send_notification_to_multiple(
            tokens=tokens,
            title=message["title"],
            body=message["body"]
        )
        
        # Log the notification
        log_entry = {
            "id": str(uuid.uuid4()),
            "type": "daily_automated",
            "title": message["title"],
            "body": message["body"],
            "target": "all_with_tokens",
            "total_sent": len(tokens),
            "success_count": result.get("success_count", 0),
            "failure_count": result.get("failure_count", 0),
            "sent_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notification_logs.insert_one(log_entry)
        
        logger.info(f"Daily Notification: Sent to {len(tokens)} users")
        
        return {
            "sent": len(tokens),
            "success": result.get("success_count", 0),
            "failed": result.get("failure_count", 0)
        }
        
    except Exception as e:
        logger.error(f"Daily Notification Error: {str(e)}")
        return {"error": str(e)}

async def send_inactive_user_notifications():
    """
    Send notifications to users who haven't been active for 3+ days
    """
    try:
        three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
        
        # Find inactive users with FCM tokens
        inactive_users = await db.users.find({
            "fcm_token": {"$exists": True, "$nin": [None, ""]},
            "last_active": {"$lt": three_days_ago.isoformat()}
        }).to_list(100)
        
        if not inactive_users:
            return {"sent": 0, "message": "No inactive users found"}
        
        success_count = 0
        for user in inactive_users:
            if user.get("fcm_token"):
                # Calculate days inactive
                last_active = datetime.fromisoformat(user.get("last_active", datetime.now(timezone.utc).isoformat()).replace('Z', '+00:00'))
                days_inactive = (datetime.now(timezone.utc) - last_active).days
                
                result = send_inactive_user_notification(user["fcm_token"], days_inactive)
                if result.get("success"):
                    success_count += 1
        
        return {"sent": success_count, "total": len(inactive_users)}
        
    except Exception as e:
        logger.error(f"Inactive Notification Error: {str(e)}")
        return {"error": str(e)}

# Background scheduler for daily notifications
daily_notification_running = False

async def daily_notification_scheduler():
    """
    Runs in background, sends notifications once per day at 10 AM IST
    """
    global daily_notification_running
    
    if daily_notification_running:
        return
    
    daily_notification_running = True
    
    while True:
        try:
            # Get current time in IST (UTC+5:30)
            now_utc = datetime.now(timezone.utc)
            ist_offset = timedelta(hours=5, minutes=30)
            now_ist = now_utc + ist_offset
            
            # Target time: 10:00 AM IST
            target_hour = 10
            target_minute = 0
            
            # Check if it's notification time (within 5 minute window)
            if now_ist.hour == target_hour and 0 <= now_ist.minute < 5:
                # Check if we already sent today
                today_date = now_ist.date().isoformat()
                existing_log = await db.notification_logs.find_one({
                    "type": "daily_automated",
                    "sent_at": {"$regex": f"^{today_date}"}
                })
                
                if not existing_log:
                    logger.info("Sending daily notifications...")
                    await send_daily_notifications()
                    
                    # Also send to inactive users
                    await send_inactive_user_notifications()
            
            # Sleep for 5 minutes before checking again
            await asyncio.sleep(300)
            
        except Exception as e:
            logger.error(f"Daily scheduler error: {str(e)}")
            await asyncio.sleep(60)

# API to manually trigger daily notifications (admin only)
@api_router.post("/admin/trigger-daily-notification")
async def trigger_daily_notification():
    """
    Manually trigger daily notifications (for testing)
    """
    result = await send_daily_notifications()
    inactive_result = await send_inactive_user_notifications()
    
    return {
        "daily": result,
        "inactive": inactive_result
    }

# API to check daily notification status
@api_router.get("/admin/daily-notification-status")
async def get_daily_notification_status():
    """
    Get status of daily notifications
    """
    # Get last notification log
    last_log = await db.notification_logs.find_one(
        {"type": "daily_automated"},
        sort=[("sent_at", -1)]
    )
    
    # Count users with FCM tokens
    users_with_tokens = await db.users.count_documents({
        "fcm_token": {"$exists": True, "$nin": [None, ""]}
    })
    
    # Count inactive users
    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    inactive_count = await db.users.count_documents({
        "fcm_token": {"$exists": True, "$nin": [None, ""]},
        "last_active": {"$lt": three_days_ago.isoformat()}
    })
    
    return {
        "scheduler_running": daily_notification_running,
        "users_with_fcm_tokens": users_with_tokens,
        "inactive_users": inactive_count,
        "last_notification": {
            "title": last_log.get("title") if last_log else None,
            "sent_at": last_log.get("sent_at") if last_log else None,
            "total_sent": last_log.get("total_sent") if last_log else 0,
            "success_count": last_log.get("success_count") if last_log else 0
        } if last_log else None,
        "next_scheduled": "10:00 AM IST daily"
    }

# Merge additional startup tasks into existing startup event
# (startup_event is already defined at line ~255)
@app.on_event("startup")
async def startup_daily_tasks():
    """Start daily notification tasks"""
    asyncio.create_task(daily_notification_scheduler())
    logger.info("Daily notification scheduler started")
    asyncio.create_task(scheduled_notification_processor())
    logger.info("Scheduled notification processor started")


# ==================== SCHEDULED NOTIFICATION PROCESSOR ====================

async def scheduled_notification_processor():
    """
    Background task that checks and sends scheduled notifications
    Runs every minute to check for due notifications
    """
    while True:
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            # Find notifications that are due
            due_notifications = await db.scheduled_notifications.find({
                "status": "pending",
                "schedule_time": {"$lte": now}
            }).to_list(None)
            
            for notif in due_notifications:
                try:
                    # Send via OneSignal
                    target = notif.get("target", "all")
                    title = notif.get("title", "HeartLink")
                    message = notif.get("body", "")
                    
                    if target == "all":
                        result = await fcm_service.send_to_all(db, title, message)
                    elif target in ["male", "female"]:
                        query = {"gender": {"$regex": f"^{target}$", "$options": "i"}}
                        users = await db.users.find(query, {"id": 1}).to_list(None)
                        user_ids = [u["id"] for u in users]
                        if user_ids:
                            result = await fcm_service.send_to_users(db, user_ids, title, message)
                        else:
                            result = {"success": False, "error": f"No {target} users found"}
                    elif target == "inactive":
                        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
                        query = {"last_active": {"$lt": week_ago}}
                        users = await db.users.find(query, {"id": 1}).to_list(None)
                        user_ids = [u["id"] for u in users]
                        if user_ids:
                            result = await fcm_service.send_to_users(db, user_ids, title, message)
                        else:
                            result = {"success": False, "error": "No inactive users found"}
                    else:
                        result = {"success": False, "error": "Invalid target"}
                    
                    # Update notification status
                    await db.scheduled_notifications.update_one(
                        {"id": notif["id"]},
                        {"$set": {
                            "status": "sent" if result.get("success") else "failed",
                            "sent_at": datetime.now(timezone.utc).isoformat(),
                            "result": result
                        }}
                    )
                    
                    # Log the notification
                    await db.notification_logs.insert_one({
                        "id": str(uuid.uuid4()),
                        "title": title,
                        "body": message,
                        "target": target,
                        "provider": "onesignal",
                        "type": "scheduled",
                        "scheduled_id": notif["id"],
                        "result": result,
                        "sent_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    logger.info(f"Scheduled notification sent: {notif['id']} - {result.get('success')}")
                    
                except Exception as e:
                    logger.error(f"Error sending scheduled notification {notif.get('id')}: {e}")
                    await db.scheduled_notifications.update_one(
                        {"id": notif["id"]},
                        {"$set": {"status": "failed", "error": str(e)}}
                    )
            
            # Sleep for 1 minute before next check
            await asyncio.sleep(60)
            
        except Exception as e:
            logger.error(f"Scheduled notification processor error: {e}")
            await asyncio.sleep(60)

# ==================== PUSH NOTIFICATION APIS (FCM Only) ====================



@api_router.post("/admin/push/send")
async def send_push_notification_api(data: PushNotificationRequest):
    """Send push notification via FCM (Admin Panel)."""
    if data.target == "user_ids" and data.user_ids:
        result = await fcm_service.send_to_users(db, data.user_ids, data.title, data.message)
    else:
        result = await fcm_service.admin_broadcast(db, data.title, data.message, data.target)
    
    await db.notification_logs.insert_one({
        "id": str(uuid.uuid4()),
        "title": data.title,
        "body": data.message,
        "target": data.target,
        "provider": "fcm",
        "result": {k: v for k, v in result.items() if k != "stale_tokens"},
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    return result

# Keep old endpoint path for backward compatibility with frontend
@api_router.post("/admin/onesignal/send")
async def send_push_compat(data: PushNotificationRequest):
    """Backward-compatible endpoint — routes to FCM."""
    return await send_push_notification_api(data)

@api_router.post("/admin/push/send-to-user/{user_id}")
async def send_push_to_single_user(user_id: str, title: str = "HeartLink", message: str = "Test"):
    """Send push to a specific user via FCM."""
    return await fcm_service.send_to_user(db, user_id, title, message)

@api_router.post("/admin/onesignal/send-to-user/{user_id}")
async def send_push_to_single_user_compat(user_id: str, title: str = "HeartLink", message: str = "Test"):
    """Backward-compatible endpoint."""
    return await send_push_to_single_user(user_id, title, message)

@api_router.get("/admin/push/status")
async def get_push_status():
    """Check FCM push notification status."""
    total = await db.users.count_documents({})
    with_fcm = await db.users.count_documents({"fcm_token": {"$exists": True, "$nin": [None, ""]}})
    return {
        "provider": "fcm",
        "configured": fcm_service.is_fcm_ready(),
        "can_send_notifications": fcm_service.is_fcm_ready(),
        "total_users": total,
        "users_with_fcm_token": with_fcm,
        "users_without_fcm_token": total - with_fcm,
    }

@api_router.get("/admin/onesignal/status")
async def get_push_status_compat():
    """Backward-compatible endpoint."""
    return await get_push_status()

@api_router.post("/admin/push/test")
async def test_push():
    """Send a test notification to all users via FCM."""
    return await fcm_service.send_to_all(db, "HeartLink", "Push notification system is working!")

@api_router.post("/admin/onesignal/test")
async def test_push_compat():
    """Backward-compatible endpoint."""
    return await test_push()


# ==================== ENGAGEMENT NOTIFICATION ENDPOINTS ====================

@api_router.get("/admin/notifications/templates")
async def get_engagement_notification_templates():
    """Get all available engagement notification templates"""
    return {
        "templates": fcm_service.ENGAGEMENT_TEMPLATES,
        "template_keys": list(fcm_service.ENGAGEMENT_TEMPLATES.keys())
    }


@api_router.post("/admin/notifications/send-engagement")
async def send_engagement_to_users(
    template_key: str,
    user_ids: Optional[List[str]] = None,
    send_to_all: bool = False
):
    """
    Send engagement notification using pre-defined templates
    """
    if template_key not in fcm_service.ENGAGEMENT_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Unknown template: {template_key}")
    
    if send_to_all:
        template = fcm_service.ENGAGEMENT_TEMPLATES[template_key]
        result = await fcm_service.send_to_all(db, template["title"], template["message"])
    elif user_ids:
        result = await fcm_service.send_to_users(db, user_ids, template.get("title",""), template.get("body",""))
    else:
        raise HTTPException(status_code=400, detail="Provide user_ids or set send_to_all=true")
    
    # Log the notification
    await db.admin_notifications.insert_one({
        "type": "engagement",
        "template": template_key,
        "target": "all" if send_to_all else user_ids,
        "result": result,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    
    return result


@api_router.get("/admin/notifications/inactive-users")
async def get_inactive_users(days: int = 3):
    """Get list of inactive users (haven't been active in X days)"""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    inactive_users = await db.users.find({
        "$or": [
            {"last_active": {"$lt": cutoff_date.isoformat()}},
            {"last_active": {"$exists": False}}
        ],
        "profile_status": "approved"
    }, {
        "_id": 0, "id": 1, "name": 1, "email": 1, "last_active": 1
    }).to_list(None)
    
    return {
        "count": len(inactive_users),
        "days_inactive": days,
        "users": inactive_users
    }


@api_router.post("/admin/notifications/send-to-inactive")
async def send_notification_to_inactive_users(days: int = 3):
    """Send re-engagement notification to inactive users"""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get inactive user IDs
    inactive_users = await db.users.find({
        "$or": [
            {"last_active": {"$lt": cutoff_date.isoformat()}},
            {"last_active": {"$exists": False}}
        ],
        "profile_status": "approved"
    }, {"_id": 0, "id": 1}).to_list(None)
    
    if not inactive_users:
        return {"success": True, "message": "No inactive users found", "sent_to": 0}
    
    user_ids = [u["id"] for u in inactive_users]
    
    # Select template based on inactivity period
    if days <= 1:
        template_key = "inactive_1day"
    elif days <= 3:
        template_key = "inactive_3days"
    else:
        template_key = "inactive_7days"
    
    template = fcm_service.ENGAGEMENT_TEMPLATES.get(template_key, {})
    result = await fcm_service.send_to_users(db, user_ids, template.get("title","Come back!"), template.get("body","We miss you!"))
    
    # Log
    await db.admin_notifications.insert_one({
        "type": "re-engagement",
        "template": template_key,
        "days_inactive": days,
        "target_count": len(user_ids),
        "result": result,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": result.get("success", False),
        "sent_to": len(user_ids),
        "template_used": template_key,
        "result": result
    }


@api_router.post("/admin/notifications/send-custom")
async def send_custom_notification(
    title: str,
    message: str,
    user_ids: Optional[List[str]] = None,
    send_to_all: bool = False,
    action: str = "open_app"
):
    """Send custom notification with custom title and message"""
    if send_to_all:
        result = await fcm_service.send_to_all(db, title, message, {"type": "custom", "action": action})
    elif user_ids:
        result = await fcm_service.send_to_users(db, user_ids, title, message, {"type": "custom", "action": action})
    else:
        result = {"success": False, "error": "No target specified"}
    
    # Log
    await db.admin_notifications.insert_one({
        "type": "custom",
        "title": title,
        "message": message,
        "target": "all" if send_to_all else user_ids,
        "result": result,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    
    return result


@api_router.get("/admin/notifications/stats")
async def get_notification_stats():
    """Get notification sending statistics"""
    # Get counts by type
    pipeline = [
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    stats_by_type = await db.admin_notifications.aggregate(pipeline).to_list(None)
    
    # Get recent notifications
    recent = await db.admin_notifications.find(
        {},
        {"_id": 0}
    ).sort("sent_at", -1).limit(10).to_list(None)
    
    # Get total sent
    total = await db.admin_notifications.count_documents({})
    
    return {
        "total_sent": total,
        "by_type": {s["_id"]: s["count"] for s in stats_by_type},
        "recent": recent
    }


@api_router.get("/admin/notifications/delivery-log")
async def get_notification_delivery_log(limit: int = 50, notification_type: str = ""):
    """Get comprehensive notification delivery log for audit"""
    query = {}
    if notification_type:
        query["type"] = notification_type
    
    logs = await db.notification_logs.find(
        query, {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(None)
    
    # Get summary stats
    total_logs = await db.notification_logs.count_documents({})
    total_in_app = await db.in_app_notifications.count_documents({})
    
    # Count by notification type from in_app_notifications
    type_pipeline = [
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    type_stats = await db.in_app_notifications.aggregate(type_pipeline).to_list(None)
    
    return {
        "logs": logs,
        "summary": {
            "total_push_logs": total_logs,
            "total_in_app_notifications": total_in_app,
            "by_type": {s["_id"]: s["count"] for s in type_stats}
        }
    }


# ==========================================
# REFERRAL SYSTEM (P1)
# ==========================================

@api_router.get("/referral/{user_id}")
async def get_referral_info(user_id: str):
    """Get user's referral code and stats"""
    # Check feature flag
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if flags and not flags.get("referral_system", True):
        raise HTTPException(status_code=403, detail="Referral system is currently paused")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate referral code if not exists
    referral_code = user.get("referral_code")
    if not referral_code:
        referral_code = f"HL{user.get('name', 'U')[:3].upper()}{str(uuid.uuid4())[:6].upper()}"
        await db.users.update_one({"id": user_id}, {"$set": {"referral_code": referral_code}})
    
    # Count successful referrals
    referral_count = await db.referrals.count_documents({"referrer_id": user_id, "status": "completed"})
    pending_count = await db.referrals.count_documents({"referrer_id": user_id, "status": "pending"})
    
    # Calculate rewards earned
    rewards_earned = (referral_count // 3) * 10  # 10 superlikes per 3 referrals
    next_milestone = 3 - (referral_count % 3)  # Referrals needed for next reward
    
    # Get referral history
    referrals = await db.referrals.find(
        {"referrer_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "referral_code": referral_code,
        "referral_link": f"https://heartlink.co.in/auth?ref={referral_code}",
        "total_referrals": referral_count,
        "pending_referrals": pending_count,
        "rewards_earned": rewards_earned,
        "next_milestone": next_milestone,
        "referrals_for_next_reward": next_milestone,
        "referrals": referrals
    }

@api_router.post("/referral/apply")
async def apply_referral_code(data: dict):
    """Apply a referral code during signup"""
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if flags and not flags.get("referral_system", True):
        raise HTTPException(status_code=403, detail="Referral system is currently paused")
    
    referral_code = data.get("referral_code", "").strip().upper()
    new_user_id = data.get("user_id")
    
    if not referral_code or not new_user_id:
        raise HTTPException(status_code=400, detail="Referral code and user_id required")
    
    # Find the referrer
    referrer = await db.users.find_one({"referral_code": referral_code}, {"_id": 0})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referrer["id"] == new_user_id:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")
    
    # Check if already referred
    existing = await db.referrals.find_one({
        "referred_user_id": new_user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already used a referral code")
    
    # Create referral record
    referral = {
        "id": str(uuid.uuid4()),
        "referrer_id": referrer["id"],
        "referrer_name": referrer.get("name", "Unknown"),
        "referred_user_id": new_user_id,
        "referral_code": referral_code,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.referrals.insert_one(referral)
    
    # Check if referrer hit a milestone (every 3 referrals = 10 superlikes)
    total_referrals = await db.referrals.count_documents({
        "referrer_id": referrer["id"], "status": "completed"
    })
    
    reward_given = False
    if total_referrals % 3 == 0:
        # Grant 10 superlikes to referrer
        await db.users.update_one(
            {"id": referrer["id"]},
            {"$inc": {"bonus_superlikes": 10}}
        )
        # Log reward
        await db.rewards.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": referrer["id"],
            "type": "referral_milestone",
            "reward": "10_superlikes",
            "description": f"Referred {total_referrals} friends! +10 Superlikes",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        reward_given = True
    
    # Give new user a welcome bonus (2 superlikes for using referral)
    await db.users.update_one(
        {"id": new_user_id},
        {"$inc": {"bonus_superlikes": 2}, "$set": {"referred_by": referrer["id"]}}
    )
    
    return {
        "success": True,
        "message": "Referral applied successfully!",
        "referrer_rewarded": reward_given,
        "referrer_total": total_referrals,
        "new_user_bonus": 2
    }

@api_router.get("/referral/{user_id}/leaderboard")
async def get_referral_leaderboard(user_id: str):
    """Get top referrers"""
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": "$referrer_id", "count": {"$sum": 1}, "name": {"$first": "$referrer_name"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    leaders = await db.referrals.aggregate(pipeline).to_list(10)
    
    leaderboard = []
    for i, leader in enumerate(leaders):
        leaderboard.append({
            "rank": i + 1,
            "name": leader.get("name", "Anonymous"),
            "referrals": leader["count"],
            "is_you": leader["_id"] == user_id
        })
    
    return {"leaderboard": leaderboard}


# ==========================================
# DAILY LOGIN REWARDS (P2)
# ==========================================

DAILY_REWARDS = [
    {"day": 1, "type": "superlikes", "amount": 1, "label": "1 Superlike"},
    {"day": 2, "type": "superlikes", "amount": 2, "label": "2 Superlikes"},
    {"day": 3, "type": "profile_boost", "amount": 30, "label": "30 Min Profile Boost"},
    {"day": 4, "type": "superlikes", "amount": 3, "label": "3 Superlikes"},
    {"day": 5, "type": "superlikes", "amount": 5, "label": "5 Superlikes"},
    {"day": 6, "type": "profile_boost", "amount": 60, "label": "1 Hr Profile Boost"},
    {"day": 7, "type": "superlikes_badge", "amount": 10, "label": "10 Superlikes + Badge"},
]

@api_router.get("/daily-reward/{user_id}")
async def get_daily_reward_status(user_id: str):
    """Get user's daily login reward status and streak"""
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if flags and not flags.get("daily_rewards", True):
        raise HTTPException(status_code=403, detail="Daily rewards are currently paused")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get today's date (IST)
    now_utc = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now_utc + ist_offset
    today_str = now_ist.strftime("%Y-%m-%d")
    
    # Get streak info
    streak_data = await db.daily_rewards.find_one(
        {"user_id": user_id}, {"_id": 0}
    )
    
    if not streak_data:
        streak_data = {
            "user_id": user_id,
            "current_streak": 0,
            "last_claim_date": None,
            "total_claims": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.daily_rewards.insert_one(streak_data)
    
    last_claim = streak_data.get("last_claim_date")
    current_streak = streak_data.get("current_streak", 0)
    
    # Check if already claimed today
    already_claimed = last_claim == today_str
    
    # Check if streak should reset (missed more than 1 day)
    if last_claim and not already_claimed:
        last_claim_date = datetime.strptime(last_claim, "%Y-%m-%d")
        today_date = datetime.strptime(today_str, "%Y-%m-%d")
        diff_days = (today_date - last_claim_date).days
        
        if diff_days > 1:
            # Streak broken - reset
            current_streak = 0
            await db.daily_rewards.update_one(
                {"user_id": user_id},
                {"$set": {"current_streak": 0}}
            )
    
    # Current day in cycle (1-7)
    next_day = (current_streak % 7) + 1
    
    return {
        "current_streak": current_streak,
        "next_day": next_day,
        "already_claimed_today": already_claimed,
        "today_reward": DAILY_REWARDS[next_day - 1] if not already_claimed else None,
        "all_rewards": DAILY_REWARDS,
        "total_claims": streak_data.get("total_claims", 0),
        "last_claim_date": last_claim
    }

@api_router.post("/daily-reward/{user_id}/claim")
async def claim_daily_reward(user_id: str):
    """Claim today's daily login reward"""
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if flags and not flags.get("daily_rewards", True):
        raise HTTPException(status_code=403, detail="Daily rewards are currently paused")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now_utc = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now_utc + ist_offset
    today_str = now_ist.strftime("%Y-%m-%d")
    
    streak_data = await db.daily_rewards.find_one({"user_id": user_id}, {"_id": 0})
    
    if not streak_data:
        streak_data = {
            "user_id": user_id,
            "current_streak": 0,
            "last_claim_date": None,
            "total_claims": 0
        }
        await db.daily_rewards.insert_one(streak_data)
    
    # Check if already claimed
    if streak_data.get("last_claim_date") == today_str:
        raise HTTPException(status_code=400, detail="Already claimed today's reward")
    
    current_streak = streak_data.get("current_streak", 0)
    last_claim = streak_data.get("last_claim_date")
    
    # Check streak continuity
    if last_claim:
        last_claim_date = datetime.strptime(last_claim, "%Y-%m-%d")
        today_date = datetime.strptime(today_str, "%Y-%m-%d")
        diff_days = (today_date - last_claim_date).days
        if diff_days > 1:
            current_streak = 0  # Reset streak
    
    # Next day in cycle
    reward_day = (current_streak % 7)  # 0-6
    reward = DAILY_REWARDS[reward_day]
    new_streak = current_streak + 1
    
    # Apply reward
    update_fields = {}
    if reward["type"] == "superlikes" or reward["type"] == "superlikes_badge":
        update_fields["$inc"] = {"bonus_superlikes": reward["amount"]}
        if reward["type"] == "superlikes_badge" and new_streak >= 7:
            # Add streak badge
            update_fields["$addToSet"] = {"badges": "streak_champion"}
    elif reward["type"] == "profile_boost":
        boost_until = (now_utc + timedelta(minutes=reward["amount"])).isoformat()
        update_fields["$set"] = {"profile_boost_until": boost_until}
    
    if update_fields:
        await db.users.update_one({"id": user_id}, update_fields)
    
    # Update streak
    await db.daily_rewards.update_one(
        {"user_id": user_id},
        {"$set": {
            "current_streak": new_streak,
            "last_claim_date": today_str
        }, "$inc": {"total_claims": 1}}
    )
    
    # Log reward
    await db.rewards.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "daily_login",
        "reward": reward["label"],
        "day": reward_day + 1,
        "streak": new_streak,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "reward": reward,
        "new_streak": new_streak,
        "message": f"Day {reward_day + 1} reward claimed: {reward['label']}!"
    }


# ==========================================
# ADMIN AI PROFILES MANAGEMENT
# ==========================================

@api_router.get("/admin/ai-profiles")
async def admin_get_ai_profiles():
    """Get all AI profiles for admin management."""
    profiles = await get_ai_profiles(db)
    # Get match counts and message counts for each profile
    result = []
    for p in profiles:
        match_count = await db.matches.count_documents({
            "$or": [{"user1_id": p["id"]}, {"user2_id": p["id"]}],
            "matched": True
        })
        msg_count = await db.messages.count_documents({"sender_id": p["id"]})
        p["total_matches"] = match_count
        p["total_messages_sent"] = msg_count
        result.append(p)
    return result

@api_router.delete("/admin/ai-profiles/{profile_id}")
async def admin_delete_ai_profile(profile_id: str):
    """Delete an AI profile and all related data."""
    success = await delete_ai_profile(db, profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="AI profile not found")
    return {"message": "AI profile deleted successfully"}

@api_router.put("/admin/ai-profiles/{profile_id}/toggle")
async def admin_toggle_ai_profile(profile_id: str, data: dict):
    """Enable or disable an AI profile."""
    is_active = data.get("is_active", True)
    success = await toggle_ai_profile(db, profile_id, is_active)
    if not success:
        raise HTTPException(status_code=404, detail="AI profile not found")
    return {"message": f"AI profile {'activated' if is_active else 'deactivated'}", "is_active": is_active}

@api_router.post("/admin/ai-profiles/reseed")
async def admin_reseed_ai_profiles():
    """Re-seed AI profiles (updates existing, creates missing)."""
    await seed_ai_profiles(db)
    return {"message": "AI profiles re-seeded successfully"}


# ==========================================
# ADMIN FEATURE TOGGLES
# ==========================================

DEFAULT_FEATURE_FLAGS = {
    "referral_system": True,
    "daily_rewards": True,
    "ai_chatbot": True,
    "new_user_gender_notifications": True,
    "new_user_notif_to_males": True,
    "new_user_notif_to_females": True,
    "crush_feature": False,
}

@api_router.get("/admin/feature-flags")
async def get_feature_flags():
    """Get all feature flags (always merged with defaults)"""
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if not flags:
        flags = {**DEFAULT_FEATURE_FLAGS, "type": "feature_flags"}
        await db.app_settings.insert_one(flags)
    # Always merge defaults so newly added flags are visible
    merged = {**DEFAULT_FEATURE_FLAGS, **{k: v for k, v in flags.items() if k != "type"}}
    return merged

@api_router.put("/admin/feature-flags")
async def update_feature_flags(data: dict):
    """Update feature flags (admin only)"""
    allowed_keys = {"referral_system", "daily_rewards", "ai_chatbot", "new_user_gender_notifications", "new_user_notif_to_males", "new_user_notif_to_females", "crush_feature"}
    updates = {k: bool(v) for k, v in data.items() if k in allowed_keys}
    
    if not updates:
        raise HTTPException(status_code=400, detail="No valid flags provided")
    
    await db.app_settings.update_one(
        {"type": "feature_flags"},
        {"$set": updates},
        upsert=True
    )
    
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    return {k: v for k, v in flags.items() if k != "type"}





# ==========================================
# NOTIFICATION ADMIN CONTROLS
# ==========================================

@api_router.get("/admin/notification-config")
async def get_notification_config():
    """Admin: Get notification settings + analytics."""
    config = await db.app_settings.find_one({"type": "notification_config"}, {"_id": 0})
    defaults = {
        "welcome_enabled": True, "profile_reminder_enabled": True,
        "new_user_discovery_enabled": True, "comeback_3d_enabled": True,
        "comeback_7d_enabled": True, "daily_engagement_enabled": True,
        "weekend_special_enabled": True, "max_notifications_per_user_per_day": 3,
    }
    if not config:
        config = defaults
    merged = {**defaults, **{k: v for k, v in config.items() if k != "type"}}
    
    analytics = await db.app_settings.find_one({"type": "notification_analytics"}, {"_id": 0})
    
    # Recent notification counts (last 24h)
    yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent_count = await db.notification_logs.count_documents({"sent_at": {"$gte": yesterday}})
    
    # Type breakdown (last 24h)
    type_pipeline = [
        {"$match": {"sent_at": {"$gte": yesterday}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
    ]
    type_breakdown = await db.notification_logs.aggregate(type_pipeline).to_list(None)
    
    return {
        "config": merged,
        "analytics": {k: v for k, v in (analytics or {}).items() if k not in ("type", "_id")},
        "recent_24h": recent_count,
        "type_breakdown_24h": {t["_id"]: t["count"] for t in type_breakdown},
    }


@api_router.put("/admin/notification-config")
async def update_notification_config(request: Request):
    """Admin: Update notification settings."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    allowed = {
        "welcome_enabled", "profile_reminder_enabled", "new_user_discovery_enabled",
        "comeback_3d_enabled", "comeback_7d_enabled", "daily_engagement_enabled",
        "weekend_special_enabled", "max_notifications_per_user_per_day",
    }
    updates = {}
    for k, v in data.items():
        if k in allowed:
            if k == "max_notifications_per_user_per_day":
                val = int(v)
                updates[k] = max(1, min(10, val))
            else:
                updates[k] = bool(v)
    
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields")
    
    await db.app_settings.update_one({"type": "notification_config"}, {"$set": updates}, upsert=True)
    config = await db.app_settings.find_one({"type": "notification_config"}, {"_id": 0})
    return {k: v for k, v in config.items() if k != "type"}


@api_router.get("/admin/notification-analytics-chart")
async def get_notification_analytics_chart(days: int = 7):
    """7-day notification analytics chart data from notification_logs."""
    now = datetime.now(timezone.utc)
    chart_data = []
    for i in range(days - 1, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        
        pipeline = [
            {"$match": {"sent_at": {"$gte": day_start, "$lte": day_end}}},
            {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        ]
        type_counts = await db.notification_logs.aggregate(pipeline).to_list(None)
        total = sum(t["count"] for t in type_counts)
        
        chart_data.append({
            "date": day.strftime("%b %d"),
            "total": total,
            "breakdown": {t["_id"]: t["count"] for t in type_counts}
        })
    
    return {"chart": chart_data, "period_days": days}


# ==========================================
# IN-APP RATING PROMPT
# ==========================================

@api_router.get("/rating/check/{user_id}")
async def check_rating_prompt(user_id: str):
    """Check if user should see the Play Store rating prompt.
    Trigger: 3+ matches AND not already rated AND not dismissed recently."""
    user = await db.users.find_one({"id": user_id}, {
        "_id": 0, "id": 1, "total_match_count": 1,
        "rating_submitted": 1, "rating_dismissed_at": 1
    })
    if not user:
        return {"show_rating": False}

    # Already rated — never show again
    if user.get("rating_submitted"):
        return {"show_rating": False}

    # Not enough matches
    match_count = user.get("total_match_count", 0)
    if match_count < 3:
        # Count from DB if field wasn't incremented yet (includes AI matches for user experience)
        match_count = await db.matches.count_documents({
            "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
            "matched": True
        })
        if match_count < 3:
            return {"show_rating": False}

    # Dismissed recently? (cooldown: 7 days)
    dismissed_at = user.get("rating_dismissed_at")
    if dismissed_at:
        try:
            dt = datetime.fromisoformat(dismissed_at.replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - dt).days < 7:
                return {"show_rating": False}
        except (ValueError, TypeError):
            pass

    return {
        "show_rating": True,
        "match_count": match_count,
        "play_store_url": "https://play.google.com/store/apps/details?id=com.heartlink.app"
    }


@api_router.post("/rating/event")
async def track_rating_event(request: Request):
    """Track rating prompt events: shown, clicked (rated), dismissed."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    user_id = data.get("user_id")
    event = data.get("event")  # rating_prompt_shown | rating_submitted | rating_dismissed

    if not user_id or event not in ("rating_prompt_shown", "rating_submitted", "rating_dismissed"):
        raise HTTPException(status_code=400, detail="Invalid event or user_id")

    # Track in analytics
    await db.app_settings.update_one(
        {"type": "rating_analytics"},
        {"$inc": {event: 1}},
        upsert=True
    )

    # Update user-level state
    if event == "rating_submitted":
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"rating_submitted": True, "rating_submitted_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif event == "rating_dismissed":
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"rating_dismissed_at": datetime.now(timezone.utc).isoformat()}}
        )

    return {"status": "ok"}



# ==========================================
# AD-FREE REWARD SYSTEM
# ==========================================

DEFAULT_ADFREE_CONFIG = {
    "type": "adfree_reward_config",
    "enabled": True,
    "reward_minutes": 30,
    "required_ads": 2,
}


@api_router.get("/adfree/config")
async def get_adfree_config():
    """Get ad-free reward config (public — used by app to show/hide the feature)."""
    config = await db.app_settings.find_one({"type": "adfree_reward_config"}, {"_id": 0})
    if not config:
        config = {**DEFAULT_ADFREE_CONFIG}
    return {
        "enabled": config.get("enabled", True),
        "reward_minutes": config.get("reward_minutes", 30),
        "required_ads": config.get("required_ads", 2),
    }


@api_router.get("/adfree/status/{user_id}")
async def get_adfree_status(user_id: str):
    """Check if user currently has ad-free reward active."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "ad_free_until": 1, "is_premium": 1, "isPremium": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("is_premium") or user.get("isPremium"):
        return {"ad_free": True, "reason": "premium", "remaining_seconds": -1}

    ad_free_until = user.get("ad_free_until")
    if ad_free_until:
        try:
            expires = datetime.fromisoformat(ad_free_until.replace("Z", "+00:00"))
            remaining = (expires - datetime.now(timezone.utc)).total_seconds()
            if remaining > 0:
                return {"ad_free": True, "reason": "reward", "remaining_seconds": int(remaining), "expires_at": ad_free_until}
        except (ValueError, TypeError):
            pass

    return {"ad_free": False, "remaining_seconds": 0}


@api_router.post("/adfree/activate")
async def activate_adfree_reward(request: Request):
    """Activate ad-free reward after user completed required rewarded ads."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    user_id = data.get("user_id")
    ads_completed = data.get("ads_completed", 0)

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    # Get config
    config = await db.app_settings.find_one({"type": "adfree_reward_config"}, {"_id": 0})
    if not config:
        config = {**DEFAULT_ADFREE_CONFIG}

    if not config.get("enabled", True):
        raise HTTPException(status_code=403, detail="Ad-free reward is currently disabled")

    required = config.get("required_ads", 2)
    reward_mins = config.get("reward_minutes", 30)

    if ads_completed < required:
        raise HTTPException(status_code=400, detail=f"Need {required} ads completed, got {ads_completed}")

    # Prevent duplicate activation (check if already active)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "ad_free_until": 1})
    if user and user.get("ad_free_until"):
        try:
            existing = datetime.fromisoformat(user["ad_free_until"].replace("Z", "+00:00"))
            if (existing - datetime.now(timezone.utc)).total_seconds() > 60:
                return {"status": "already_active", "expires_at": user["ad_free_until"]}
        except (ValueError, TypeError):
            pass

    expires = datetime.now(timezone.utc) + timedelta(minutes=reward_mins)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"ad_free_until": expires.isoformat()}}
    )

    # Track analytics
    await db.app_settings.update_one(
        {"type": "adfree_analytics"},
        {"$inc": {"ad_free_reward_activated": 1}},
        upsert=True
    )

    return {"status": "activated", "reward_minutes": reward_mins, "expires_at": expires.isoformat()}


@api_router.post("/adfree/track")
async def track_adfree_event(request: Request):
    """Track rewarded ad events for analytics."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = data.get("event")
    valid_events = ("rewarded_ad_prompt_shown", "rewarded_ad_started", "rewarded_ad_completed",
                    "rewarded_ad_failed", "ad_free_reward_activated", "ad_free_reward_expired")
    if event not in valid_events:
        raise HTTPException(status_code=400, detail="Invalid event")

    await db.app_settings.update_one(
        {"type": "adfree_analytics"},
        {"$inc": {event: 1}},
        upsert=True
    )
    return {"status": "ok"}


@api_router.get("/admin/adfree-config")
async def admin_get_adfree_config():
    """Admin: Get ad-free reward config with analytics."""
    config = await db.app_settings.find_one({"type": "adfree_reward_config"}, {"_id": 0})
    if not config:
        config = {**DEFAULT_ADFREE_CONFIG}
    analytics = await db.app_settings.find_one({"type": "adfree_analytics"}, {"_id": 0})
    return {
        "config": {k: v for k, v in config.items() if k != "type"},
        "analytics": {k: v for k, v in (analytics or {}).items() if k not in ("type", "_id")},
    }


@api_router.put("/admin/adfree-config")
async def admin_update_adfree_config(request: Request):
    """Admin: Update ad-free reward config."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    allowed = {"enabled", "reward_minutes", "required_ads"}
    updates = {}
    for k, v in data.items():
        if k in allowed:
            if k == "enabled":
                updates[k] = bool(v)
            else:
                updates[k] = int(v)

    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields")

    await db.app_settings.update_one({"type": "adfree_reward_config"}, {"$set": updates}, upsert=True)
    config = await db.app_settings.find_one({"type": "adfree_reward_config"}, {"_id": 0})
    return {k: v for k, v in config.items() if k != "type"}


# ==========================================
# SMART APP UPDATE SYSTEM
# ==========================================

DEFAULT_APP_UPDATE_CONFIG = {
    "type": "app_update_config",
    "latest_version_code": 57,
    "latest_version_name": "3.2.6",
    "update_title": "New HeartLink Update Available",
    "update_message": "Update now for a smoother and better HeartLink experience.",
    "update_enabled": True,
    "force_update": False,
    "play_store_url": "https://play.google.com/store/apps/details?id=com.heartlink.app",
    "min_dismiss_hours": 24,
}


@api_router.get("/app-update/check")
async def check_app_update(version_code: int = 0, version_name: str = ""):
    """Check if an app update is available. Called on app startup/resume."""
    config = await db.app_settings.find_one({"type": "app_update_config"}, {"_id": 0})
    if not config:
        config = {**DEFAULT_APP_UPDATE_CONFIG}

    if not config.get("update_enabled", True):
        return {"update_available": False}

    latest_code = config.get("latest_version_code", 0)
    has_update = version_code > 0 and latest_code > version_code

    if not has_update:
        return {"update_available": False}

    return {
        "update_available": True,
        "latest_version_code": latest_code,
        "latest_version_name": config.get("latest_version_name", ""),
        "title": config.get("update_title", DEFAULT_APP_UPDATE_CONFIG["update_title"]),
        "message": config.get("update_message", DEFAULT_APP_UPDATE_CONFIG["update_message"]),
        "force_update": config.get("force_update", False),
        "play_store_url": config.get("play_store_url", DEFAULT_APP_UPDATE_CONFIG["play_store_url"]),
        "min_dismiss_hours": config.get("min_dismiss_hours", 24),
    }


@api_router.get("/admin/app-update")
async def get_app_update_config():
    """Admin: Get current app update configuration."""
    config = await db.app_settings.find_one({"type": "app_update_config"}, {"_id": 0})
    if not config:
        config = {**DEFAULT_APP_UPDATE_CONFIG}
        await db.app_settings.insert_one({**config})

    # Analytics
    analytics = await db.app_settings.find_one({"type": "app_update_analytics"}, {"_id": 0})

    # Notification history
    notif_hist = await db.app_settings.find_one({"type": "update_notifications"}, {"_id": 0})

    return {
        "config": {k: v for k, v in config.items() if k != "type"},
        "analytics": {k: v for k, v in (analytics or {}).items() if k not in ("type", "_id")},
        "notification_history": (notif_hist or {}).get("history", [])[-5:],
        "total_notifications_sent": (notif_hist or {}).get("total_sent", 0),
    }


@api_router.put("/admin/app-update")
async def update_app_update_config(request: Request):
    """Admin: Update app update configuration. Auto-sends push if version changed."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    allowed_keys = {
        "latest_version_code", "latest_version_name",
        "update_title", "update_message",
        "update_enabled", "force_update",
        "play_store_url", "min_dismiss_hours"
    }
    updates = {}
    for k, v in data.items():
        if k in allowed_keys:
            if k in ("latest_version_code", "min_dismiss_hours"):
                updates[k] = int(v)
            elif k in ("update_enabled", "force_update"):
                updates[k] = bool(v)
            else:
                updates[k] = str(v)

    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields provided")

    # Check if version changed (for auto-notification)
    old_config = await db.app_settings.find_one({"type": "app_update_config"}, {"_id": 0})
    old_version_code = (old_config or {}).get("latest_version_code", 0)
    new_version_code = updates.get("latest_version_code", old_version_code)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.app_settings.update_one(
        {"type": "app_update_config"},
        {"$set": updates},
        upsert=True
    )

    config = await db.app_settings.find_one({"type": "app_update_config"}, {"_id": 0})
    result_data = {k: v for k, v in config.items() if k != "type"}

    # AUTO-SEND push if version code increased and auto_notify is requested
    auto_sent = False
    if new_version_code > old_version_code and data.get("auto_notify", True):
        title = config.get("update_title", DEFAULT_APP_UPDATE_CONFIG["update_title"])
        message = config.get("update_message", DEFAULT_APP_UPDATE_CONFIG["update_message"])
        play_url = config.get("play_store_url", DEFAULT_APP_UPDATE_CONFIG["play_store_url"])

        try:
            push_result = await fcm_service.send_to_all(
                db, title, message,
                data={"type": "app_update", "url": play_url, "click_action": "OPEN_PLAY_STORE"}
            )
            await db.app_settings.update_one(
                {"type": "update_notifications"},
                {"$push": {"history": {
                    "title": title, "message": message,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "result": str(push_result), "source": "auto_version_change",
                    "version_change": f"{old_version_code} → {new_version_code}"
                }}, "$inc": {"total_sent": 1}},
                upsert=True
            )
            auto_sent = True
            result_data["notification_sent"] = True
            result_data["notification_result"] = push_result
        except Exception as e:
            result_data["notification_error"] = str(e)

    result_data["auto_notification_sent"] = auto_sent
    return result_data


@api_router.post("/admin/app-update/send-notification")
async def send_app_update_notification(request: Request):
    """Admin: Send FCM push notification for app update to eligible users."""
    try:
        data = await request.json()
    except Exception:
        data = {}

    # Get current config
    config = await db.app_settings.find_one({"type": "app_update_config"}, {"_id": 0})
    if not config:
        config = {**DEFAULT_APP_UPDATE_CONFIG}

    title = data.get("title", config.get("update_title", DEFAULT_APP_UPDATE_CONFIG["update_title"]))
    message = data.get("message", config.get("update_message", DEFAULT_APP_UPDATE_CONFIG["update_message"]))
    play_url = config.get("play_store_url", DEFAULT_APP_UPDATE_CONFIG["play_store_url"])

    # Dedupe guard: check last notification time
    notif_hist = await db.app_settings.find_one({"type": "update_notifications"}, {"_id": 0})
    if notif_hist and notif_hist.get("history"):
        last = notif_hist["history"][-1]
        last_time = last.get("sent_at", "")
        if last_time:
            try:
                elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(last_time.replace("Z", "+00:00"))).total_seconds()
                if elapsed < 300:  # 5 min cooldown
                    raise HTTPException(status_code=429, detail="Notification sent recently. Wait 5 minutes.")
            except (ValueError, TypeError):
                pass

    # Send to all users with FCM tokens
    result = await fcm_service.send_to_all(
        db,
        title,
        message,
        data={"type": "app_update", "url": play_url, "click_action": "OPEN_PLAY_STORE"}
    )

    # Log
    await db.app_settings.update_one(
        {"type": "update_notifications"},
        {"$push": {"history": {
            "title": title,
            "message": message,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "result": str(result),
            "source": "admin_manual"
        }}, "$inc": {"total_sent": 1}},
        upsert=True
    )

    return {"status": "sent", "result": result}


@api_router.post("/app-update/analytics")
async def track_update_analytics(request: Request):
    """Track update prompt events: shown, clicked, dismissed."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = data.get("event")  # update_prompt_shown | update_prompt_clicked | update_prompt_dismissed
    if event not in ("update_prompt_shown", "update_prompt_clicked", "update_prompt_dismissed"):
        raise HTTPException(status_code=400, detail="Invalid event type")

    await db.app_settings.update_one(
        {"type": "app_update_analytics"},
        {"$inc": {event: 1}},
        upsert=True
    )
    return {"status": "ok"}



# ==========================================
# PLAY WITH MATCH — Moved to routes/games.py
# PROFILE BOOST — Moved to routes/boost.py
# WELCOME MESSAGE SYSTEM — Moved to routes/welcome.py
# ==========================================

# ==================== ANALYTICS & INSTALL TRACKING ====================


# ==================== ANALYTICS & INSTALL TRACKING ====================

@api_router.post("/analytics/track-install")
async def track_install(request: Request):
    """Track a first-open / install event. Idempotent per installation_id."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    installation_id = data.get("installation_id")
    if not installation_id:
        raise HTTPException(status_code=400, detail="installation_id required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Atomic upsert: avoids TOCTOU race on concurrent first-open calls
    result = await db.installs.update_one(
        {"installation_id": installation_id},
        {
            "$setOnInsert": {
                "installation_id": installation_id,
                "first_open_at": now,
                "platform": data.get("platform", "unknown"),
                "app_version": data.get("app_version", "unknown"),
                "signup_status": "not_registered",
                "user_id": None,
                "acquisition_source": data.get("acquisition_source", "direct"),
                "utm_source": data.get("utm_source"),
                "utm_medium": data.get("utm_medium"),
                "utm_campaign": data.get("utm_campaign"),
                "signup_at": None,
                "first_login_at": None,
                "events": [{"type": "first_open", "timestamp": now}]
            },
            "$set": {"last_active_at": now}
        },
        upsert=True
    )
    
    if result.upserted_id:
        return {"status": "tracked", "installation_id": installation_id}
    return {"status": "already_tracked", "installation_id": installation_id}


@api_router.post("/analytics/track-event")
async def track_event(request: Request):
    """Track a funnel event for an installation."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    installation_id = data.get("installation_id")
    event_type = data.get("event_type")
    if not installation_id or not event_type:
        raise HTTPException(status_code=400, detail="installation_id and event_type required")
    
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "$push": {"events": {"type": event_type, "timestamp": now}},
        "$set": {"last_active_at": now}
    }
    
    # Special handling for signup and login events
    if event_type == "signup_completed":
        update["$set"]["signup_status"] = "registered"
        update["$set"]["signup_at"] = now
        if data.get("user_id"):
            update["$set"]["user_id"] = data["user_id"]
    elif event_type == "first_login":
        update["$set"]["first_login_at"] = now
    
    result = await db.installs.update_one(
        {"installation_id": installation_id},
        update,
        upsert=True
    )
    return {"status": "ok", "matched": result.matched_count}


@api_router.get("/admin/growth-stats")
async def get_growth_stats(response: Response, period: str = "today"):
    """Get growth & acquisition stats for admin dashboard."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    
    try:
        now = datetime.now(timezone.utc)
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = now + ist_offset
        today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_utc = (today_start_ist - ist_offset).isoformat()
        
        yesterday_start_ist = today_start_ist - timedelta(days=1)
        yesterday_start_utc = (yesterday_start_ist - ist_offset).isoformat()
        yesterday_end_utc = today_start_utc
        
        week_ago_utc = (now - timedelta(days=7)).isoformat()
        month_ago_utc = (now - timedelta(days=30)).isoformat()
        
        # Determine date filter
        if period == "yesterday":
            date_gte = yesterday_start_utc
            date_lt = yesterday_end_utc
        elif period == "week":
            date_gte = week_ago_utc
            date_lt = None
        elif period == "month":
            date_gte = month_ago_utc
            date_lt = None
        else:  # today
            date_gte = today_start_utc
            date_lt = None
        
        date_q = {"$gte": date_gte}
        if date_lt:
            date_q["$lt"] = date_lt
        
        # ===== INSTALL METRICS =====
        total_installs = await db.installs.count_documents({})
        installs_today = await db.installs.count_documents({"first_open_at": {"$gte": today_start_utc}})
        installs_week = await db.installs.count_documents({"first_open_at": {"$gte": week_ago_utc}})
        installs_month = await db.installs.count_documents({"first_open_at": {"$gte": month_ago_utc}})
        installs_period = await db.installs.count_documents({"first_open_at": date_q})
        
        # ===== SIGNUP METRICS (from users collection — source of truth) =====
        signups_today = await db.users.count_documents({"created_at": {"$gte": today_start_utc}, "is_ai_profile": {"$ne": True}})
        signups_week = await db.users.count_documents({"created_at": {"$gte": week_ago_utc}, "is_ai_profile": {"$ne": True}})
        signups_month = await db.users.count_documents({"created_at": {"$gte": month_ago_utc}, "is_ai_profile": {"$ne": True}})
        signups_period = await db.users.count_documents({"created_at": date_q, "is_ai_profile": {"$ne": True}})
        
        # Not registered installs
        not_registered = await db.installs.count_documents({"signup_status": "not_registered"})
        
        # Conversion rate
        conversion_rate = round((signups_period / installs_period * 100), 1) if installs_period > 0 else 0
        
        # ===== ACQUISITION SOURCE BREAKDOWN =====
        sources = ["meta_ads", "google_ads", "organic", "referral", "direct"]
        source_stats = {}
        for src in sources:
            src_installs = await db.installs.count_documents({"acquisition_source": src, "first_open_at": date_q})
            src_signups = await db.installs.count_documents({"acquisition_source": src, "signup_status": "registered", "signup_at": date_q})
            src_conv = round((src_signups / src_installs * 100), 1) if src_installs > 0 else 0
            source_stats[src] = {"installs": src_installs, "signups": src_signups, "conversion_rate": src_conv}
        
        # ===== GENDER BREAKDOWN (registered users only) =====
        male_signups = await db.users.count_documents({"created_at": date_q, "gender": {"$regex": "^male$", "$options": "i"}, "is_ai_profile": {"$ne": True}})
        female_signups = await db.users.count_documents({"created_at": date_q, "gender": {"$regex": "^female$", "$options": "i"}, "is_ai_profile": {"$ne": True}})
        other_signups = signups_period - male_signups - female_signups
        
        # ===== FUNNEL =====
        funnel_installs = installs_period
        funnel_app_opened = await db.installs.count_documents({"first_open_at": date_q})
        funnel_signup_started = await db.installs.count_documents({
            "first_open_at": date_q,
            "events.type": "signup_started"
        })
        funnel_signup_completed = signups_period
        funnel_first_login = await db.users.count_documents({
            "last_login": {"$gte": date_gte if isinstance(date_gte, str) else date_gte},
            "created_at": date_q,
            "is_ai_profile": {"$ne": True}
        })
        funnel_active = await db.users.count_documents({
            "last_active": {"$gte": today_start_utc},
            "is_ai_profile": {"$ne": True}
        })
        
        # ===== ACTIVE USER METRICS =====
        active_today = await db.users.count_documents({"last_active": {"$gte": today_start_utc}, "is_ai_profile": {"$ne": True}})
        active_week = await db.users.count_documents({"last_active": {"$gte": week_ago_utc}, "is_ai_profile": {"$ne": True}})
        
        return {
            "period": period,
            "installs": {
                "total": total_installs,
                "today": installs_today,
                "this_week": installs_week,
                "this_month": installs_month,
                "period": installs_period
            },
            "signups": {
                "today": signups_today,
                "this_week": signups_week,
                "this_month": signups_month,
                "period": signups_period
            },
            "not_registered": not_registered,
            "conversion_rate": conversion_rate,
            "source_breakdown": source_stats,
            "gender_breakdown": {
                "male": male_signups,
                "female": female_signups,
                "other": max(0, other_signups)
            },
            "funnel": {
                "app_install": funnel_installs,
                "app_opened": funnel_app_opened,
                "signup_started": funnel_signup_started,
                "signup_completed": funnel_signup_completed,
                "first_login": funnel_first_login,
                "active_user": funnel_active
            },
            "active_users": {
                "today": active_today,
                "this_week": active_week
            },
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Growth stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch growth stats: {str(e)}")


@api_router.get("/admin/acquisition-table")
async def get_acquisition_table(response: Response, page: int = 1, limit: int = 20):
    """Get recent acquisition records for admin table."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    
    try:
        skip = (page - 1) * limit
        cursor = db.installs.find({}).sort("first_open_at", -1).skip(skip).limit(limit)
        records = await cursor.to_list(None)
        total = await db.installs.count_documents({})
        
        result = []
        for r in records:
            # If user_id exists, fetch user info
            user_info = None
            if r.get("user_id"):
                u = await db.users.find_one({"id": r["user_id"]}, {"_id": 0, "name": 1, "email": 1, "gender": 1, "profile_picture": 1})
                if u:
                    user_info = u
            
            result.append({
                "installation_id": r.get("installation_id", "")[:12] + "...",
                "first_open": r.get("first_open_at"),
                "source": r.get("acquisition_source", "direct"),
                "signup_status": r.get("signup_status", "not_registered"),
                "signup_date": r.get("signup_at"),
                "first_login": r.get("first_login_at"),
                "last_active": r.get("last_active_at"),
                "app_version": r.get("app_version", "unknown"),
                "platform": r.get("platform", "unknown"),
                "user": user_info
            })
        
        return {"records": result, "total": total, "page": page, "pages": max(1, -(-total // limit))}
    except Exception as e:
        logger.error(f"Acquisition table error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch acquisition data: {str(e)}")


@api_router.get("/admin/retention-chart")
async def get_retention_chart(response: Response, days: int = 7):
    """Get N-day retention data: for each cohort day, how many users came back on subsequent days."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    
    try:
        now = datetime.now(timezone.utc)
        ist_offset = timedelta(hours=5, minutes=30)
        
        retention_data = []
        
        for day_offset in range(days, 0, -1):
            # Cohort: users who signed up on this day
            day_start_ist = (now + ist_offset - timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end_ist = day_start_ist + timedelta(days=1)
            day_start_utc = (day_start_ist - ist_offset).isoformat()
            day_end_utc = (day_end_ist - ist_offset).isoformat()
            
            # Users who signed up on this day
            cohort_count = await db.users.count_documents({
                "created_at": {"$gte": day_start_utc, "$lt": day_end_utc},
                "is_ai_profile": {"$ne": True}
            })
            
            # Users from this cohort who were active today
            today_start_ist = (now + ist_offset).replace(hour=0, minute=0, second=0, microsecond=0)
            today_start_utc = (today_start_ist - ist_offset).isoformat()
            
            returned_today = 0
            if cohort_count > 0:
                # Find users who signed up on cohort day AND were active today
                returned_today = await db.users.count_documents({
                    "created_at": {"$gte": day_start_utc, "$lt": day_end_utc},
                    "last_active": {"$gte": today_start_utc},
                    "is_ai_profile": {"$ne": True}
                })
            
            retention_pct = round((returned_today / cohort_count * 100), 1) if cohort_count > 0 else 0
            day_label = (now - timedelta(days=day_offset)).strftime("%d %b")
            
            retention_data.append({
                "day": day_label,
                "days_ago": day_offset,
                "cohort_size": cohort_count,
                "returned_today": returned_today,
                "retention_pct": retention_pct
            })
        
        return {"retention": retention_data, "fetched_at": now.isoformat()}
    except Exception as e:
        logger.error(f"Retention chart error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch retention data: {str(e)}")


@api_router.post("/admin/send-weekly-digest-now")
async def send_weekly_digest_now():
    """Manually trigger the weekly growth digest email (for testing)."""
    try:
        await _send_weekly_growth_digest()
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/push-update-notification")
async def push_update_notification(request: Request):
    """Send app update push notification to ALL users."""
    try:
        data = await request.json()
    except Exception:
        data = {}
    
    title = data.get("title", "HeartLink Update Available! \u2728")
    message = data.get("message", "Please update the app for a smooth and bugless experience! Naye features aur improvements aapka wait kar rahe hain.")
    play_store_url = data.get("play_store_url", "https://play.google.com/store/apps/details?id=com.heartlink.app")
    
    try:
        result = await fcm_service.send_to_all(
            db, title, message,
            data={"type": "app_update", "url": play_store_url, "click_action": "OPEN_PLAY_STORE"}
        )
        
        # Log the broadcast
        await db.app_settings.update_one(
            {"type": "update_notifications"},
            {"$push": {"history": {
                "title": title,
                "message": message,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "result": str(result)
            }}, "$inc": {"total_sent": 1}},
            upsert=True
        )
        
        return {"status": "sent", "result": result}
    except Exception as e:
        logger.error(f"Update push notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
