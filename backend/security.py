"""
HeartLink Security Module
=========================
Comprehensive security features for the dating app:
- JWT Authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting
- Input validation & sanitization
- Security headers
- Session management
- Suspicious activity detection
"""

import os
import re
import uuid
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from functools import wraps

# JWT & Password
from jose import JWTError, jwt
from passlib.context import CryptContext

# Rate Limiting
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Security Headers
from secure import Secure

# FastAPI
from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ===========================================
# CONFIGURATION
# ===========================================

# JWT Config
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not JWT_SECRET_KEY:
    JWT_SECRET_KEY = secrets.token_urlsafe(32)
    import logging as _log
    _log.warning("JWT_SECRET_KEY not set in .env — using random key (tokens will reset on restart)")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Password Config
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# Security Headers
secure_headers = Secure()

# HTTP Bearer for token auth
security = HTTPBearer(auto_error=False)

# ===========================================
# PASSWORD HASHING (BCRYPT)
# ===========================================

def hash_password_secure(password: str) -> str:
    """Hash password using bcrypt (more secure than SHA256)"""
    return pwd_context.hash(password)

def verify_password_secure(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except:
        # Fallback for old SHA256 hashes during migration
        sha256_hash = hashlib.sha256(plain_password.encode()).hexdigest()
        return sha256_hash == hashed_password

def needs_password_rehash(hashed_password: str) -> bool:
    """Check if password needs to be rehashed (for migration from SHA256)"""
    # SHA256 hashes are 64 chars, bcrypt hashes start with $2b$
    return not hashed_password.startswith('$2b$')

# ===========================================
# JWT TOKEN MANAGEMENT
# ===========================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    })
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token (longer lived)"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": str(uuid.uuid4())  # Unique token ID for revocation
    })
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

def verify_access_token(token: str) -> Optional[dict]:
    """Verify access token and return payload"""
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        return payload
    return None

def verify_refresh_token(token: str) -> Optional[dict]:
    """Verify refresh token and return payload"""
    payload = decode_token(token)
    if payload and payload.get("type") == "refresh":
        return payload
    return None

# ===========================================
# INPUT VALIDATION & SANITIZATION
# ===========================================

def sanitize_string(value: str, max_length: int = 1000) -> str:
    """Sanitize string input to prevent XSS and injection"""
    if not value:
        return ""
    
    # Remove null bytes
    value = value.replace('\x00', '')
    
    # Limit length
    value = value[:max_length]
    
    # Remove potentially dangerous HTML/script tags
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',
        r'<iframe[^>]*>.*?</iframe>',
        r'javascript:',
        r'on\w+\s*=',
        r'<\s*img[^>]*onerror',
    ]
    
    for pattern in dangerous_patterns:
        value = re.sub(pattern, '', value, flags=re.IGNORECASE | re.DOTALL)
    
    return value.strip()

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_phone(phone: str) -> bool:
    """Validate phone number format (Indian)"""
    # Remove spaces, dashes, and country code
    cleaned = re.sub(r'[\s\-\+]', '', phone)
    if cleaned.startswith('91'):
        cleaned = cleaned[2:]
    return bool(re.match(r'^[6-9]\d{9}$', cleaned))

def validate_password_strength(password: str) -> tuple[bool, str]:
    """Check password strength - Relaxed version for better UX"""
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    # Removed strict requirements for better user experience
    # Users can still use strong passwords if they want
    return True, "Password is valid"

# ===========================================
# RATE LIMITING RULES
# ===========================================

RATE_LIMITS = {
    "login": "5/minute",           # 5 login attempts per minute
    "register": "3/minute",        # 3 registrations per minute
    "forgot_password": "3/minute", # 3 password reset requests per minute
    "api_general": "100/minute",   # 100 API calls per minute
    "message": "30/minute",        # 30 messages per minute
    "like": "60/minute",           # 60 likes per minute
    "upload": "10/minute",         # 10 uploads per minute
}

# ===========================================
# SUSPICIOUS ACTIVITY DETECTION
# ===========================================

class SuspiciousActivityDetector:
    """Detect and flag suspicious user activities"""
    
    def __init__(self):
        self.failed_logins: Dict[str, list] = {}  # IP -> timestamps
        self.rapid_actions: Dict[str, list] = {}   # user_id -> action timestamps
    
    def record_failed_login(self, ip: str) -> bool:
        """Record failed login attempt, return True if suspicious"""
        now = datetime.now(timezone.utc)
        
        if ip not in self.failed_logins:
            self.failed_logins[ip] = []
        
        # Clean old entries (older than 1 hour)
        self.failed_logins[ip] = [
            t for t in self.failed_logins[ip]
            if now - t < timedelta(hours=1)
        ]
        
        self.failed_logins[ip].append(now)
        
        # Flag as suspicious if more than 10 failed attempts in 1 hour
        return len(self.failed_logins[ip]) > 10
    
    def record_action(self, user_id: str, action_type: str) -> bool:
        """Record user action, return True if suspicious (too rapid)"""
        now = datetime.now(timezone.utc)
        key = f"{user_id}:{action_type}"
        
        if key not in self.rapid_actions:
            self.rapid_actions[key] = []
        
        # Clean old entries (older than 1 minute)
        self.rapid_actions[key] = [
            t for t in self.rapid_actions[key]
            if now - t < timedelta(minutes=1)
        ]
        
        self.rapid_actions[key].append(now)
        
        # Thresholds for suspicious activity
        thresholds = {
            "like": 100,      # 100 likes per minute is suspicious
            "message": 50,    # 50 messages per minute is suspicious
            "report": 20,     # 20 reports per minute is suspicious
        }
        
        threshold = thresholds.get(action_type, 100)
        return len(self.rapid_actions[key]) > threshold
    
    def clear_failed_logins(self, ip: str):
        """Clear failed login records for an IP (after successful login)"""
        self.failed_logins.pop(ip, None)

# Global detector instance
activity_detector = SuspiciousActivityDetector()

# ===========================================
# SESSION MANAGEMENT
# ===========================================

class SessionManager:
    """Manage user sessions and devices"""
    
    def __init__(self):
        self.active_sessions: Dict[str, Dict] = {}  # user_id -> {device_id: session_info}
    
    def create_session(self, user_id: str, device_info: dict) -> str:
        """Create new session for user"""
        session_id = str(uuid.uuid4())
        
        if user_id not in self.active_sessions:
            self.active_sessions[user_id] = {}
        
        self.active_sessions[user_id][session_id] = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_active": datetime.now(timezone.utc).isoformat(),
            "device_info": device_info,
            "ip": device_info.get("ip"),
        }
        
        return session_id
    
    def validate_session(self, user_id: str, session_id: str) -> bool:
        """Check if session is valid"""
        if user_id not in self.active_sessions:
            return False
        return session_id in self.active_sessions[user_id]
    
    def get_active_sessions(self, user_id: str) -> list:
        """Get all active sessions for user"""
        if user_id not in self.active_sessions:
            return []
        
        sessions = []
        for sid, info in self.active_sessions[user_id].items():
            sessions.append({
                "session_id": sid,
                **info
            })
        return sessions
    
    def revoke_session(self, user_id: str, session_id: str):
        """Revoke a specific session"""
        if user_id in self.active_sessions:
            self.active_sessions[user_id].pop(session_id, None)
    
    def revoke_all_sessions(self, user_id: str, except_session: str = None):
        """Revoke all sessions for user except specified one"""
        if user_id in self.active_sessions:
            if except_session:
                self.active_sessions[user_id] = {
                    k: v for k, v in self.active_sessions[user_id].items()
                    if k == except_session
                }
            else:
                self.active_sessions[user_id] = {}

# Global session manager
session_manager = SessionManager()

# ===========================================
# DATA ENCRYPTION
# ===========================================

def encrypt_sensitive_data(data: str) -> str:
    """Encrypt sensitive data (phone, email) for storage"""
    # Simple encryption using Fernet would be better, but for now using hash-based
    # This is one-way - for two-way encryption, use Fernet
    salt = os.environ.get('ENCRYPTION_SALT', 'heartlink_secure_salt')
    return hashlib.sha256(f"{salt}:{data}".encode()).hexdigest()[:32]

def generate_secure_token(length: int = 32) -> str:
    """Generate cryptographically secure random token"""
    return secrets.token_urlsafe(length)

# ===========================================
# SECURITY MIDDLEWARE
# ===========================================

async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    
    return response

# ===========================================
# DEPENDENCY FOR PROTECTED ROUTES
# ===========================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user from JWT token"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = credentials.credentials
    payload = verify_access_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload

# ===========================================
# AUDIT LOGGING
# ===========================================

class SecurityAuditLog:
    """Log security-related events for audit"""
    
    @staticmethod
    def log_event(event_type: str, user_id: str = None, ip: str = None, details: dict = None):
        """Log a security event"""
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "user_id": user_id,
            "ip": ip,
            "details": details or {}
        }
        # In production, this should write to a secure audit log database
        print(f"[SECURITY AUDIT] {log_entry}")
        return log_entry

audit_log = SecurityAuditLog()

# ===========================================
# EXPORTS
# ===========================================

__all__ = [
    # Password
    'hash_password_secure',
    'verify_password_secure',
    'needs_password_rehash',
    
    # JWT
    'create_access_token',
    'create_refresh_token',
    'decode_token',
    'verify_access_token',
    'verify_refresh_token',
    
    # Validation
    'sanitize_string',
    'validate_email',
    'validate_phone',
    'validate_password_strength',
    
    # Rate Limiting
    'limiter',
    'RATE_LIMITS',
    
    # Security
    'activity_detector',
    'session_manager',
    'encrypt_sensitive_data',
    'generate_secure_token',
    'add_security_headers',
    'get_current_user',
    'audit_log',
    
    # Constants
    'JWT_SECRET_KEY',
    'ACCESS_TOKEN_EXPIRE_MINUTES',
]
