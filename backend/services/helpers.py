from datetime import datetime, timezone
"""
HeartLink Shared Helper Functions
Utility functions used across multiple route modules.
"""

import hashlib
import logging
import re
from database import db
from models.schemas import InAppNotification

logger = logging.getLogger(__name__)

# ==================== INDIAN LOCATIONS FILTER ====================
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
    """Check if a given location is in India"""
    if not location:
        return False
    location_lower = location.lower().strip()
    if "india" in location_lower:
        return True
    for state in INDIAN_STATES:
        if state in location_lower or location_lower in state:
            return True
    for city in INDIAN_CITIES:
        if city in location_lower or location_lower in city:
            return True
    return False


# ==================== PASSWORD HELPERS ====================

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


# ==================== USER DATA HELPERS ====================

def clean_user_data(user_data: dict) -> dict:
    """Clean user data to prevent Pydantic validation errors with None values"""
    cleaned_user = {}
    for key, value in user_data.items():
        if value is not None:
            cleaned_user[key] = value
        else:
            if key in ["bio", "about_me"]:
                cleaned_user[key] = ""
            elif key in ["photos", "interests", "blocked_users", "muted_users", "values",
                         "lifestyle_tags", "profile_viewers", "device_ids", "blocked_device_ids"]:
                cleaned_user[key] = []
            elif key in ["email", "phone", "fcm_token", "latitude", "longitude",
                         "bio_voice_intro_url", "intro_video_url", "ban_reason"]:
                cleaned_user[key] = None
            elif key in ["profile_views", "risk_score"]:
                cleaned_user[key] = 0
            else:
                cleaned_user[key] = value
    return cleaned_user


def serialize_user_for_response(user_dict: dict, exclude_password: bool = True) -> dict:
    """Serialize user data for API responses. Female users always get premium. Hides AI profile indicator."""
    user_dict.pop('_id', None)
    if exclude_password:
        user_dict.pop('password_hash', None)
        user_dict.pop('password', None)
        user_dict.pop('password_reset_code', None)
        user_dict.pop('password_reset_expires', None)
    # NEVER expose AI profile status to frontend
    user_dict.pop('is_ai_profile', None)
    user_dict.pop('is_active_ai', None)
    user_dict.pop('ai_personality', None)
    user_dict.pop('personality_desc', None)
    user_dict.pop('vibe', None)
    cleaned = clean_user_data(user_dict)
    # Female users are always premium — no purchase needed
    if cleaned.get("gender", "").lower() == "female":
        cleaned["is_premium"] = True
        cleaned["subscription_status"] = cleaned.get("subscription_status") or "girls_free"
    return cleaned


def is_user_premium(user: dict) -> bool:
    """Check if user has premium access. Female users always have premium."""
    if not user:
        return False
    if user.get("gender", "").lower() == "female":
        return True
    if str(user.get("premium_pass_until") or "") > datetime.now(timezone.utc).isoformat():
        return True
    return user.get("is_premium", False)


def sanitize_mongo_input(data):
    """Remove MongoDB operators from user input to prevent injection"""
    if isinstance(data, dict):
        return {k: sanitize_mongo_input(v) for k, v in data.items() if not str(k).startswith('$')}
    elif isinstance(data, list):
        return [sanitize_mongo_input(item) for item in data]
    elif isinstance(data, str):
        if data.startswith('$'):
            return ''
        return data
    return data


# ==================== MESSAGE SAFETY ====================

PHONE_EMAIL_PATTERN = re.compile(
    r'(\+?\d[\d\s\-]{7,14})|'
    r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)'
)

MONEY_SCAM_KEYWORDS = [
    "send money", "paytm", "phonepe", "gpay", "google pay",
    "bank account", "upi", "neft", "imps", "transfer money",
    "payment", "rupees", "rs.", "inr", "₹",
    "loan", "invest", "crypto", "bitcoin",
    "western union", "moneygram",
]


def mask_phone_email(text: str) -> str:
    """Auto-mask phone numbers and email addresses in chat messages"""
    return PHONE_EMAIL_PATTERN.sub('[Hidden for Safety]', text)


def check_money_scam(text: str) -> bool:
    """Check if message contains potential money scam keywords"""
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in MONEY_SCAM_KEYWORDS)


# ==================== NOTIFICATION HELPER ====================

async def create_in_app_notification(
    user_id: str, title: str, body: str,
    notification_type: str = "general", data: dict = None
):
    """Helper function to create in-app notification"""
    notification = InAppNotification(
        user_id=user_id,
        title=title,
        body=body,
        type=notification_type,
        data=data or {}
    )
    await db.in_app_notifications.insert_one(notification.dict())
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"unread_notifications": 1}}
    )
    return notification
