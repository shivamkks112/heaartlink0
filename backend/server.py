from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Request, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import base64
import hashlib
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import asyncio

# Load environment variables FIRST before importing firebase_config
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)  # Don't override K8s environment variables

# Now import firebase_config after env vars are loaded
from firebase_config import (
    send_match_notification,
    send_message_notification,
    send_like_notification,
    send_verification_notification,
    send_notification_to_multiple,
    send_promotional_notification,
    send_daily_reminder,
    send_inactive_user_notification
)

# Import OneSignal for push notifications (more reliable than FCM)
from onesignal_config import (
    send_onesignal_notification,
    send_notification_to_user as send_onesignal_to_user,
    send_notification_to_users as send_onesignal_to_users,
    send_notification_to_all as send_onesignal_to_all,
    send_match_notification_onesignal,
    send_message_notification_onesignal,
    send_like_notification_onesignal,
    send_admin_notification,
    set_user_external_id,
    add_user_tags
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

# ==================== INDIAN LOCATIONS FILTER ====================
# List of Indian states and major cities for location filtering
INDIAN_STATES = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
    "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka",
    "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram",
    "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu",
    "telangana", "tripura", "uttar pradesh", "uttarakhand", "west bengal",
    "delhi", "jammu and kashmir", "ladakh", "chandigarh", "puducherry",
    "andaman and nicobar", "dadra and nagar haveli", "daman and diu", "lakshadweep"
]

INDIAN_CITIES = [
    "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "chennai", "kolkata",
    "pune", "ahmedabad", "surat", "jaipur", "lucknow", "kanpur", "nagpur", "indore",
    "thane", "bhopal", "visakhapatnam", "patna", "vadodara", "ghaziabad", "ludhiana",
    "agra", "nashik", "faridabad", "meerut", "rajkot", "varanasi", "srinagar",
    "aurangabad", "dhanbad", "amritsar", "navi mumbai", "allahabad", "prayagraj",
    "ranchi", "howrah", "coimbatore", "jabalpur", "gwalior", "vijayawada", "jodhpur",
    "madurai", "raipur", "kota", "chandigarh", "guwahati", "solapur", "hubli",
    "mysore", "mysuru", "tiruchirappalli", "bareilly", "aligarh", "tiruppur",
    "moradabad", "jalandhar", "bhubaneswar", "salem", "warangal", "guntur",
    "bhiwandi", "saharanpur", "gorakhpur", "bikaner", "amravati", "noida",
    "jamshedpur", "bhilai", "cuttack", "firozabad", "kochi", "cochin", "nellore",
    "bhavnagar", "dehradun", "durgapur", "asansol", "rourkela", "nanded", "kolhapur",
    "ajmer", "akola", "gulbarga", "jamnagar", "ujjain", "loni", "siliguri", "jhansi",
    "ulhasnagar", "jammu", "sangli", "mangalore", "erode", "belgaum", "ambattur",
    "tirunelveli", "malegaon", "gaya", "jalgaon", "udaipur", "maheshtala", "davanagere",
    "kozhikode", "calicut", "kurnool", "bokaro", "rajahmundry", "ballari", "bellary",
    "patiala", "gopalpur", "agartala", "bhagalpur", "muzaffarnagar", "bhatpara",
    "panihati", "latur", "dhule", "rohtak", "korba", "bhilwara", "berhampur",
    "muzaffarpur", "ahmednagar", "mathura", "kollam", "avadi", "kadapa", "anantapur",
    "kamarhati", "bilaspur", "sambalpur", "shahjahanpur", "satara", "bijapur",
    "rampur", "shimoga", "chandrapur", "junagadh", "thrissur", "alwar", "bardhaman",
    "kulti", "nizamabad", "parbhani", "tumkur", "khammam", "ozhukarai", "bihar sharif",
    "panipat", "darbhanga", "bally", "aizawl", "dewas", "ichalkaranji", "karnal",
    "bathinda", "jalna", "eluru", "kirari suleman nagar", "barasat", "purnia",
    "satna", "mau", "sonipat", "farrukhabad", "sagar", "rourkela", "durg", "imphal",
    "ratlam", "hapur", "arrah", "karimnagar", "anantapur", "etawah", "ambernath",
    "north dumdum", "bharatpur", "begusarai", "new delhi", "gandhidham", "baranagar",
    "tiruvottiyur", "pondicherry", "sikar", "thoothukudi", "rewa", "mirzapur",
    "raichur", "pali", "kharagpur", "vizianagaram", "katihar", "hardwar", "haridwar",
    "sonepat", "vellore", "lalitpur", "ballia", "unnao", "kangra", "malda", "shimla",
    "bharuch", "naihati", "hosur", "amroha", "bhind", "porbandar", "fatehpur"
]

def is_indian_location(location: str) -> bool:
    """Check if a location is in India"""
    if not location:
        return False
    
    location_lower = location.lower().strip()
    
    # Check if it contains "india"
    if "india" in location_lower:
        return True
    
    # Check against states
    for state in INDIAN_STATES:
        if state in location_lower or location_lower in state:
            return True
    
    # Check against cities
    for city in INDIAN_CITIES:
        if city in location_lower or location_lower in city:
            return True
    
    return False

# MongoDB connection with connection pooling for better performance
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,  # Maximum connections in pool
    minPoolSize=10,  # Minimum connections to maintain
    maxIdleTimeMS=30000,  # Close idle connections after 30 sec
    connectTimeoutMS=5000,  # Connection timeout
    serverSelectionTimeoutMS=5000  # Server selection timeout
)
db = client[os.environ.get('DB_NAME', 'dating_app_db')]

# Create the main app with rate limiting
app = FastAPI(title="HeartLink API", description="Secure Dating App API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

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
    """API health check endpoint"""
    return {"status": "healthy", "service": "HeartLink API"}

# Simple in-memory cache for frequently accessed data
from functools import lru_cache
from cachetools import TTLCache
import time

# Cache for user profiles (5 min TTL, max 1000 items)
user_cache = TTLCache(maxsize=1000, ttl=300)
# Cache for discover results (1 min TTL)
discover_cache = TTLCache(maxsize=500, ttl=60)
# Cache for online status (30 sec TTL, very short for real-time)
online_status_cache = TTLCache(maxsize=2000, ttl=30)
# Cache for likes count (2 min TTL)
likes_cache = TTLCache(maxsize=1000, ttl=120)

def get_cached_user(user_id: str):
    """Get user from cache"""
    return user_cache.get(user_id)

def set_cached_user(user_id: str, user_data: dict):
    """Set user in cache"""
    user_cache[user_id] = user_data

def invalidate_user_cache(user_id: str):
    """Invalidate user cache"""
    user_cache.pop(user_id, None)

def get_cached_online_status(user_id: str):
    """Get online status from cache"""
    return online_status_cache.get(user_id)

def set_cached_online_status(user_id: str, is_online: bool, last_active: str):
    """Set online status in cache"""
    online_status_cache[user_id] = {"is_online": is_online, "last_active": last_active}

# Database index creation on startup
async def create_indexes():
    """Create MongoDB indexes for better query performance"""
    try:
        # Users collection indexes
        await db.users.create_index("id", unique=True, background=True)
        await db.users.create_index("email", sparse=True, background=True)
        await db.users.create_index("phone", sparse=True, background=True)
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
        await db.users.create_index("profile_status", background=True)  # For admin approvals
        await db.users.create_index("created_at", background=True)  # For sorting
        # Compound index for discover queries
        await db.users.create_index([
            ("gender", 1), 
            ("looking_for", 1), 
            ("is_shadow_banned", 1),
            ("is_permanently_banned", 1)
        ], background=True)
        # Compound index for admin pending profiles
        await db.users.create_index([
            ("profile_status", 1),
            ("created_at", -1)
        ], background=True)
        
        # Matches collection indexes
        await db.matches.create_index("id", unique=True, background=True)
        await db.matches.create_index("user1_id", background=True)
        await db.matches.create_index("user2_id", background=True)
        await db.matches.create_index("matched", background=True)
        await db.matches.create_index([("user1_id", 1), ("user2_id", 1)], background=True)
        await db.matches.create_index([("matched", 1), ("user1_id", 1)], background=True)
        await db.matches.create_index([("matched", 1), ("user2_id", 1)], background=True)
        
        # Messages collection indexes
        await db.messages.create_index("id", unique=True, background=True)
        await db.messages.create_index("match_id", background=True)
        await db.messages.create_index("sender_id", background=True)
        await db.messages.create_index("receiver_id", background=True)
        await db.messages.create_index([("match_id", 1), ("created_at", 1)], background=True)
        
        # Reports collection indexes
        await db.reports.create_index("reporter_id", background=True)
        await db.reports.create_index("reported_user_id", background=True)
        await db.reports.create_index("status", background=True)
        
        # Profile views collection indexes
        await db.profile_views.create_index("profile_id", background=True)
        await db.profile_views.create_index("viewer_id", background=True)
        await db.profile_views.create_index([("profile_id", 1), ("viewed_at", -1)], background=True)
        
        logging.info("✅ MongoDB indexes created successfully")
    except Exception as e:
        logging.error(f"❌ Error creating indexes: {e}")

@app.on_event("startup")
async def startup_event():
    """Run on app startup"""
    await create_indexes()
    logging.info("🚀 HeartLink server started with optimized indexes")

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
            except:
                self.disconnect(user_id)
    
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

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password_hash: str
    name: str
    age: int
    gender: str  # male/female/non-binary
    looking_for: str
    bio: str = ""
    location: str
    latitude: Optional[float] = None  # For nearby matches
    longitude: Optional[float] = None  # For nearby matches
    photos: List[str] = []
    interests: List[str] = []
    verified: bool = False
    verification_status: str = "pending"  # pending, verified, rejected
    profile_status: str = "pending"  # pending, approved, rejected - Admin approval for new profiles
    is_admin: bool = False  # Admin flag
    fcm_token: Optional[str] = None  # Firebase Cloud Messaging token for push notifications
    
    # === NEW SAFETY & TRUST FIELDS ===
    # Gender Lock Feature
    show_to_gender: str = "both"  # male/female/both
    gender_lock_enabled: bool = False
    hide_profile_from_gender: str = "none"  # male/female/none
    
    # Profile Media
    bio_voice_intro_url: Optional[str] = None  # 15 sec voice intro
    intro_video_url: Optional[str] = None  # Optional intro video
    
    # Trust & Safety
    trust_badge_level: str = "low"  # low/medium/high
    risk_score: int = 0  # 0-100, admin only visible
    is_verified_male: bool = False  # For women safety - verified male
    
    # In-App Notifications (Alternative to FCM)
    unread_notifications: int = 0  # Count of unread notifications
    
    # Profile Enhancement
    about_me: str = ""  # Extended bio
    values: List[str] = []  # respect, family, ambition, spirituality, freedom
    relationship_status: str = ""  # single, divorced, widowed, separated, complicated
    relationship_intent: str = ""  # serious, casual, friendship, marriage
    lifestyle_tags: List[str] = []  # non-smoker, vegetarian, fitness, travel
    
    # Profile Viewers
    profile_viewers: List[Dict] = []  # Last 5 viewers [{user_id, viewed_at}]
    
    # Device Blocking
    device_ids: List[str] = []  # User's device IDs
    blocked_device_ids: List[str] = []  # Blocked device IDs
    
    # Women Safety Mode
    women_safety_mode: bool = False  # Enable extra safety features
    night_quiet_hours_enabled: bool = False  # 10pm-7am auto mute
    first_message_delay_exempt: bool = False  # Exempted from 2 min delay
    
    # Banning
    is_shadow_banned: bool = False
    is_permanently_banned: bool = False
    ban_reason: Optional[str] = None
    
    # Legacy fields
    privacy_settings: Dict = Field(default_factory=lambda: {
        "show_profile": True,
        "show_photos": True,
        "incognito_mode": False
    })
    blocked_users: List[str] = []
    muted_users: List[str] = []
    profile_views: int = 0
    is_online: bool = False
    last_active: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        arbitrary_types_allowed = True

class UserSignup(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    name: str
    age: int
    gender: str  # male/female/non-binary
    looking_for: str
    bio: str = ""
    location: str
    interests: List[str] = []
    # New optional fields during signup
    show_to_gender: str = "both"
    relationship_status: str = ""  # single, divorced, widowed, separated, complicated
    relationship_intent: str = ""
    values: List[str] = []
    lifestyle_tags: List[str] = []

class UserLogin(BaseModel):
    email_or_phone: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email_or_phone: str

class ResetPasswordRequest(BaseModel):
    email_or_phone: str
    reset_code: str
    new_password: str

class DeleteAccountRequest(BaseModel):
    email: EmailStr
    reason: Optional[str] = None

class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user1_id: str
    user2_id: str
    user1_liked: bool = False
    user2_liked: bool = False
    matched: bool = False
    is_superlike: bool = False
    compatibility_score: Optional[float] = None
    ai_analysis: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# In-App Notification Model
class InAppNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Recipient user
    title: str
    body: str
    type: str = "general"  # general, match, like, message, admin, promotion
    is_read: bool = False
    data: dict = {}  # Additional data like match_id, sender_id
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: Optional[str] = None  # Optional expiration

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    match_id: str
    sender_id: str
    receiver_id: str
    content: str
    read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class LikeAction(BaseModel):
    target_user_id: str
    action: str  # like, pass, superlike

class BlockUser(BaseModel):
    blocked_user_id: str

class MuteUser(BaseModel):
    muted_user_id: str

class ReportUser(BaseModel):
    reported_user_id: str
    reason: str
    
class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    location: str  # City name

class PrivacyUpdate(BaseModel):
    show_profile: Optional[bool] = None
    show_photos: Optional[bool] = None
    incognito_mode: Optional[bool] = None

# === NEW MODELS FOR SAFETY FEATURES ===

class GenderLockUpdate(BaseModel):
    gender_lock_enabled: Optional[bool] = None
    show_to_gender: Optional[str] = None  # male/female/both
    hide_profile_from_gender: Optional[str] = None  # male/female/none

class ProfileEnhancementUpdate(BaseModel):
    about_me: Optional[str] = None
    bio_voice_intro_url: Optional[str] = None
    intro_video_url: Optional[str] = None
    values: Optional[List[str]] = None  # respect, family, ambition, spirituality, freedom
    relationship_intent: Optional[str] = None  # serious, casual, friendship, marriage
    lifestyle_tags: Optional[List[str]] = None  # non-smoker, vegetarian, fitness, travel

class WomenSafetyUpdate(BaseModel):
    women_safety_mode: Optional[bool] = None
    night_quiet_hours_enabled: Optional[bool] = None

class AdminUserUpdate(BaseModel):
    user_id: str
    gender_lock_enabled: Optional[bool] = None
    is_verified_male: Optional[bool] = None
    trust_badge_level: Optional[str] = None
    risk_score: Optional[int] = None
    is_shadow_banned: Optional[bool] = None
    is_permanently_banned: Optional[bool] = None
    ban_reason: Optional[str] = None

class DeviceBlock(BaseModel):
    device_id: str

class DiscoverFilters(BaseModel):
    relationship_intent: Optional[str] = None
    values: Optional[List[str]] = None
    lifestyle_tags: Optional[List[str]] = None
    trust_badge_level: Optional[str] = None
    last_active_within_hours: Optional[int] = None  # e.g., 24 = active in last 24 hours

class AdminVerification(BaseModel):
    user_id: str
    action: str  # 'approve' or 'reject'
    reason: Optional[str] = None
    verified_by: str

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash

def clean_user_data(user_data: dict) -> dict:
    """Clean user data to prevent Pydantic validation errors with None values"""
    cleaned_user = {}
    for key, value in user_data.items():
        if value is not None:
            cleaned_user[key] = value
        else:
            # Set default values for None fields based on User model
            if key in ["bio", "about_me"]:
                cleaned_user[key] = ""
            elif key in ["photos", "interests", "blocked_users", "muted_users", "values", "lifestyle_tags", "profile_viewers", "device_ids", "blocked_device_ids"]:
                cleaned_user[key] = []
            elif key in ["email", "phone", "fcm_token", "latitude", "longitude", "bio_voice_intro_url", "intro_video_url", "ban_reason"]:
                cleaned_user[key] = None
            elif key in ["profile_views", "risk_score"]:
                cleaned_user[key] = 0
            else:
                cleaned_user[key] = value
    return cleaned_user

def serialize_user_for_response(user_dict: dict, exclude_password: bool = True) -> dict:
    """
    Serialize user data for API responses - PERMANENT FIX
    Removes MongoDB _id and optionally password_hash
    """
    # Remove MongoDB's _id field
    user_dict.pop('_id', None)
    
    # Remove password related fields if needed
    if exclude_password:
        user_dict.pop('password_hash', None)
        user_dict.pop('password', None)  # Also remove plain password if exists
        user_dict.pop('password_reset_code', None)  # Security - don't expose reset codes
        user_dict.pop('password_reset_expires', None)
    
    # Clean None values
    cleaned = clean_user_data(user_dict)
    
    return cleaned

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
            except:
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
    
    # Check if user exists
    if user_data.email:
        existing = await db.users.find_one({"email": user_data.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    if user_data.phone:
        existing = await db.users.find_one({"phone": user_data.phone})
        if existing:
            raise HTTPException(status_code=400, detail="Phone already registered")
    
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
        
        # Insert into database
        insert_result = await db.users.insert_one(user_dict_for_db)
        
        # Fetch the created user from database
        created_user = await db.users.find_one({"id": user.id})
        if not created_user:
            raise HTTPException(status_code=500, detail="User created but not found")
        
        # Create JWT tokens for immediate login
        token_data = {"user_id": user.id, "email": user_data.email}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        # Audit log
        audit_log.log_event("signup_success", user_id=user.id, ip=client_ip)
        
        # Serialize for response (removes _id, password_hash, cleans None values)
        clean_user = serialize_user_for_response(created_user, exclude_password=True)
        
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
    
    # Verify password (supports both bcrypt and legacy SHA256)
    if not verify_password_secure(credentials.password, user["password_hash"]):
        is_suspicious = activity_detector.record_failed_login(client_ip)
        if is_suspicious:
            audit_log.log_event("suspicious_login_attempts", user_id=user["id"], ip=client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user is banned
    if user.get("is_permanently_banned"):
        raise HTTPException(status_code=403, detail="Account has been permanently banned")
    
    # Clear failed login records on successful login
    activity_detector.clear_failed_logins(client_ip)
    
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
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "last_login": datetime.now(timezone.utc).isoformat(),
            "last_login_ip": client_ip,
            "is_online": True,
            "last_active": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Audit log
    audit_log.log_event("login_success", user_id=user["id"], ip=client_ip)
    
    # Serialize for response (removes _id, password_hash, cleans None values)
    clean_user = serialize_user_for_response(user, exclude_password=True)
    
    return {
        "message": "Login successful",
        "user": clean_user,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

class PhoneLogin(BaseModel):
    phone: str
    firebase_uid: str

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
    
    # Serialize for response
    clean_user = serialize_user_for_response(user, exclude_password=True)
    
    return {"message": "Login successful", "user": clean_user}

class PhoneSignup(BaseModel):
    phone: str
    firebase_uid: str
    name: str
    age: int
    gender: str
    looking_for: str
    location: str
    bio: str = ""
    interests: List[str] = []
    relationship_status: str = ""  # single, divorced, widowed, separated, complicated

@api_router.post("/auth/phone-signup")
async def phone_signup(data: PhoneSignup):
    """
    Phone signup - for users who verified via OTP
    """
    # Normalize phone
    phone = data.phone
    if not phone.startswith('+'):
        phone = '+' + phone
    
    # Check if user already exists
    existing = await db.users.find_one({
        "$or": [
            {"phone": phone},
            {"firebase_uid": data.firebase_uid}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="User already exists with this phone number")
    
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
        relationship_status=data.relationship_status,
        verified=True  # Phone verified via OTP
    )
    
    user_dict = user.dict()
    user_dict["firebase_uid"] = data.firebase_uid
    user_dict.pop("_id", None)
    
    await db.users.insert_one(user_dict)
    
    # Fetch created user
    created_user = await db.users.find_one({"id": user_id})
    clean_user = serialize_user_for_response(created_user, exclude_password=True)
    
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

class RefreshTokenRequest(BaseModel):
    refresh_token: str

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

class ChangePasswordRequest(BaseModel):
    user_id: str
    current_password: str
    new_password: str

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
    # Remove sensitive/locked fields that should NEVER be changed
    locked_fields = ["password_hash", "id", "_id", "name", "gender", "email", "phone", "firebase_uid", "created_at"]
    for field in locked_fields:
        updates.pop(field, None)
    
    # Filter out None values to prevent validation errors
    filtered_updates = {k: v for k, v in updates.items() if v is not None}
    
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
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings = user.get("privacy_settings", {})
    if privacy.show_profile is not None:
        settings["show_profile"] = privacy.show_profile
    if privacy.show_photos is not None:
        settings["show_photos"] = privacy.show_photos
    if privacy.incognito_mode is not None:
        settings["incognito_mode"] = privacy.incognito_mode
    
    await db.users.update_one({"id": user_id}, {"$set": {"privacy_settings": settings}})
    return {"message": "Privacy settings updated", "settings": settings}

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
        
        # Send push notification
        if user.get('fcm_token'):
            send_verification_notification(
                token=user['fcm_token'],
                status="approved"
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
        
        # Send push notification
        if user.get('fcm_token'):
            send_verification_notification(
                token=user['fcm_token'],
                status="rejected"
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
async def discover_users(user_id: str, limit: int = 10, relationship_intent: str = None, trust_badge_level: str = None, last_active_hours: int = None):
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
            "gender_lock_enabled": 1, "show_to_gender": 1
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
        "is_permanently_banned": {"$ne": True}
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
    
    # Projection for discover - only fields needed for cards
    discover_projection = {
        "_id": 0, "id": 1, "name": 1, "age": 1, "bio": 1,
        "photos": 1, "interests": 1, "verified": 1, "location": 1,
        "profile_picture": 1, "is_online": 1, "last_active": 1,
        "trust_badge_level": 1, "relationship_intent": 1,
        "values": 1, "lifestyle_tags": 1,
        "gender_lock_enabled": 1, "show_to_gender": 1, "hide_profile_from_gender": 1
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
        if len(filtered_users) >= limit:
            break
    
    return [{
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
        "lifestyle_tags": u.get("lifestyle_tags", [])
    } for u in filtered_users]

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
        "privacy_settings.show_profile": True
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
        
        # Send real-time notification
        await manager.send_message(action.target_user_id, {
            "type": "new_match",
            "user": {"id": user_id, "name": user1["name"]}
        })
        
        # Send push notification to matched user via FCM (legacy)
        if user2.get('fcm_token'):
            send_match_notification(
                token=user2['fcm_token'],
                user_name=user1['name'],
                compatibility_score=int(score)
            )
        
        # Send push notification via OneSignal (primary)
        send_match_notification_onesignal(
            user_id=action.target_user_id,
            matched_user_name=user1['name']
        )
        
        return {
            "action": "matched",
            "match_id": existing["id"],
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
            
            # Send push notification via FCM (legacy)
            if user2 and user2.get('fcm_token'):
                send_like_notification(
                    token=user2['fcm_token'],
                    user_name=user1['name']
                )
            
            # Send push notification via OneSignal (primary)
            send_like_notification_onesignal(
                user_id=action.target_user_id,
                liker_name=user1['name']
            )
        elif action.action == "like":
            # Send like notification for regular likes too via FCM (legacy)
            if user2 and user2.get('fcm_token'):
                send_like_notification(
                    token=user2['fcm_token'],
                    user_name=user1['name']
                )
            
            # Send push notification via OneSignal (primary)
            send_like_notification_onesignal(
                user_id=action.target_user_id,
                liker_name=user1['name']
            )
        
        return {"action": "liked"}

# Matches Routes
@api_router.get("/matches/{user_id}")
async def get_matches(user_id: str):
    """Get user matches - OPTIMIZED with batch queries"""
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
    
    return result

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
    
    # Find active users (users created/updated recently)
    # You can add last_active field in future
    query = {
        "id": {"$ne": user_id, "$nin": blocked_users + blocker_ids + list(matched_ids)},
        "gender": current_user["looking_for"],
        "looking_for": current_user["gender"],
        "privacy_settings.show_profile": True
    }
    
    users = await db.users.find(query).sort("created_at", -1).limit(limit).to_list(None)
    
    return [{
        "id": u["id"],
        "name": u["name"],
        "age": u["age"],
        "bio": u.get("bio", ""),
        "photos": u.get("photos", []),
        "profile_picture": u.get("profile_picture"),
        "interests": u.get("interests", []),
        "verified": u.get("verified", False),
        "location": u.get("location", "")
    } for u in users]

# Chat Routes
@api_router.get("/messages/{match_id}")
async def get_messages(match_id: str):
    messages = await db.messages.find({"match_id": match_id}).sort("created_at", 1).to_list(None)
    return [Message(**m).dict() for m in messages]

@api_router.post("/messages")
async def send_message_http(message_data: Message):
    """Send message with women safety checks"""
    # Get sender and receiver
    sender = await db.users.find_one({"id": message_data.sender_id})
    receiver = await db.users.find_one({"id": message_data.receiver_id})
    
    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    # === WOMEN SAFETY MODE CHECKS ===
    if receiver.get("women_safety_mode"):
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
    
    # Check if sender is muted by receiver
    muted_users = receiver.get('muted_users', [])
    sender_not_muted = message_data.sender_id not in muted_users
    
    # Send push notification to receiver via FCM (legacy)
    if receiver.get('fcm_token') and sender and sender_not_muted:
        send_message_notification(
            token=receiver['fcm_token'],
            sender_name=sender['name'],
            message_preview=message_data.content
        )
    
    # Send push notification via OneSignal (primary)
    if sender and sender_not_muted:
        send_message_notification_onesignal(
            user_id=message_data.receiver_id,
            sender_name=sender['name'],
            message_preview=message_data.content
        )
    
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
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
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
            receiver = await db.users.find_one({"id": message_data["receiver_id"]})
            sender = await db.users.find_one({"id": user_id})
            
            if receiver and receiver.get('fcm_token') and sender:
                # Check if sender is muted by receiver
                muted_users = receiver.get('muted_users', [])
                if user_id not in muted_users:
                    send_message_notification(
                        token=receiver['fcm_token'],
                        sender_name=sender['name'],
                        message_preview=message_data["content"]
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

class FCMTokenRequest(BaseModel):
    user_id: str
    fcm_token: str

@api_router.post("/fcm/register-token")
async def register_fcm_token(request: FCMTokenRequest):
    """Register or update FCM token for a user"""
    try:
        result = await db.users.update_one(
            {"id": request.user_id},
            {"$set": {"fcm_token": request.fcm_token}}
        )
        
        if result.modified_count > 0 or result.matched_count > 0:
            return {"success": True, "message": "FCM token registered successfully"}
        else:
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        logger.error(f"Error registering FCM token: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
class MakeAdminRequest(BaseModel):
    secret_code: str
    user_email: str

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
    search: str = "", 
    page: int = 1, 
    limit: int = 20,
    gender: str = None,
    status: str = None,
    sort: str = "newest"
):
    """Get all users with search, filters, sorting and pagination for admin"""
    skip = (page - 1) * limit
    
    # Build search query
    query = {}
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
async def get_dashboard_stats():
    """Get comprehensive dashboard statistics"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    
    # Total users
    total_users = await db.users.count_documents({})
    
    # Gender breakdown
    male_users = await db.users.count_documents({"gender": {"$regex": "^male$", "$options": "i"}})
    female_users = await db.users.count_documents({"gender": {"$regex": "^female$", "$options": "i"}})
    
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
        } for u in recent_signups]
    }

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

# === PHOTO VERIFICATION SYSTEM ===
class SelfieVerificationRequest(BaseModel):
    user_id: str
    selfie_url: str

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

class VerifySelfieRequest(BaseModel):
    user_id: str
    action: str  # approve or reject
    reason: str = ""

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
            send_onesignal_to_user(
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


class ReVerifyRequest(BaseModel):
    user_id: str
    reason: str = ""


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
        send_onesignal_to_user(
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


class ProfileApprovalRequest(BaseModel):
    user_id: str
    action: str  # approve or reject
    reason: str = ""


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
        
        # Send notification to user via OneSignal
        try:
            send_onesignal_to_user(
                user_id=data.user_id,
                title="🎉 Profile Approved!",
                message="Your profile has been approved. Start finding your match now!"
            )
        except Exception as e:
            logger.error(f"Failed to send approval notification: {e}")
        
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
        
        # Send notification to user via OneSignal
        try:
            send_onesignal_to_user(
                user_id=data.user_id,
                title="❌ Profile Not Approved",
                message=f"Your profile needs changes: {data.reason}" if data.reason else "Please update your profile and try again."
            )
        except Exception as e:
            logger.error(f"Failed to send rejection notification: {e}")
        
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
    
    # Send notifications to all approved users via OneSignal
    for user_id in user_ids:
        try:
            send_onesignal_to_user(
                user_id=user_id,
                title="🎉 Profile Approved!",
                message="Your profile has been approved. Start finding your match now!"
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

class BulkNotificationRequest(BaseModel):
    title: str
    body: str
    target: str = "all"  # all, male, female, inactive

class ScheduledNotificationRequest(BaseModel):
    title: str
    body: str
    target: str = "all"
    schedule_time: str  # ISO format datetime

@api_router.post("/admin/send-notification")
async def send_bulk_notification(data: BulkNotificationRequest):
    """
    Send notification to all users or specific group
    Target options: all, male, female, inactive
    """
    # Build query based on target
    query = {"fcm_token": {"$exists": True, "$ne": None, "$ne": ""}}
    
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

async def create_in_app_notification(user_id: str, title: str, body: str, notification_type: str = "general", data: dict = None):
    """Helper function to create in-app notification"""
    notification = InAppNotification(
        user_id=user_id,
        title=title,
        body=body,
        type=notification_type,
        data=data or {}
    )
    
    await db.in_app_notifications.insert_one(notification.dict())
    
    # Update unread count
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"unread_notifications": 1}}
    )
    
    return notification

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
        # Decrease unread count
        await db.users.update_one(
            {"id": user_id, "unread_notifications": {"$gt": 0}},
            {"$inc": {"unread_notifications": -1}}
        )
    
    return {"success": True}

@api_router.post("/notifications/{user_id}/read-all")
async def mark_all_notifications_read(user_id: str):
    """Mark all notifications as read for a user"""
    result = await db.in_app_notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    # Reset unread count
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"unread_notifications": 0}}
    )
    
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

class AdminNotificationWithEmail(BaseModel):
    title: str
    body: str
    target: str = "all"  # all, male, female, inactive
    send_email: bool = True
    send_in_app: bool = True

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
class NotificationTemplateCreate(BaseModel):
    title: str
    body: str
    category: str = "custom"


@api_router.get("/admin/notification-templates")
async def get_all_notification_templates():
    """Get all notification templates (pre-defined + custom)"""
    return await get_notification_templates()


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

class AdImpressionRequest(BaseModel):
    user_id: str
    ad_type: str  # rewarded, interstitial, banner
    reward_type: Optional[str] = None  # extra_swipes, profile_boost, priority_message
    amount: Optional[int] = None
    timestamp: str

class AdRewardRequest(BaseModel):
    user_id: str
    reward_type: str  # extra_swipes, profile_boost, priority_message
    amount: int
    timestamp: str

@api_router.post("/ads/impression")
async def track_ad_impression(data: AdImpressionRequest):
    """
    Track ad impression for analytics
    Business Rules:
    - Only male, non-premium users can have ad impressions
    - Max 1 interstitial per day
    """
    # Verify user exists and is eligible
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check eligibility - only male non-premium users
    if user.get("gender", "").lower() != "male":
        raise HTTPException(status_code=403, detail="Ads only for male users")
    
    if user.get("is_premium") or user.get("isPremium"):
        raise HTTPException(status_code=403, detail="Premium users don't see ads")
    
    # Record impression
    impression_doc = {
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "ad_type": data.ad_type,
        "reward_type": data.reward_type,
        "amount": data.amount,
        "timestamp": data.timestamp,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ad_impressions.insert_one(impression_doc)
    
    # Update user's ad stats
    await db.users.update_one(
        {"id": data.user_id},
        {
            "$inc": {f"ad_stats.{data.ad_type}_count": 1},
            "$set": {"ad_stats.last_ad_shown": data.timestamp}
        }
    )
    
    return {"success": True, "impression_id": impression_doc["id"]}

@api_router.post("/ads/reward")
async def track_ad_reward(data: AdRewardRequest):
    """Track reward earned from watching ad"""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Record reward
    reward_doc = {
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "reward_type": data.reward_type,
        "amount": data.amount,
        "timestamp": data.timestamp,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ad_rewards.insert_one(reward_doc)
    
    # Apply reward to user based on type
    update_fields = {}
    
    if data.reward_type == "extra_swipes":
        update_fields["extra_swipes"] = user.get("extra_swipes", 0) + data.amount
    elif data.reward_type == "profile_boost":
        boost_end = datetime.now(timezone.utc) + timedelta(minutes=data.amount)
        update_fields["profile_boost_end"] = boost_end.isoformat()
        update_fields["is_boosted"] = True
    elif data.reward_type == "priority_message":
        update_fields["priority_messages"] = user.get("priority_messages", 0) + data.amount
    
    if update_fields:
        await db.users.update_one(
            {"id": data.user_id},
            {"$set": update_fields}
        )
    
    invalidate_user_cache(data.user_id)
    
    return {"success": True, "reward_applied": data.reward_type, "amount": data.amount}

@api_router.get("/ads/stats/{user_id}")
async def get_ad_stats(user_id: str):
    """Get user's ad statistics"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get today's impressions
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    today_impressions = await db.ad_impressions.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    today_interstitials = await db.ad_impressions.count_documents({
        "user_id": user_id,
        "ad_type": "interstitial",
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Get total rewards earned
    rewards_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$reward_type",
            "total_amount": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    rewards_summary = await db.ad_rewards.aggregate(rewards_pipeline).to_list(None)
    
    return {
        "user_id": user_id,
        "is_eligible": user.get("gender", "").lower() == "male" and not user.get("is_premium"),
        "today_impressions": today_impressions,
        "today_interstitials": today_interstitials,
        "can_show_interstitial": today_interstitials < 1,  # Max 1 per day
        "extra_swipes": user.get("extra_swipes", 0),
        "priority_messages": user.get("priority_messages", 0),
        "is_boosted": user.get("is_boosted", False),
        "boost_end": user.get("profile_boost_end"),
        "rewards_summary": {r["_id"]: {"total": r["total_amount"], "count": r["count"]} for r in rewards_summary}
    }

@api_router.get("/ads/frequency-cap/{user_id}")
async def check_frequency_cap(user_id: str):
    """Check if user can see interstitial ad today"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check eligibility
    if user.get("gender", "").lower() != "male":
        return {"can_show": False, "reason": "female_user"}
    
    if user.get("is_premium") or user.get("isPremium"):
        return {"can_show": False, "reason": "premium_user"}
    
    # Check today's interstitial count
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    today_interstitials = await db.ad_impressions.count_documents({
        "user_id": user_id,
        "ad_type": "interstitial",
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    if today_interstitials >= 1:
        # Calculate next eligible time (midnight UTC)
        tomorrow = today_start + timedelta(days=1)
        return {
            "can_show": False,
            "reason": "daily_limit_reached",
            "next_eligible_at": tomorrow.isoformat()
        }
    
    return {"can_show": True}

# ==================== PREMIUM SUBSCRIPTION APIS ====================

class SubscriptionCreateRequest(BaseModel):
    user_id: str
    plan_id: str  # monthly, quarterly, yearly

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

# CORS - Add before routes
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ADMIN: Complete Database Cleanup Endpoint (DANGEROUS - USE WITH CAUTION)
class DatabaseClearRequest(BaseModel):
    confirm: str
    admin_password: str

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
            "fcm_token": {"$exists": True, "$ne": None, "$ne": ""}
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
            "fcm_token": {"$exists": True, "$ne": None, "$ne": ""},
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
        "fcm_token": {"$exists": True, "$ne": None, "$ne": ""}
    })
    
    # Count inactive users
    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    inactive_count = await db.users.count_documents({
        "fcm_token": {"$exists": True, "$ne": None, "$ne": ""},
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

@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup"""
    # Start daily notification scheduler
    asyncio.create_task(daily_notification_scheduler())
    logger.info("✅ Daily notification scheduler started")
    
    # Start scheduled notification processor
    asyncio.create_task(scheduled_notification_processor())
    logger.info("✅ Scheduled notification processor started")


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
                        result = send_onesignal_to_all(title, message)
                    elif target in ["male", "female"]:
                        query = {"gender": {"$regex": f"^{target}$", "$options": "i"}}
                        users = await db.users.find(query, {"id": 1}).to_list(None)
                        user_ids = [u["id"] for u in users]
                        if user_ids:
                            result = send_onesignal_to_users(user_ids, title, message)
                        else:
                            result = {"success": False, "error": f"No {target} users found"}
                    elif target == "inactive":
                        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
                        query = {"last_active": {"$lt": week_ago}}
                        users = await db.users.find(query, {"id": 1}).to_list(None)
                        user_ids = [u["id"] for u in users]
                        if user_ids:
                            result = send_onesignal_to_users(user_ids, title, message)
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

# ==================== ONESIGNAL NOTIFICATION APIS ====================

class OneSignalNotificationRequest(BaseModel):
    title: str
    message: str
    target: str = "all"  # all, user_ids, male, female
    user_ids: Optional[List[str]] = None

class OneSignalUserLinkRequest(BaseModel):
    user_id: str  # Your app's user ID
    onesignal_player_id: str  # OneSignal's player/subscription ID

@api_router.post("/admin/onesignal/send")
async def send_onesignal_notification_api(data: OneSignalNotificationRequest):
    """
    Send push notification via OneSignal (Admin Panel)
    Target options: all, user_ids, male, female, inactive
    """
    if data.target == "all":
        result = send_onesignal_to_all(data.title, data.message)
    elif data.target == "user_ids" and data.user_ids:
        result = send_onesignal_to_users(data.user_ids, data.title, data.message)
    elif data.target in ["male", "female"]:
        # Get users by gender
        query = {"gender": {"$regex": f"^{data.target}$", "$options": "i"}}
        users = await db.users.find(query, {"id": 1}).to_list(None)
        user_ids = [u["id"] for u in users]
        if user_ids:
            result = send_onesignal_to_users(user_ids, data.title, data.message)
        else:
            result = {"success": False, "error": f"No {data.target} users found"}
    elif data.target == "inactive":
        # Get users inactive for 7+ days
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query = {"last_active": {"$lt": week_ago}}
        users = await db.users.find(query, {"id": 1}).to_list(None)
        user_ids = [u["id"] for u in users]
        if user_ids:
            result = send_onesignal_to_users(user_ids, data.title, data.message)
        else:
            result = {"success": False, "error": "No inactive users found"}
    else:
        result = {"success": False, "error": "Invalid target"}
    
    # Log notification
    await db.notification_logs.insert_one({
        "id": str(uuid.uuid4()),
        "title": data.title,
        "body": data.message,
        "target": data.target,
        "provider": "onesignal",
        "result": result,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    
    return result

@api_router.post("/admin/onesignal/send-to-user/{user_id}")
async def send_onesignal_to_single_user(user_id: str, title: str, message: str):
    """Send notification to a specific user via OneSignal"""
    result = send_onesignal_to_user(user_id, title, message)
    return result

@api_router.post("/user/onesignal/register")
async def register_onesignal_user(data: OneSignalUserLinkRequest):
    """
    Link OneSignal player ID with app user ID
    Call this when user logs in
    """
    # Set external ID in OneSignal
    result = set_user_external_id(data.onesignal_player_id, data.user_id)
    
    if result.get("success"):
        # Also save OneSignal player ID in user profile
        await db.users.update_one(
            {"id": data.user_id},
            {"$set": {"onesignal_player_id": data.onesignal_player_id}}
        )
        invalidate_user_cache(data.user_id)
    
    return result

@api_router.get("/admin/onesignal/status")
async def get_onesignal_status():
    """Check OneSignal configuration status"""
    import os
    app_id = os.environ.get('ONESIGNAL_APP_ID', '')
    api_key = os.environ.get('ONESIGNAL_API_KEY', '')
    
    # Count users with OneSignal IDs
    total = await db.users.count_documents({})
    with_onesignal = await db.users.count_documents({
        "onesignal_player_id": {"$exists": True, "$ne": None, "$ne": ""}
    })
    
    return {
        "configured": bool(app_id and api_key),
        "app_id_set": bool(app_id),
        "api_key_set": bool(api_key),
        "total_users": total,
        "users_with_onesignal": with_onesignal,
        "users_without_onesignal": total - with_onesignal,
        "can_send_notifications": bool(app_id and api_key),
        "message": "OneSignal configured and ready!" if (app_id and api_key) else "Please set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY in .env"
    }

@api_router.post("/admin/onesignal/test")
async def test_onesignal():
    """Send a test notification to all users via OneSignal"""
    result = send_onesignal_to_all(
        "🎉 Test Notification", 
        "OneSignal integration is working! - HeartLink Team"
    )
    return result

# Include router - MUST be at the very end after all route definitions
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
