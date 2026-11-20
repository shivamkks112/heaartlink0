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
import secrets
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
    clean_user_data, serialize_user_for_response, is_user_premium,
    sanitize_mongo_input,
    mask_phone_email, check_money_scam,
    create_in_app_notification,
)

# Load environment variables FIRST before importing firebase_config
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)  # Don't override K8s environment variables

# Now import firebase_config after env vars are loaded
from firebase_config import (
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
    auto_match_stealth_users,
    handle_ai_message,
    get_ai_profiles,
    delete_ai_profile,
    toggle_ai_profile,
    handle_stealth_auto_reply,
    create_daily_ai_profiles,
    auto_match_new_ai_with_users,
    batch_generate_ai_photos,
    ai_online_now,
    resume_pending_ai_replies,
)

# Import Safety Module
from safety_module import (
    handle_creepy_detection,
    check_night_mode_block,
    check_safe_word,
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


# ═══════════════════════════════════════════════════════════════
# ADMIN AUTH DEPENDENCY — reusable guard for admin-only endpoints
# ═══════════════════════════════════════════════════════════════
def _otp_new() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _otp_hash(key: str, code: str) -> str:
    """HMAC so a DB leak doesn't reveal codes; key binds the code to one email/account."""
    import hmac as _hmac
    return _hmac.new((os.environ.get("JWT_SECRET_KEY") or "").encode(), f"{key}:{code}".encode(), hashlib.sha256).hexdigest()


def _otp_matches(key: str, code: str, stored_hash, stored_plain=None) -> bool:
    import hmac as _hmac
    if stored_hash:
        return _hmac.compare_digest(stored_hash, _otp_hash(key, (code or "").strip()))
    return bool(stored_plain) and _hmac.compare_digest(str(stored_plain), (code or "").strip())


PRIVATE_USER_FIELDS = ("email", "phone", "fcm_token", "firebase_uid", "device_ids", "blocked_device_ids", "password_hash")


def _viewer_id(request: Request):
    """User id from a valid Bearer token, else None."""
    auth = request.headers.get("authorization", "")
    payload = verify_access_token(auth[7:]) if auth.startswith("Bearer ") else None
    return payload.get("user_id") if payload else None


def _hide_private(user: dict, owner_id: str, request: Request) -> dict:
    """Private contact/device fields only for the verified owner."""
    if _viewer_id(request) == owner_id:
        return user
    return {k: v for k, v in user.items() if k not in PRIVATE_USER_FIELDS}


async def require_admin(request: Request) -> dict:
    """Extract token, verify JWT, check is_admin. Returns admin user dict."""
    token = None
    # ONLY accept Authorization: Bearer header — no header/query param shortcuts
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "is_admin": 1, "name": 1})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user

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


from pymongo.errors import PyMongoError as _PyMongoError


@app.exception_handler(_PyMongoError)
async def _mongo_error_handler(request: Request, exc: _PyMongoError):
    logger.error(f"DB error on {request.url.path}: {type(exc).__name__}")
    return JSONResponse(status_code=503, content={"detail": "Server busy, please retry"})

api_router = APIRouter(prefix="/api")


def _public_base(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    proto = request.headers.get("x-forwarded-proto", "https").split(",")[0]
    return f"{proto}://{host}"


def _photo_url(base: str, uid: str, slot, value: str, w: int = 0) -> str:
    sig = value[4:] if value.startswith("B64:") else f"{len(value)}{value[-16:]}"
    v = hashlib.md5(sig.encode()).hexdigest()[:10]
    return f"{base}/api/photo/{uid}/{slot}?v={v}" + (f"&w={w}" if w else "")


_IMG_HOSTS = ("https://static.prod-images.emergentagent.com/", "https://firebasestorage.googleapis.com/")


def _proxy_url(base: str, value, w: int):
    """Route big external images through our resize proxy so phones download ~50KB instead of ~800KB."""
    if isinstance(value, str) and value.startswith(_IMG_HOSTS):
        from urllib.parse import quote
        return f"{base}/api/img?w={w}&u={quote(value, safe='')}"
    return value


def _B64_MARK(field):
    """Mongo expr: replace base64 value with short marker 'B64:<len><tail>' (avoids transferring MBs)."""
    return {"$cond": [
        {"$and": [{"$eq": [{"$type": field}, "string"]}, {"$eq": [{"$substrCP": [field, 0, 5]}, "data:"]}]},
        {"$concat": ["B64:", {"$toString": {"$strLenCP": field}},
                     {"$substrCP": [field, {"$subtract": [{"$strLenCP": field}, 16]}, 16]}]},
        field,
    ]}


async def find_users_light(query: dict, fields: list, sort: dict = None, limit: int = 0) -> list:
    """Fetch users with photo fields reduced to short markers (no MB-sized base64 transfer)."""
    proj = {"_id": 0, **{f: 1 for f in fields if f not in ("photos", "profile_picture")}}
    if "profile_picture" in fields:
        proj["profile_picture"] = _B64_MARK("$profile_picture")
    if "photos" in fields:
        proj["photos"] = {"$map": {"input": {"$ifNull": ["$photos", []]}, "as": "p", "in": _B64_MARK("$$p")}}
    pipeline = [{"$match": query}] + ([{"$sort": sort}] if sort else []) + ([{"$limit": limit}] if limit else []) + [{"$project": proj}]
    return await db.users.aggregate(pipeline).to_list(None)


def slim_photos(obj, request: Request):
    """Replace inline base64 photos with cacheable URLs (keeps list responses tiny)."""
    base = _public_base(request)

    def walk(o):
        if isinstance(o, list):
            return [walk(x) for x in o]
        if not isinstance(o, dict):
            return o
        uid = o.get("id") or o.get("user_id")
        out = {k: walk(v) for k, v in o.items()}
        if uid:
            pp = out.get("profile_picture")
            if isinstance(pp, str) and (pp.startswith("data:") or pp.startswith("B64:")):
                out["profile_picture"] = _photo_url(base, uid, "p", pp, 400)
            photos = out.get("photos")
            if isinstance(photos, list):
                out["photos"] = [
                    _photo_url(base, uid, i, p, 720) if isinstance(p, str) and (p.startswith("data:") or p.startswith("B64:")) else p
                    for i, p in enumerate(photos) if p
                ]
                if "profile_picture" in out and not out["profile_picture"] and out["photos"]:
                    out["profile_picture"] = out["photos"][0]
                out["photos"] = [_proxy_url(base, p, 720) for p in out["photos"]]
            if "profile_picture" in out:
                out["profile_picture"] = _proxy_url(base, out["profile_picture"], 400)
        return out

    return walk(obj)


_thumb_cache: Dict[str, tuple] = {}


def _make_thumb(data: bytes, w: int) -> bytes:
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(data))
    img = img.convert("RGB")
    img.thumbnail((w, w * 2))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=78, optimize=True)
    return out.getvalue()


@api_router.get("/img")
async def get_resized_image(u: str, w: int = 720):
    if not u.startswith(_IMG_HOSTS):
        raise HTTPException(status_code=400, detail="Host not allowed")
    w = max(64, min(w, 1080))
    ck = f"ext:{u}:{w}"
    data = _thumb_cache.get(ck)
    if data is None:
        import httpx
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(u)
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail="Not found")
        try:
            data = await asyncio.to_thread(_make_thumb, r.content, w)
        except Exception:
            data = r.content
        if len(_thumb_cache) > 2000:
            _thumb_cache.clear()
        _thumb_cache[ck] = data
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=31536000, immutable"})


@api_router.get("/photo/{user_id}/{slot}")
async def get_user_photo(user_id: str, slot: str, w: int = 0, v: str = ""):
    idx = 0 if slot == "p" else (int(slot) if slot.isdigit() else -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="Not found")
    proj = {"_id": 0, "photos": {"$slice": [idx, 1]}}
    if slot == "p":
        proj["profile_picture"] = 1
    u = await db.users.find_one({"id": user_id}, proj)
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    first = (u.get("photos") or [None])[0]
    value = (u.get("profile_picture") or first) if slot == "p" else first
    if not value:
        raise HTTPException(status_code=404, detail="Not found")
    if not value.startswith("data:"):
        return Response(status_code=302, headers={"Location": value})
    header, _, b64 = value.partition(",")
    media = header[5:].split(";")[0] or "image/jpeg"
    try:
        data = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=404, detail="Bad image")
    if w:
        w = max(64, min(w, 1080))
        ck = f"{user_id}:{slot}:{w}:{v}"
        if ck in _thumb_cache:
            data = _thumb_cache[ck]
        else:
            try:
                data = await asyncio.to_thread(_make_thumb, data, w)
            except Exception:
                pass
            if len(_thumb_cache) > 2000:
                _thumb_cache.clear()
            _thumb_cache[ck] = data
        media = "image/jpeg"
    return Response(content=data, media_type=media, headers={"Cache-Control": "public, max-age=31536000, immutable"})


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
async def get_init_data(user_id: str, request: Request):
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
            "user": _hide_private(user, user_id, request),
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
    asyncio.create_task(_ws_relay_loop())
    """Run on app startup"""
    await create_indexes()
    logging.info("🚀 HeartLink server started with optimized indexes")
    
    # Seed AI girl profiles
    await seed_ai_profiles(db)
    logging.info("🤖 AI girl profiles seeded")
    
    # Keep AI profiles looking "online"
    asyncio.create_task(keep_ai_profiles_online(db))
    asyncio.create_task(ai_profile_activity_loop())
    asyncio.create_task(ai_story_photo_loop())
    
    # Start background notification scheduler
    asyncio.create_task(notification_scheduler())
    logging.info("📬 Notification scheduler started")
    
    # Start weekly growth email scheduler
    asyncio.create_task(weekly_growth_email_scheduler())
    logging.info("📧 Weekly growth email scheduler started")
    
    # Start weekly highlights notification scheduler
    asyncio.create_task(weekly_highlights_scheduler())
    logging.info("📊 Weekly highlights notification scheduler started")
    
    # Start payment reminder scheduler
    asyncio.create_task(payment_reminder_scheduler())
    logging.info("💳 Payment reminder scheduler started")
    
    # Auto-send update notification if app version changed
    asyncio.create_task(auto_update_notification())
    
    # Catch existing users who never got AI matches
    asyncio.create_task(_backfill_ai_matches())
    
    # Auto-unban checker — runs every 30 min to unban expired temp bans
    asyncio.create_task(auto_unban_checker())
    logging.info("🔓 Auto-unban checker started")
    
    # Subscription expiry checker — runs every hour
    asyncio.create_task(subscription_expiry_checker())
    logging.info("💳 Subscription expiry checker started")
    
    # AI girl join notification — every 30 min
    asyncio.create_task(ai_girl_join_notification_scheduler())
    logging.info("🤖 AI girl notification scheduler started")
    
    # Smart nudge — "X people liked you!" every 2 hours
    asyncio.create_task(smart_nudge_scheduler())
    logging.info("💡 Smart nudge scheduler started")
    
    # Daily AI profile creator — creates 3 new profiles at random times each day
    asyncio.create_task(daily_ai_profile_creator())
    logging.info("🤖 Daily AI profile creator started")
    
    # Initialize Object Storage
    try:
        _init_object_storage()
        logging.info("📦 Object Storage initialized")
    except Exception as e:
        logging.error(f"Object Storage init failed: {e}")


# ═══ Object Storage Setup ═══
import requests as http_requests

_STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
_STORAGE_URL = _STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
_storage_key = None

def _init_object_storage(force=False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = http_requests.post(f"{_STORAGE_URL}/init", json={"emergent_key": _EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def _put_object(path, data, content_type):
    key = _init_object_storage()
    resp = http_requests.put(
        f"{_STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    if resp.status_code == 404:
        key = _init_object_storage(force=True)
        resp = http_requests.put(
            f"{_STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120
        )
    resp.raise_for_status()
    return resp.json()

def _get_object(path):
    key = _init_object_storage()
    resp = http_requests.get(
        f"{_STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    if resp.status_code == 404:
        key = _init_object_storage(force=True)
        resp = http_requests.get(
            f"{_STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


async def subscription_expiry_checker():
    """Background task: auto-expire premium when subscription period ends."""
    first_run = True
    while True:
        try:
            if not first_run:
                await asyncio.sleep(60 * 60)  # Every hour
            else:
                await asyncio.sleep(30)
                first_run = False
            
            now = datetime.now(timezone.utc).isoformat()
            
            # Find premium users whose subscription has expired
            expired = await db.users.find({
                "is_premium": True,
                "premium_end": {"$ne": None, "$lte": now},
                "subscription_status": {"$nin": ["expired"]},
            }).to_list(None)
            
            for user in expired:
                await db.users.update_one({"id": user["id"]}, {"$set": {
                    "is_premium": False,
                    "subscription_status": "expired",
                    "premium_expired_at": now,
                    "grace_notif_sent": False,
                }})
                invalidate_user_cache(user["id"])
                logging.info(f"💳 Premium expired for {user.get('name', user['id'])}")
            
            if expired:
                logging.info(f"💳 Subscription expiry check: {len(expired)} users expired")
            
            # Grace period notification — 1 day before expiry
            tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
            expiring_soon = await db.users.find({
                "is_premium": True,
                "premium_end": {"$ne": None, "$lte": tomorrow, "$gt": now},
                "grace_notif_sent": {"$ne": True},
            }, {"_id": 0, "id": 1, "name": 1, "fcm_token": 1}).to_list(None)
            
            grace_msgs = [
                ("Premium expires tomorrow!", "Renew now to keep unlimited likes, no ads & more."),
                ("Don't lose your premium perks", "Your HeartLink Premium ends tomorrow. Tap to renew."),
            ]
            for u in expiring_soon:
                if u.get("fcm_token"):
                    try:
                        title, body = random.choice(grace_msgs)
                        await fcm_service.send_push_notification(
                            u["fcm_token"], title, body,
                            data={"type": "grace_period", "route": "/premium"})
                        await db.users.update_one({"id": u["id"]}, {"$set": {"grace_notif_sent": True}})
                        logging.info(f"💳 Grace period notification sent to {u.get('name', u['id'])}")
                    except Exception:
                        pass
            
            # Win-back push — 3 days after premium expired
            three_days_ago = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
            winback_users = await db.users.find({
                "is_premium": False,
                "subscription_status": "expired",
                "premium_expired_at": {"$ne": None, "$lte": three_days_ago},
                "winback_sent": {"$ne": True},
            }, {"_id": 0, "id": 1, "name": 1, "fcm_token": 1}).to_list(50)
            
            winback_msgs = [
                ("We miss you!", "Come back to HeartLink Premium — unlimited likes & no ads await you."),
                ("Your matches miss you", "Re-subscribe to Premium and get back to unlimited swiping."),
                ("Premium perks are waiting", "Rejoin HeartLink Premium — your matches are growing!"),
            ]
            for u in winback_users:
                if u.get("fcm_token"):
                    try:
                        title, body = random.choice(winback_msgs)
                        await fcm_service.send_push_notification(
                            u["fcm_token"], title, body,
                            data={"type": "winback", "route": "/premium"})
                        await db.users.update_one({"id": u["id"]}, {"$set": {"winback_sent": True}})
                    except Exception:
                        pass
        except Exception as e:
            logging.error(f"Subscription expiry checker error: {e}")


async def auto_unban_checker():
    """Background task: auto-unban users whose temporary ban has expired."""
    # Run once immediately on startup, then every 30 min
    first_run = True
    while True:
        try:
            if not first_run:
                await asyncio.sleep(30 * 60)
            else:
                await asyncio.sleep(10)  # Short delay on first run for DB readiness
                first_run = False
            
            now = datetime.now(timezone.utc).isoformat()
            
            # Find users with expired temp bans
            expired = await db.users.find({
                "is_blocked": True,
                "is_permanently_banned": {"$ne": True},
                "ban_expires_at": {"$ne": None, "$lte": now}
            }).to_list(None)
            
            for user in expired:
                await db.users.update_one({"id": user["id"]}, {"$set": {
                    "is_blocked": False,
                    "is_shadow_banned": False,
                    "is_permanently_banned": False,
                    "block_reason": None,
                    "safety_warnings": 0,
                    "unbanned_at": now,
                    "unbanned_by": "auto_timer",
                    "ban_expires_at": None,
                    "ban_duration": None,
                }})
                logging.info(f"🔓 Auto-unbanned user {user.get('name', user['id'])} (ban expired)")
            
            if expired:
                logging.info(f"🔓 Auto-unban check: {len(expired)} users unbanned")
        except Exception as e:
            logging.error(f"Auto-unban checker error: {e}")


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
            await auto_match_stealth_users(db, user["id"], user.get("gender", "male"), user.get("looking_for", "female"))
            backfilled += 1
        
        if backfilled > 0:
            logging.info(f"Backfilled AI matches for {backfilled} existing users")
    except Exception as e:
        logging.error(f"Backfill AI matches error: {e}")


APP_VERSION = "3.3.0"  # Increment this on each release
APP_VERSION_CODE = 70   # Android versionCode — increment on each build


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


async def ai_profile_activity_loop():
    """AI personas / chatbot accounts visit active male users' profiles (1/day, anonymous) and
    occasionally send a Secret Crush (~1/week). Runs every 30 min, only 9 AM - 11 PM IST."""
    await asyncio.sleep(120)
    while True:
        try:
            await _run_ai_profile_activity()
        except Exception as e:
            logging.error(f"AI profile activity error: {e}")
        await asyncio.sleep(1800)


async def _run_ai_profile_activity():
    ist_hour = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).hour
    if not 9 <= ist_hour < 22:
        return
    today = _ist_day()
    now = datetime.now(timezone.utc)
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0}) or {}
    crush_on = flags.get("crush_feature", False)
    visitors = await db.users.find(
        {"$or": [{"is_ai_profile": True, "is_active_ai": True}, {"auto_chat_enabled": True}],
         "gender": {"$regex": "^female$", "$options": "i"}},
        {"_id": 0, "id": 1, "online_hours": 1, "is_ai_profile": 1}).to_list(None)
    visitors = [v for v in visitors if not v.get("is_ai_profile") or ai_online_now(v)]
    if not visitors:
        return
    users = await db.users.find(
        {"is_ai_profile": {"$ne": True}, "auto_chat_enabled": {"$ne": True}, "gender": {"$regex": "^male$", "$options": "i"},
         "last_active": {"$gte": (now - timedelta(days=3)).isoformat()}},
        {"_id": 0, "id": 1, "ai_visit_day": 1, "ai_visit_count": 1, "ai_visit_target": 1, "last_ai_crush_at": 1, "ai_like_day": 1}
    ).to_list(2000)
    remaining_runs = max((22 - ist_hour) * 2, 1)
    visits = crushes = 0
    for u in users:
        uid = u["id"]
        if u.get("ai_visit_day") != today:
            u.update(ai_visit_day=today, ai_visit_count=0, ai_visit_target=random.choice([1, 1, 2]))
            await db.users.update_one({"id": uid}, {"$set": {"ai_visit_day": today, "ai_visit_count": 0,
                                                             "ai_visit_target": u["ai_visit_target"]}})
        left = u["ai_visit_target"] - u.get("ai_visit_count", 0)
        if left > 0 and random.random() < min(1.0, left / remaining_runs * 1.5):
            seen = await db.profile_views.distinct("viewer_id", {
                "viewed_user_id": uid, "viewed_at": {"$gte": (now - timedelta(days=1)).isoformat()}})
            pool = [v for v in visitors if v["id"] not in seen]
            if pool:
                await _record_profile_view(uid, random.choice(pool)["id"], anonymous=True)
                await db.users.update_one({"id": uid}, {"$inc": {"ai_visit_count": 1}})
                visits += 1
        # ~1 AI like per day, at a random moment between 9am-10pm
        if u.get("ai_like_day") != today and random.random() < 1.0 / remaining_runs:
            liker_pool = [v for v in visitors if v.get("is_ai_profile")]
            if liker_pool and await _ai_send_like(uid, random.choice(liker_pool), push_now=False):
                await db.users.update_one({"id": uid}, {"$set": {"ai_like_day": today}})
        last = u.get("last_ai_crush_at")
        if crush_on and (not last or last < (now - timedelta(days=6)).isoformat()) and random.random() < 0.06:
            done = await db.crushes.distinct("crusher_id", {"crushed_id": uid})
            pool = [v for v in visitors if v["id"] not in done]
            if pool:
                await db.crushes.insert_one({"id": str(uuid.uuid4()), "crusher_id": random.choice(pool)["id"],
                                             "crushed_id": uid, "created_at": now.isoformat(), "revealed": False})
                await db.users.update_one({"id": uid}, {"$set": {"last_ai_crush_at": now.isoformat()}})
                await create_in_app_notification(
                    uid, "Secret Crush", "Kisi ne tumhe Secret Crush kiya hai",
                    "crush", {"action": "open_crushes", "route": "/likes", "anonymous": True})
                try:
                    await fcm_service.send_to_user(db, uid, "Secret Crush", "Kisi ne tumhe Secret Crush kiya hai", automated=True)
                except Exception:
                    pass
                crushes += 1
    if visits or crushes:
        logging.info(f"AI activity: {visits} profile visits, {crushes} secret crushes")


async def keep_ai_profiles_online(db_ref):
    """Background task to keep AI profiles online and clean stale online statuses."""
    while True:
        try:
            # Keep AI profiles online — respecting each persona's online hours
            ais = await db_ref.users.find(
                {"is_ai_profile": True, "is_active_ai": True}, {"_id": 0, "id": 1, "online_hours": 1}
            ).to_list(None)
            on_ids = [a["id"] for a in ais if ai_online_now(a)]
            off_ids = [a["id"] for a in ais if a["id"] not in set(on_ids)]
            if on_ids:
                await db_ref.users.update_many({"id": {"$in": on_ids}}, {"$set": {
                    "is_online": True, "last_active": datetime.now(timezone.utc).isoformat()}})
            if off_ids:
                await db_ref.users.update_many({"id": {"$in": off_ids}, "is_online": True}, {"$set": {"is_online": False}})
            await resume_pending_ai_replies(db_ref, manager)
            
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


async def ai_girl_join_notification_scheduler():
    """Send 'New girls joined HeartLink!' notification every 30 min using random AI girl profiles."""
    import random
    await asyncio.sleep(60)  # Wait 1 min after startup
    
    # Curated notification messages for variety
    NOTIF_TEMPLATES = [
        ("{name} just joined HeartLink!", "She's from {city}. Check her out!"),
        ("New girls are joining HeartLink!", "{name} from {city} is looking for a match"),
        ("{name} is now on HeartLink", "She's nearby and waiting to connect!"),
        ("Someone new just joined!", "{name}, {age}, from {city} — swipe now!"),
        ("Don't miss out!", "{name} from {city} just signed up. Say hi!"),
    ]
    
    while True:
        try:
            # Get active AI girl profiles
            ai_girls = await db.users.find(
                {"is_ai_profile": True, "is_active_ai": True, "gender": "female"},
                {"_id": 0, "name": 1, "age": 1, "location": 1}
            ).to_list(None)
            
            if ai_girls:
                girl = random.choice(ai_girls)
                name = girl.get("name", "Someone")
                city = (girl.get("location") or "your city").split(",")[0].strip()
                age = girl.get("age", 23)
                
                template = random.choice(NOTIF_TEMPLATES)
                title = template[0].format(name=name, city=city, age=age)
                body = template[1].format(name=name, city=city, age=age)
                
                # Send to all active male users with FCM tokens (not AI profiles)
                male_users = await db.users.find(
                    {
                        "is_ai_profile": {"$ne": True},
                        "gender": {"$regex": "^male$", "$options": "i"},
                        "fcm_token": {"$exists": True, "$ne": None},
                        "is_banned": {"$ne": True},
                    },
                    {"_id": 0, "fcm_token": 1, "id": 1}
                ).to_list(None)
                
                ok_ids = set(await fcm_service.allowed_auto_ids(db, [u["id"] for u in male_users]))
                tokens = [u["fcm_token"] for u in male_users if u.get("fcm_token") and u["id"] in ok_ids]
                if tokens:
                    from firebase_config import send_notification_to_multiple
                    result = send_notification_to_multiple(
                        tokens, title, body,
                        {"type": "ai_girl_joined", "action": "open_discover"}
                    )
                    logging.info(f"🤖 AI girl notification sent to {len(tokens)} users: {title}")
        except Exception as e:
            logging.error(f"AI girl notification scheduler error: {e}")
        
        await asyncio.sleep(1800)  # Every 30 minutes


async def smart_nudge_scheduler():
    """Send 'X people liked you!' push to non-premium users with pending likes — every 2 hours."""
    import random
    await asyncio.sleep(300)  # Wait 5 min after startup
    
    NUDGE_MESSAGES = [
        ("{count} log tumhe pasand karte hain!", "Premium le aur dekho kaun hai!"),
        ("Koi tumhe like kar raha hai!", "{count} likes pending — unlock karo!"),
        ("{count} people liked your profile!", "Don't miss your matches — go Premium"),
        ("Tumhari profile popular hai!", "{count} likes aa chuke hain. Dekho kaun hai?"),
        ("Miss mat karo!", "{count} log tumse milna chahte hain. Premium se dekho!"),
    ]
    
    while True:
        try:
            from firebase_config import send_notification
            
            # Find non-premium male users with pending likes
            non_premium_users = await db.users.find(
                {
                    "is_ai_profile": {"$ne": True},
                    "gender": {"$regex": "^male$", "$options": "i"},
                    "is_premium": {"$ne": True},
                    "fcm_token": {"$exists": True, "$ne": None},
                    "is_banned": {"$ne": True},
                },
                {"_id": 0, "id": 1, "fcm_token": 1, "name": 1}
            ).to_list(None)
            
            sent = 0
            for u in non_premium_users:
                # Count their pending likes
                like_count = await db.likes.count_documents({
                    "liked_user_id": u["id"],
                    "action": "like",
                    "is_matched": False
                })
                
                if like_count > 0 and u.get("fcm_token") and await fcm_service.allowed_auto_ids(db, [u["id"]]):
                    template = random.choice(NUDGE_MESSAGES)
                    title = template[0].format(count=like_count)
                    body = template[1].format(count=like_count)
                    
                    send_notification(
                        u["fcm_token"], title, body,
                        {"type": "smart_nudge", "action": "open_likes", "route": "/likes"}
                    )
                    sent += 1
            
            if sent > 0:
                logging.info(f"💡 Smart nudge sent to {sent} non-premium users")
        except Exception as e:
            logging.error(f"Smart nudge scheduler error: {e}")
        
        await asyncio.sleep(7200)  # Every 2 hours


async def daily_ai_profile_creator():
    """Create 3 new AI profiles daily at staggered times (morning, afternoon, evening IST)."""
    import random as _rand
    await asyncio.sleep(120)  # Wait 2 min after startup
    
    while True:
        try:
            ist_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
            today_key = ist_now.strftime("%Y-%m-%d")
            
            # Check if already created today
            created_today = await db.users.count_documents({
                "is_ai_profile": True,
                "created_at": {"$regex": f"^{today_key}"}
            })
            
            # Only create if less than 3 created today AND it's between 9am-9pm IST
            if created_today < 3 and 9 <= ist_now.hour <= 21:
                remaining = 3 - created_today
                new_profiles = await create_daily_ai_profiles(db, count=min(remaining, 1))  # Create 1 at a time
                
                # Send notification for new profile
                if new_profiles:
                    from firebase_config import send_notification_to_multiple
                    name = new_profiles[0]
                    
                    male_users = await db.users.find(
                        {
                            "is_ai_profile": {"$ne": True},
                            "gender": {"$regex": "^male$", "$options": "i"},
                            "fcm_token": {"$exists": True, "$ne": None},
                            "is_banned": {"$ne": True},
                        },
                        {"_id": 0, "fcm_token": 1, "id": 1}
                    ).to_list(None)
                    
                    ok_ids = set(await fcm_service.allowed_auto_ids(db, [u["id"] for u in male_users]))
                    tokens = [u["fcm_token"] for u in male_users if u.get("fcm_token") and u["id"] in ok_ids]
                    if tokens:
                        send_notification_to_multiple(
                            tokens,
                            f"{name} just joined HeartLink!",
                            "New girl nearby. Check her out!",
                            {"type": "new_ai_profile", "action": "open_discover"}
                        )
                        logging.info(f"🤖 New AI profile {name} created + notification sent")
        except Exception as e:
            logging.error(f"Daily AI profile creator error: {e}")
        
        # Sleep 3-5 hours between creations (staggered throughout the day)
        await asyncio.sleep(_rand.randint(10800, 18000))




# === SOCIAL MEDIA / EXTERNAL LINK BLOCKING ===
SOCIAL_BLOCK_DAYS = 30  # Days after match before users can share social handles

_SOCIAL_MEDIA_PATTERNS = [
    # Platform names
    r'\btelegram\b', r'\btele\s*gram\b', r'\bt\.me\b', r'\bt\.me/\S+',
    r'\bwhatsapp\b', r'\bwhats\s*app\b', r'\bwa\.me\b', r'\bwa\.me/\S+',
    r'\binstagram\b', r'\binsta\b', r'\big\b(?:\s*[:@]\s*\w+)',
    r'\bsnapchat\b', r'\bsnap\s*chat\b', r'\bsnap\b(?:\s*[:@]\s*\w+)',
    r'\bfacebook\b', r'\bfb\b(?:\s*[:@./]\s*\S+)', r'\bmessenger\b',
    r'\btwitter\b', r'\bx\.com\b',
    r'\bdiscord\b', r'\bdiscord\.gg\b',
    r'\bsignal\b(?:\s+app)',
    r'\bskype\b',
    r'\btinder\b', r'\bbumble\b', r'\bhinge\b',
    # URL patterns
    r'https?://\S+',
    r'www\.\S+',
    # @ handles
    r'@[A-Za-z0-9_.]{3,}',
    # Phone numbers (Indian 10-digit)
    r'\b[6-9]\d{9}\b',
    r'\b\+91\s*\d{10}\b',
    r'\b\d{5}\s*\d{5}\b',
    # Email
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    # Hinglish variations
    r'\binsta\s*id\b', r'\binsta\s*pe\b', r'\btg\s*pe\b', r'\btg\s*id\b',
    r'\bsnap\s*id\b', r'\bwp\s*number\b', r'\bwp\s*no\b',
    r'\bwhatsapp\s*number\b', r'\bwhatsapp\s*no\b',
    r'\btelegram\s*id\b', r'\btelegram\s*pe\b',
    r'\bnumber\s*de\b', r'\bphone\s*number\b', r'\bcall\s*me\b', r'\bcall\s*kro\b',
    r'\bnumber\s*do\b', r'\bnumber\s*bhej\b', r'\bno\.\s*de\b',
]

import re as _re
_SOCIAL_COMPILED = [_re.compile(p, _re.IGNORECASE) for p in _SOCIAL_MEDIA_PATTERNS]

def _contains_social_media(text: str) -> bool:
    """Check if text contains any social media handle, link, or platform name."""
    for pattern in _SOCIAL_COMPILED:
        if pattern.search(text):
            return True
    return False

async def _check_social_block(match_id: str, content: str) -> tuple:
    """Returns (blocked: bool, reason: str). Blocks social media sharing if match < 15 days."""
    if not _contains_social_media(content):
        return False, ""
    
    match_doc = await db.matches.find_one({"id": match_id}, {"_id": 0, "created_at": 1})
    if not match_doc or not match_doc.get("created_at"):
        return True, f"Social media links aur handles share karna allowed nahi hai pehle {SOCIAL_BLOCK_DAYS} din. Safety ke liye app ke andar baat karein."
    
    try:
        match_created = datetime.fromisoformat(match_doc["created_at"].replace("Z", "+00:00"))
        days_since = (datetime.now(timezone.utc) - match_created).days
        if days_since < SOCIAL_BLOCK_DAYS:
            remaining = SOCIAL_BLOCK_DAYS - days_since
            return True, f"Social media links aur handles {remaining} din baad share kar sakte hai. Abhi app ke andar baat karein — safety first!"
    except Exception:
        pass
    
    return False, ""



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
    # Also match stealth auto-chat accounts (real users with AI replies)
    await auto_match_stealth_users(db, user_id, gender, looking_for)


async def _ai_send_like(user_id: str, girl: dict, push_now: bool) -> bool:
    """One pending AI like (user must like back). push_now=False -> push waits for the 9/2/7 slots."""
    if await db.matches.find_one({"$or": [{"user1_id": girl["id"], "user2_id": user_id},
                                          {"user1_id": user_id, "user2_id": girl["id"]}]}, {"_id": 1}):
        return False
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.matches.insert_one({"id": str(uuid.uuid4()), "user1_id": girl["id"], "user2_id": user_id,
                                 "user1_liked": True, "user2_liked": False, "matched": False,
                                 "is_superlike": random.random() < 0.1, "created_at": now_iso})
    await db.likes.insert_one({"user_id": girl["id"], "liked_user_id": user_id, "action": "like",
                               "is_matched": False, "created_at": now_iso})
    title = random.choice(["Someone liked your profile", "You have a new like", "Someone is interested in you"])
    await create_in_app_notification(user_id, title, "Open HeartLink to see who liked you", "like_received",
                                     {"action": "open_likes", "route": "/likes"})
    try:
        await fcm_service.send_to_user(db, user_id, title=title, body="Open HeartLink to see who liked you",
                                       data={"type": "ai_like_received", "route": "/likes"}, automated=not push_now)
    except Exception:
        pass
    return True


async def _schedule_ai_likes_for_new_user(user_id: str, user_name: str):
    """New male user: an AI profile visits at ~5 min, first AI like at ~15 min, 1-2 more spread over hours."""
    await asyncio.sleep(random.uniform(4.5 * 60, 5.5 * 60))
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "gender": 1, "is_banned": 1})
    if not user or user.get("is_banned") or user.get("gender", "").lower() != "male":
        return
    ai_girls = await db.users.find(
        {"is_ai_profile": True, "is_active_ai": True, "gender": "female"},
        {"_id": 0, "id": 1, "name": 1}).to_list(None)
    if not ai_girls:
        return
    picks = random.sample(ai_girls, min(len(ai_girls), random.randint(2, 3)))
    try:
        await _record_profile_view(user_id, picks[0]["id"], anonymous=True, welcome=True)
    except Exception as e:
        logger.error(f"welcome AI view error: {e}")
    await asyncio.sleep(random.uniform(9 * 60, 11 * 60))
    for i, girl in enumerate(picks):
        try:
            if await _ai_send_like(user_id, girl, push_now=(i == 0)):
                logger.info(f"AI like for new user {user_name} ({i+1}/{len(picks)})")
        except Exception as e:
            logger.error(f"AI like error: {e}")
        if i < len(picks) - 1:
            await asyncio.sleep(random.uniform(45 * 60, 120 * 60))
    return


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
                "Aaj ke new profiles dekho - shayad tumhara perfect match mil jaye!", automated=True)
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
                "Bahut din ho gaye tumhare bina. Naye log join ho rahe hain, wapas aao!", automated=True)
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
                await fcm_service.send_to_user(db, uid, title, body, automated=True)
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
                await fcm_service.send_to_user(db, uid, title, body, automated=True)
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


async def weekly_highlights_scheduler():
    """Send weekly highlights push notification to all active users every Sunday 6 PM IST."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            ist_offset = timedelta(hours=5, minutes=30)
            now_ist = now + ist_offset
            
            # Calculate next Sunday 6 PM IST
            days_until_sunday = (6 - now_ist.weekday()) % 7
            if days_until_sunday == 0 and now_ist.hour >= 18:
                days_until_sunday = 7
            
            next_sunday = now_ist.replace(hour=18, minute=0, second=0, microsecond=0) + timedelta(days=days_until_sunday)
            sleep_seconds = (next_sunday - now_ist).total_seconds()
            
            logging.info(f"📊 Weekly highlights: sleeping {sleep_seconds/3600:.1f}h until Sunday 6PM IST")
            await asyncio.sleep(max(sleep_seconds, 60))
            
            await _send_weekly_highlights()
            
        except Exception as e:
            logging.error(f"Weekly highlights scheduler error: {e}")
            await asyncio.sleep(3600)


async def _send_weekly_highlights():
    """Send personalized weekly highlights notification to each active user."""
    try:
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        
        # Get all non-AI users who have been active recently
        active_users = await db.users.find(
            {"is_ai_profile": {"$ne": True}, "fcm_token": {"$exists": True, "$ne": None}},
            {"_id": 0, "id": 1, "name": 1, "fcm_token": 1, "gender": 1}
        ).to_list(None)
        
        sent_count = 0
        for user in active_users:
            try:
                user_id = user["id"]
                
                # Count likes received this week
                likes_received = await db.matches.count_documents({
                    "user2_id": user_id,
                    "user1_liked": True,
                    "created_at": {"$gte": week_ago}
                })
                
                # Count profile views this week
                views_received = await db.in_app_notifications.count_documents({
                    "user_id": user_id,
                    "type": "profile_view",
                    "created_at": {"$gte": week_ago}
                })
                
                # Count new matches this week
                new_matches = await db.matches.count_documents({
                    "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
                    "matched": True,
                    "created_at": {"$gte": week_ago}
                })
                
                # Count messages received
                msgs_received = await db.messages.count_documents({
                    "receiver_id": user_id,
                    "created_at": {"$gte": week_ago}
                })
                
                # Build notification message
                if likes_received == 0 and views_received == 0 and new_matches == 0:
                    continue  # Skip users with no activity
                
                parts = []
                if likes_received > 0:
                    parts.append(f"{likes_received} likes")
                if views_received > 0:
                    parts.append(f"{views_received} profile views")
                if new_matches > 0:
                    parts.append(f"{new_matches} new matches")
                if msgs_received > 0:
                    parts.append(f"{msgs_received} messages")
                
                summary = ", ".join(parts)
                first_name = user.get("name", "").split()[0] if user.get("name") else "Hey"
                
                title = f"{first_name}, tumhara week kaisa raha!"
                body = f"Is hafte: {summary}. Kholke dekho kaun interested hai!"
                
                await fcm_service.send_to_user(
                    db, user_id,
                    title=title,
                    body=body,
                    data={"type": "weekly_highlights", "route": "/likes"}, automated=True)
                sent_count += 1
                
                # Small delay to avoid FCM rate limits
                if sent_count % 50 == 0:
                    await asyncio.sleep(2)
                    
            except Exception as e:
                logging.error(f"Weekly highlight for {user.get('id','?')}: {e}")
                continue
        
        logging.info(f"📊 Weekly highlights sent to {sent_count}/{len(active_users)} users")
        
    except Exception as e:
        logging.error(f"Weekly highlights error: {e}")


async def payment_reminder_scheduler():
    """Check pending payment requests every 6 hours. Send reminder if pending > 24 hours."""
    while True:
        try:
            await asyncio.sleep(6 * 3600)  # Check every 6 hours
            
            now = datetime.now(timezone.utc)
            cutoff_24h = (now - timedelta(hours=24)).isoformat()
            cutoff_48h = (now - timedelta(hours=48)).isoformat()
            
            # Find pending requests older than 24h but newer than 48h (don't spam)
            stale_requests = await db.payment_requests.find({
                "status": "pending",
                "created_at": {"$lte": cutoff_24h, "$gte": cutoff_48h},
                "reminder_sent": {"$ne": True},
            }, {"_id": 0}).to_list(None)
            
            sent = 0
            for req in stale_requests:
                try:
                    await fcm_service.send_to_user(
                        db, req["user_id"],
                        title="Payment Verification Pending",
                        message="Tumhara payment verify ho raha hai. Agar screenshot upload nahi kiya toh abhi karo!",
                        data={"type": "payment_reminder", "route": "/premium"}
                    )
                    await db.payment_requests.update_one(
                        {"id": req["id"]},
                        {"$set": {"reminder_sent": True}}
                    )
                    sent += 1
                except Exception:
                    pass
            
            if sent > 0:
                logging.info(f"💳 Payment reminders sent to {sent} users")
                
            # Auto-expire requests older than 7 days
            expire_cutoff = (now - timedelta(days=7)).isoformat()
            expired = await db.payment_requests.update_many(
                {"status": "pending", "created_at": {"$lte": expire_cutoff}},
                {"$set": {"status": "expired", "reviewed_at": now.isoformat()}}
            )
            if expired.modified_count > 0:
                logging.info(f"💳 Expired {expired.modified_count} old payment requests")
                
        except Exception as e:
            logging.error(f"Payment reminder scheduler error: {e}")
            await asyncio.sleep(3600)



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
        "girls_retention_enabled": True,
        "verify_nudge_enabled": True,
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
                            data={"type": "profile_reminder", "route": "/profile/edit"}, automated=True)
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
                            data={"type": "comeback_3d", "route": "/discover"}, automated=True)
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
                            data={"type": "comeback_7d", "route": "/discover"}, automated=True)
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
            
            # ── 6. GIRLS RETENTION PUSH (3-day inactive girls) ──
            if notif_config.get("girls_retention_enabled", True):
                cutoff_3d = (now - timedelta(days=3)).isoformat()
                cutoff_10d = (now - timedelta(days=10)).isoformat()
                
                inactive_girls = await db.users.find({
                    "gender": {"$regex": "^female$", "$options": "i"},
                    "is_ai_profile": {"$ne": True},
                    "last_active": {"$lt": cutoff_3d, "$gt": cutoff_10d},
                    "is_blocked": {"$ne": True},
                    "last_girls_retention_at": {"$not": {"$gte": cutoff_3d}},
                }, {"_id": 0, "id": 1, "name": 1, "is_premium": 1, "premium_pass_until": 1}).to_list(100)
                
                import random as _rand
                girls_msgs = [
                    {
                        "title": "{name}, tumhe miss kar rahe hai!",
                        "body": "Naye verified boys join hue hai HeartLink pe. Aao dekho kaun tumse match hua!",
                    },
                    {
                        "title": "{name}, tumhara FREE Premium active hai!",
                        "body": "See Who Liked You aur Crush Reveal abhi bhi free hai. Miss mat karo!",
                    },
                    {
                        "title": "Koi tumhe pasand karta hai, {name}!",
                        "body": "Someone liked your profile! Open HeartLink to find out who.",
                    },
                    {
                        "title": "{name}, you're in demand!",
                        "body": "Multiple boys viewed your profile recently. Come back and see who's interested!",
                    },
                    {
                        "title": "Safety update for you, {name}",
                        "body": "We added new safety features just for you. Night Mode, AI protection & more. Check it out!",
                    },
                ]
                
                sent_count = 0
                for girl in inactive_girls:
                    if await can_notify(girl["id"]):
                        msg = _rand.choice(girls_msgs)
                        girl_name = (girl.get("name") or "").split()[0] or "Hey"
                        title = msg["title"].format(name=girl_name)
                        body = msg["body"]
                        
                        # Premium girls get premium-focused messages
                        if girl.get("is_premium"):
                            body = msg["body"]
                        
                        await fcm_service.send_to_user(db, girl["id"],
                            title, body,
                            data={"type": "girls_retention", "route": "/discover"}, automated=True)
                        await db.users.update_one({"id": girl["id"]}, {"$set": {"last_girls_retention_at": now.isoformat()}})
                        await log_notification(girl["id"], "girls_retention")
                        sent_count += 1
                
                if sent_count:
                    logging.info(f"Girls retention push sent to {sent_count} girls")
            
            # ── 7. VERIFY NUDGE (Unverified boys, 48hr+ after signup) ──
            if notif_config.get("verify_nudge_enabled", True):
                cutoff_48h = (now - timedelta(hours=48)).isoformat()
                unverified_boys = await db.users.find({
                    "is_ai_profile": {"$ne": True},
                    "gender": {"$regex": "^male$", "$options": "i"},
                    "created_at": {"$lt": cutoff_48h},
                    "selfie_verification_status": {"$nin": ["verified", "pending"]},
                    "verified": {"$ne": True},
                    "is_blocked": {"$ne": True},
                    "verify_nudge_sent": {"$ne": True},
                }, {"_id": 0, "id": 1, "name": 1, "fcm_token": 1}).limit(50).to_list(None)
                
                sent_count = 0
                nudge_msgs = [
                    ("Get Verified — Stand Out!", "Verified boys get 3x more matches. Take a quick selfie now!"),
                    ("Girls prefer verified profiles", "Get your verified badge in 30 seconds. Tap to verify."),
                    ("Almost there!", "One selfie away from your Verified badge. Girls trust verified profiles more."),
                ]
                for boy in unverified_boys:
                    if await can_notify(boy["id"]) and boy.get("fcm_token"):
                        title, body = random.choice(nudge_msgs)
                        try:
                            await fcm_service.send_push_notification(
                                boy["fcm_token"],
                                title, body,
                                data={"type": "verify_nudge", "route": "/verify-selfie"})
                            await db.users.update_one({"id": boy["id"]}, {"$set": {"verify_nudge_sent": True}})
                            await log_notification(boy["id"], "verify_nudge")
                            sent_count += 1
                        except Exception:
                            pass
                
                if sent_count:
                    logging.info(f"Verify nudge push sent to {sent_count} boys")
        
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

    def disconnect(self, user_id: str, websocket: WebSocket = None):
        current = self.active_connections.get(user_id)
        if current is not None and (websocket is None or current is websocket):
            del self.active_connections[user_id]

    async def send_message(self, user_id: str, message: dict, relay: bool = True):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
                return
            except Exception:
                self.disconnect(user_id)
        if relay:
            # Socket may live on another backend pod — hand it over via Mongo relay
            try:
                await db.ws_relay.insert_one({"target": user_id, "msg": message, "origin": WS_POD_ID,
                                              "created_at": datetime.now(timezone.utc)})
            except Exception as e:
                logging.debug(f"ws relay insert failed: {e}")
    
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
WS_POD_ID = str(uuid.uuid4())


async def _ws_relay_loop():
    """Deliver WS events written by other pods to sockets connected to this pod."""
    try:
        await db.ws_relay.create_index("created_at", expireAfterSeconds=120)
    except Exception:
        pass
    since = datetime.now(timezone.utc)
    seen = {}
    while True:
        try:
            # 3s overlap window + seen-set: safe against clock skew between pods
            rows = await db.ws_relay.find({"created_at": {"$gte": since - timedelta(seconds=3)}, "origin": {"$ne": WS_POD_ID}}).sort("created_at", 1).limit(1000).to_list(None)
            for r in rows:
                if r["_id"] in seen:
                    continue
                seen[r["_id"]] = r["created_at"]
                since = max(since, r["created_at"].replace(tzinfo=timezone.utc) if r["created_at"].tzinfo is None else r["created_at"])
                if r["target"] in manager.active_connections:
                    await manager.send_message(r["target"], r["msg"], relay=False)
            if len(seen) > 5000:
                cutoff = since - timedelta(seconds=10)
                seen = {k: v for k, v in seen.items() if (v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v) >= cutoff}
        except Exception as e:
            logging.warning(f"ws relay loop error: {e}")
            await asyncio.sleep(2)
        await asyncio.sleep(0.3)

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
    existing = await db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered. Please login instead.")
    
    # Resend cooldown: 60s between codes for the same email
    prev = await db.signup_otps.find_one({"email": email}, {"_id": 0, "created_at": 1})
    if prev and prev.get("created_at", "") > (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat():
        raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting a new OTP.")
    otp_code = _otp_new()
    otp_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store OTP in DB (upsert — replaces any previous OTP for this email)
    await db.signup_otps.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "otp_hash": _otp_hash(email, otp_code),
            "otp_code": None,
            "expires_at": otp_expires.isoformat(),
            "attempts": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Send OTP email
    try:
        from email_service import send_signup_otp_email
        result = await asyncio.to_thread(send_signup_otp_email, to_email=email, otp_code=otp_code, user_name="HeartLink User")
        if result.get("success"):
            logger.info(f"Signup OTP sent via {result.get('provider')} to {email[:2]}***")
            await db.signup_funnel.insert_one({"email": email, "step": "otp_sent", "timestamp": datetime.now(timezone.utc).isoformat()})
            return {"message": "OTP sent to your email", "email": email}
        else:
            logger.error(f"Signup OTP send failed: provider={result.get('provider')} error={result.get('error')}")
            await db.signup_otps.delete_one({"email": email})
            raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup OTP email error: {type(e).__name__}")
        await db.signup_otps.delete_one({"email": email})
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
    if not _otp_matches(email, otp_input, stored.get("otp_hash"), stored.get("otp_code")):
        remaining = 5 - stored.get("attempts", 0) - 1
        raise HTTPException(status_code=400, detail=f"Incorrect OTP. {remaining} attempts remaining.")
    
    # OTP verified — mark email as verified and clean up
    await db.signup_otps.update_one(
        {"email": email},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Track funnel: OTP verified
    await db.signup_funnel.insert_one({
        "email": email,
        "step": "otp_verified",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
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
    await check_auth_rate_limit(request, limit=5, window=600)
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
        user_dict["app_version"] = APP_VERSION
        user_dict["app_version_code"] = APP_VERSION_CODE
        
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
        
        # Track funnel: Signup completed with gender
        await db.signup_funnel.insert_one({
            "email": user_dict.get("email", ""),
            "step": "signup_completed",
            "gender": user_dict.get("gender", ""),
            "name": user_dict.get("name", ""),
            "location": user_dict.get("location", ""),
            "user_id": user.id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        # === AUTOMATIC NOTIFICATIONS ===
        # Notify all users about new user joining
        asyncio.create_task(_notify_new_user_joined(user.id, sanitized_name, user_dict.get("gender", ""), user_dict.get("location", "")))
        
        # Auto-match AI girl profiles — DELAYED to feel natural (2-6 hours after signup)
        asyncio.create_task(
            _delayed_ai_match(user.id, user_dict.get("gender", ""), user_dict.get("looking_for", ""))
        )
        
        # Schedule AI likes for new male users — 30 min delay, staggered, real human feel
        if user_dict.get("gender", "").lower() == "male":
            asyncio.create_task(
                _schedule_ai_likes_for_new_user(user.id, sanitized_name)
            )
        
        # === GIRLS FREE PREMIUM (1 month) ===
        if user_dict.get("gender", "").lower() == "female":
            premium_until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            await db.users.update_one({"id": user.id}, {"$set": {
                "is_premium": True,
                "premium_until": premium_until,
                "premium_source": "girls_free_signup",
                "premium_features": ["see_who_liked", "crush_reveal", "extra_boost", "unlimited_swipes"]
            }})
            logger.info(f"Girls Free Premium granted to {user.id} until {premium_until}")
        
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
    await check_auth_rate_limit(request, limit=10, window=300)
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
    
    # Schedule AI likes for new male users
    if data.gender.lower() == "male":
        asyncio.create_task(
            _schedule_ai_likes_for_new_user(user_id, data.name)
        )
    
    token_data = {"user_id": clean_user.get("id"), "email": clean_user.get("email")}
    return {"message": "Signup successful", "user": clean_user, "access_token": create_access_token(token_data)}


@api_router.post("/auth/forgot-password")
async def forgot_password(req: Request, request: ForgotPasswordRequest):
    """Request password reset - generates 6-digit OTP"""
    await check_auth_rate_limit(req, limit=5, window=600)
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
    
    generic = {"message": "If account exists, reset code has been sent"}
    last = user.get("password_reset_sent_at") or ""
    if last > (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat():
        raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting a new code.")
    if not user.get("email"):
        return generic  # SMS reset not available; never return the code in the response
    
    reset_code = _otp_new()
    reset_expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_reset_hash": _otp_hash(user["id"], reset_code),
            "password_reset_code": None,
            "password_reset_attempts": 0,
            "password_reset_sent_at": datetime.now(timezone.utc).isoformat(),
            "password_reset_expires": reset_expires.isoformat()
        }}
    )
    try:
        from email_service import send_otp_email
        result = await asyncio.to_thread(send_otp_email, to_email=user["email"], otp_code=reset_code, user_name=user.get("name", "User"))
        if not result.get("success"):
            logger.error(f"Password reset email failed: {result.get('error')}")
            raise HTTPException(status_code=503, detail="Email service is busy. Please try again in a minute.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset email error: {e}")
        raise HTTPException(status_code=503, detail="Email service is busy. Please try again in a minute.")
    return {"message": "Reset code sent to your email"}


async def _check_reset_code(user: dict, code: str):
    """Shared check: max 5 wrong tries, expiry, constant-time compare."""
    if not (user.get("password_reset_hash") or user.get("password_reset_code")):
        raise HTTPException(status_code=400, detail="No reset code requested")
    if (user.get("password_reset_attempts") or 0) >= 5:
        raise HTTPException(status_code=400, detail="Too many attempts. Please request a new code.")
    expires_at = datetime.fromisoformat(user["password_reset_expires"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset code expired")
    if not _otp_matches(user["id"], code, user.get("password_reset_hash"), user.get("password_reset_code")):
        await db.users.update_one({"id": user["id"]}, {"$inc": {"password_reset_attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid reset code")

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
    
    await _check_reset_code(user, reset_code)
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
    
    await _check_reset_code(user, data.reset_code)
    
    # Update password with bcrypt
    new_password_hash = hash_password_secure(data.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": new_password_hash,
            "password_reset_code": None,
            "password_reset_hash": None,
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
@api_router.get("/api/profile/{user_id}")
async def get_profile(user_id: str, request: Request, slim: bool = False):
    """Get user profile - OPTIMIZED with caching; slim=1 serves photo URLs instead of base64"""
    cached = get_cached_user(user_id)
    if cached:
        cached = _hide_private(cached, user_id, request)
        return slim_photos(cached, request) if slim else cached
    
    # Use projection to fetch only needed fields (faster query)
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0, "password_reset_code": 0, "password_reset_expires": 0, "failed_login_attempts": 0, "last_login_ip": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Clean and cache
    clean_user = clean_user_data(user)
    set_cached_user(user_id, clean_user)
    clean_user = _hide_private(clean_user, user_id, request)
    return slim_photos(clean_user, request) if slim else clean_user

@api_router.put("/profile/{user_id}")
async def update_profile(user_id: str, updates: dict, request: Request):
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
    return _hide_private(clean_user, user_id, request)


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


@api_router.get("/chat/{match_id}/info")
async def get_chat_info(match_id: str, user_id: str, request: Request):
    """Fast endpoint: get match info + other user data in one call"""
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(404, "Match not found")
    other_id = match["user2_id"] if match["user1_id"] == user_id else match["user1_id"]
    found = await find_users_light({"id": other_id}, ["id", "name", "age", "profile_picture", "photos", "is_online", "last_active", "bio", "is_ai_profile", "verified"])
    if not found:
        raise HTTPException(404, "User not found")
    other_user = found[0]
    return slim_photos({
        "match_id": match_id,
        "other_user": {
            "id": other_user["id"],
            "name": other_user.get("name", ""),
            "age": other_user.get("age"),
            "profile_picture": other_user.get("profile_picture"),
            "photos": other_user.get("photos", []),
            "is_online": other_user.get("is_online", False),
            "last_active": other_user.get("last_active"),
            "bio": other_user.get("bio", ""),
            "is_ai_profile": other_user.get("is_ai_profile", False),
            "verified": other_user.get("verified", False),
        }
    }, request)


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
async def make_user_admin(user_id: str, admin: dict = Depends(require_admin)):
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
async def make_user_admin_by_email(email: str = "admin@heartlink.com", admin: dict = Depends(require_admin)):
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
async def get_users_for_verification(status: str = "pending", admin: dict = Depends(require_admin)):
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
async def admin_verify_user(verification: AdminVerification, admin: dict = Depends(require_admin)):
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
        
        # Send push notification via FCM
        try:
            await fcm_service.notify_verification(db, verification.user_id, "approved")
        except Exception as e:
            logger.error(f"Verification notification failed: {e}")
        
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
        
        # Send push notification via FCM
        try:
            await fcm_service.notify_verification(db, verification.user_id, "rejected", verification.reason or "")
        except Exception as e:
            logger.error(f"Verification rejection notification failed: {e}")
        
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
async def get_admin_stats(admin: dict = Depends(require_admin)):
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
async def discover_users(request: Request, user_id: str, limit: int = 10, relationship_intent: str = None, trust_badge_level: str = None, last_active_hours: int = None, city: str = None):
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
        {"_id": 0, "user1_id": 1, "user2_id": 1, "user1_liked": 1, "matched": 1, "created_at": 1}
    ).sort("created_at", -1).limit(1000).to_list(None)
    
    # Await both tasks concurrently
    blockers, matches = await asyncio.gather(blockers_task, matches_task)
    
    blocker_ids = [u["id"] for u in blockers]
    interacted_ids = set()
    pass_cutoff = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    # My own passes older than 3 days come back into Discover
    recycled = {m["user2_id"] for m in matches if m.get("user1_id") == user_id and not m.get("user1_liked")
                and not m.get("matched") and (m.get("created_at") or "") < pass_cutoff}
    for m in matches:
        if m.get("user1_id") == user_id and m["user2_id"] in recycled and not m.get("user1_liked") and not m.get("matched"):
            continue
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
        "$or": [{"is_ai_profile": {"$ne": True}, "last_active": {"$gte": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()}},
                {"is_active_ai": True, "photos.0": {"$exists": True}}],
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
        "latitude": 1, "longitude": 1,
        "profile_prompts": 1, "ladies_first_enabled": 1,
        "selfie_verification_status": 1,
    }
    
    discover_projection["profile_picture"] = _B64_MARK("$profile_picture")
    discover_projection["photos"] = {"$map": {"input": {"$ifNull": ["$photos", []]}, "as": "p", "in": _B64_MARK("$$p")}}
    users = await db.users.aggregate([{"$match": query}, {"$sort": {"is_online": -1, "last_active": -1}}, {"$limit": max(limit * 6, 60)}, {"$project": discover_projection}]).to_list(None)
    if len(users) < limit:  # few active in last 30 days: fall back to less-active users after them
        query["$or"][0] = {"is_ai_profile": {"$ne": True}}
        query["id"] = {"$nin": exclude_ids + [u["id"] for u in users]}
        users += await db.users.aggregate([{"$match": query}, {"$sort": {"is_online": -1, "last_active": -1}}, {"$limit": max(limit * 6, 60)}, {"$project": discover_projection}]).to_list(None)
    
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
        # Verified profile bonus — HIGH priority so verification feels rewarding
        if profile.get("verified"):
            score += 50
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
    
    def _boosted(p):
        try:
            return bool(p.get("boost_active")) and datetime.now(timezone.utc) < datetime.fromisoformat(p.get("boost_end", "").replace("Z", "+00:00"))
        except Exception:
            return False
    # Priority: boosted > online now > most recently active > match score
    filtered_users.sort(key=lambda p: (_boosted(p), bool(p.get("is_online")), (p.get("last_active") or "")[:13], rank_score(p)), reverse=True)
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
    
    return slim_photos(result, request)

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
        await _record_profile_view(user_id, viewer_id)
    return {"message": "Profile view tracked", "incognito": viewer_incognito}


async def _record_profile_view(user_id: str, viewer_id: str, anonymous: bool = False, welcome: bool = False):
    """Store a view + notify. Free users only learn that *someone* viewed (who = Premium)."""
    recent = await db.profile_views.find_one({
        "viewed_user_id": user_id, "viewer_id": viewer_id,
        "viewed_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()}}, {"_id": 1})
    if not recent:
        real_viewer = viewer_id
        view_doc = {
            "viewed_user_id": user_id,
            "profile_id": user_id,
            "viewer_id": viewer_id,
            "viewed_at": datetime.now(timezone.utc).isoformat()
        }
        await db.profile_views.insert_one(view_doc)
        
        owner = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1, "premium_pass_until": 1, "gender": 1})
        owner_premium = is_user_premium(owner) if owner else False
        viewer_data = await db.users.find_one({"id": viewer_id}, {"_id": 0, "name": 1, "profile_picture": 1})
        real_premium = owner_premium
        if anonymous:
            owner_premium = False
        viewer_name = (viewer_data.get("name", "Someone") if viewer_data else "Someone") if owner_premium else "Someone"
        if not owner_premium:
            viewer_id = None
        await manager.send_message(user_id, {
            "type": "profile_view",
            "viewer_id": viewer_id,
            "viewer_name": viewer_name
        })
        
        # Store in-app notification for profile view
        await create_in_app_notification(
            user_id,
            "Profile Viewed",
            f"{viewer_name} viewed your profile." if viewer_id else (
                "Someone viewed your profile. Views tab mein dekho" if real_premium
                else "Someone viewed your profile. Premium lo aur dekho kaun hai"),
            "profile_view",
            {"viewer_id": viewer_id, "action": "open_profile", "route": f"/profile/{viewer_id}"} if viewer_id
            else {"action": "open_likes", "route": "/likes"}
        )
        
        # Send OneSignal push notification for profile view
        try:
            viewer_is_ai = await db.users.count_documents({"id": real_viewer, "is_ai_profile": True}, limit=1)
            await fcm_service.notify_profile_view(db, user_id, viewer_name, real_viewer, anonymous=not owner_premium, automated=bool(viewer_is_ai) and not welcome)
        except Exception as e:
            logger.error(f"Profile view push notification failed: {e}")
        
        # Update badge
        asyncio.create_task(manager.send_badge_update(user_id))

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
    user_pic = user_pic if isinstance(user_pic, str) and user_pic.startswith("http") else None
    target_pic = target_pic if isinstance(target_pic, str) and target_pic.startswith("http") else None
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





@api_router.post("/action/{user_id}/undo")
async def undo_action(user_id: str, request: Request):
    """Undo last swipe action — Premium only. Removes the like/pass record."""
    data = await request.json()
    target_user_id = data.get("target_user_id")
    
    if not target_user_id:
        raise HTTPException(status_code=400, detail="target_user_id required")
    
    # Check premium
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1, "premium_pass_until": 1, "gender": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not is_user_premium(user):
        raise HTTPException(status_code=403, detail="Undo is a Premium feature")
    
    # Remove any match/action record between these users (where this user initiated)
    # Case 1: User liked target — remove the match record
    result = await db.matches.delete_one({
        "user1_id": user_id,
        "user2_id": target_user_id,
        "matched": False  # Only undo non-mutual matches (can't undo a mutual match)
    })
    
    # Case 2: User was second to like (mutual match already happened) — can't undo
    if result.deleted_count == 0:
        # Check if there's a mutual match
        mutual = await db.matches.find_one({
            "$or": [
                {"user1_id": user_id, "user2_id": target_user_id, "matched": True},
                {"user1_id": target_user_id, "user2_id": user_id, "matched": True}
            ]
        })
        if mutual:
            raise HTTPException(status_code=400, detail="Can't undo — you already matched! Unmatch from chat instead.")
    
    # Also remove from swipe history / pass records
    await db.swipe_history.delete_one({
        "user_id": user_id,
        "target_user_id": target_user_id
    })
    
    # Remove related notification
    await db.in_app_notifications.delete_many({
        "user_id": target_user_id,
        "data.from_user_id": user_id,
        "type": {"$in": ["new_like", "superlike"]}
    })
    
    invalidate_user_cache(user_id)
    
    return {"success": True, "message": "Swipe undone! Profile restored."}


FREE_DAILY_SWIPES = 5
EXTRA_SWIPES_PER_AD = 3
MAX_SWIPE_ADS_PER_DAY = 5
MAX_LIKE_REVEALS_PER_DAY = 3


def _ist_day() -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d")


def _ist_day_start_utc() -> str:
    ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    return (ist.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(hours=5, minutes=30)).isoformat()


async def _swipe_status(user_id: str) -> dict:
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "swipe_day": 1, "swipe_count": 1, "extra_swipes": 1}) or {}
    used = u.get("swipe_count", 0) if u.get("swipe_day") == _ist_day() else 0
    extra = max(int(u.get("extra_swipes", 0) or 0), 0)
    return {"limit": FREE_DAILY_SWIPES, "used": used, "extra": extra,
            "remaining": max(FREE_DAILY_SWIPES - used, 0) + extra}


async def _consume_swipe(user_id: str) -> bool:
    """Atomically use one free daily swipe, else one extra (ad) swipe. False if none left."""
    today = _ist_day()
    r = await db.users.update_one({"id": user_id, "swipe_day": {"$ne": today}},
                                  {"$set": {"swipe_day": today, "swipe_count": 1}})
    if r.modified_count:
        return True
    r = await db.users.update_one({"id": user_id, "swipe_day": today, "swipe_count": {"$lt": FREE_DAILY_SWIPES}},
                                  {"$inc": {"swipe_count": 1}})
    if r.modified_count:
        return True
    r = await db.users.update_one({"id": user_id, "extra_swipes": {"$gt": 0}}, {"$inc": {"extra_swipes": -1}})
    return bool(r.modified_count)


FREE_AI_MSGS_PER_DAY = 30
AI_MSGS_PER_AD = 10
MAX_AI_CHAT_ADS_PER_DAY = 5
MAX_CRUSH_REVEALS_PER_DAY = 2


async def _claim_daily_reward(user_id: str, reward_type: str, cap: int, **extra) -> Optional[str]:
    """Insert-then-count daily cap (safe under parallel requests). Returns reward id or None if cap hit."""
    doc = {"id": str(uuid.uuid4()), "user_id": user_id, "reward_type": reward_type, "amount": 1,
           "created_at": datetime.now(timezone.utc).isoformat(), **extra}
    await db.ad_rewards.insert_one(doc)
    earlier = await db.ad_rewards.count_documents({
        "user_id": user_id, "reward_type": reward_type, "created_at": {"$gte": _ist_day_start_utc()},
        "$or": [{"created_at": {"$lt": doc["created_at"]}}, {"created_at": doc["created_at"], "id": {"$lt": doc["id"]}}]})
    if earlier >= cap:
        await db.ad_rewards.delete_one({"id": doc["id"]})
        return None
    return doc["id"]


async def _rewards_left(user_id: str, reward_type: str, cap: int) -> int:
    used = await db.ad_rewards.count_documents({"user_id": user_id, "reward_type": reward_type,
                                                "created_at": {"$gte": _ist_day_start_utc()}})
    return max(cap - used, 0)


async def _ai_chat_status(user_id: str) -> dict:
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "ai_msg_day": 1, "ai_msg_count": 1, "ai_msg_extra": 1,
                                                  "is_premium": 1, "premium_pass_until": 1, "gender": 1}) or {}
    if is_user_premium(u):
        return {"unlimited": True}
    used = u.get("ai_msg_count", 0) if u.get("ai_msg_day") == _ist_day() else 0
    extra = max(int(u.get("ai_msg_extra", 0) or 0), 0)
    return {"unlimited": False, "limit": FREE_AI_MSGS_PER_DAY, "used": used, "extra": extra,
            "remaining": max(FREE_AI_MSGS_PER_DAY - used, 0) + extra,
            "videos_left": await _rewards_left(user_id, "ai_chat_extend", MAX_AI_CHAT_ADS_PER_DAY)}


async def _consume_ai_msg(sender: dict) -> bool:
    """Free users: 30 msgs/day to AI personas, then extra msgs earned via rewarded video."""
    if is_user_premium(sender):
        return True
    uid, today = sender["id"], _ist_day()
    r = await db.users.update_one({"id": uid, "ai_msg_day": {"$ne": today}}, {"$set": {"ai_msg_day": today, "ai_msg_count": 1}})
    if r.modified_count:
        return True
    r = await db.users.update_one({"id": uid, "ai_msg_day": today, "ai_msg_count": {"$lt": FREE_AI_MSGS_PER_DAY}},
                                  {"$inc": {"ai_msg_count": 1}})
    if r.modified_count:
        return True
    r = await db.users.update_one({"id": uid, "ai_msg_extra": {"$gt": 0}}, {"$inc": {"ai_msg_extra": -1}})
    return bool(r.modified_count)


@api_router.get("/ai-chat/limit/{user_id}")
async def get_ai_chat_limit(user_id: str):
    return await _ai_chat_status(user_id)


@api_router.post("/ai-chat/extend/{user_id}")
async def extend_ai_chat_with_ad(user_id: str):
    """User watched a rewarded video -> +10 AI chat messages (max 5 videos/day)."""
    if not await _claim_daily_reward(user_id, "ai_chat_extend", MAX_AI_CHAT_ADS_PER_DAY):
        raise HTTPException(status_code=429, detail="Aaj ke video rewards khatam. Kal try karo ya Premium lo")
    await db.users.update_one({"id": user_id, "ai_msg_extra": {"$lt": 0}}, {"$set": {"ai_msg_extra": 0}})
    await db.users.update_one({"id": user_id}, {"$inc": {"ai_msg_extra": AI_MSGS_PER_AD}})
    return {"success": True, "added": AI_MSGS_PER_AD, **(await _ai_chat_status(user_id))}


@api_router.post("/crushes/{user_id}/reveal")
async def reveal_crush_with_ad(user_id: str):
    """User watched a rewarded video -> reveal their newest hidden Secret Crush (max 2/day)."""
    crush = await db.crushes.find_one({"crushed_id": user_id, "revealed": {"$ne": True}}, {"_id": 0, "id": 1},
                                      sort=[("created_at", -1)])
    if not crush:
        raise HTTPException(status_code=404, detail="Koi hidden crush nahi hai")
    if not await _claim_daily_reward(user_id, "crush_reveal", MAX_CRUSH_REVEALS_PER_DAY, target_id=crush["id"]):
        raise HTTPException(status_code=429, detail=f"Aaj ke {MAX_CRUSH_REVEALS_PER_DAY} free reveals ho gaye. Kal try karo ya Premium lo")
    await db.crushes.update_one({"id": crush["id"]}, {"$set": {"revealed": True, "revealed_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True, "crush_id": crush["id"]}


@api_router.get("/swipes/{user_id}")
async def get_swipe_status(user_id: str):
    return await _swipe_status(user_id)


class LikeRevealRequest(BaseModel):
    liker_id: str


@api_router.post("/likes/{user_id}/reveal")
async def reveal_like_with_ad(user_id: str, data: LikeRevealRequest):
    """Free user watched a rewarded ad -> reveal one person who liked them (max 3/day)."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1, "premium_pass_until": 1, "gender": 1, "revealed_likes": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if is_user_premium(user):
        return {"success": True, "already_premium": True}
    like = await db.matches.find_one({"user1_id": data.liker_id, "user2_id": user_id, "user1_liked": True, "matched": False}, {"_id": 1})
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
    if data.liker_id in (user.get("revealed_likes") or []):
        return {"success": True, "already_revealed": True}
    doc = {"id": str(uuid.uuid4()), "user_id": user_id, "reward_type": "like_reveal", "amount": 1,
           "target_id": data.liker_id, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.ad_rewards.insert_one(doc)
    used = await db.ad_rewards.count_documents({
        "user_id": user_id, "reward_type": "like_reveal", "created_at": {"$gte": _ist_day_start_utc()},
        "$or": [{"created_at": {"$lt": doc["created_at"]}}, {"created_at": doc["created_at"], "id": {"$lt": doc["id"]}}]})
    if used >= MAX_LIKE_REVEALS_PER_DAY:
        await db.ad_rewards.delete_one({"id": doc["id"]})
        raise HTTPException(status_code=429, detail=f"Aaj ke {MAX_LIKE_REVEALS_PER_DAY} free reveals ho gaye. Kal try karo ya Premium lo")
    await db.users.update_one({"id": user_id}, {"$addToSet": {"revealed_likes": data.liker_id}})
    return {"success": True, "remaining_today": MAX_LIKE_REVEALS_PER_DAY - used - 1}


@api_router.post("/action/{user_id}")
@api_router.post("/api/action/{user_id}")
async def user_action(user_id: str, action: LikeAction):
    # ── PREMIUM GATE: Only premium users can like/superlike ──
    if action.action in ("like", "superlike"):
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1, "premium_pass_until": 1, "gender": 1, "bonus_superlike_until": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_premium = is_user_premium(user)
        
        if action.action == "superlike":
            # Super like: premium OR bonus super like from ads
            bonus_until = user.get("bonus_superlike_until", "")
            has_bonus = bonus_until and bonus_until > datetime.now(timezone.utc).isoformat()
            if not user_premium and not has_bonus:
                raise HTTPException(status_code=403, detail="Premium or watch 3 ads for Super Like")
            # Consume bonus super like if not premium
            if not user_premium and has_bonus:
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"bonus_superlike_until": ""}}
                )

    if action.action == "like":
        swiper = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1, "premium_pass_until": 1, "gender": 1})
        if swiper and not is_user_premium(swiper) and not await _consume_swipe(user_id):
            raise HTTPException(status_code=429, detail="out_of_swipes")

    # Check if there's an existing record where target user liked current user
    existing_like = await db.matches.find_one({
        "user1_id": action.target_user_id,
        "user2_id": user_id,
        "user1_liked": True
    })
    if not existing_like and action.action in ("like", "superlike"):
        target_ai = await db.users.find_one({"id": action.target_user_id, "is_ai_profile": True, "is_active_ai": True}, {"_id": 1})
        if target_ai:
            ai_like = Match(user1_id=action.target_user_id, user2_id=user_id, user1_liked=True, matched=False).dict()
            await db.matches.insert_one(ai_like)
            existing_like = await db.matches.find_one({"id": ai_like["id"]})
    
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
        light = {"_id": 0, "photos": 0, "password_hash": 0}
        user1, user2 = await asyncio.gather(
            db.users.find_one({"id": user_id}, light),
            db.users.find_one({"id": action.target_user_id}, light))
        
        # Persist the match first so both Match tabs see it immediately
        await db.matches.update_one(
            {"id": existing["id"]},
            {"$set": {"user2_liked": True, "matched": True, "matched_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # AI compatibility (slow LLM call) runs in background
        async def _compat():
            sc, an = await calculate_ai_compatibility(user1, user2)
            await db.matches.update_one({"id": existing["id"]}, {"$set": {"compatibility_score": sc, "ai_analysis": an}})
            return sc, an
        asyncio.create_task(_compat())
        score, analysis = None, None
        
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
            # If already liked, upgrade to superlike — don't send duplicate notification
            existing_like = await db.matches.find_one({"user1_id": user_id, "user2_id": action.target_user_id, "is_superlike": False})
            if existing_like:
                await db.matches.update_one({"_id": existing_like["_id"]}, {"$set": {"is_superlike": True}})
                # Remove previous like notification
                await db.notifications.delete_many({
                    "user_id": action.target_user_id,
                    "type": "like",
                    "data.user_id": user_id,
                })
            
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
            # Check if already superliked — don't downgrade notification
            existing_superlike = await db.matches.find_one({"user1_id": user_id, "user2_id": action.target_user_id, "is_superlike": True})
            if existing_superlike:
                return {"action": "liked"}  # Already superliked, skip like notification
            
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
    
    # Premium check — crush is a premium feature
    crusher = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "gender": 1, "is_premium": 1, "premium_pass_until": 1})
    if not crusher:
        raise HTTPException(status_code=404, detail="User not found")
    if not is_user_premium(crusher):
        raise HTTPException(status_code=403, detail="Premium required to send crush")
    if not await db.users.find_one({"id": target_user_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already crushed
    existing = await db.crushes.find_one({"crusher_id": user_id, "crushed_id": target_user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already marked as crush")
    
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
async def get_crushes(user_id: str, request: Request):
    """Get users who crushed on you — premium sees full data, free sees blurred."""
    # Server-side premium check
    requesting_user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1, "premium_pass_until": 1, "gender": 1})
    user_has_premium = is_user_premium(requesting_user) if requesting_user else False
    
    total = await db.crushes.count_documents({"crushed_id": user_id})
    q = {"crushed_id": user_id} if user_has_premium else {"crushed_id": user_id, "revealed": True}
    crushes = await db.crushes.find(q).sort("created_at", -1).limit(50).to_list(None)
    
    result = []
    for c in crushes:
        crusher = await db.users.find_one(
            {"id": c["crusher_id"]},
            {"_id": 0, "id": 1, "name": 1, "age": 1, "profile_picture": 1, "location": 1}
        )
        if crusher:
            if user_has_premium or c.get("revealed", False):
                result.append({
                    "crush_id": c["id"],
                    "user": crusher,
                    "created_at": c["created_at"],
                    "revealed": True,
                    "is_premium_locked": False,
                })
            else:
                result.append({
                    "crush_id": c["id"],
                    "user": {
                        "id": crusher["id"],
                        "name": "???",
                        "age": None,
                        "profile_picture": crusher.get("profile_picture"),
                        "location": "",
                    },
                    "created_at": c["created_at"],
                    "revealed": False,
                    "is_premium_locked": True,
                })
    
    my_crushes = await db.crushes.find({"crusher_id": user_id}).to_list(None)
    my_crush_ids = {c["crushed_id"] for c in my_crushes}
    for r in result:
        r["is_mutual"] = r["user"]["id"] in my_crush_ids
    
    reveals_left = 0 if user_has_premium else await _rewards_left(user_id, "crush_reveal", MAX_CRUSH_REVEALS_PER_DAY)
    return slim_photos({"crushes": result, "total": total, "hidden": total - sum(1 for r in result if r["revealed"]),
                        "is_premium": user_has_premium, "reveals_left": reveals_left}, request)

@api_router.get("/crushes/{user_id}/sent")
async def get_sent_crushes(user_id: str):
    """Get users you crushed on"""
    crushes = await db.crushes.find({"crusher_id": user_id}).sort("created_at", -1).to_list(None)
    crush_ids = [c["crushed_id"] for c in crushes]
    return {"sent_crush_ids": crush_ids, "total": len(crush_ids)}

# ==================== WHO VIEWED PROFILE (ENHANCED) ====================

@api_router.get("/profile-viewers/{user_id}")
async def get_profile_viewers_enhanced(user_id: str, request: Request):
    """Get who viewed your profile - blurred for free, full for premium. Premium checked server-side."""
    q = {"$or": [{"viewed_user_id": user_id}, {"profile_id": user_id}]}
    total_views = await db.profile_views.count_documents(q)
    today_views = await db.profile_views.count_documents({
        **q, "viewed_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
    })
    
    # Server-side premium check — NO client-side override
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1, "premium_pass_until": 1, "gender": 1})
    user_has_premium = is_user_premium(user) if user else False
    if not user_has_premium:
        # Free: counts only — who viewed is a Premium feature
        return {"viewers": [], "total_views": total_views, "today_views": today_views, "is_premium": False}

    views = await db.profile_views.find(q).sort("viewed_at", -1).limit(100).to_list(None)
    seen_viewers = set()
    views = [v for v in views if not (v.get("viewer_id") in seen_viewers or seen_viewers.add(v.get("viewer_id")))][:50]
    
    viewers = []
    for v in views:
        viewer = await db.users.find_one(
            {"id": v.get("viewer_id")},
            {"_id": 0, "id": 1, "name": 1, "age": 1, "profile_picture": 1, "location": 1, "gender": 1}
        )
        if viewer:
            if user_has_premium:
                viewers.append({
                    "user": viewer,
                    "viewed_at": v.get("viewed_at"),
                    "locked": False
                })
            else:
                viewers.append({
                    "user": {
                        "id": viewer["id"],
                        "name": viewer["name"][0] + "***" if viewer.get("name") else "???",
                        "age": viewer.get("age"),
                        "profile_picture": None,
                        "location": viewer.get("location", "").split(",")[0] if viewer.get("location") else "",
                        "gender": viewer.get("gender")
                    },
                    "viewed_at": v.get("viewed_at"),
                    "locked": True
                })
    
    return slim_photos({
        "viewers": viewers,
        "total_views": total_views,
        "today_views": today_views,
        "is_premium": user_has_premium
    }, request)

# Matches Routes
@api_router.get("/matches/{user_id}")
async def get_matches(user_id: str, request: Request):
    """Get user matches - OPTIMIZED with caching and batch queries"""
    # Check cache first
    cache_key = f"matches_{user_id}"
    cached = matches_cache.get(cache_key)
    if cached:
        return slim_photos(cached, request)
    
    # Get current user blocked list only
    current_user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "id": 1, "blocked_users": 1}
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
    matched_users = await find_users_light(
        {"id": {"$in": other_user_ids}},
        ["id", "name", "age", "verified", "is_online", "last_active", "photos",
         "profile_picture", "privacy_settings", "blocked_users"]
    )
    
    # Create lookup dict
    users_dict = {u["id"]: u for u in matched_users}
    
    result = []
    for match in matches:
        if not match.get("id"):
            continue
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
            "name": other_user.get("name", ""),
            "age": other_user.get("age"),
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
    return slim_photos(result, request)

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
async def get_likes(user_id: str, request: Request):
    """Get users who liked the current user. Non-premium see blurred/limited data."""
    # Check premium status
    requesting_user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1, "premium_pass_until": 1, "gender": 1, "revealed_likes": 1})
    user_has_premium = is_user_premium(requesting_user) if requesting_user else False
    revealed_ids = set((requesting_user or {}).get("revealed_likes") or [])

    # Find all matches where user2_id is current user and user1 has liked
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
    
    liker_ids = list({lk["user1_id"] for lk in likes if lk.get("user2_action") != "pass"})
    liker_map = {u["id"]: u async for u in db.users.aggregate([
        {"$match": {"id": {"$in": liker_ids}}},
        {"$project": {"_id": 0, "id": 1, "name": 1, "age": 1, "bio": 1, "interests": 1, "verified": 1,
                      "location": 1, "is_online": 1, "last_active": 1,
                      "profile_picture": _B64_MARK("$profile_picture"),
                      "photos": {"$map": {"input": {"$ifNull": ["$photos", []]}, "as": "p", "in": _B64_MARK("$$p")}}}},
    ])}

    for like in likes:
        if like.get("user2_action") == "pass":
            continue
            
        liker_user = liker_map.get(like["user1_id"])
        
        if liker_user:
            if user_has_premium or liker_user["id"] in revealed_ids:
                # Premium (or revealed via rewarded ad): full data
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
                    "is_superlike": like.get("is_superlike", False),
                    "revealed": not user_has_premium,
                }
            else:
                # Non-premium: blurred/hidden data — only count and blurred photo
                user_data = {
                    "id": liker_user["id"],
                    "name": "???",
                    "age": None,
                    "bio": "",
                    "photos": [],
                    "profile_picture": liker_user.get("profile_picture"),  # Frontend blurs this
                    "interests": [],
                    "verified": False,
                    "location": "",
                    "is_online": False,
                    "last_active": None,
                    "liked_at": like.get("created_at"),
                    "is_superlike": like.get("is_superlike", False),
                    "is_locked": True,
                }
            
            if like.get("is_superlike"):
                result["super_likes"].append(user_data)
            else:
                result["regular_likes"].append(user_data)
    
    result["total_count"] = len(result["regular_likes"]) + len(result["super_likes"])
    result["is_premium"] = user_has_premium
    
    return slim_photos(result, request)

@api_router.get("/active-users/{user_id}")
async def get_active_users(user_id: str, request: Request, limit: int = 20):
    """Get recently active users who are not blocked and not matched"""
    current_user = await db.users.find_one({"id": user_id}, {"_id": 0, "blocked_users": 1, "looking_for": 1, "gender": 1})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get blocked users
    blocked_users = current_user.get("blocked_users", [])
    
    # Find users who blocked current user
    blockers = await db.users.find({"blocked_users": user_id}, {"_id": 0, "id": 1}).limit(1000).to_list(None)
    blocker_ids = [u["id"] for u in blockers]
    
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
        "is_permanently_banned": {"$ne": True},
        "is_shadow_banned": {"$ne": True},
        "$or": [{"id": {"$in": ws_connected_ids}}, {"last_active": {"$gte": active_threshold}}],
    }
    
    # Real users first; online AI personas (with photos) only fill remaining slots, shuffled
    fields = ["id", "name", "age", "bio", "photos", "profile_picture", "interests", "verified", "location", "last_active"]
    real = await find_users_light({**query, "is_ai_profile": {"$ne": True}}, fields, sort={"last_active": -1}, limit=limit)
    users = real
    if len(real) < limit:
        ai = await find_users_light({**query, "is_ai_profile": True, "is_active_ai": True, "is_online": True,
                                     "photos.0": {"$exists": True}}, fields, limit=100)
        random.shuffle(ai)
        users = real + ai[:limit - len(real)]
    
    # Determine online status: WS-connected OR active in last 5 minutes
    five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    
    return slim_photos([{
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
    } for u in users], request)


@api_router.get("/conversations/{user_id}")
async def get_conversations(user_id: str, request: Request):
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
    other_of = {m["id"]: (m["user2_id"] if m["user1_id"] == user_id else m["user1_id"]) for m in matches if m.get("id")}
    match_ids = list(other_of.keys())
    # 3 batched queries instead of 3 per match
    last_rows, unread_rows, users = await asyncio.gather(
        db.messages.aggregate([
            {"$match": {"match_id": {"$in": match_ids}, "is_deleted_for_all": {"$ne": True}}},
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$match_id", "doc": {"$first": "$$ROOT"}}},
        ]).to_list(None),
        db.messages.aggregate([
            {"$match": {"match_id": {"$in": match_ids}, "receiver_id": user_id, "read": False, "is_deleted_for_all": {"$ne": True}}},
            {"$group": {"_id": "$match_id", "count": {"$sum": 1}}},
        ]).to_list(None),
        find_users_light({"id": {"$in": list(set(other_of.values()))}}, [
            "id", "name", "age", "profile_picture", "photos", "is_online", "last_active", "verified", "is_ai_profile"]),
    )
    last_by = {r["_id"]: r["doc"] for r in last_rows}
    unread_by = {r["_id"]: r["count"] for r in unread_rows}
    user_by = {u["id"]: u for u in users}
    
    for match_id, other_user_id in other_of.items():
        last_message = last_by.get(match_id)
        other_user = user_by.get(other_user_id)
        if not last_message or not other_user:
            continue
        last_message.pop("_id", None)
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
            },
            "lastMessage": serialize_user_for_response(last_message, exclude_password=False),
            "unreadCount": unread_by.get(match_id, 0),
            "hasMessages": True,
        })
    
    # Sort by last message time, newest first
    conversations.sort(key=lambda c: c["lastMessage"].get("created_at", ""), reverse=True)
    return slim_photos(conversations, request)


# Chat Routes
@api_router.get("/messages/{match_id}")
async def get_messages(match_id: str, user_id: Optional[str] = None, limit: int = 100, skip: int = 0, order: str = "asc", before: Optional[str] = None):
    """Get chat messages with pagination and privacy filters
    
    Args:
        order: 'asc' for oldest first (default for chat display), 'desc' for newest first (for getting last message)
        before: ISO timestamp - load messages before this time (for pagination)
    """
    query = {
        "match_id": match_id,
        "is_deleted_for_all": {"$ne": True}
    }
    
    # Pagination: load messages before a timestamp
    if before:
        try:
            query["created_at"] = {"$lt": before}
        except Exception:
            pass
    
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
        {"$set": {"read": True, "delivered": True, "read_at": datetime.now(timezone.utc).isoformat()}}
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


@api_router.post("/chat/upload-image")
async def upload_chat_image(request: Request):
    """Upload image for chat + AI inappropriate content check."""
    data = await request.json()
    sender_id = data.get("sender_id")
    match_id = data.get("match_id")
    image_base64 = data.get("image_base64")  # data:image/jpeg;base64,...
    
    if not sender_id or not match_id or not image_base64:
        raise HTTPException(status_code=400, detail="sender_id, match_id, image_base64 required")
    
    sender = await db.users.find_one({"id": sender_id})
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")
    
    # Extract base64 data
    if "," in image_base64:
        header, b64data = image_base64.split(",", 1)
        content_type = header.split(":")[1].split(";")[0] if ":" in header else "image/jpeg"
    else:
        b64data = image_base64
        content_type = "image/jpeg"
    
    import json as json_mod
    try:
        image_bytes = base64.b64decode(b64data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    
    # Size limit: 5MB
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Max 5MB.")
    
    # AI Inappropriate Content Check using Gemini Vision
    is_safe = True
    moderation_reason = ""
    EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
    if EMERGENT_KEY:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            
            chat = LlmChat(
                api_key=EMERGENT_KEY,
                session_id=f"img_mod_{sender_id}_{uuid.uuid4().hex[:8]}",
                system_message="""You are a content moderation AI for a dating app. Check if the image is safe to send in chat.

BLOCK if the image contains:
- Nudity or sexually explicit content
- Violence or gore
- Drugs or illegal substances
- Hate symbols
- Spam or scam content

ALLOW: Normal selfies, scenery, food, pets, memes, casual photos.

Respond ONLY in JSON: {"safe": true/false, "reason": "brief reason"}"""
            )
            chat.with_model("gemini", "gemini-2.5-flash")
            
            img_content = ImageContent(image_base64=b64data)
            msg = UserMessage(text="Is this image safe for a dating app chat?", file_contents=[img_content])
            response = await chat.send_message(msg)
            resp_text = str(response).strip()
            
            import json as json_mod
            start = resp_text.find('{')
            end = resp_text.rfind('}') + 1
            if start >= 0 and end > start:
                result = json_mod.loads(resp_text[start:end])
                is_safe = result.get("safe", True)
                moderation_reason = result.get("reason", "")
        except Exception as e:
            logging.error(f"Image moderation failed: {e}")
            is_safe = True  # Allow on AI failure
    
    if not is_safe:
        # Log the blocked image
        await db.safety_reports.insert_one({
            "type": "image_blocked",
            "sender_id": sender_id,
            "sender_name": sender.get("name"),
            "match_id": match_id,
            "reason": moderation_reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "blocked": True, "message": "Image blocked — inappropriate content detected. Please send appropriate images only."}
    
    # Upload to Object Storage
    ext = content_type.split("/")[-1] if "/" in content_type else "jpeg"
    if ext == "jpeg":
        ext = "jpg"
    storage_path = f"heartlink/chat/{match_id}/{uuid.uuid4().hex}.{ext}"
    
    try:
        result = _put_object(storage_path, image_bytes, content_type)
        image_path = result.get("path", storage_path)
    except Exception as e:
        logging.error(f"Image upload to storage failed: {e}")
        raise HTTPException(status_code=500, detail="Image upload failed. Please try again.")
    
    return {
        "success": True,
        "image_path": image_path,
        "content_type": content_type,
        "size": len(image_bytes),
    }


@api_router.get("/chat/image/{path:path}")
async def get_chat_image(path: str):
    """Serve chat image from Object Storage."""
    try:
        data, content_type = _get_object(path)
        return Response(content=data, media_type=content_type)
    except Exception as e:
        logging.error(f"Image download failed: {e}")
        raise HTTPException(status_code=404, detail="Image not found")



@api_router.post("/messages")
async def send_message_http(message_data: Message):
    """Send message with women safety checks"""
    # Get sender and receiver
    light = {"_id": 0, "photos": 0, "profile_picture": 0, "password_hash": 0}
    sender, receiver = await asyncio.gather(
        db.users.find_one({"id": message_data.sender_id}, light),
        db.users.find_one({"id": message_data.receiver_id}, light))
    
    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Skip safety checks if receiver is an AI profile
    is_ai_receiver = receiver.get("is_ai_profile", False)
    if is_ai_receiver and not await _consume_ai_msg(sender):
        raise HTTPException(status_code=429, detail="ai_chat_limit")
    
    # === LADIES FIRST MODE CHECK ===
    if not is_ai_receiver and receiver.get("ladies_first_enabled"):
        sender_gender = sender.get("gender", "").lower()
        if sender_gender == "male":
            # Check if girl has already sent a message in this match
            girl_msg = await db.messages.find_one({
                "match_id": message_data.match_id,
                "sender_id": message_data.receiver_id
            })
            if not girl_msg:
                raise HTTPException(
                    status_code=403,
                    detail="This user has Ladies First enabled. Wait for her to message first."
                )
    
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
    
    # === SOCIAL MEDIA BLOCK — silently drop ===
    blocked, block_reason = await _check_social_block(message_data.match_id, original_content)
    if blocked:
        return {"id": message_dict.get("id", ""), "status": "sent"}
    
    # === GIRLS SAFETY CHECKS (skip for AI/auto-chat profiles) ===
    if not is_ai_receiver and not receiver.get("auto_chat_enabled"):
        safe_word_triggered = await check_safe_word(
            db, message_data.sender_id, message_data.receiver_id, message_data.match_id,
            original_content, ws_manager=manager
        )
        if safe_word_triggered:
            return {"id": message_dict.get("id", ""), "status": "sent"}
        
        night_blocked, _ = await check_night_mode_block(
            db, message_data.sender_id, message_data.receiver_id, message_data.match_id
        )
        if night_blocked:
            return {"id": message_dict.get("id", ""), "status": "sent"}
        
    
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
    
    asyncio.create_task(_ack_message(
        message_dict["id"], message_data.match_id, message_data.sender_id, message_data.receiver_id,
        bool(receiver and (receiver.get("is_ai_profile") or receiver.get("auto_chat_enabled")))))
    
    # Check if sender is muted by receiver
    muted_users = receiver.get('muted_users', [])
    sender_not_muted = message_data.sender_id not in muted_users
    
    # Vulgarity AI check + push run in background so the message reaches the receiver instantly
    asyncio.create_task(_after_message_sent(
        message_dict["id"], message_data.match_id, message_data.sender_id, message_data.receiver_id,
        sender.get("name", "Someone"), original_content, message_data.content,
        needs_ai_safety=not is_ai_receiver and not receiver.get("auto_chat_enabled"),
        send_push=not is_ai_receiver and sender_not_muted))
    
    # === AI CHATBOT: If receiver is an AI profile, generate auto-reply ===
    if receiver.get("is_ai_profile") and receiver.get("is_active_ai"):
        asyncio.create_task(
            handle_ai_message(
                db, manager, message_data.match_id,
                message_data.sender_id, receiver,
                message_data.content, sender.get("name", "User")
            )
        )
    # === STEALTH AUTO-CHAT: Real account with AI replies (invisible) ===
    elif receiver.get("auto_chat_enabled") and not receiver.get("is_ai_profile"):
        asyncio.create_task(
            handle_stealth_auto_reply(
                db, manager, message_data.match_id,
                message_data.sender_id, receiver,
                message_data.content, sender.get("name", "User")
            )
        )
    
    # Update badge count for receiver
    asyncio.create_task(manager.send_badge_update(message_data.receiver_id))
    
    return clean_message

_fcm_throttle: Dict[str, float] = {}


async def _after_message_sent(message_id, match_id, sender_id, receiver_id, sender_name, original_content, content,
                              needs_ai_safety: bool, send_push: bool):
    """Background: retract the message if AI flags it as vulgar, otherwise push-notify the receiver."""
    try:
        flagged = False
        if needs_ai_safety:
            try:
                flagged = await asyncio.wait_for(handle_creepy_detection(db, sender_id, receiver_id, match_id, original_content, ws_manager=manager), 4)
            except asyncio.TimeoutError:
                logging.warning("creepy check timeout — delivering push")
        if flagged:
            await db.messages.update_one({"id": message_id}, {"$set": {"is_deleted_for_all": True, "content": "This message was deleted"}})
            for uid in (receiver_id, sender_id):
                await manager.send_message(uid, {"type": "message_deleted", "message_id": message_id, "deleted_for_all": True})
            return
        if not send_push:
            return
        import time as _time
        key = f"{sender_id}_{receiver_id}"
        now_ts = _time.time()
        if now_ts - _fcm_throttle.get(key, 0) > 10:
            _fcm_throttle[key] = now_ts
            asyncio.create_task(_send_push_to_user(
                user_id=receiver_id, title=sender_name, message=content[:100],
                data={"type": "message", "action": "open_chat", "match_id": match_id, "route": f"/chat/{match_id}"}))
        await create_in_app_notification(
            receiver_id, f"New message from {sender_name}", content[:100], "message",
            {"match_id": match_id, "sender_id": sender_id, "action": "open_chat", "route": f"/chat/{match_id}"})
    except Exception as e:
        logging.error(f"after_message_sent error: {e}")


# WebSocket for real-time chat
async def _ack_message(message_id: str, match_id: str, sender_id: str, receiver_id: str, ai_receiver: bool = False):
    """Delivered tick when receiver online (or AI); AI 'reads' after a short delay."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        persona = None
        if ai_receiver:
            persona = await db.users.find_one({"id": receiver_id}, {"_id": 0, "is_ai_profile": 1, "online_hours": 1})
        if persona and persona.get("is_ai_profile"):
            # AI persona: delivered only while she's "online"; seen/read handled by handle_ai_message
            if ai_online_now(persona):
                await db.messages.update_one({"id": message_id}, {"$set": {"delivered": True, "delivered_at": now}})
                await manager.send_message(sender_id, {"type": "message_delivered", "message_id": message_id, "match_id": match_id})
            return
        if ai_receiver or receiver_id in manager.active_connections:
            await db.messages.update_one({"id": message_id}, {"$set": {"delivered": True, "delivered_at": now}})
            await manager.send_message(sender_id, {"type": "message_delivered", "message_id": message_id, "match_id": match_id})
        if ai_receiver:
            await asyncio.sleep(random.uniform(2, 5))
            await db.messages.update_many(
                {"match_id": match_id, "receiver_id": receiver_id, "read": {"$ne": True}},
                {"$set": {"read": True, "delivered": True, "read_at": datetime.now(timezone.utc).isoformat()}})
            await manager.send_message(sender_id, {"type": "messages_read", "match_id": match_id, "read_by": receiver_id})
    except Exception as e:
        logging.error(f"ack_message error: {e}")


async def _deliver_pending(user_id: str):
    """User came online: mark their pending incoming messages delivered and notify senders."""
    try:
        pending = await db.messages.aggregate([
            {"$match": {"receiver_id": user_id, "delivered": {"$ne": True}}},
            {"$group": {"_id": {"m": "$match_id", "s": "$sender_id"}}},
        ]).to_list(500)
        if not pending:
            return
        await db.messages.update_many(
            {"receiver_id": user_id, "delivered": {"$ne": True}},
            {"$set": {"delivered": True, "delivered_at": datetime.now(timezone.utc).isoformat()}})
        for p in pending:
            await manager.send_message(p["_id"]["s"], {"type": "message_delivered", "match_id": p["_id"]["m"], "all": True})
    except Exception as e:
        logging.error(f"deliver_pending error: {e}")


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
    asyncio.create_task(_deliver_pending(user_id))
    
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
                now_iso = datetime.now(timezone.utc).isoformat()
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"last_active": now_iso, "is_online": True}}
                )
                # Send pong back so client can detect zombie connections
                try:
                    await websocket.send_json({"type": "pong"})
                except Exception:
                    pass
                # Every ~2 min (5th ping), broadcast last_active to connected matched users
                ping_count = getattr(websocket, '_ping_count', 0) + 1
                websocket._ping_count = ping_count
                if ping_count % 5 == 0:
                    for cid in list(manager.active_connections.keys()):
                        if cid != user_id:
                            try:
                                await manager.send_message(cid, {
                                    "type": "status_update",
                                    "user_id": user_id,
                                    "is_online": True,
                                    "last_active": now_iso
                                })
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
            
            # Block social media links/handles — silently drop, no warning
            blocked, block_reason = await _check_social_block(message_data["match_id"], message_data["content"])
            if blocked:
                continue
            
            # ── GIRLS SAFETY CHECKS (skip for AI profiles) ──
            receiver_for_safety = await db.users.find_one({"id": message_data["receiver_id"]}, {"_id": 0, "is_ai_profile": 1, "auto_chat_enabled": 1})
            is_ai_receiver = receiver_for_safety and (receiver_for_safety.get("is_ai_profile") or receiver_for_safety.get("auto_chat_enabled"))
            if receiver_for_safety and receiver_for_safety.get("is_ai_profile"):
                ws_sender = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "is_premium": 1, "premium_pass_until": 1, "gender": 1})
                if ws_sender and not await _consume_ai_msg(ws_sender):
                    await manager.send_message(user_id, {"type": "ai_chat_limit", "match_id": message_data["match_id"],
                                                         "content": message_data.get("content", "")})
                    continue
            
            if not is_ai_receiver:
                # 1. Safe Word check (girl types emergency keyword → instant block + report)
                safe_word_triggered = await check_safe_word(
                    db, user_id, message_data["receiver_id"], message_data["match_id"],
                    message_data["content"], ws_manager=manager
                )
                if safe_word_triggered:
                    continue
                
                # 2. Night Mode Safety (11pm-6am IST, new matches only)
                night_blocked, _ = await check_night_mode_block(
                    db, user_id, message_data["receiver_id"], message_data["match_id"]
                )
                if night_blocked:
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
            asyncio.create_task(_ack_message(message_dict["id"], message_data["match_id"], user_id,
                                             message_data["receiver_id"], bool(is_ai_receiver)))
            
            # Fetch receiver/sender (no photos — keeps the socket loop fast)
            light = {"_id": 0, "photos": 0, "profile_picture": 0, "password_hash": 0}
            receiver = await db.users.find_one({"id": message_data["receiver_id"]}, light)
            sender = await db.users.find_one({"id": user_id}, light)
            
            # Vulgarity check (may retract) + push notification, in background — same as HTTP path
            if receiver and sender:
                asyncio.create_task(_after_message_sent(
                    message_dict["id"], message_data["match_id"], user_id, message_data["receiver_id"],
                    sender.get("name", "Someone"), message_data["content"], message_data["content"],
                    needs_ai_safety=not is_ai_receiver,
                    send_push=not is_ai_receiver and user_id not in (receiver.get("muted_users") or [])))
            
            # AI Chatbot: If receiver is AI, generate auto-reply
            if receiver and receiver.get("is_ai_profile") and receiver.get("is_active_ai"):
                asyncio.create_task(
                    handle_ai_message(
                        db, manager, message_data["match_id"],
                        user_id, receiver,
                        message_data["content"], sender.get("name", "User") if sender else "User"
                    )
                )
            # Stealth Auto-Chat: Real account with AI replies (invisible)
            elif receiver and receiver.get("auto_chat_enabled") and not receiver.get("is_ai_profile"):
                asyncio.create_task(
                    handle_stealth_auto_reply(
                        db, manager, message_data["match_id"],
                        user_id, receiver,
                        message_data["content"], sender.get("name", "User") if sender else "User"
                    )
                )
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
        if user_id in manager.active_connections:
            return  # a newer socket for this user is still live
        
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
        # One device = one account: stop pushes for accounts previously logged in on this phone
        await db.users.update_many({"fcm_token": request.fcm_token, "id": {"$ne": request.user_id}}, {"$set": {"fcm_token": None}})
        logger.info(f"FCM token registered for user {request.user_id}")
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
        "has_fcm_token": has_token,
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
    expected_secret = os.environ.get('ADMIN_SECRET_CODE')
    if not expected_secret or request.secret_code != expected_secret:
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
    
    if not is_user_premium(user):
        return {"viewers": [], "total_views": user.get("profile_views", 0), "is_premium": False}
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
async def admin_update_user(updates: AdminUserUpdate, admin: dict = Depends(require_admin)):
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
async def get_pending_intros(admin: dict = Depends(require_admin)):
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
async def get_high_risk_users(admin: dict = Depends(require_admin)):
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
    sort: str = "newest",
    admin: dict = Depends(require_admin)
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
        "is_permanently_banned": 1, "is_premium": 1, "premium_pass_until": 1, "is_admin": 1,
        "trust_badge_level": 1, "risk_score": 1, "created_at": 1,
        "last_active": 1, "total_matches": 1, "total_likes_received": 1,
        "selfie_verification_url": 1, "selfie_verification_status": 1,
        "auto_chat_enabled": 1, "custom_ai_persona": 1, "photos": 1
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
            "selfie_verification_status": u.get("selfie_verification_status", "none"),
            "auto_chat_enabled": u.get("auto_chat_enabled", False),
            "custom_ai_persona": u.get("custom_ai_persona", False),
            "photos": u.get("photos", [])
        } for u in users],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# === ADMIN: DASHBOARD STATS ===
@api_router.get("/admin/dashboard-stats")
async def get_dashboard_stats(response: Response, admin: dict = Depends(require_admin)):
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

# === ADMIN: TEST PUSH ===
@api_router.post("/admin/test-push")
async def admin_test_push(admin: dict = Depends(require_admin)):
    u = await db.users.find_one({"id": admin.get("id")}, {"_id": 0, "fcm_token": 1})
    if not u or not u.get("fcm_token"):
        raise HTTPException(status_code=400, detail="Aapke account ka device token nahi mila. Phone app mein login karke notification allow karein.")
    from fcm_service import send_fcm
    r = await asyncio.to_thread(send_fcm, u["fcm_token"], "HeartLink test", "Push notification sahi kaam kar raha hai", {"type": "test"})
    if not r.get("success"):
        raise HTTPException(status_code=502, detail=f"Push fail: {r.get('error')}")
    return {"message": "Test notification bhej diya, phone check karein"}


# === ADMIN: ACCOUNT DELETION REQUESTS ===
@api_router.get("/admin/deletion-requests")
async def admin_deletion_requests(admin: dict = Depends(require_admin)):
    return await db.deletion_requests.find({}, {"_id": 0}).sort("requested_at", -1).limit(200).to_list(None)


@api_router.post("/admin/deletion-requests/{request_id}/complete")
async def admin_complete_deletion(request_id: str, admin: dict = Depends(require_admin)):
    req = await db.deletion_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("status") == "completed":
        return {"message": "Already deleted"}
    if req.get("user_id") and await db.users.find_one({"id": req["user_id"]}, {"_id": 1}):
        await admin_delete_user(req["user_id"], admin)
    await db.deletion_requests.update_one({"id": request_id}, {"$set": {
        "status": "completed", "processed_at": datetime.now(timezone.utc).isoformat(), "processed_by": admin.get("email")}})
    return {"message": "Account deleted"}


# === ADMIN: DELETE USER ===
@api_router.delete("/admin/user/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
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
async def admin_block_user(user_id: str, permanent: bool = False, reason: str = "", admin: dict = Depends(require_admin)):
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
async def admin_unblock_user(user_id: str, admin: dict = Depends(require_admin)):
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
async def admin_reset_user_password(request: AdminResetPasswordRequest, admin: dict = Depends(require_admin)):
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


@api_router.post("/user/verify-selfie-ai")
async def verify_selfie_ai(request: Request):
    """AI-powered selfie verification — compares selfie with profile photo using Gemini vision."""
    data = await request.json()
    user_id = data.get("user_id")
    selfie_base64 = data.get("selfie_base64")
    
    if not user_id or not selfie_base64:
        raise HTTPException(status_code=400, detail="user_id and selfie_base64 required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get profile photo for comparison
    profile_photo = user.get("profile_picture") or (user.get("photos", []) or [None])[0]
    if not profile_photo:
        raise HTTPException(status_code=400, detail="No profile photo found. Please upload a profile photo first.")
    
    # Clean base64 data
    selfie_clean = selfie_base64
    if "," in selfie_clean:
        selfie_clean = selfie_clean.split(",", 1)[1]
    
    profile_clean = profile_photo
    if "," in profile_clean:
        profile_clean = profile_clean.split(",", 1)[1]
    
    # AI Face Comparison using Gemini Vision
    EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
    if not EMERGENT_KEY:
        # Fallback to manual review
        await db.users.update_one({"id": user_id}, {"$set": {
            "selfie_verification_url": f"data:image/jpeg;base64,{selfie_clean[:100]}...",
            "selfie_verification_status": "pending",
            "selfie_submitted_at": datetime.now(timezone.utc).isoformat()
        }})
        invalidate_user_cache(user_id)
        return {"status": "pending", "message": "Selfie submitted for manual review"}
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"face_verify_{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            system_message="""You are a face verification AI for a dating app. You compare two photos to determine if they show the SAME person.

RULES:
1. Compare facial features: eyes, nose, mouth shape, face shape, skin tone
2. Ignore: lighting, angle, makeup, glasses, background, expression
3. Be STRICT but fair — same person with different selfie angles should still match
4. Respond ONLY in JSON format

OUTPUT FORMAT:
{"match": true/false, "confidence": 0-100, "reason": "brief reason"}

- confidence >= 75: MATCH (same person)
- confidence 40-74: UNCERTAIN (needs manual review)
- confidence < 40: NO MATCH (different person)"""
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        
        # Send both images for comparison
        profile_img = ImageContent(image_base64=profile_clean)
        selfie_img = ImageContent(image_base64=selfie_clean)
        
        user_msg = UserMessage(
            text="Compare these two photos. Image 1 is the profile photo. Image 2 is the live selfie. Are they the same person? Respond in JSON only.",
            file_contents=[profile_img, selfie_img]
        )
        
        response = await chat.send_message(user_msg)
        resp_text = str(response).strip()
        
        # Parse JSON response
        import json as json_module
        start = resp_text.find('{')
        end = resp_text.rfind('}') + 1
        if start >= 0 and end > start:
            result = json_module.loads(resp_text[start:end])
        else:
            result = {"match": False, "confidence": 0, "reason": "AI response parse failed"}
        
        is_match = result.get("match", False)
        confidence = result.get("confidence", 0)
        reason = result.get("reason", "")
        
        now = datetime.now(timezone.utc).isoformat()
        
        if confidence >= 75 and is_match:
            # AUTO-VERIFY: High confidence match
            await db.users.update_one({"id": user_id}, {"$set": {
                "selfie_verification_status": "verified",
                "verified": True,
                "verification_status": "verified",
                "trust_badge_level": "high",
                "selfie_verified_at": now,
                "selfie_submitted_at": now,
                "selfie_ai_confidence": confidence,
                "selfie_ai_reason": reason,
            }})
            invalidate_user_cache(user_id)
            return {"status": "verified", "confidence": confidence, "message": "Verification successful! You are now verified."}
        
        elif confidence >= 40:
            # UNCERTAIN: Send to admin for manual review
            await db.users.update_one({"id": user_id}, {"$set": {
                "selfie_verification_status": "pending",
                "selfie_submitted_at": now,
                "selfie_ai_confidence": confidence,
                "selfie_ai_reason": reason,
                "selfie_verification_url": f"data:image/jpeg;base64,{selfie_clean}",
            }})
            invalidate_user_cache(user_id)
            return {"status": "pending", "confidence": confidence, "message": "Selfie submitted. Under review — you'll be notified soon."}
        
        else:
            # NO MATCH: Reject
            await db.users.update_one({"id": user_id}, {"$set": {
                "selfie_verification_status": "rejected",
                "selfie_submitted_at": now,
                "selfie_ai_confidence": confidence,
                "selfie_ai_reason": reason,
            }})
            invalidate_user_cache(user_id)
            return {"status": "rejected", "confidence": confidence, "message": "Selfie doesn't match your profile photo. Please try again with a clear face selfie."}
    
    except Exception as e:
        logging.error(f"AI selfie verification failed: {e}")
        # Fallback to manual review on AI failure
        await db.users.update_one({"id": user_id}, {"$set": {
            "selfie_verification_status": "pending",
            "selfie_submitted_at": datetime.now(timezone.utc).isoformat(),
            "selfie_verification_url": f"data:image/jpeg;base64,{selfie_clean}",
        }})
        invalidate_user_cache(user_id)
        return {"status": "pending", "message": "Selfie submitted for review."}

@api_router.get("/admin/pending-verifications")
async def get_pending_verifications(admin: dict = Depends(require_admin)):
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
async def admin_verify_selfie(data: VerifySelfieRequest, admin: dict = Depends(require_admin)):
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
        
        # Send notification via FCM
        try:
            await fcm_service.send_to_user(db, 
                user_id=data.user_id,
                title="Selfie Verification Not Approved",
                message=f"Reason: {data.reason}" if data.reason else "Please try again with a clearer selfie."
            )
        except Exception as e:
            logger.error(f"Selfie rejection notification failed: {e}")
        
        invalidate_user_cache(data.user_id)
        return {"message": "Selfie verification rejected", "reason": data.reason}
    
    raise HTTPException(status_code=400, detail="Invalid action")


@api_router.get("/admin/verified-users")
async def get_verified_users(page: int = 1, limit: int = 20, admin: dict = Depends(require_admin)):
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
async def admin_request_reverify(data: ReVerifyRequest, admin: dict = Depends(require_admin)):
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
async def get_pending_profiles(page: int = 1, limit: int = 20, admin: dict = Depends(require_admin)):
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
async def get_profile_approval_stats(admin: dict = Depends(require_admin)):
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
async def admin_approve_profile(data: ProfileApprovalRequest, admin: dict = Depends(require_admin)):
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
async def bulk_approve_profiles(user_ids: List[str], admin: dict = Depends(require_admin)):
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
async def send_bulk_notification(data: BulkNotificationRequest, admin: dict = Depends(require_admin)):
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
async def get_fcm_status(admin: dict = Depends(require_admin)):
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
async def fcm_debug(admin: dict = Depends(require_admin)):
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
async def send_test_to_specific_user(email: str, admin: dict = Depends(require_admin)):
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
async def send_notification_all_methods(data: AdminNotificationWithEmail, admin: dict = Depends(require_admin)):
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
    if False and data.send_email:  # bulk email to all users disabled (transactional-only email policy)
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
async def get_all_notification_templates(admin: dict = Depends(require_admin)):
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
async def get_custom_templates(admin: dict = Depends(require_admin)):
    """Get only custom templates from database"""
    templates = await db.notification_templates.find(
        {},
        {"_id": 0}
    ).to_list(None)
    return templates


@api_router.post("/admin/notification-templates")
async def create_notification_template(template: NotificationTemplateCreate, admin: dict = Depends(require_admin)):
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
async def update_notification_template(template_id: str, template: NotificationTemplateCreate, admin: dict = Depends(require_admin)):
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
async def delete_notification_template(template_id: str, admin: dict = Depends(require_admin)):
    """Delete a custom notification template"""
    result = await db.notification_templates.delete_one({"id": template_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"success": True, "message": "Template deleted"}

@api_router.get("/admin/notification-history")
async def get_notification_history(limit: int = 20, admin: dict = Depends(require_admin)):
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
async def schedule_notification(data: ScheduledNotificationRequest, admin: dict = Depends(require_admin)):
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
async def get_scheduled_notifications(admin: dict = Depends(require_admin)):
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
async def cancel_scheduled_notification(notification_id: str, admin: dict = Depends(require_admin)):
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
    """Get user's subscription status with all states."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_premium_flag = user.get("is_premium", False)
    sub_status = user.get("subscription_status", "none")
    
    # Female users are ALWAYS premium — no subscription needed
    if user.get("gender", "").lower() == "female":
        is_premium_flag = True
        sub_status = sub_status if sub_status != "none" else "girls_free"
    
    # Live expiry check (only for non-female paid users)
    if is_premium_flag and user.get("premium_end") and user.get("gender", "").lower() != "female":
        try:
            end_date = datetime.fromisoformat(user["premium_end"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > end_date:
                await db.users.update_one({"id": user_id}, {"$set": {"is_premium": False, "subscription_status": "expired"}})
                invalidate_user_cache(user_id)
                is_premium_flag = False
                sub_status = "expired"
        except Exception:
            pass
    
    return {
        "user_id": user_id,
        "is_premium": is_premium_flag,
        "subscription_status": sub_status,
        "plan": user.get("premium_plan"),
        "product_id": user.get("subscription_product_id"),
        "base_plan_id": user.get("subscription_base_plan_id"),
        "started_at": user.get("premium_start"),
        "expires_at": user.get("premium_end"),
        "purchase_source": user.get("premium_source", "unknown"),
        "auto_renew_enabled": user.get("auto_renew_enabled"),
        "last_verified_at": user.get("last_verified_at"),
        "features": {
            "no_ads": is_premium_flag,
            "unlimited_swipes": is_premium_flag,
            "see_who_liked": is_premium_flag,
            "profile_boost": is_premium_flag,
            "super_likes": is_premium_flag,
            "rewind": is_premium_flag,
        }
    }


@api_router.post("/subscription/google-play/verify")
async def verify_google_play_purchase(request: Request):
    """
    Verify Google Play purchase and activate premium.
    Product: heartlink_premium_monthly | Plan: monthly | Offer: trial3days
    """
    data = await request.json()
    user_id = data.get("user_id")
    product_id = data.get("product_id", "heartlink_premium_monthly")
    purchase_token = data.get("purchase_token")
    transaction_id = data.get("transaction_id")
    base_plan_id = data.get("base_plan_id", "monthly")
    offer_id = data.get("offer_id", "")
    
    if not user_id or not purchase_token:
        raise HTTPException(status_code=400, detail="user_id and purchase_token required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Idempotent — don't charge twice
    existing = await db.subscription_orders.find_one({"purchase_token": purchase_token, "status": "completed"})
    if existing:
        return {"success": True, "message": "Purchase already verified", "is_premium": True, "subscription_status": existing.get("subscription_status", "active"), "expires_at": existing.get("expires_at")}
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Determine trial vs paid based on offer_id
    is_trial = offer_id == "trial3days" or (not await db.subscription_orders.find_one({"user_id": user_id, "status": "completed", "source": "google_play"}))
    sub_status = "trialing" if is_trial else "active"
    
    subscription_days = 30
    expiry = (datetime.now(timezone.utc) + timedelta(days=subscription_days)).isoformat()
    trial_end = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat() if is_trial else None
    
    order_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "product_id": product_id,
        "base_plan_id": base_plan_id,
        "offer_id": offer_id,
        "purchase_token": purchase_token,
        "transaction_id": transaction_id,
        "source": "google_play",
        "status": "completed",
        "subscription_status": sub_status,
        "currency": "INR",
        "is_trial": is_trial,
        "trial_end": trial_end,
        "created_at": now,
        "verified_at": now,
        "expires_at": expiry,
        "auto_renew_enabled": True,
    }
    await db.subscription_orders.insert_one(order_doc)
    
    await db.users.update_one({"id": user_id}, {"$set": {
        "is_premium": True,
        "premium_plan": "monthly",
        "premium_source": "google_play",
        "premium_start": now,
        "premium_end": expiry,
        "subscription_status": sub_status,
        "subscription_product_id": product_id,
        "subscription_base_plan_id": base_plan_id,
        "purchase_token": purchase_token,
        "last_verified_at": now,
        "auto_renew_enabled": True,
        "premium_features": ["unlimited_swipes", "no_ads", "see_who_liked", "super_likes", "boost", "rewind"],
        "grace_notif_sent": False,
        "winback_sent": False,
    }})
    
    invalidate_user_cache(user_id)
    logging.info(f"Premium activated for {user.get('name', user_id)} via Google Play ({'trial' if is_trial else 'paid'})")
    
    return {
        "success": True,
        "is_premium": True,
        "subscription_status": "trialing" if is_trial else "active",
        "is_trial": is_trial,
        "trial_end": trial_end,
        "expires_at": expiry,
        "message": "Premium activated! Welcome to HeartLink Premium." if not is_trial else "3-day free trial started! Enjoy HeartLink Premium."
    }


@api_router.post("/subscription/cancel/{user_id}")
async def cancel_subscription(user_id: str):
    """Mark subscription as cancelled (user cancels from Play Store, this handles backend state)."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"id": user_id}, {"$set": {
        "subscription_status": "cancelled",
    }})
    invalidate_user_cache(user_id)
    
    return {"success": True, "message": "Subscription cancelled. Premium remains until expiry date."}


# ═══════════════════════════════════════════════════════════════
# GOOGLE PLAY RTDN — Real-Time Developer Notifications Webhook
# ═══════════════════════════════════════════════════════════════

# Notification type mapping
SUBSCRIPTION_NOTIF_TYPES = {
    1: "recovered",        # Recovered from account hold
    2: "renewed",          # Subscription renewed
    3: "canceled",         # Subscription cancelled
    4: "purchased",        # New purchase
    5: "on_hold",          # Account hold (payment failed)
    6: "in_grace_period",  # Grace period (payment retrying)
    7: "restarted",        # Restarted from cancelled/paused
    8: "price_change_confirmed",
    9: "deferred",
    10: "paused",
    11: "pause_schedule_changed",
    12: "revoked",         # Refunded/revoked
    13: "expired",         # Subscription expired
}

@api_router.post("/webhooks/google-play")
async def google_play_rtdn_webhook(request: Request):
    """
    Google Play RTDN webhook via Pub/Sub push subscription.
    Receives subscription state changes and updates user premium status.
    Returns 200 immediately to prevent Pub/Sub retry loops.
    """
    try:
        body = await request.json()
        message = body.get("message", {})
        message_id = message.get("messageId", "")
        
        # Deduplicate by messageId
        if message_id:
            existing = await db.rtdn_logs.find_one({"message_id": message_id})
            if existing:
                return Response(status_code=200)
        
        # Decode base64 payload
        encoded_data = message.get("data", "")
        if not encoded_data:
            return Response(status_code=200)
        
        decoded = json.loads(base64.b64decode(encoded_data).decode("utf-8"))
        package_name = decoded.get("packageName", "")
        
        sub_notif = decoded.get("subscriptionNotification")
        if not sub_notif:
            # Not a subscription notification (could be test or voided purchase)
            return Response(status_code=200)
        
        purchase_token = sub_notif.get("purchaseToken", "")
        notif_type = sub_notif.get("notificationType", 0)
        subscription_id = sub_notif.get("subscriptionId", "")
        
        type_name = SUBSCRIPTION_NOTIF_TYPES.get(notif_type, f"unknown_{notif_type}")
        now = datetime.now(timezone.utc).isoformat()
        
        # Log the notification
        log_doc = {
            "message_id": message_id,
            "package_name": package_name,
            "subscription_id": subscription_id,
            "purchase_token": purchase_token,
            "notification_type": notif_type,
            "type_name": type_name,
            "raw_data": decoded,
            "processed_at": now,
        }
        await db.rtdn_logs.insert_one(log_doc)
        
        # Find user by purchase_token
        user = await db.users.find_one({"purchase_token": purchase_token})
        if not user:
            # Try finding via subscription_orders
            order = await db.subscription_orders.find_one({"purchase_token": purchase_token})
            if order:
                user = await db.users.find_one({"id": order["user_id"]})
        
        if not user:
            logging.warning(f"RTDN: No user found for purchase_token {purchase_token[:20]}...")
            return Response(status_code=200)
        
        user_id = user["id"]
        update_fields = {"last_verified_at": now}
        
        # Handle each notification type
        if notif_type in (1, 2, 4, 7):
            # RECOVERED, RENEWED, PURCHASED, RESTARTED → activate premium
            update_fields["is_premium"] = True
            update_fields["subscription_status"] = "active"
            update_fields["premium_end"] = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            update_fields["auto_renew_enabled"] = True
            if notif_type == 4:
                update_fields["premium_start"] = now
                update_fields["premium_source"] = "google_play"
            logging.info(f"RTDN: {type_name} — Premium activated for {user.get('name', user_id)}")
        
        elif notif_type == 3:
            # CANCELED → keep premium until expiry, mark cancelled
            update_fields["subscription_status"] = "cancelled"
            update_fields["auto_renew_enabled"] = False
            logging.info(f"RTDN: cancelled — {user.get('name', user_id)} (premium until expiry)")
        
        elif notif_type == 5:
            # ON_HOLD → payment failed, pause premium
            update_fields["is_premium"] = False
            update_fields["subscription_status"] = "on_hold"
            logging.info(f"RTDN: on_hold — Premium paused for {user.get('name', user_id)}")
        
        elif notif_type == 6:
            # IN_GRACE_PERIOD → keep premium, payment retrying
            update_fields["subscription_status"] = "in_grace_period"
            update_fields["is_premium"] = True
            logging.info(f"RTDN: grace_period — {user.get('name', user_id)}")
        
        elif notif_type == 10:
            # PAUSED → user paused subscription
            update_fields["subscription_status"] = "paused"
            update_fields["auto_renew_enabled"] = False
            logging.info(f"RTDN: paused — {user.get('name', user_id)}")
        
        elif notif_type in (12, 13):
            # REVOKED or EXPIRED → remove premium
            update_fields["is_premium"] = False
            update_fields["subscription_status"] = "expired" if notif_type == 13 else "revoked"
            update_fields["premium_expired_at"] = now
            update_fields["grace_notif_sent"] = False
            update_fields["winback_sent"] = False
            logging.info(f"RTDN: {type_name} — Premium removed for {user.get('name', user_id)}")
        
        await db.users.update_one({"id": user_id}, {"$set": update_fields})
        invalidate_user_cache(user_id)
        
    except Exception as e:
        logging.error(f"RTDN webhook error: {e}")
    
    # Always return 200 to prevent Pub/Sub retries
    return Response(status_code=200)


@api_router.get("/admin/premium-analytics")
async def get_premium_analytics(admin: dict = Depends(require_admin)):
    """Admin: Premium subscription analytics."""
    total_premium = await db.users.count_documents({"is_premium": True})
    google_play = await db.users.count_documents({"is_premium": True, "premium_source": "google_play"})
    girls_free = await db.users.count_documents({"is_premium": True, "premium_source": "girls_free_signup"})
    trialing = await db.users.count_documents({"subscription_status": "trialing"})
    active = await db.users.count_documents({"subscription_status": "active"})
    cancelled = await db.users.count_documents({"subscription_status": "cancelled"})
    expired = await db.subscription_orders.count_documents({"status": "completed", "expires_at": {"$lt": datetime.now(timezone.utc).isoformat()}})
    
    total_users = await db.users.count_documents({"is_ai_profile": {"$ne": True}})
    conversion_rate = round((total_premium / max(total_users, 1)) * 100, 1)
    
    # Recent orders
    recent_orders = await db.subscription_orders.find(
        {"source": "google_play"},
        {"_id": 0, "user_id": 1, "amount": 1, "created_at": 1, "is_trial": 1, "subscription_status": 1}
    ).sort("created_at", -1).limit(20).to_list(None)
    
    # Revenue estimate (completed Google Play orders)
    paid_orders = await db.subscription_orders.count_documents({"source": "google_play", "status": "completed", "is_trial": False})
    estimated_revenue = paid_orders * 49
    
    return {
        "summary": {
            "total_premium": total_premium,
            "google_play": google_play,
            "girls_free_premium": girls_free,
            "trialing": trialing,
            "active_paid": active,
            "cancelled": cancelled,
            "expired": expired,
            "conversion_rate": conversion_rate,
            "total_users": total_users,
            "estimated_revenue_inr": estimated_revenue,
            "paid_orders": paid_orders,
        },
        "recent_orders": recent_orders,
    }


@api_router.get("/admin/revenue-trends")
async def get_revenue_trends(admin: dict = Depends(require_admin)):
    """Admin: Daily/weekly/monthly payment trends and conversion rates."""
    now = datetime.now(timezone.utc)
    
    # Last 30 days daily breakdown
    daily_data = []
    for days_ago in range(29, -1, -1):
        day = now - timedelta(days=days_ago)
        day_str = day.strftime("%Y-%m-%d")
        
        approved = await db.payment_requests.count_documents({
            "status": "approved",
            "created_at": {"$regex": f"^{day_str}"}
        })
        rejected = await db.payment_requests.count_documents({
            "status": "rejected",
            "created_at": {"$regex": f"^{day_str}"}
        })
        pending = await db.payment_requests.count_documents({
            "status": "pending",
            "created_at": {"$regex": f"^{day_str}"}
        })
        new_users = await db.users.count_documents({
            "is_ai_profile": {"$ne": True},
            "created_at": {"$regex": f"^{day_str}"}
        })
        
        daily_data.append({
            "date": day_str,
            "label": day.strftime("%d %b"),
            "approved": approved,
            "rejected": rejected,
            "pending": pending,
            "revenue": approved * 49,
            "new_users": new_users,
        })
    
    # Weekly summary (last 4 weeks)
    weekly_data = []
    for week in range(3, -1, -1):
        week_start = now - timedelta(weeks=week, days=now.weekday())
        week_end = week_start + timedelta(days=6)
        
        week_approved = 0
        week_new = 0
        for d in range(7):
            day = week_start + timedelta(days=d)
            day_str = day.strftime("%Y-%m-%d")
            week_approved += await db.payment_requests.count_documents({
                "status": "approved",
                "created_at": {"$regex": f"^{day_str}"}
            })
            week_new += await db.users.count_documents({
                "is_ai_profile": {"$ne": True},
                "created_at": {"$regex": f"^{day_str}"}
            })
        
        weekly_data.append({
            "week": f"W{4 - week}",
            "label": f"{week_start.strftime('%d %b')} - {week_end.strftime('%d %b')}",
            "approved": week_approved,
            "revenue": week_approved * 49,
            "new_users": week_new,
            "conversion": round((week_approved / max(week_new, 1)) * 100, 1),
        })
    
    # Totals
    total_approved = await db.payment_requests.count_documents({"status": "approved"})
    total_revenue = total_approved * 49
    today_str = now.strftime("%Y-%m-%d")
    today_revenue = await db.payment_requests.count_documents({"status": "approved", "created_at": {"$regex": f"^{today_str}"}})
    
    return {
        "daily": daily_data,
        "weekly": weekly_data,
        "totals": {
            "total_revenue": total_revenue,
            "total_approved": total_approved,
            "today_revenue": today_revenue * 49,
            "today_approved": today_revenue,
        }
    }


@api_router.get("/admin/version-analytics")
async def get_version_analytics(admin: dict = Depends(require_admin)):
    """Admin: User registrations grouped by app version."""
    now = datetime.now(timezone.utc)
    
    # Group all users by app_version
    version_pipeline = [
        {"$match": {"is_ai_profile": {"$ne": True}}},
        {"$group": {
            "_id": {"$ifNull": ["$app_version", "unknown"]},
            "count": {"$sum": 1},
            "first_signup": {"$min": "$registered_at"},
            "last_signup": {"$max": "$registered_at"},
        }},
        {"$sort": {"last_signup": -1}},
    ]
    version_data = await db.users.aggregate(version_pipeline).to_list(None)
    
    versions = []
    total_users = 0
    for v in version_data:
        ver = v["_id"] or "unknown"
        count = v["count"]
        total_users += count
        versions.append({
            "version": ver,
            "registrations": count,
            "first_signup": v.get("first_signup"),
            "last_signup": v.get("last_signup"),
        })
    
    # Daily registrations for current version (last 30 days)
    daily_current = []
    for days_ago in range(29, -1, -1):
        day = now - timedelta(days=days_ago)
        day_str = day.strftime("%Y-%m-%d")
        count = await db.users.count_documents({
            "is_ai_profile": {"$ne": True},
            "app_version": APP_VERSION,
            "registered_at": {"$regex": f"^{day_str}"},
        })
        daily_current.append({"date": day_str, "label": day.strftime("%d %b"), "count": count})
    
    # Today's signups per version
    today_str = now.strftime("%Y-%m-%d")
    today_pipeline = [
        {"$match": {"is_ai_profile": {"$ne": True}, "registered_at": {"$regex": f"^{today_str}"}}},
        {"$group": {"_id": {"$ifNull": ["$app_version", "unknown"]}, "count": {"$sum": 1}}},
    ]
    today_data = await db.users.aggregate(today_pipeline).to_list(None)
    today_by_version = {t["_id"]: t["count"] for t in today_data}
    
    return {
        "current_version": APP_VERSION,
        "current_version_code": APP_VERSION_CODE,
        "total_users": total_users,
        "versions": versions,
        "daily_current_version": daily_current,
        "today_by_version": today_by_version,
    }


# CORS - Allow all origins for web + Capacitor Android app
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

# ==================== FEEDBACK SYSTEM ====================

@api_router.post("/feedback/submit")
async def submit_feedback(request: Request):
    """Submit user feedback — bug reports, feature requests, payment issues, etc."""
    data = await request.json()
    user_id = data.get("user_id")
    category = data.get("category", "general")
    message = data.get("message", "").strip()
    
    if not user_id or not message:
        raise HTTPException(status_code=400, detail="User ID and message are required")
    if len(message) < 10:
        raise HTTPException(status_code=400, detail="Message must be at least 10 characters")
    if len(message) > 2000:
        raise HTTPException(status_code=400, detail="Message too long (max 2000 characters)")
    
    valid_categories = ["bug_report", "feature_suggestion", "payment_issue", "ad_experience", "general"]
    if category not in valid_categories:
        category = "general"
    
    # Rate limit: max 5 feedback per user per day
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    today_count = await db.feedback.count_documents({"user_id": user_id, "created_at": {"$gte": today_start}})
    if today_count >= 5:
        raise HTTPException(status_code=429, detail="Maximum 5 feedback submissions per day")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
    
    feedback_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user.get("name", "Unknown") if user else "Unknown",
        "user_email": user.get("email", "") if user else "",
        "category": category,
        "message": message,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "app_version": APP_VERSION,
    }
    await db.feedback.insert_one(feedback_doc)
    
    return {"success": True, "message": "Feedback submitted! We'll look into it.", "feedback_id": feedback_doc["id"]}


@api_router.get("/admin/feedback")
async def get_feedback(admin: dict = Depends(require_admin)):
    """Admin: View all user feedback."""
    feedback = await db.feedback.find({}).sort("created_at", -1).limit(100).to_list(None)
    for f in feedback:
        f.pop("_id", None)
    return feedback


# ==================== SECURITY HARDENING ====================

# Security headers middleware
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
    if not request.url.path.startswith("/api/photo/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
    return response

# IP-based rate limiter for auth endpoints (in-memory, resets on restart)
_auth_rate_limits = {}

async def check_auth_rate_limit(request: Request, limit: int = 10, window: int = 300):
    """Rate limit auth endpoints — max {limit} attempts per {window} seconds per IP."""
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{request.url.path}"
    now = datetime.now(timezone.utc).timestamp()
    
    if key not in _auth_rate_limits:
        _auth_rate_limits[key] = []
    
    # Clean old entries
    _auth_rate_limits[key] = [t for t in _auth_rate_limits[key] if now - t < window]
    
    if len(_auth_rate_limits[key]) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Please try again in {window // 60} minutes."
        )
    
    _auth_rate_limits[key].append(now)

# API key validation — reject requests with suspicious patterns
@app.middleware("http")
async def block_suspicious_requests(request, call_next):
    path = request.url.path.lower()
    # Block common attack paths
    blocked_patterns = [
        "/.env", "/wp-admin", "/wp-login", "/phpinfo", "/phpmyadmin",
        "/.git", "/config", "/backup", "/debug", "/actuator",
        "/eval", "/exec", "/$where", "/shell"
    ]
    for pattern in blocked_patterns:
        if pattern in path:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    
    # Block MongoDB injection in query params
    query = str(request.url.query).lower()
    if any(op in query for op in ["$where", "$regex", "$gt", "$lt", "$ne", "$or", "$and", "$exists"]):
        return JSONResponse(status_code=400, content={"detail": "Invalid request"})
    
    return await call_next(request)


# ADMIN: Complete Database Cleanup Endpoint (DANGEROUS - USE WITH CAUTION)


@api_router.post("/admin/clear-all-data")
async def clear_all_database_data(request: DatabaseClearRequest, admin: dict = Depends(require_admin)):
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
async def trigger_daily_notification(admin: dict = Depends(require_admin)):
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
async def get_daily_notification_status(admin: dict = Depends(require_admin)):
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
async def send_push_notification_api(data: PushNotificationRequest, admin: dict = Depends(require_admin)):
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
async def send_push_compat(data: PushNotificationRequest, admin: dict = Depends(require_admin)):
    """Backward-compatible endpoint — routes to FCM."""
    return await send_push_notification_api(data)

@api_router.post("/admin/push/send-to-user/{user_id}")
async def send_push_to_single_user(user_id: str, title: str = "HeartLink", message: str = "Test", admin: dict = Depends(require_admin)):
    """Send push to a specific user via FCM."""
    return await fcm_service.send_to_user(db, user_id, title, message)

@api_router.post("/admin/onesignal/send-to-user/{user_id}")
async def send_push_to_single_user_compat(user_id: str, title: str = "HeartLink", message: str = "Test", admin: dict = Depends(require_admin)):
    """Backward-compatible endpoint."""
    return await send_push_to_single_user(user_id, title, message)

@api_router.get("/admin/push/status")
async def get_push_status(admin: dict = Depends(require_admin)):
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
async def get_push_status_compat(admin: dict = Depends(require_admin)):
    """Backward-compatible endpoint."""
    return await get_push_status()

@api_router.post("/admin/push/test")
async def test_push(admin: dict = Depends(require_admin)):
    """Send a test notification to all users via FCM."""
    return await fcm_service.send_to_all(db, "HeartLink", "Push notification system is working!")

@api_router.post("/admin/onesignal/test")
async def test_push_compat(admin: dict = Depends(require_admin)):
    """Backward-compatible endpoint."""
    return await test_push()


# ==================== ENGAGEMENT NOTIFICATION ENDPOINTS ====================

@api_router.get("/admin/notifications/templates")
async def get_engagement_notification_templates(admin: dict = Depends(require_admin)):
    """Get all available engagement notification templates"""
    return {
        "templates": fcm_service.ENGAGEMENT_TEMPLATES,
        "template_keys": list(fcm_service.ENGAGEMENT_TEMPLATES.keys())
    }


@api_router.post("/admin/notifications/send-engagement")
async def send_engagement_to_users(
    template_key: str,
    user_ids: Optional[List[str]] = None,
    send_to_all: bool = False,
    admin: dict = Depends(require_admin)
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
async def get_inactive_users(days: int = 3, admin: dict = Depends(require_admin)):
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
async def send_notification_to_inactive_users(days: int = 3, admin: dict = Depends(require_admin)):
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
    action: str = "open_app",
    admin: dict = Depends(require_admin)
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
async def get_notification_stats(admin: dict = Depends(require_admin)):
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
async def get_notification_delivery_log(limit: int = 50, notification_type: str = "", admin: dict = Depends(require_admin)):
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
async def admin_get_ai_profiles(admin: dict = Depends(require_admin)):
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
async def admin_delete_ai_profile(profile_id: str, admin: dict = Depends(require_admin)):
    """Delete an AI profile and all related data."""
    success = await delete_ai_profile(db, profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="AI profile not found")
    return {"message": "AI profile deleted successfully"}

@api_router.put("/admin/ai-profiles/{profile_id}/toggle")
async def admin_toggle_ai_profile(profile_id: str, data: dict, admin: dict = Depends(require_admin)):
    """Enable or disable an AI profile."""
    is_active = data.get("is_active", True)
    success = await toggle_ai_profile(db, profile_id, is_active)
    if not success:
        raise HTTPException(status_code=404, detail="AI profile not found")
    return {"message": f"AI profile {'activated' if is_active else 'deactivated'}", "is_active": is_active}

@api_router.post("/admin/ai-profiles/reseed")
async def admin_reseed_ai_profiles(admin: dict = Depends(require_admin)):
    """Re-seed AI profiles (updates existing, creates missing)."""
    await seed_ai_profiles(db)
    return {"message": "AI profiles re-seeded successfully"}


@api_router.post("/admin/ai-profiles/generate-photos")
async def admin_generate_ai_photos(request: Request, admin: dict = Depends(require_admin)):
    """Batch generate photos for all AI profiles. Runs in background."""
    data = await request.json() if request.headers.get("content-type") == "application/json" else {}
    num_photos = data.get("photos_per_profile", 3)
    
    # Run in background — this takes a long time
    asyncio.create_task(batch_generate_ai_photos(db, num_photos_per_profile=num_photos))
    
    total_ai = await db.users.count_documents({"is_ai_profile": True, "is_active_ai": True})
    return {
        "message": f"Photo generation started for {total_ai} AI profiles ({num_photos} photos each). Running in background.",
        "total_profiles": total_ai,
        "photos_per_profile": num_photos,
    }


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
async def get_feature_flags(admin: dict = Depends(require_admin)):
    """Get all feature flags (always merged with defaults)"""
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if not flags:
        flags = {**DEFAULT_FEATURE_FLAGS, "type": "feature_flags"}
        await db.app_settings.insert_one(flags)
    # Always merge defaults so newly added flags are visible
    merged = {**DEFAULT_FEATURE_FLAGS, **{k: v for k, v in flags.items() if k != "type"}}
    return merged

@api_router.get("/admin/ai-photos")
async def admin_list_ai_photos(request: Request, pending_only: bool = False, admin: dict = Depends(require_admin)):
    import ai_chatbot as ac
    q = {"is_ai_profile": True, "is_active_ai": True}
    if pending_only:
        q["photos_approved"] = {"$ne": True}
    users = await find_users_light(q, ["id", "name", "age", "photos", "profile_picture", "photos_approved", "last_story_photo_at"])
    users.sort(key=lambda u: (bool(u.get("photos_approved")), u.get("name", "")))
    out = slim_photos(users, request)
    for u in out:
        u["busy"] = [int(k.split(":")[1]) for k in ac._photo_redo_busy if k.startswith(u["id"] + ":")]
    cfg = await db.app_settings.find_one({"type": "ai_story_photos"}, {"_id": 0}) or {}
    return {"profiles": out, "story": {"enabled": cfg.get("enabled", False), "every_days": cfg.get("every_days", 4)}}


@api_router.post("/admin/ai-photos/{profile_id}/approve")
async def admin_approve_ai_photos(profile_id: str, admin: dict = Depends(require_admin)):
    r = await db.users.update_one({"id": profile_id, "is_ai_profile": True}, {"$set": {"photos_approved": True}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="AI profile not found")
    return {"success": True}


@api_router.post("/admin/ai-photos/{profile_id}/{index}/redo")
async def admin_redo_ai_photo(profile_id: str, index: int, admin: dict = Depends(require_admin)):
    import ai_chatbot as ac
    if not 0 <= index <= 5:
        raise HTTPException(status_code=400, detail="Invalid photo index")
    if not await db.users.find_one({"id": profile_id, "is_ai_profile": True}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="AI profile not found")
    asyncio.create_task(ac.redo_single_photo(db, profile_id, index))
    return {"started": True}


@api_router.post("/admin/ai-photos/{profile_id}/{index}/main")
async def admin_set_main_ai_photo(profile_id: str, index: int, admin: dict = Depends(require_admin)):
    u = await db.users.find_one({"id": profile_id, "is_ai_profile": True}, {"_id": 0, "photos": 1})
    if not u or not 0 <= index < len(u.get("photos") or []):
        raise HTTPException(status_code=404, detail="Photo not found")
    photos = u["photos"]
    photos.insert(0, photos.pop(index))
    await db.users.update_one({"id": profile_id}, {"$set": {"photos": photos, "profile_picture": photos[0]}})
    return {"success": True}


@api_router.delete("/admin/ai-photos/{profile_id}/{index}")
async def admin_delete_ai_photo(profile_id: str, index: int, admin: dict = Depends(require_admin)):
    u = await db.users.find_one({"id": profile_id, "is_ai_profile": True}, {"_id": 0, "photos": 1, "profile_picture": 1})
    photos = list((u or {}).get("photos") or [])
    if not 0 <= index < len(photos):
        raise HTTPException(status_code=404, detail="Photo not found")
    if len(photos) == 1:
        raise HTTPException(status_code=400, detail="Aakhri photo delete nahi ho sakti — Redo karo")
    removed = photos.pop(index)
    upd = {"photos": photos}
    if u.get("profile_picture") == removed:
        upd["profile_picture"] = photos[0]
    await db.users.update_one({"id": profile_id}, {"$set": upd})
    return {"success": True}


@api_router.put("/admin/ai-story-photos")
async def admin_update_story_photos(data: dict, admin: dict = Depends(require_admin)):
    try:
        every = int(data.get("every_days", 4))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="every_days 1-30")
    if not 1 <= every <= 30:
        raise HTTPException(status_code=400, detail="every_days 1-30")
    cfg = {"enabled": bool(data.get("enabled")), "every_days": every}
    await db.app_settings.update_one({"type": "ai_story_photos"}, {"$set": cfg}, upsert=True)
    return cfg


async def ai_story_photo_loop():
    """Every 3h: a few AI girls whose photo is older than `every_days` post a fresh casual photo."""
    import ai_chatbot as ac
    await asyncio.sleep(300)
    while True:
        try:
            cfg = await db.app_settings.find_one({"type": "ai_story_photos"}, {"_id": 0}) or {}
            if cfg.get("enabled"):
                cutoff = (datetime.now(timezone.utc) - timedelta(days=cfg.get("every_days", 4))).isoformat()
                due = await db.users.find(
                    {"is_ai_profile": True, "is_active_ai": True,
                     "$or": [{"last_story_photo_at": {"$exists": False}}, {"last_story_photo_at": {"$lt": cutoff}}]},
                    {"_id": 0, "id": 1, "name": 1, "age": 1, "location": 1}).to_list(200)
                for p in random.sample(due, min(3, len(due))):
                    if await ac.post_story_photo(db, p):
                        logging.info(f"AI story photo posted for {p['name']}")
                    await asyncio.sleep(5)
        except Exception as e:
            logging.error(f"AI story photo loop error: {e}")
        await asyncio.sleep(3 * 3600)


@api_router.post("/admin/ai-profiles/regenerate-photos")
async def admin_regenerate_ai_photos(data: dict, admin: dict = Depends(require_admin)):
    """Replace AI persona photos with natural, varied phone-style photos (background job)."""
    import ai_chatbot as ac
    if ac._photo_regen_status["running"]:
        return {"started": False, **ac._photo_regen_status}
    n = max(1, min(int(data.get("photos_per_profile", 2)), 4))
    ids = data.get("profile_ids") or None
    asyncio.create_task(ac.regenerate_natural_photos(db, n, ids))
    return {"started": True, "photos_per_profile": n}


@api_router.get("/admin/ai-profiles/regenerate-photos/status")
async def admin_regenerate_ai_photos_status(admin: dict = Depends(require_admin)):
    import ai_chatbot as ac
    return ac._photo_regen_status


@api_router.put("/admin/ai-profiles/{profile_id}/schedule")
async def update_ai_profile_schedule(profile_id: str, data: dict, admin: dict = Depends(require_admin)):
    """Per-persona reply speed (minutes) and online hours (IST, 0-23). Null values = use defaults."""
    def num(v, lo, hi, name):
        if v is None or v == "":
            return None
        try:
            v = float(v)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"Invalid {name}")
        if not lo <= v <= hi:
            raise HTTPException(status_code=400, detail=f"{name} {lo}-{hi} ke beech hona chahiye")
        return v
    rmin = num(data.get("reply_delay_min"), 0.1, 180, "reply_delay_min")
    rmax = num(data.get("reply_delay_max"), 0.1, 180, "reply_delay_max")
    if (rmin is None) != (rmax is None) or (rmin is not None and rmin > rmax):
        raise HTTPException(status_code=400, detail="Reply min aur max dono do, aur min <= max")
    start = num(data.get("online_start"), 0, 23, "online_start")
    end = num(data.get("online_end"), 0, 23, "online_end")
    if (start is None) != (end is None):
        raise HTTPException(status_code=400, detail="Online start aur end dono do")
    online_hours = {"start": int(start), "end": int(end)} if start is not None else None
    res = await db.users.update_one(
        {"id": profile_id, "is_ai_profile": True},
        {"$set": {"reply_delay_min": rmin, "reply_delay_max": rmax, "online_hours": online_hours}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="AI profile not found")
    online = ai_online_now({"online_hours": online_hours})
    upd = {"is_online": online, **({"last_active": datetime.now(timezone.utc).isoformat()} if online else {})}
    await db.users.update_one({"id": profile_id}, {"$set": upd})
    return {"reply_delay_min": rmin, "reply_delay_max": rmax, "online_hours": online_hours, "is_online": online}


@api_router.get("/feature-flags/public")
async def get_public_feature_flags():
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0}) or {}
    return {"crush_feature": bool(flags.get("crush_feature", False))}


@api_router.get("/admin/ai-prompts")
async def get_ai_prompts(admin: dict = Depends(require_admin)):
    import ai_chatbot as ac
    doc = await db.app_settings.find_one({"type": "ai_prompts"}, {"_id": 0}) or {}
    return {"labels": ac.PROMPT_LABELS, "placeholders": ac.PROMPT_PLACEHOLDERS,
            "defaults": ac.default_prompts(), "overrides": doc.get("prompts") or {},
            "updated_at": doc.get("updated_at")}


@api_router.put("/admin/ai-prompts")
async def update_ai_prompts(data: dict, admin: dict = Depends(require_admin)):
    """Body: {prompts: {key: text}}; empty text = reset that key to default."""
    import ai_chatbot as ac
    doc = await db.app_settings.find_one({"type": "ai_prompts"}, {"_id": 0}) or {}
    prompts = dict(doc.get("prompts") or {})
    incoming = data.get("prompts") or {}
    if not isinstance(incoming, dict):
        raise HTTPException(status_code=400, detail="prompts must be an object")
    for k, v in incoming.items():
        if k not in ac.PROMPT_LABELS:
            raise HTTPException(status_code=400, detail=f"Unknown prompt key: {k}")
        if v is not None and not isinstance(v, str):
            raise HTTPException(status_code=400, detail=f"{k}: text hona chahiye")
        v = (v or "").strip()
        if not v:
            prompts.pop(k, None)
            continue
        if len(v) > 20000:
            raise HTTPException(status_code=400, detail=f"{k}: bahut lamba hai (max 20000 chars)")
        if k in ac.PROMPT_PLACEHOLDERS and ac.safe_format(v, **{p: "x" for p in ac.PROMPT_PLACEHOLDERS[k]}) is None:
            raise HTTPException(status_code=400, detail=f"{k}: template mein galat {{ }} hai. Literal bracket ke liye {{{{ }}}} use karo")
        prompts[k] = v
    await db.app_settings.update_one(
        {"type": "ai_prompts"},
        {"$set": {"prompts": prompts, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin.get("id")}},
        upsert=True)
    ac.clear_prompt_cache()
    return {"overrides": prompts}


@api_router.get("/admin/ai-personas")
async def list_ai_personas(admin: dict = Depends(require_admin)):
    return await db.users.find(
        {"is_ai_profile": True},
        {"_id": 0, "id": 1, "name": 1, "age": 1, "location": 1, "bio": 1, "ai_personality": 1,
         "persona_context": 1, "is_active_ai": 1}).sort("name", 1).to_list(None)


@api_router.put("/admin/ai-personas/{profile_id}")
async def update_ai_persona(profile_id: str, data: dict, admin: dict = Depends(require_admin)):
    import ai_chatbot as ac
    upd = {}
    if "ai_personality" in data:
        if not isinstance(data["ai_personality"], str) or data["ai_personality"] not in ac.PERSONALITY_PROMPTS:
            raise HTTPException(status_code=400, detail="Invalid personality")
        upd["ai_personality"] = data["ai_personality"]
    if "persona_context" in data:
        if not isinstance(data.get("persona_context") or "", str):
            raise HTTPException(status_code=400, detail="persona_context text hona chahiye")
        ctx = (data.get("persona_context") or "").strip()
        if len(ctx) > 4000:
            raise HTTPException(status_code=400, detail="Context max 4000 chars")
        upd["persona_context"] = ctx
    if "bio" in data:
        if not isinstance(data.get("bio") or "", str):
            raise HTTPException(status_code=400, detail="bio text hona chahiye")
        bio = (data.get("bio") or "").strip()
        if len(bio) > 500:
            raise HTTPException(status_code=400, detail="Bio max 500 chars")
        upd["bio"] = bio
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.users.update_one({"id": profile_id, "is_ai_profile": True}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="AI profile not found")
    invalidate_user_cache(profile_id)
    return {"success": True, **upd}


@api_router.post("/admin/ai-prompts/preview")
async def preview_ai_reply(data: dict, admin: dict = Depends(require_admin)):
    """Try a persona's reply to a sample message with current prompts (nothing is saved)."""
    import ai_chatbot as ac
    persona = await db.users.find_one({"id": data.get("profile_id"), "is_ai_profile": True},
                                      {"_id": 0, "password_hash": 0, "photos": 0, "profile_picture": 0})
    if not persona:
        raise HTTPException(status_code=404, detail="AI profile not found")
    msg = (data.get("message") or "").strip()[:500]
    if not msg:
        raise HTTPException(status_code=400, detail="Message likho")
    reply = await ac.generate_ai_response(db, f"preview-{uuid.uuid4()}", persona, msg, data.get("user_name") or "Rahul")
    return {"reply": reply}


@api_router.get("/admin/ai-reply-timing")
async def get_ai_reply_timing(admin: dict = Depends(require_admin)):
    from ai_chatbot import DEFAULT_AI_REPLY_TIMING
    cfg = await db.app_settings.find_one({"type": "ai_reply_timing"}, {"_id": 0}) or {}
    slots = {k: {**v, **(cfg.get("slots") or {}).get(k, {})} for k, v in DEFAULT_AI_REPLY_TIMING.items()}
    return {"enabled": cfg.get("enabled", False), "slots": slots}


@api_router.put("/admin/ai-reply-timing")
async def update_ai_reply_timing(data: dict, admin: dict = Depends(require_admin)):
    from ai_chatbot import DEFAULT_AI_REPLY_TIMING
    slots = {}
    for k in DEFAULT_AI_REPLY_TIMING:
        v = (data.get("slots") or {}).get(k) or DEFAULT_AI_REPLY_TIMING[k]
        try:
            lo, hi = float(v.get("min")), float(v.get("max"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"Invalid value for {k}")
        if not (0.1 <= lo <= 180 and 0.1 <= hi <= 180) or lo > hi:
            raise HTTPException(status_code=400, detail=f"{k}: min/max 0.1-180 min hona chahiye aur min <= max")
        slots[k] = {"min": lo, "max": hi}
    enabled = bool(data.get("enabled", True))
    await db.app_settings.update_one(
        {"type": "ai_reply_timing"},
        {"$set": {"slots": slots, "enabled": enabled, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True)
    return {"enabled": enabled, "slots": slots}


@api_router.put("/admin/feature-flags")
async def update_feature_flags(data: dict, admin: dict = Depends(require_admin)):
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
async def get_notification_config(admin: dict = Depends(require_admin)):
    """Admin: Get notification settings + analytics."""
    config = await db.app_settings.find_one({"type": "notification_config"}, {"_id": 0})
    defaults = {
        "welcome_enabled": True, "profile_reminder_enabled": True,
        "new_user_discovery_enabled": True, "comeback_3d_enabled": True,
        "comeback_7d_enabled": True, "daily_engagement_enabled": True,
        "weekend_special_enabled": True, "girls_retention_enabled": True,
        "verify_nudge_enabled": True,
        "max_notifications_per_user_per_day": 3,
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
async def update_notification_config(request: Request, admin: dict = Depends(require_admin)):
    """Admin: Update notification settings."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    allowed = {
        "welcome_enabled", "profile_reminder_enabled", "new_user_discovery_enabled",
        "comeback_3d_enabled", "comeback_7d_enabled", "daily_engagement_enabled",
        "weekend_special_enabled", "girls_retention_enabled", "verify_nudge_enabled",
        "max_notifications_per_user_per_day",
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
async def get_notification_analytics_chart(days: int = 7, admin: dict = Depends(require_admin)):
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
# STEALTH AUTO-CHAT ADMIN ENDPOINTS
# ==========================================

@api_router.post("/admin/auto-chat/enable")
async def enable_auto_chat(request: Request, admin: dict = Depends(require_admin)):
    """Enable stealth AI auto-chat for a real user account."""
    data = await request.json()
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "is_ai_profile": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("is_ai_profile"):
        raise HTTPException(status_code=400, detail="Already an AI profile, use AI toggle instead")
    
    await db.users.update_one({"id": user_id}, {"$set": {"auto_chat_enabled": True}})
    return {"success": True, "user_id": user_id, "name": user.get("name"), "auto_chat_enabled": True}


@api_router.post("/admin/auto-chat/disable")
async def disable_auto_chat(request: Request, admin: dict = Depends(require_admin)):
    """Disable stealth AI auto-chat for a user."""
    data = await request.json()
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    await db.users.update_one({"id": user_id}, {"$set": {"auto_chat_enabled": False}})
    return {"success": True, "user_id": user_id, "auto_chat_enabled": False}


@api_router.get("/admin/auto-chat/list")
async def list_auto_chat_users(admin: dict = Depends(require_admin)):
    """List all users with stealth auto-chat enabled."""
    users = await db.users.find(
        {"auto_chat_enabled": True, "is_ai_profile": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "gender": 1, "location": 1, "photos": 1, "auto_chat_enabled": 1}
    ).to_list(None)
    return users



# ==========================================
# CUSTOM AI PERSONA SYSTEM
# ==========================================

@api_router.post("/admin/custom-ai-persona/toggle")
async def toggle_custom_ai_persona(request: Request, admin: dict = Depends(require_admin)):
    """Toggle custom AI persona for a user. Auto-enables stealth chat if needed."""
    data = await request.json()
    user_id = data.get("user_id")
    enable = data.get("enable", True)
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1, "auto_chat_enabled": 1, "is_ai_profile": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if enable and not user.get("auto_chat_enabled"):
        # Auto-enable stealth chat when enabling custom persona
        await db.users.update_one({"id": user_id}, {"$set": {"auto_chat_enabled": True, "custom_ai_persona": True}})
    else:
        await db.users.update_one({"id": user_id}, {"$set": {"custom_ai_persona": enable}})
    
    return {"success": True, "user_id": user_id, "name": user.get("name"), "custom_ai_persona": enable, "auto_chat_enabled": True if enable else user.get("auto_chat_enabled")}


@api_router.get("/admin/custom-ai-personas")
async def list_custom_ai_personas(admin: dict = Depends(require_admin)):
    """List all users with custom AI persona enabled."""
    users = await db.users.find(
        {"custom_ai_persona": True},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "gender": 1, "location": 1, "photos": 1, "auto_chat_enabled": 1, "custom_ai_persona": 1}
    ).to_list(None)
    return {"users": users, "total": len(users)}


# ==========================================


# ==========================================


# ==========================================


# ==========================================
# SIGNUP FUNNEL ANALYTICS
# ==========================================

@api_router.get("/admin/signup-funnel")
async def get_signup_funnel(days: int = 30, admin: dict = Depends(require_admin)):
    """Admin: Full signup funnel analytics — installs → OTP sent → OTP verified → signup complete, by gender."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Install count
    installs = await db.installs.count_documents({"first_open_at": {"$gte": cutoff}})
    
    # Funnel steps
    otp_sent = await db.signup_funnel.count_documents({"step": "otp_sent", "timestamp": {"$gte": cutoff}})
    otp_verified = await db.signup_funnel.count_documents({"step": "otp_verified", "timestamp": {"$gte": cutoff}})
    signup_completed = await db.signup_funnel.count_documents({"step": "signup_completed", "timestamp": {"$gte": cutoff}})
    
    # Gender breakdown of completed signups
    girls_completed = await db.signup_funnel.count_documents({
        "step": "signup_completed", "timestamp": {"$gte": cutoff},
        "gender": {"$regex": "^female$", "$options": "i"}
    })
    boys_completed = await db.signup_funnel.count_documents({
        "step": "signup_completed", "timestamp": {"$gte": cutoff},
        "gender": {"$regex": "^male$", "$options": "i"}
    })
    
    # Recent signups (last 20) with details
    recent_signups = await db.signup_funnel.find(
        {"step": "signup_completed", "timestamp": {"$gte": cutoff}},
        {"_id": 0, "name": 1, "email": 1, "gender": 1, "location": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(20).to_list(None)
    
    # Recent OTP requests that DIDN'T complete signup (drop-offs)
    otp_emails = set()
    completed_emails = set()
    
    otp_docs = await db.signup_funnel.find(
        {"step": "otp_sent", "timestamp": {"$gte": cutoff}},
        {"_id": 0, "email": 1}
    ).to_list(None)
    otp_emails = {d["email"] for d in otp_docs}
    
    completed_docs = await db.signup_funnel.find(
        {"step": "signup_completed", "timestamp": {"$gte": cutoff}},
        {"_id": 0, "email": 1}
    ).to_list(None)
    completed_emails = {d["email"] for d in completed_docs}
    
    dropped_emails = list(otp_emails - completed_emails)[:20]
    
    # Conversion rates
    install_to_otp = round((otp_sent / max(installs, 1)) * 100, 1)
    otp_to_verify = round((otp_verified / max(otp_sent, 1)) * 100, 1)
    verify_to_signup = round((signup_completed / max(otp_verified, 1)) * 100, 1)
    overall = round((signup_completed / max(installs, 1)) * 100, 1)
    
    return {
        "period_days": days,
        "funnel": {
            "installs": installs,
            "otp_sent": otp_sent,
            "otp_verified": otp_verified,
            "signup_completed": signup_completed,
        },
        "gender_breakdown": {
            "girls": girls_completed,
            "boys": boys_completed,
        },
        "conversion_rates": {
            "install_to_otp": install_to_otp,
            "otp_to_verify": otp_to_verify,
            "verify_to_signup": verify_to_signup,
            "overall": overall,
        },
        "recent_signups": recent_signups,
        "dropped_off_emails": dropped_emails,
        "drop_off_count": len(otp_emails - completed_emails),
    }


# GIRLS ACQUISITION ENDPOINTS
# ==========================================

@api_router.get("/stats/boys-waiting")
async def get_boys_waiting_count():
    """Public endpoint: How many boys are active on the platform."""
    total_boys = await db.users.count_documents({
        "gender": {"$regex": "^male$", "$options": "i"},
        "is_ai_profile": {"$ne": True},
        "is_blocked": {"$ne": True}
    })
    # Add a natural-looking multiplier for small numbers (min 100)
    display_count = max(total_boys, 100)
    
    # Active boys (last 7 days)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    active_boys = await db.users.count_documents({
        "gender": {"$regex": "^male$", "$options": "i"},
        "is_ai_profile": {"$ne": True},
        "last_active": {"$gte": week_ago}
    })
    
    return {
        "total_boys": display_count,
        "active_this_week": max(active_boys, 50),
        "message": f"{display_count}+ boys are looking for matches right now!"
    }


@api_router.post("/referral/invite-girl-check")
async def check_invite_girl_reward(request: Request):
    """Check if boy has invited 3+ girls and grant premium reward."""
    data = await request.json()
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "gender": 1, "is_premium": 1, "premium_pass_until": 1, "referral_code": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Count how many girls signed up using this user's referral
    ref_code = user.get("referral_code", "")
    if not ref_code:
        return {"girls_invited": 0, "reward_unlocked": False, "needed": 3}
    
    girls_invited = await db.users.count_documents({
        "referred_by": ref_code,
        "gender": {"$regex": "^female$", "$options": "i"},
        "is_ai_profile": {"$ne": True}
    })
    
    reward_unlocked = girls_invited >= 3
    
    # Auto-grant premium if 3+ girls invited and not already premium
    if reward_unlocked and not user.get("is_premium"):
        premium_until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        await db.users.update_one({"id": user_id}, {"$set": {
            "is_premium": True,
            "premium_until": premium_until,
            "premium_source": "invite_girls_reward",
            "premium_features": ["see_who_liked", "crush_reveal", "extra_boost", "unlimited_swipes"]
        }})
    
    return {
        "girls_invited": girls_invited,
        "reward_unlocked": reward_unlocked,
        "needed": max(0, 3 - girls_invited),
        "is_premium": user.get("is_premium", False) or reward_unlocked
    }



@api_router.get("/admin/girls-referral-tracking")
async def get_girls_referral_tracking(admin: dict = Depends(require_admin)):
    """Admin: Full girls referral analytics — who invited whom, conversion rates."""
    
    # Total girls (real, not AI)
    total_girls = await db.users.count_documents({
        "gender": {"$regex": "^female$", "$options": "i"},
        "is_ai_profile": {"$ne": True}
    })
    
    # Girls who came via referral
    girls_via_referral = await db.users.count_documents({
        "gender": {"$regex": "^female$", "$options": "i"},
        "is_ai_profile": {"$ne": True},
        "referred_by": {"$exists": True, "$nin": [None, ""]}
    })
    
    # Girls with free premium
    girls_premium = await db.users.count_documents({
        "gender": {"$regex": "^female$", "$options": "i"},
        "is_ai_profile": {"$ne": True},
        "is_premium": True
    })
    
    # Total boys
    total_boys = await db.users.count_documents({
        "gender": {"$regex": "^male$", "$options": "i"},
        "is_ai_profile": {"$ne": True}
    })
    
    # Boys who earned premium via girl invites
    boys_with_invite_premium = await db.users.count_documents({
        "premium_source": "invite_girls_reward"
    })
    
    # Top referrers (boys who invited most girls)
    pipeline = [
        {"$match": {"gender": {"$regex": "^female$", "$options": "i"}, "is_ai_profile": {"$ne": True}, "referred_by": {"$exists": True, "$nin": [None, ""]}}},
        {"$group": {"_id": "$referred_by", "girls_count": {"$sum": 1}}},
        {"$sort": {"girls_count": -1}},
        {"$limit": 10}
    ]
    top_referrers_raw = await db.users.aggregate(pipeline).to_list(None)
    
    # Enrich with referrer names
    top_referrers = []
    for ref in top_referrers_raw:
        referrer = await db.users.find_one(
            {"referral_code": ref["_id"]},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "gender": 1}
        )
        top_referrers.append({
            "referral_code": ref["_id"],
            "girls_invited": ref["girls_count"],
            "name": referrer.get("name", "Unknown") if referrer else "Unknown",
            "email": referrer.get("email", "") if referrer else "",
            "gender": referrer.get("gender", "") if referrer else "",
        })
    
    # Weekly girl signups trend (last 4 weeks)
    weekly_trend = []
    for i in range(3, -1, -1):
        week_start = (datetime.now(timezone.utc) - timedelta(weeks=i+1)).isoformat()
        week_end = (datetime.now(timezone.utc) - timedelta(weeks=i)).isoformat()
        count = await db.users.count_documents({
            "gender": {"$regex": "^female$", "$options": "i"},
            "is_ai_profile": {"$ne": True},
            "created_at": {"$gte": week_start, "$lt": week_end}
        })
        weekly_trend.append({
            "week": f"W{4-i}",
            "label": f"{(datetime.now(timezone.utc) - timedelta(weeks=i+1)).strftime('%b %d')} - {(datetime.now(timezone.utc) - timedelta(weeks=i)).strftime('%b %d')}",
            "girls_signup": count
        })
    
    # Gender ratio
    ratio = round(total_boys / max(total_girls, 1), 1)
    
    return {
        "total_girls": total_girls,
        "total_boys": total_boys,
        "gender_ratio": f"{ratio}:1 (Boys:Girls)",
        "girls_via_referral": girls_via_referral,
        "girls_premium": girls_premium,
        "boys_with_invite_premium": boys_with_invite_premium,
        "referral_conversion_rate": round((girls_via_referral / max(total_girls, 1)) * 100, 1),
        "top_referrers": top_referrers,
        "weekly_trend": weekly_trend
    }





# ==========================================
# SAFETY BAN / UNBAN SYSTEM
# ==========================================

@api_router.post("/admin/safety-ban")
async def safety_ban_user(request: Request, admin: dict = Depends(require_admin)):
    """Ban a user — supports temporary (24h/7d) or permanent."""
    data = await request.json()
    user_id = data.get("user_id")
    reason = data.get("reason", "Banned from safety review")
    duration = data.get("duration", "permanent")  # "24h", "7d", "permanent"
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    ban_data = {
        "is_blocked": True,
        "block_reason": reason,
        "banned_at": now.isoformat(),
        "banned_by": "admin_safety",
        "ban_duration": duration,
    }
    
    if duration == "24h":
        ban_data["ban_expires_at"] = (now + timedelta(hours=24)).isoformat()
        ban_data["is_permanently_banned"] = False
    elif duration == "7d":
        ban_data["ban_expires_at"] = (now + timedelta(days=7)).isoformat()
        ban_data["is_permanently_banned"] = False
    else:
        ban_data["ban_expires_at"] = None
        ban_data["is_permanently_banned"] = True
    
    await db.users.update_one({"id": user_id}, {"$set": ban_data})
    
    return {"success": True, "name": user.get("name"), "action": "banned", "duration": duration, "reason": reason}


@api_router.post("/admin/safety-unban")
async def safety_unban_user(request: Request, admin: dict = Depends(require_admin)):
    """Unban a user — clears ALL block flags + resets safety warnings."""
    data = await request.json()
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"id": user_id}, {"$set": {
        "is_blocked": False,
        "is_shadow_banned": False,
        "is_permanently_banned": False,
        "block_reason": None,
        "safety_warnings": 0,
        "unbanned_at": datetime.now(timezone.utc).isoformat(),
        "unbanned_by": "admin_safety"
    }})
    
    return {"success": True, "name": user.get("name"), "action": "unbanned"}


@api_router.get("/admin/safety-banned-users")
async def get_safety_banned_users(admin: dict = Depends(require_admin)):
    """List all users banned via safety system."""
    banned = await db.users.find(
        {"$or": [{"is_blocked": True}, {"is_permanently_banned": True}]},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "gender": 1, "safety_warnings": 1,
         "block_reason": 1, "banned_at": 1, "location": 1, "age": 1, "photos": 1,
         "ban_duration": 1, "ban_expires_at": 1, "is_permanently_banned": 1}
    ).sort("banned_at", -1).to_list(100)
    
    return {"banned_users": banned, "total": len(banned)}


@api_router.get("/admin/user-chat-history/{user_id}")
async def get_admin_user_chat_history(user_id: str, limit: int = 50, admin: dict = Depends(require_admin)):
    """Admin: Get banned user's recent chat history across ALL matches for review."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all matches for this user
    matches = await db.matches.find(
        {"$or": [{"user1_id": user_id}, {"user2_id": user_id}]},
        {"_id": 0, "id": 1, "user1_id": 1, "user2_id": 1}
    ).to_list(None)
    
    match_ids = [m["id"] for m in matches]
    
    # Get other user info for each match
    other_users = {}
    for m in matches:
        other_id = m["user2_id"] if m["user1_id"] == user_id else m["user1_id"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "id": 1, "name": 1, "is_ai_profile": 1})
        other_users[m["id"]] = other or {"id": other_id, "name": "Unknown"}
    
    # Get recent messages across all matches
    messages = await db.messages.find(
        {"match_id": {"$in": match_ids}},
        {"_id": 0, "id": 1, "match_id": 1, "sender_id": 1, "receiver_id": 1, "content": 1, "created_at": 1}
    ).sort("created_at", -1).limit(limit).to_list(None)
    
    # Group by match and enrich
    for msg in messages:
        match_id = msg["match_id"]
        other = other_users.get(match_id, {})
        msg["is_own"] = msg["sender_id"] == user_id
        msg["other_user_name"] = other.get("name", "Unknown")
        msg["is_ai_match"] = other.get("is_ai_profile", False)
    
    # Safety reports for this user
    reports = await db.safety_reports.find(
        {"sender_id": user_id},
        {"_id": 0, "type": 1, "content": 1, "severity": 1, "reason": 1, "warning_number": 1, "created_at": 1, "receiver_name": 1}
    ).sort("created_at", -1).limit(10).to_list(None)
    
    return {
        "user": user,
        "total_matches": len(matches),
        "messages": messages,
        "safety_reports": reports,
    }



# GIRLS SAFETY ENDPOINTS
# ==========================================

@api_router.post("/safety/night-mode/toggle")
async def toggle_night_safety(request: Request):
    """Girls can toggle night mode safety (11pm-6am block for new matches)."""
    data = await request.json()
    user_id = data.get("user_id")
    enabled = data.get("enabled", True)
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    await db.users.update_one({"id": user_id}, {"$set": {"night_safety_enabled": enabled}})
    return {"success": True, "night_safety_enabled": enabled}


@api_router.get("/safety/night-mode/{user_id}")
async def get_night_safety(user_id: str):
    """Get night mode safety status for a user."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "night_safety_enabled": 1, "gender": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"night_safety_enabled": user.get("night_safety_enabled", True), "gender": user.get("gender")}


@api_router.get("/admin/safety-reports")
async def get_safety_reports(limit: int = 50, admin: dict = Depends(require_admin)):
    """Admin: Get recent safety reports (AI detections + safe word triggers)."""
    reports = await db.safety_reports.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(None)
    
    alerts = await db.admin_alerts.find(
        {"type": "safe_word_emergency"}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(None)
    
    stats = {
        "total_reports": await db.safety_reports.count_documents({}),
        "ai_detections": await db.safety_reports.count_documents({"type": "ai_detection"}),
        "safe_word_triggers": await db.safety_reports.count_documents({"type": "safe_word_triggered"}),
        "auto_bans": await db.safety_reports.count_documents({"auto_action": "banned"}),
        "unread_alerts": await db.admin_alerts.count_documents({"read": False}),
    }
    
    return {"reports": reports, "alerts": alerts, "stats": stats}


@api_router.get("/admin/safety-analytics")
async def get_safety_analytics(days: int = 30, admin: dict = Depends(require_admin)):
    """Admin: Ban/unban trends over time for Smart Ban Analytics chart."""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).isoformat()
    
    # Get all users who were banned in the period
    banned_users = await db.users.find(
        {"banned_at": {"$gte": cutoff}},
        {"_id": 0, "banned_at": 1, "ban_duration": 1}
    ).to_list(None)
    
    # Get all users who were unbanned in the period
    unbanned_users = await db.users.find(
        {"unbanned_at": {"$gte": cutoff}},
        {"_id": 0, "unbanned_at": 1, "unbanned_by": 1}
    ).to_list(None)
    
    # Also check safety_reports for historical ban actions
    report_bans = await db.safety_reports.find(
        {"created_at": {"$gte": cutoff}, "auto_action": "banned"},
        {"_id": 0, "created_at": 1, "type": 1, "severity": 1}
    ).to_list(None)
    
    # Build daily buckets
    daily = {}
    for d in range(days):
        date = (now - timedelta(days=d)).strftime("%Y-%m-%d")
        daily[date] = {"date": date, "bans": 0, "unbans": 0, "auto_unbans": 0, "manual_unbans": 0, "temp_bans": 0, "perm_bans": 0, "ai_detections": 0}
    
    # Count bans per day
    for u in banned_users:
        ba = u.get("banned_at", "")
        if ba:
            day = ba[:10]
            if day in daily:
                daily[day]["bans"] += 1
                dur = u.get("ban_duration", "permanent")
                if dur in ("24h", "7d"):
                    daily[day]["temp_bans"] += 1
                else:
                    daily[day]["perm_bans"] += 1
    
    # Count report-triggered bans (AI auto-bans)
    for r in report_bans:
        ca = r.get("created_at", "")
        if ca:
            day = ca[:10]
            if day in daily:
                daily[day]["ai_detections"] += 1
    
    # Count unbans per day
    for u in unbanned_users:
        ua = u.get("unbanned_at", "")
        if ua:
            day = ua[:10]
            if day in daily:
                daily[day]["unbans"] += 1
                if u.get("unbanned_by") == "auto_timer":
                    daily[day]["auto_unbans"] += 1
                else:
                    daily[day]["manual_unbans"] += 1
    
    # Sort by date ascending
    chart = sorted(daily.values(), key=lambda x: x["date"])
    
    # Summary
    total_bans = sum(d["bans"] for d in chart)
    total_unbans = sum(d["unbans"] for d in chart)
    total_auto_unbans = sum(d["auto_unbans"] for d in chart)
    total_temp = sum(d["temp_bans"] for d in chart)
    total_perm = sum(d["perm_bans"] for d in chart)
    total_ai = sum(d["ai_detections"] for d in chart)
    currently_banned = await db.users.count_documents({"$or": [{"is_blocked": True}, {"is_permanently_banned": True}]})
    
    return {
        "chart": chart,
        "summary": {
            "total_bans": total_bans,
            "total_unbans": total_unbans,
            "auto_unbans": total_auto_unbans,
            "manual_unbans": total_unbans - total_auto_unbans,
            "temp_bans": total_temp,
            "perm_bans": total_perm,
            "ai_detections": total_ai,
            "currently_banned": currently_banned,
            "avg_bans_per_day": round(total_bans / max(days, 1), 1),
        }
    }


@api_router.put("/admin/safety-config")
async def update_safety_config(request: Request, admin: dict = Depends(require_admin)):
    """Admin: Update safety configuration (safe words, etc)."""
    data = await request.json()
    allowed = {"safe_words", "creepy_detection_enabled", "night_mode_default", "auto_ban_threshold"}
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields")
    updates["type"] = "safety_config"
    await db.app_settings.update_one(
        {"type": "safety_config"}, {"$set": updates}, upsert=True
    )
    return updates


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
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "ad_free_until": 1, "is_premium": 1, "premium_pass_until": 1, "isPremium": 1})
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
async def admin_get_adfree_config(admin: dict = Depends(require_admin)):
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
async def admin_update_adfree_config(request: Request, admin: dict = Depends(require_admin)):
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
async def get_app_update_config(admin: dict = Depends(require_admin)):
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
async def update_app_update_config(request: Request, admin: dict = Depends(require_admin)):
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
async def send_app_update_notification(request: Request, admin: dict = Depends(require_admin)):
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
async def get_growth_stats(response: Response, period: str = "today", admin: dict = Depends(require_admin)):
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
async def get_acquisition_table(response: Response, page: int = 1, limit: int = 20, admin: dict = Depends(require_admin)):
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
async def get_retention_chart(response: Response, days: int = 7, admin: dict = Depends(require_admin)):
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
async def send_weekly_digest_now(admin: dict = Depends(require_admin)):
    """Manually trigger the weekly growth digest email (for testing)."""
    try:
        await _send_weekly_growth_digest()
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/push-update-notification")
async def push_update_notification(request: Request, admin: dict = Depends(require_admin)):
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


# ==================== PROFILE PROMPTS (Hinge-style) ====================

PROMPT_QUESTIONS = [
    "My ideal weekend looks like...",
    "A life goal of mine is...",
    "My most controversial opinion is...",
    "I'm looking for someone who...",
    "The way to my heart is...",
    "My hidden talent is...",
    "Two truths and a lie...",
    "Best travel story...",
    "My comfort food is...",
    "I geek out on...",
    "My love language is...",
    "Change my mind about...",
    "Biggest green flag in a person...",
    "After work you'll find me...",
    "I bet you can't guess that I...",
]

@api_router.get("/profile-prompts/questions")
async def get_prompt_questions():
    """Get available prompt questions for profiles"""
    return {"questions": PROMPT_QUESTIONS}

@api_router.post("/profile-prompts/{user_id}")
async def save_profile_prompts(user_id: str, request: Request):
    """Save user's profile prompts (max 3)"""
    data = await request.json()
    prompts = data.get("prompts", [])

    if len(prompts) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 prompts allowed")

    validated = []
    for p in prompts:
        q = p.get("question", "").strip()
        a = p.get("answer", "").strip()
        if q and a and len(a) <= 300:
            validated.append({"question": q, "answer": a})

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"profile_prompts": validated}}
    )
    invalidate_user_cache(user_id)
    return {"success": True, "prompts": validated}

@api_router.get("/profile-prompts/{user_id}")
async def get_profile_prompts(user_id: str):
    """Get user's profile prompts"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "profile_prompts": 1})
    return {"prompts": user.get("profile_prompts", []) if user else []}


# ==================== LADIES FIRST MODE ====================

@api_router.post("/user/{user_id}/ladies-first")
async def toggle_ladies_first(user_id: str, request: Request):
    """Toggle Ladies First mode — only girls can enable"""
    data = await request.json()
    enabled = data.get("enabled", False)

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "gender": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("gender", "").lower() != "female":
        raise HTTPException(status_code=403, detail="Ladies First is only available for female users")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"ladies_first_enabled": enabled}}
    )
    invalidate_user_cache(user_id)
    return {"success": True, "ladies_first_enabled": enabled}


# ==================== GIRL DAILY REWARDS ====================

@api_router.post("/rewards/daily-checkin/{user_id}")
async def daily_checkin_reward(user_id: str):
    """Daily check-in reward for girls — coins and superlikes"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "gender": 1, "name": 1, "last_daily_reward": 1, "reward_streak": 1, "heart_coins": 1, "daily_superlikes_bonus": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already claimed today
    now = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now + ist_offset
    today_str = now_ist.strftime("%Y-%m-%d")

    last_reward = user.get("last_daily_reward", "")
    if last_reward == today_str:
        return {"success": False, "message": "Aaj ka reward already claim ho chuka hai", "already_claimed": True}

    # Calculate streak
    yesterday_str = (now_ist - timedelta(days=1)).strftime("%Y-%m-%d")
    old_streak = user.get("reward_streak", 0)
    new_streak = (old_streak + 1) if last_reward == yesterday_str else 1

    # Rewards based on streak and gender
    is_girl = user.get("gender", "").lower() == "female"
    base_coins = 10 if is_girl else 5
    streak_bonus = min(new_streak, 7) * (3 if is_girl else 1)
    total_coins = base_coins + streak_bonus
    superlikes_bonus = 1 if is_girl and new_streak >= 3 else 0

    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "last_daily_reward": today_str,
            "reward_streak": new_streak,
        },
        "$inc": {
            "heart_coins": total_coins,
            "daily_superlikes_bonus": superlikes_bonus,
        }}
    )

    return {
        "success": True,
        "coins_earned": total_coins,
        "superlikes_earned": superlikes_bonus,
        "streak": new_streak,
        "total_coins": user.get("heart_coins", 0) + total_coins,
        "is_girl_bonus": is_girl,
        "message": f"{'🎉' if is_girl else ''} {total_coins} HeartCoins earned!" + (f" + {superlikes_bonus} SuperLike!" if superlikes_bonus else "")
    }


# ==================== PROMO CODE SYSTEM ====================

@api_router.post("/admin/promo-codes/create")
async def create_promo_code(request: Request, admin: dict = Depends(require_admin)):
    """Admin: Create a new promo code for premium activation."""
    data = await request.json()
    code = data.get("code", "").strip().upper()
    days = data.get("days", 30)
    max_uses = data.get("max_uses", 1)
    description = data.get("description", "")

    if not code or len(code) < 4:
        raise HTTPException(status_code=400, detail="Code must be at least 4 characters")
    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 365")

    existing = await db.promo_codes.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Code already exists")

    promo = {
        "code": code,
        "days": days,
        "max_uses": max_uses,
        "used_count": 0,
        "used_by": [],
        "description": description,
        "is_active": True,
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.promo_codes.insert_one(promo)
    return {"success": True, "code": code, "days": days, "max_uses": max_uses}


@api_router.get("/admin/promo-codes")
async def list_promo_codes(admin: dict = Depends(require_admin)):
    """Admin: List all promo codes."""
    codes = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(None)
    return codes


@api_router.delete("/admin/promo-codes/{code}")
async def delete_promo_code(code: str, admin: dict = Depends(require_admin)):
    """Admin: Delete/deactivate a promo code."""
    result = await db.promo_codes.update_one({"code": code.upper()}, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    return {"success": True, "message": f"Code {code} deactivated"}


@api_router.post("/promo/redeem")
async def redeem_promo_code(request: Request):
    """User: Redeem a promo code for premium activation."""
    data = await request.json()
    user_id = data.get("user_id", "").strip()
    code = data.get("code", "").strip().upper()

    if not user_id or not code:
        raise HTTPException(status_code=400, detail="User ID and code required")

    # Find the promo code
    promo = await db.promo_codes.find_one({"code": code, "is_active": True})
    if not promo:
        raise HTTPException(status_code=404, detail="Invalid or expired promo code")

    # Check max uses
    if promo["used_count"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="This code has reached its maximum usage limit")

    # Check if user already used this code
    if user_id in promo.get("used_by", []):
        raise HTTPException(status_code=400, detail="You have already used this code")

    # Find user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Activate premium
    days = promo["days"]
    now = datetime.now(timezone.utc)
    premium_end = now + timedelta(days=days)

    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_premium": True,
            "subscription_status": "promo_code",
            "premium_start": now.isoformat(),
            "premium_end": premium_end.isoformat(),
            "premium_source": f"promo_{code}",
            "premium_plan": f"{days}_day_promo",
        }}
    )

    # Update promo code usage
    await db.promo_codes.update_one(
        {"code": code},
        {"$inc": {"used_count": 1}, "$push": {"used_by": user_id}}
    )

    invalidate_user_cache(user_id)

    return {
        "success": True,
        "message": f"Premium activated for {days} days!",
        "days": days,
        "expires_at": premium_end.isoformat(),
    }


# ==================== MANUAL PAYMENT VERIFICATION ====================

@api_router.post("/payment/submit-screenshot")
async def submit_payment_screenshot(request: Request):
    """User submits UPI payment screenshot for premium activation."""
    data = await request.json()
    user_id = data.get("user_id", "").strip()
    screenshot_base64 = data.get("screenshot_base64", "")
    utr_number = data.get("utr_number", "").strip()
    amount = data.get("amount", 49)
    payment_method = data.get("payment_method", "UPI")

    if not user_id or not screenshot_base64:
        raise HTTPException(status_code=400, detail="User ID and screenshot required")

    if not utr_number:
        raise HTTPException(status_code=400, detail="UTR / Transaction ID is required")

    # UTR format validation — must be 12+ alphanumeric characters
    clean_utr = utr_number.replace(" ", "").replace("-", "")
    if len(clean_utr) < 6:
        raise HTTPException(status_code=400, detail="Invalid UTR/Transaction ID. Must be at least 6 characters.")

    # Check for duplicate UTR across ALL users (prevent reuse of same screenshot/UTR)
    duplicate_utr = await db.payment_requests.find_one({
        "utr_number": {"$regex": f"^{clean_utr}$", "$options": "i"},
        "status": {"$in": ["pending", "approved"]},
    })
    if duplicate_utr:
        raise HTTPException(status_code=400, detail="This UTR/Transaction ID has already been used. Each payment must have a unique UTR.")

    # Rate limit: max 3 payment requests per user per day
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    today_count = await db.payment_requests.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": today_start},
    })
    if today_count >= 3:
        raise HTTPException(status_code=429, detail="Maximum 3 payment submissions per day. Please try again tomorrow.")

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for duplicate pending request
    existing = await db.payment_requests.find_one({"user_id": user_id, "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending payment request. Please wait for verification.")

    # Upload screenshot to object storage
    screenshot_url = ""
    try:
        import base64
        img_data = screenshot_base64.split(",")[-1]
        img_bytes = base64.b64decode(img_data)
        path = f"payments/{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.jpg"
        result = _put_object(path, img_bytes, "image/jpeg")
        screenshot_url = result.get("url", "")
    except Exception as e:
        logger.error(f"Screenshot upload failed: {e}")
        raise HTTPException(status_code=500, detail="Screenshot upload failed. Please try again.")

    # Create payment request
    payment_req = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "screenshot_url": screenshot_url,
        "utr_number": utr_number,
        "amount": amount,
        "payment_method": payment_method,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
    }
    await db.payment_requests.insert_one(payment_req)

    return {
        "success": True,
        "message": "Payment screenshot submitted! Premium will be activated within 24 hours after verification.",
        "request_id": payment_req["id"],
    }


@api_router.get("/payment/status/{user_id}")
async def get_payment_status(user_id: str):
    """Check user's latest payment request status."""
    req = await db.payment_requests.find_one(
        {"user_id": user_id},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    if not req:
        return {"has_request": False}
    return {"has_request": True, "status": req["status"], "created_at": req["created_at"], "request_id": req["id"]}


@api_router.get("/payment/history/{user_id}")
async def get_payment_history(user_id: str):
    """Get user's payment history."""
    payments = await db.payment_requests.find(
        {"user_id": user_id},
        {"_id": 0, "id": 1, "amount": 1, "payment_method": 1, "status": 1, "created_at": 1, "utr_number": 1, "premium_days": 1, "reject_reason": 1}
    ).sort("created_at", -1).limit(20).to_list(None)
    return payments



@api_router.get("/admin/payment-requests")
async def list_payment_requests(status: str = "pending", admin: dict = Depends(require_admin)):
    """Admin: List payment verification requests."""
    query = {}
    if status != "all":
        query["status"] = status
    requests = await db.payment_requests.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(None)
    return requests


@api_router.post("/admin/payment-requests/{request_id}/approve")
async def approve_payment_request(request_id: str, request: Request, admin: dict = Depends(require_admin)):
    """Admin: Approve payment and activate premium."""
    data = await request.json()
    days = data.get("days", 30)

    pay_req = await db.payment_requests.find_one({"id": request_id})
    if not pay_req:
        raise HTTPException(status_code=404, detail="Request not found")
    if pay_req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {pay_req['status']}")

    # Activate premium
    user_id = pay_req["user_id"]
    now = datetime.now(timezone.utc)
    premium_end = now + timedelta(days=days)

    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_premium": True,
            "subscription_status": "manual_payment",
            "premium_start": now.isoformat(),
            "premium_end": premium_end.isoformat(),
            "premium_source": "manual_upi",
            "premium_plan": f"{days}_day_manual",
        }}
    )

    # Update payment request
    await db.payment_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "reviewed_at": now.isoformat(),
            "reviewed_by": admin["id"],
            "premium_days": days,
        }}
    )

    invalidate_user_cache(user_id)

    # Notify user
    try:
        await fcm_service.send_to_user(db, user_id,
            title="Premium Activated!",
            message=f"Your payment has been verified. Enjoy {days} days of Premium!",
            data={"type": "premium_activated", "route": "/premium"}
        )
    except Exception:
        pass

    return {"success": True, "message": f"Premium activated for {days} days", "user_id": user_id}


@api_router.post("/admin/payment-requests/{request_id}/reject")
async def reject_payment_request(request_id: str, request: Request, admin: dict = Depends(require_admin)):
    """Admin: Reject payment request."""
    data = await request.json()
    reason = data.get("reason", "Payment could not be verified")

    pay_req = await db.payment_requests.find_one({"id": request_id})
    if not pay_req:
        raise HTTPException(status_code=404, detail="Request not found")

    now = datetime.now(timezone.utc)
    await db.payment_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "rejected",
            "reject_reason": reason,
            "reviewed_at": now.isoformat(),
            "reviewed_by": admin["id"],
        }}
    )

    # Notify user
    try:
        await fcm_service.send_to_user(db, pay_req["user_id"],
            title="Payment Verification Update",
            message=f"Your payment could not be verified. Reason: {reason}",
            data={"type": "payment_rejected", "route": "/premium"}
        )
    except Exception:
        pass

    return {"success": True, "message": "Payment request rejected"}


@api_router.post("/admin/payment-requests/bulk-approve")
async def bulk_approve_payments(request: Request, admin: dict = Depends(require_admin)):
    """Admin: Bulk approve multiple payment requests."""
    data = await request.json()
    request_ids = data.get("request_ids", [])
    days = data.get("days", 30)
    
    if not request_ids:
        raise HTTPException(status_code=400, detail="No request IDs provided")
    
    approved = 0
    failed = 0
    for rid in request_ids:
        try:
            pay_req = await db.payment_requests.find_one({"id": rid, "status": "pending"})
            if not pay_req:
                failed += 1
                continue
            
            user_id = pay_req["user_id"]
            now = datetime.now(timezone.utc)
            premium_end = now + timedelta(days=days)
            
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "is_premium": True,
                    "subscription_status": "manual_payment",
                    "premium_start": now.isoformat(),
                    "premium_end": premium_end.isoformat(),
                    "premium_source": "manual_upi",
                    "premium_plan": f"{days}_day_manual",
                }}
            )
            
            await db.payment_requests.update_one(
                {"id": rid},
                {"$set": {
                    "status": "approved",
                    "reviewed_at": now.isoformat(),
                    "reviewed_by": admin["id"],
                    "premium_days": days,
                }}
            )
            
            invalidate_user_cache(user_id)
            
            try:
                await fcm_service.send_to_user(db, user_id,
                    title="Premium Activated!",
                    message=f"Your payment has been verified. Enjoy {days} days of Premium!",
                    data={"type": "premium_activated", "route": "/premium"}
                )
            except Exception:
                pass
            
            approved += 1
        except Exception as e:
            logger.error(f"Bulk approve failed for {rid}: {e}")
            failed += 1
    
    return {"success": True, "approved": approved, "failed": failed}


@api_router.post("/admin/payment-requests/bulk-reject")
async def bulk_reject_payments(request: Request, admin: dict = Depends(require_admin)):
    """Admin: Bulk reject multiple payment requests."""
    data = await request.json()
    request_ids = data.get("request_ids", [])
    reason = data.get("reason", "Payment could not be verified")
    
    if not request_ids:
        raise HTTPException(status_code=400, detail="No request IDs provided")
    
    rejected = 0
    for rid in request_ids:
        try:
            pay_req = await db.payment_requests.find_one({"id": rid, "status": "pending"})
            if not pay_req:
                continue
            
            now = datetime.now(timezone.utc)
            await db.payment_requests.update_one(
                {"id": rid},
                {"$set": {
                    "status": "rejected",
                    "reject_reason": reason,
                    "reviewed_at": now.isoformat(),
                    "reviewed_by": admin["id"],
                }}
            )
            
            try:
                await fcm_service.send_to_user(db, pay_req["user_id"],
                    title="Payment Verification Update",
                    message=f"Your payment could not be verified. Reason: {reason}",
                    data={"type": "payment_rejected", "route": "/premium"}
                )
            except Exception:
                pass
            
            rejected += 1
        except Exception as e:
            logger.error(f"Bulk reject failed for {rid}: {e}")
    
    return {"success": True, "rejected": rejected}



@api_router.get("/rewards/status/{user_id}")
async def get_reward_status(user_id: str):
    """Get user's reward status"""
    user = await db.users.find_one({"id": user_id}, {
        "_id": 0, "heart_coins": 1, "reward_streak": 1,
        "last_daily_reward": 1, "gender": 1, "daily_superlikes_bonus": 1
    })
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    today_str = now_ist.strftime("%Y-%m-%d")
    can_claim = user.get("last_daily_reward", "") != today_str

    return {
        "heart_coins": user.get("heart_coins", 0),
        "streak": user.get("reward_streak", 0),
        "can_claim_today": can_claim,
        "is_girl": user.get("gender", "").lower() == "female",
        "superlikes_bonus": user.get("daily_superlikes_bonus", 0),
    }


@api_router.get("/weekly-highlights/{user_id}")
async def get_weekly_highlights(user_id: str):
    """Get user's weekly activity highlights."""
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    likes = await db.matches.count_documents({
        "user2_id": user_id, "user1_liked": True,
        "created_at": {"$gte": week_ago}
    })
    views = await db.in_app_notifications.count_documents({
        "user_id": user_id, "type": "profile_view",
        "created_at": {"$gte": week_ago}
    })
    matches = await db.matches.count_documents({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
        "matched": True, "created_at": {"$gte": week_ago}
    })
    msgs = await db.messages.count_documents({
        "receiver_id": user_id, "created_at": {"$gte": week_ago}
    })

    return {
        "likes_received": likes,
        "profile_views": views,
        "new_matches": matches,
        "messages_received": msgs,
        "period": "last_7_days"
    }


@api_router.get("/ai-memory/{match_id}")
async def get_ai_memory(match_id: str):
    """Get AI conversation memory — what she remembers about the user."""
    memory = await db.ai_conversation_memory.find_one({"match_id": match_id}, {"_id": 0})
    if not memory or not memory.get("facts"):
        return {"facts": [], "has_memory": False}
    return {"facts": memory["facts"], "has_memory": True, "updated_at": memory.get("updated_at")}




# ==================== OTA UPDATE SYSTEM ====================
@api_router.post("/ota/check")
async def ota_check(request: Request):
    """Check for OTA updates — called by @capgo/capacitor-updater plugin"""
    try:
        body = await request.json()
    except Exception:
        body = {}
    
    app_id = body.get("app_id", "")
    current_version = body.get("version_name", "0.0.0")
    platform = body.get("platform", "")
    
    # Only serve updates for our app on Android
    if app_id != "com.heartlink.app" or platform.lower() not in ("android", ""):
        return {"message": "No update"}
    
    # Check MongoDB for latest OTA bundle
    latest = await db.ota_bundles.find_one(
        {"app_id": "com.heartlink.app", "active": True},
        sort=[("created_at", -1)]
    )
    
    if not latest or latest.get("version", "0.0.0") <= current_version:
        return {"message": "No update"}
    
    return {
        "version": latest["version"],
        "url": latest["url"],
        "checksum": latest.get("checksum", ""),
    }

@api_router.post("/ota/publish")
async def ota_publish(request: Request, admin: dict = Depends(require_admin)):
    """Admin: publish a new OTA bundle"""
    body = await request.json()
    version = body.get("version")
    url = body.get("url")
    checksum = body.get("checksum", "")
    
    if not version or not url:
        raise HTTPException(400, "version and url required")
    
    await db.ota_bundles.insert_one({
        "app_id": "com.heartlink.app",
        "version": version,
        "url": url,
        "checksum": checksum,
        "active": True,
        "created_at": datetime.now(timezone.utc),
    })
    
    return {"message": f"OTA v{version} published", "version": version}

@api_router.get("/ota/latest")
async def ota_latest():
    """Get current OTA version info"""
    latest = await db.ota_bundles.find_one(
        {"app_id": "com.heartlink.app", "active": True},
        sort=[("created_at", -1)]
    )
    if not latest:
        return {"version": "none", "message": "No OTA bundles"}
    return {"version": latest["version"], "url": latest["url"], "created_at": str(latest["created_at"])}

app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
