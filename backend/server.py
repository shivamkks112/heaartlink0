from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
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
    send_verification_notification
)

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

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Simple in-memory cache for frequently accessed data
from functools import lru_cache
from cachetools import TTLCache
import time

# Cache for user profiles (5 min TTL, max 1000 items)
user_cache = TTLCache(maxsize=1000, ttl=300)
# Cache for discover results (1 min TTL)
discover_cache = TTLCache(maxsize=500, ttl=60)

def get_cached_user(user_id: str):
    """Get user from cache"""
    return user_cache.get(user_id)

def set_cached_user(user_id: str, user_data: dict):
    """Set user in cache"""
    user_cache[user_id] = user_data

def invalidate_user_cache(user_id: str):
    """Invalidate user cache"""
    user_cache.pop(user_id, None)

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
        # Compound index for discover queries
        await db.users.create_index([
            ("gender", 1), 
            ("looking_for", 1), 
            ("is_shadow_banned", 1),
            ("is_permanently_banned", 1)
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
    
    # Profile Enhancement
    about_me: str = ""  # Extended bio
    values: List[str] = []  # respect, family, ambition, spirituality, freedom
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
    compatibility_score: Optional[float] = None
    ai_analysis: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

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
    
    # Remove password hash if needed
    if exclude_password:
        user_dict.pop('password_hash', None)
    
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
async def signup(user_data: UserSignup):
    """
    User signup endpoint - PERMANENT FIX
    Handles MongoDB ObjectId serialization properly
    """
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
        user_dict["password_hash"] = hash_password(user_data.password)
        del user_dict["password"]
        
        # Create User object to get all defaults (privacy_settings, etc.)
        user = User(**user_dict)
        user_dict_for_db = user.dict() if hasattr(user, 'dict') else user.model_dump()
        
        # Insert into database
        insert_result = await db.users.insert_one(user_dict_for_db)
        
        # Fetch the created user from database
        created_user = await db.users.find_one({"id": user.id})
        if not created_user:
            raise HTTPException(status_code=500, detail="User created but not found")
        
        # Serialize for response (removes _id, password_hash, cleans None values)
        clean_user = serialize_user_for_response(created_user, exclude_password=True)
        
        return {
            "message": "Signup successful",
            "user_id": user.id,
            "user": clean_user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    """
    User login endpoint - PERMANENT FIX
    Handles MongoDB ObjectId serialization properly
    """
    # Find user by email or phone
    user = await db.users.find_one({
        "$or": [
            {"email": credentials.email_or_phone},
            {"phone": credentials.email_or_phone}
        ]
    })
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Serialize for response (removes _id, password_hash, cleans None values)
    clean_user = serialize_user_for_response(user, exclude_password=True)
    
    return {"message": "Login successful", "user": clean_user}

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
async def reset_password(request: ResetPasswordRequest):
    """Reset password using verified code"""
    # Find user
    user = await db.users.find_one({
        "$or": [
            {"email": request.email_or_phone},
            {"phone": request.email_or_phone}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify code
    if not user.get("password_reset_code"):
        raise HTTPException(status_code=400, detail="No reset code requested")
    
    if user["password_reset_code"] != request.reset_code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    # Check if code expired
    expires_at = datetime.fromisoformat(user["password_reset_expires"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset code expired")
    
    # Update password
    new_password_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": new_password_hash,
            "password_reset_code": None,
            "password_reset_expires": None
        }}
    )
    
    return {"message": "Password reset successful"}

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
    """Get user profile - PERMANENT FIX"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Serialize for response
    clean_user = serialize_user_for_response(user, exclude_password=True)
    return clean_user

@api_router.put("/profile/{user_id}")
async def update_profile(user_id: str, updates: dict):
    """Update user profile - PERMANENT FIX"""
    # Remove sensitive fields
    updates.pop("password_hash", None)
    updates.pop("id", None)
    updates.pop("_id", None)
    
    # Filter out None values to prevent validation errors
    filtered_updates = {k: v for k, v in updates.items() if v is not None}
    
    # Update user
    result = await db.users.update_one({"id": user_id}, {"$set": filtered_updates})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Fetch updated user
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found after update")
    
    # Serialize for response
    clean_user = serialize_user_for_response(user, exclude_password=True)
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
@api_router.get("/admin/all-users")
async def get_all_users(limit: int = 100):
    """Get all users (for admin testing) - limited to prevent memory issues"""
    users = await db.users.find({}).limit(limit).to_list(None)
    return [{
        "id": u["id"],
        "name": u["name"],
        "email": u.get("email"),
        "is_admin": u.get("is_admin", False)
    } for u in users]

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
    Discover users with safety filters:
    - Excludes banned users (shadow and permanent)
    - Applies gender lock logic
    - Supports filtering by intent, trust level, and activity
    """
    current_user = await db.users.find_one({"id": user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get blocked users
    blocked_users = current_user.get("blocked_users", [])
    blocked_device_ids = current_user.get("blocked_device_ids", [])
    
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
    
    # Find potential matches
    looking_for_gender = current_user["looking_for"].lower() if current_user.get("looking_for") else None
    current_gender = current_user["gender"].lower() if current_user.get("gender") else None
    
    # Base query - exclude banned users
    query = {
        "id": {"$ne": user_id, "$nin": blocked_users + blocker_ids + list(interacted_ids)},
        "privacy_settings.show_profile": True,
        "is_shadow_banned": {"$ne": True},
        "is_permanently_banned": {"$ne": True}
    }
    
    # === GENDER LOCK LOGIC ===
    # If current user has gender lock enabled, only show profiles of selected gender
    if current_user.get("gender_lock_enabled"):
        show_to = current_user.get("show_to_gender", "both")
        if show_to != "both":
            query["gender"] = {"$regex": f"^{show_to}$", "$options": "i"}
    
    # Filter out users who have hidden their profile from current user's gender
    if current_gender:
        query["$or"] = [
            {"hide_profile_from_gender": "none"},
            {"hide_profile_from_gender": {"$exists": False}},
            {"hide_profile_from_gender": {"$ne": current_gender}}
        ]
    
    # Check if other user's gender_lock allows them to see current user
    # This is done in post-processing
    
    # Add gender filters if both users have gender preferences
    if looking_for_gender and current_gender:
        # Add to existing query
        if "$and" not in query:
            query["$and"] = []
        query["$and"].append({
            "gender": {"$regex": f"^{looking_for_gender}$", "$options": "i"}
        })
    
    # === OPTIONAL FILTERS ===
    if relationship_intent:
        query["relationship_intent"] = relationship_intent
    
    if trust_badge_level:
        query["trust_badge_level"] = trust_badge_level
    
    if last_active_hours:
        cutoff_time = (datetime.now(timezone.utc) - timedelta(hours=last_active_hours)).isoformat()
        query["last_active"] = {"$gte": cutoff_time}
    
    # Block by device ID - exclude users whose device is blocked
    if blocked_device_ids:
        query["device_ids"] = {"$nin": blocked_device_ids}
    
    users = await db.users.find(query).limit(limit * 2).to_list(None)  # Get extra for filtering
    
    # Post-process: Check gender lock from other user's perspective
    filtered_users = []
    for u in users:
        # If other user has gender_lock_enabled, check if current user matches their preference
        if u.get("gender_lock_enabled"):
            other_show_to = u.get("show_to_gender", "both")
            if other_show_to != "both" and current_gender and current_gender != other_show_to.lower():
                continue  # Skip - this user doesn't want to be shown to current user's gender
        
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
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Activity updated"}

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
    if action.action == "pass":
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
    
    # Check if opposite action exists
    existing = await db.matches.find_one({
        "user1_id": action.target_user_id,
        "user2_id": user_id
    })
    
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
        
        # Send push notification to matched user
        if user2.get('fcm_token'):
            send_match_notification(
                token=user2['fcm_token'],
                user_name=user1['name'],
                compatibility_score=int(score)
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
            "matched": False
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
            
            # Send push notification
            if user2 and user2.get('fcm_token'):
                send_like_notification(
                    token=user2['fcm_token'],
                    user_name=user1['name']
                )
        elif action.action == "like":
            # Send like notification for regular likes too
            if user2 and user2.get('fcm_token'):
                send_like_notification(
                    token=user2['fcm_token'],
                    user_name=user1['name']
                )
        
        return {"action": "liked"}

# Matches Routes
@api_router.get("/matches/{user_id}")
async def get_matches(user_id: str):
    # Get current user to check blocked users
    current_user = await db.users.find_one({"id": user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    blocked_users = current_user.get("blocked_users", [])
    
    matches = await db.matches.find({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
        "matched": True
    }).limit(1000).to_list(None)
    
    result = []
    for match in matches:
        other_id = match["user2_id"] if match["user1_id"] == user_id else match["user1_id"]
        
        # Skip if user is blocked
        if other_id in blocked_users:
            continue
            
        other_user = await db.users.find_one({"id": other_id})
        
        if other_user:
            # Also check if the other user has blocked current user
            other_blocked = other_user.get("blocked_users", [])
            if user_id in other_blocked:
                continue
                
            # Check show_photos privacy setting
            privacy_settings = other_user.get("privacy_settings", {})
            show_photos = privacy_settings.get("show_photos", True)
            
            # Build user data with conditional photo visibility
            user_data = {
                "id": other_user["id"],
                "name": other_user["name"],
                "age": other_user["age"],
                "verified": other_user.get("verified", False),
                "is_online": other_user.get("is_online", False),
                "last_active": other_user.get("last_active")
            }
            
            # Only include photos if show_photos is True (since they're matched)
            if show_photos:
                user_data["photos"] = other_user.get("photos", [])
                user_data["profile_picture"] = other_user.get("profile_picture")
            else:
                # Provide placeholder or empty
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
    likes = await db.matches.find({
        "user2_id": user_id,
        "user1_liked": True,
        "matched": False  # Not matched yet
    }).to_list(None)
    
    result = {
        "regular_likes": [],
        "super_likes": [],
        "total_count": 0
    }
    
    for like in likes:
        liker_user = await db.users.find_one({"id": like["user1_id"]})
        
        if liker_user:
            user_data = {
                "id": liker_user["id"],
                "name": liker_user["name"],
                "age": liker_user["age"],
                "bio": liker_user.get("bio", ""),
                "photos": liker_user.get("photos", []),
                "profile_picture": liker_user.get("profile_picture"),
                "interests": liker_user.get("interests", []),
                "verified": liker_user.get("verified", False),
                "location": liker_user.get("location", ""),
                "liked_at": like.get("created_at")
            }
            
            # Check if it's a superlike (you can add a field in matches for this)
            # For now, we'll use a simple heuristic or add it later
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
    
    # Send push notification to receiver
    if receiver.get('fcm_token') and sender:
        # Check if sender is muted by receiver
        muted_users = receiver.get('muted_users', [])
        if message_data.sender_id not in muted_users:
            send_message_notification(
                token=receiver['fcm_token'],
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

# === WOMEN SAFETY: MESSAGE CHECKS ===
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

# Include router - MUST be after all route definitions
app.include_router(api_router)

# CORS
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
