"""
HeartLink Pydantic Models / Schemas
All request/response models for the API.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, EmailStr


# ==================== CORE MODELS ====================

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
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photos: List[str] = []
    interests: List[str] = []
    verified: bool = False
    verification_status: str = "pending"
    profile_status: str = "pending"
    is_admin: bool = False
    fcm_token: Optional[str] = None
    profile_picture: Optional[str] = None
    show_to_gender: str = "both"
    gender_lock_enabled: bool = False
    hide_profile_from_gender: str = "none"
    bio_voice_intro_url: Optional[str] = None
    intro_video_url: Optional[str] = None
    trust_badge_level: str = "low"
    risk_score: int = 0
    is_verified_male: bool = False
    unread_notifications: int = 0
    about_me: str = ""
    values: List[str] = []
    relationship_status: str = ""
    relationship_intent: str = ""
    lifestyle_tags: List[str] = []
    profile_viewers: List[Dict] = []
    device_ids: List[str] = []
    blocked_device_ids: List[str] = []
    women_safety_mode: bool = False
    night_quiet_hours_enabled: bool = False
    first_message_delay_exempt: bool = False
    is_shadow_banned: bool = False
    is_permanently_banned: bool = False
    ban_reason: Optional[str] = None
    privacy_settings: Dict = Field(default_factory=lambda: {
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
    })
    blocked_users: List[str] = []
    muted_users: List[str] = []
    profile_views: int = 0
    is_online: bool = False
    last_active: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
        arbitrary_types_allowed = True


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


class InAppNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    body: str
    type: str = "general"
    is_read: bool = False
    data: dict = {}
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: Optional[str] = None


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    match_id: str
    sender_id: str
    receiver_id: str
    content: str
    read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_deleted_for_sender: bool = False
    is_deleted_for_receiver: bool = False
    is_deleted_for_all: bool = False
    expires_at: Optional[str] = None
    message_type: str = "text"


# ==================== AUTH SCHEMAS ====================

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
    photos: List[str] = []
    show_to_gender: str = "both"
    relationship_status: str = ""
    relationship_intent: str = ""
    values: List[str] = []
    lifestyle_tags: List[str] = []


class UserLogin(BaseModel):
    email_or_phone: str
    password: str


class PhoneLogin(BaseModel):
    phone: str
    firebase_uid: str


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
    relationship_status: str = ""
    photos: List[str] = []


class ForgotPasswordRequest(BaseModel):
    email_or_phone: str


class ResetPasswordRequest(BaseModel):
    email_or_phone: str
    reset_code: str
    new_password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    user_id: str
    current_password: str
    new_password: str


# ==================== PROFILE SCHEMAS ====================

class DeleteAccountRequest(BaseModel):
    email: EmailStr
    reason: Optional[str] = None


class LinkEmailRequest(BaseModel):
    email: str
    password: str


class LinkPhoneRequest(BaseModel):
    phone: str
    otp_verified: bool = False


class MergeAccountsRequest(BaseModel):
    source_user_id: str
    password: Optional[str] = None


class PrivacyUpdate(BaseModel):
    show_profile: Optional[bool] = None
    show_photos: Optional[bool] = None
    incognito_mode: Optional[bool] = None
    hide_online_status: Optional[bool] = None
    hide_read_receipts: Optional[bool] = None
    hide_typing_indicator: Optional[bool] = None
    hide_phone_number: Optional[bool] = None
    blur_photos_for_non_matches: Optional[bool] = None
    disappearing_messages: Optional[bool] = None
    disappearing_messages_duration: Optional[int] = None
    screenshot_alert: Optional[bool] = None


class GenderLockUpdate(BaseModel):
    gender_lock_enabled: Optional[bool] = None
    show_to_gender: Optional[str] = None
    hide_profile_from_gender: Optional[str] = None


class ProfileEnhancementUpdate(BaseModel):
    about_me: Optional[str] = None
    bio_voice_intro_url: Optional[str] = None
    intro_video_url: Optional[str] = None
    values: Optional[List[str]] = None
    relationship_intent: Optional[str] = None
    lifestyle_tags: Optional[List[str]] = None


class WomenSafetyUpdate(BaseModel):
    women_safety_mode: Optional[bool] = None
    night_quiet_hours_enabled: Optional[bool] = None


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    location: str


class DeviceBlock(BaseModel):
    device_id: str


class SelfieVerificationRequest(BaseModel):
    user_id: str
    selfie_url: str


# ==================== SOCIAL SCHEMAS ====================

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


class DiscoverFilters(BaseModel):
    relationship_intent: Optional[str] = None
    values: Optional[List[str]] = None
    lifestyle_tags: Optional[List[str]] = None
    trust_badge_level: Optional[str] = None
    last_active_within_hours: Optional[int] = None


# ==================== CHAT SCHEMAS ====================

class ScreenshotAlert(BaseModel):
    match_id: str
    screenshot_by: str


class DeleteMessageRequest(BaseModel):
    message_id: str
    delete_for_all: bool = False


class MessageReaction(BaseModel):
    message_id: str
    user_id: str
    reaction: str  # heart, laugh, thumbsup, sad, angry


# ==================== ADMIN SCHEMAS ====================

class AdminUserUpdate(BaseModel):
    user_id: str
    gender_lock_enabled: Optional[bool] = None
    is_verified_male: Optional[bool] = None
    trust_badge_level: Optional[str] = None
    risk_score: Optional[int] = None
    is_shadow_banned: Optional[bool] = None
    is_permanently_banned: Optional[bool] = None
    ban_reason: Optional[str] = None


class AdminVerification(BaseModel):
    user_id: str
    action: str
    reason: Optional[str] = None
    verified_by: str


class MakeAdminRequest(BaseModel):
    secret_code: str
    user_email: str


class AdminResetPasswordRequest(BaseModel):
    user_id: str
    new_password: str


class VerifySelfieRequest(BaseModel):
    user_id: str
    action: str
    reason: str = ""


class ReVerifyRequest(BaseModel):
    user_id: str
    reason: str = ""


class ProfileApprovalRequest(BaseModel):
    user_id: str
    action: str
    reason: str = ""


class DatabaseClearRequest(BaseModel):
    confirm: str
    admin_password: str


# ==================== NOTIFICATION SCHEMAS ====================

class BulkNotificationRequest(BaseModel):
    title: str
    body: str
    target: str = "all"


class ScheduledNotificationRequest(BaseModel):
    title: str
    body: str
    target: str = "all"
    schedule_time: str


class AdminNotificationWithEmail(BaseModel):
    title: str
    body: str
    target: str = "all"
    send_email: bool = True
    send_in_app: bool = True


class NotificationTemplateCreate(BaseModel):
    title: str
    body: str
    category: str = "custom"


class PushNotificationRequest(BaseModel):
    title: str
    message: str
    target: str = "all"
    user_ids: Optional[List[str]] = None


class FCMTokenRequest(BaseModel):
    user_id: str
    fcm_token: str


# ==================== MONETIZATION SCHEMAS ====================

class AdImpressionRequest(BaseModel):
    user_id: str
    ad_type: str
    reward_type: Optional[str] = None
    amount: Optional[int] = None
    timestamp: str


class AdRewardRequest(BaseModel):
    user_id: str
    reward_type: str
    amount: int
    timestamp: str


class SubscriptionCreateRequest(BaseModel):
    user_id: str
    plan_id: str
