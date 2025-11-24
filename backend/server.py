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

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'dating_app_db')]  # In production, Emergent provides DB_NAME

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

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

manager = ConnectionManager()

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password_hash: str
    name: str
    age: int
    gender: str
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
    privacy_settings: Dict = Field(default_factory=lambda: {
        "show_profile": True,
        "show_photos": True,
        "incognito_mode": False
    })
    blocked_users: List[str] = []
    muted_users: List[str] = []  # New: Muted users
    profile_views: int = 0  # New: Profile view count
    last_active: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())  # New: Last active timestamp
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    class Config:
        # Exclude MongoDB _id field from serialization
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        # Allow arbitrary types
        arbitrary_types_allowed = True

class UserSignup(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    name: str
    age: int
    gender: str
    looking_for: str
    bio: str = ""
    location: str
    interests: List[str] = []

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
            if key == "bio":
                cleaned_user[key] = ""
            elif key in ["photos", "interests", "blocked_users", "muted_users"]:
                cleaned_user[key] = []
            elif key in ["email", "phone", "fcm_token", "latitude", "longitude"]:
                cleaned_user[key] = None
            elif key == "profile_views":
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
    users = await db.users.find(query).to_list(None)
    
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
async def discover_users(user_id: str, limit: int = 10):
    current_user = await db.users.find_one({"id": user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get blocked users
    blocked_users = current_user.get("blocked_users", [])
    
    # Find users who blocked current user
    blockers = await db.users.find({"blocked_users": user_id}).to_list(None)
    blocker_ids = [u["id"] for u in blockers]
    
    # Get already interacted users
    matches = await db.matches.find({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}]
    }).to_list(None)
    interacted_ids = set()
    for m in matches:
        interacted_ids.add(m["user1_id"])
        interacted_ids.add(m["user2_id"])
    
    # Find potential matches (case-insensitive gender matching)
    looking_for_gender = current_user["looking_for"].lower() if current_user.get("looking_for") else None
    current_gender = current_user["gender"].lower() if current_user.get("gender") else None
    
    query = {
        "id": {"$ne": user_id, "$nin": blocked_users + blocker_ids + list(interacted_ids)},
        "privacy_settings.show_profile": True
    }
    
    # Add gender filters if both users have gender preferences
    if looking_for_gender and current_gender:
        query["$or"] = [
            {
                "gender": {"$regex": f"^{looking_for_gender}$", "$options": "i"},
                "looking_for": {"$regex": f"^{current_gender}$", "$options": "i"}
            }
        ]
    
    users = await db.users.find(query).limit(limit).to_list(None)
    
    return [{"id": u["id"], "name": u["name"], "age": u["age"], 
             "bio": u.get("bio", ""), "photos": u.get("photos", []),
             "interests": u.get("interests", []), "verified": u.get("verified", False),
             "location": u.get("location", ""), "profile_picture": u.get("profile_picture")} for u in users]

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
    blockers = await db.users.find({"blocked_users": user_id}).to_list(None)
    blocker_ids = [u["id"] for u in blockers]
    
    # Get already interacted users
    matches = await db.matches.find({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}]
    }).to_list(None)
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
    # Increment profile views
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"profile_views": 1}}
    )
    
    # Optionally store who viewed (for "Who Viewed Me" feature)
    if viewer_id:
        view_doc = {
            "profile_id": user_id,
            "viewer_id": viewer_id,
            "viewed_at": datetime.now(timezone.utc).isoformat()
        }
        await db.profile_views.insert_one(view_doc)
    
    return {"message": "Profile view tracked"}

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


    current_user = await db.users.find_one({"id": user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get blocked users
    blocked_users = current_user.get("blocked_users", [])
    
    # Find users who blocked current user
    blockers = await db.users.find({"blocked_users": user_id}).to_list(None)
    blocker_ids = [u["id"] for u in blockers]
    
    # Get already interacted users
    matches = await db.matches.find({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}]
    }).to_list(None)
    interacted_ids = set()
    for m in matches:
        interacted_ids.add(m["user1_id"])
        interacted_ids.add(m["user2_id"])
    
    # Find potential matches (case-insensitive gender matching)
    looking_for_gender = current_user["looking_for"].lower() if current_user.get("looking_for") else None
    current_gender = current_user["gender"].lower() if current_user.get("gender") else None
    
    query = {
        "id": {"$ne": user_id, "$nin": blocked_users + blocker_ids + list(interacted_ids)},
        "privacy_settings.show_profile": True
    }
    
    # Add gender filters if both users have gender preferences
    if looking_for_gender and current_gender:
        query["$or"] = [
            {
                "gender": {"$regex": f"^{looking_for_gender}$", "$options": "i"},
                "looking_for": {"$regex": f"^{current_gender}$", "$options": "i"}
            }
        ]
    
    users = await db.users.find(query).limit(limit).to_list(None)
    
    return [{"id": u["id"], "name": u["name"], "age": u["age"], 
             "bio": u.get("bio", ""), "photos": u.get("photos", []),
             "interests": u.get("interests", []), "verified": u.get("verified", False),
             "location": u.get("location", "")} for u in users]

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
    }).to_list(None)
    
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
                
            result.append({
                "match_id": match["id"],
                "user": {
                    "id": other_user["id"],
                    "name": other_user["name"],
                    "age": other_user["age"],
                    "photos": other_user.get("photos", []),
                    "profile_picture": other_user.get("profile_picture"),
                    "verified": other_user.get("verified", False)
                },
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
    blockers = await db.users.find({"blocked_users": user_id}).to_list(None)
    blocker_ids = [u["id"] for u in blockers]
    
    # Get already matched users
    matches = await db.matches.find({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
        "matched": True
    }).to_list(None)
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
    receiver = await db.users.find_one({"id": message_data.receiver_id})
    sender = await db.users.find_one({"id": message_data.sender_id})
    
    if receiver and receiver.get('fcm_token') and sender:
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
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
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
            
            # Send to BOTH sender and receiver
            message_payload = {
                "type": "message",
                "message": message_dict
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
