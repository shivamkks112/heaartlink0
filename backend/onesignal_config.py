"""
OneSignal Push Notification Service - Production Grade
Handles all push notifications with proper Android channel support
"""

import os
import requests
import logging
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

logger = logging.getLogger(__name__)

# OneSignal Configuration
ONESIGNAL_APP_ID = os.environ.get('ONESIGNAL_APP_ID', '')
ONESIGNAL_API_KEY = os.environ.get('ONESIGNAL_API_KEY', '')
ONESIGNAL_API_URL = "https://onesignal.com/api/v1"

# Android Notification Channel ID (must match what's declared in AndroidManifest)
ANDROID_CHANNEL_ID = "heartlink_notifications"


def _build_payload(
    title: str,
    message: str,
    target_user_ids: Optional[List[str]] = None,
    target_all: bool = False,
    data: Optional[Dict[str, Any]] = None,
    segment: Optional[str] = None,
    priority: int = 10,
) -> Dict[str, Any]:
    """Build OneSignal notification payload with full Android support."""
    payload = {
        "app_id": ONESIGNAL_APP_ID,
        "headings": {"en": title},
        "contents": {"en": message},
        "data": data or {},
        # Android 8+ notification channel (HIGH importance for heads-up)
        "android_channel_id": ANDROID_CHANNEL_ID,
        # Android notification settings
        "priority": priority,
        "android_visibility": 1,  # Public visibility
        "android_sound": "default",
        "android_led_color": "FFFF6B9D",
        "android_accent_color": "FFFF6B9D",
        # iOS
        "ios_sound": "default",
        "ios_badgeType": "Increase",
        "ios_badgeCount": 1,
        # TTL 24 hours
        "ttl": 86400,
    }

    # Targeting
    if target_all:
        payload["included_segments"] = ["All"]
    elif target_user_ids:
        payload["include_aliases"] = {"external_id": target_user_ids}
        payload["target_channel"] = "push"
    elif segment:
        payload["included_segments"] = [segment]
    else:
        payload["included_segments"] = ["All"]

    return payload


def send_onesignal_notification(
    title: str,
    message: str,
    target_user_ids: Optional[List[str]] = None,
    target_all: bool = False,
    data: Optional[Dict[str, Any]] = None,
    segment: Optional[str] = None,
    priority: int = 10,
) -> Dict[str, Any]:
    """
    Send push notification via OneSignal with full Android 8+ support.
    """
    if not ONESIGNAL_APP_ID or not ONESIGNAL_API_KEY:
        logger.warning("OneSignal credentials not configured")
        return {"success": False, "error": "OneSignal not configured"}

    headers = {
        "Authorization": f"Basic {ONESIGNAL_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = _build_payload(title, message, target_user_ids, target_all, data, segment, priority)

    try:
        response = requests.post(
            f"{ONESIGNAL_API_URL}/notifications",
            headers=headers,
            json=payload,
            timeout=10,
        )

        result = response.json()

        if response.status_code == 200:
            logger.info(f"OneSignal sent: {result.get('id')} recipients={result.get('recipients', 0)}")
            return {
                "success": True,
                "notification_id": result.get("id"),
                "recipients": result.get("recipients", 0),
            }
        else:
            logger.error(f"OneSignal error: {result}")
            return {
                "success": False,
                "error": result.get("errors", ["Unknown error"])[0] if result.get("errors") else str(result),
            }

    except Exception as e:
        logger.error(f"OneSignal request failed: {str(e)}")
        return {"success": False, "error": str(e)}


# === TARGETED NOTIFICATION HELPERS ===

def send_notification_to_user(user_id: str, title: str, message: str, data: Optional[Dict] = None) -> Dict:
    """Send notification to a specific user by their app user ID"""
    return send_onesignal_notification(
        title=title, message=message, target_user_ids=[user_id], data=data
    )


def send_notification_to_users(user_ids: List[str], title: str, message: str, data: Optional[Dict] = None) -> Dict:
    """Send notification to multiple users"""
    if not user_ids:
        return {"success": False, "error": "No user IDs provided"}
    return send_onesignal_notification(
        title=title, message=message, target_user_ids=user_ids, data=data
    )


def send_notification_to_all(title: str, message: str, data: Optional[Dict] = None) -> Dict:
    """Send notification to all subscribed users"""
    return send_onesignal_notification(
        title=title, message=message, target_all=True, data=data
    )


# === SOCIAL EVENT NOTIFICATIONS ===

def send_match_notification_onesignal(user_id: str, matched_user_name: str, match_id: str = "") -> Dict:
    """Send match notification"""
    return send_notification_to_user(
        user_id=user_id,
        title="New Match!",
        message=f"You matched with {matched_user_name}! Start chatting now.",
        data={"type": "match", "action": "open_chat", "match_id": match_id, "route": f"/chat/{match_id}" if match_id else "/matches"},
    )


def send_message_notification_onesignal(user_id: str, sender_name: str, message_preview: str, match_id: str = "") -> Dict:
    """Send new message notification"""
    preview = message_preview[:100] + "..." if len(message_preview) > 100 else message_preview
    return send_notification_to_user(
        user_id=user_id,
        title=f"New message from {sender_name}",
        message=preview,
        data={"type": "message", "action": "open_chat", "match_id": match_id, "route": f"/chat/{match_id}" if match_id else "/matches"},
    )


def send_like_notification_onesignal(user_id: str, liker_name: str) -> Dict:
    """Send like notification"""
    return send_notification_to_user(
        user_id=user_id,
        title="Someone likes you!",
        message=f"{liker_name} liked your profile. Check them out!",
        data={"type": "like", "action": "open_likes", "route": "/likes"},
    )


def send_superlike_notification_onesignal(user_id: str, liker_name: str) -> Dict:
    """Send super like notification"""
    return send_notification_to_user(
        user_id=user_id,
        title="Super Like!",
        message=f"{liker_name} superliked your profile! They really like you!",
        data={"type": "superlike", "action": "open_likes", "route": "/likes"},
    )


def send_profile_view_notification_onesignal(user_id: str, viewer_name: str, viewer_id: str = "") -> Dict:
    """Send profile viewed notification"""
    return send_notification_to_user(
        user_id=user_id,
        title="Profile Viewed!",
        message=f"{viewer_name} viewed your profile. Check them out!",
        data={"type": "profile_view", "action": "open_profile", "viewer_id": viewer_id, "route": f"/profile/{viewer_id}" if viewer_id else "/profile-viewers"},
    )


def send_welcome_notification_onesignal(user_id: str, user_name: str) -> Dict:
    """Send welcome notification after signup"""
    return send_notification_to_user(
        user_id=user_id,
        title=f"Welcome {user_name}!",
        message="Your profile is being reviewed. You'll be notified once approved. Start exploring matches!",
        data={"type": "welcome", "action": "open_discover", "route": "/discover"},
    )


def send_verification_notification_onesignal(user_id: str, status: str, reason: str = "") -> Dict:
    """Send notification about profile verification status via OneSignal"""
    if status == "approved":
        title = "Profile Verified!"
        message = "Congratulations! Your profile has been verified. You'll get more visibility now!"
        data = {"type": "verification", "status": "approved", "action": "open_profile", "route": "/profile"}
    else:
        title = "Profile Update Needed"
        message = f"Your profile needs some changes. {reason}" if reason else "Your profile verification was not approved. Please update your profile."
        data = {"type": "verification", "status": "rejected", "action": "open_profile", "route": "/profile"}
    return send_notification_to_user(user_id=user_id, title=title, message=message, data=data)


def send_photo_approval_notification_onesignal(user_id: str, approved: bool) -> Dict:
    """Send notification about photo approval"""
    if approved:
        return send_notification_to_user(
            user_id=user_id,
            title="Photo Approved!",
            message="Your profile photo has been approved. Your profile is now visible to others!",
            data={"type": "photo_approved", "action": "open_profile", "route": "/profile"},
        )
    else:
        return send_notification_to_user(
            user_id=user_id,
            title="Photo Not Approved",
            message="Your profile photo was not approved. Please upload a clear face photo.",
            data={"type": "photo_rejected", "action": "open_profile", "route": "/profile"},
        )


def send_online_status_notification_onesignal(user_ids: List[str], online_user_name: str) -> Dict:
    """Notify matched users that someone came online"""
    if not user_ids:
        return {"success": False, "error": "No user IDs"}
    return send_notification_to_users(
        user_ids=user_ids,
        title=f"{online_user_name} is online!",
        message=f"Your match {online_user_name} is online now. Say hi!",
        data={"type": "online_status", "action": "open_matches", "route": "/matches"},
    )


def send_unread_reminder_notification_onesignal(user_id: str, unread_count: int) -> Dict:
    """Send unread message reminder"""
    return send_notification_to_user(
        user_id=user_id,
        title=f"{unread_count} unread messages",
        message="Your matches are waiting for your reply! Don't keep them waiting.",
        data={"type": "unread_reminder", "action": "open_matches", "route": "/matches"},
    )


# === ADMIN NOTIFICATION HELPERS ===

def send_admin_notification(title: str, message: str, target_user_ids: Optional[List[str]] = None, target_all: bool = False) -> Dict:
    """Send notification from admin panel"""
    return send_onesignal_notification(
        title=title,
        message=message,
        target_user_ids=target_user_ids,
        target_all=target_all,
        data={"type": "admin", "action": "open_app"},
    )


# === OneSignal User Management ===

def set_user_external_id(onesignal_player_id: str, external_user_id: str) -> Dict:
    """Link OneSignal player ID with your app's user ID"""
    if not ONESIGNAL_APP_ID or not ONESIGNAL_API_KEY:
        return {"success": False, "error": "OneSignal not configured"}

    headers = {
        "Authorization": f"Basic {ONESIGNAL_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {"identity": {"external_id": external_user_id}}

    try:
        response = requests.patch(
            f"{ONESIGNAL_API_URL}/apps/{ONESIGNAL_APP_ID}/users/by/onesignal_id/{onesignal_player_id}",
            headers=headers,
            json=payload,
            timeout=10,
        )
        if response.status_code in [200, 201]:
            logger.info(f"OneSignal external ID set for user {external_user_id}")
            return {"success": True}
        else:
            logger.error(f"Failed to set external ID: {response.text}")
            return {"success": False, "error": response.text}
    except Exception as e:
        logger.error(f"OneSignal external ID request failed: {str(e)}")
        return {"success": False, "error": str(e)}


def add_user_tags(external_user_id: str, tags: Dict[str, str]) -> Dict:
    """Add tags to a user for segmentation"""
    if not ONESIGNAL_APP_ID or not ONESIGNAL_API_KEY:
        return {"success": False, "error": "OneSignal not configured"}

    headers = {
        "Authorization": f"Basic {ONESIGNAL_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.patch(
            f"{ONESIGNAL_API_URL}/apps/{ONESIGNAL_APP_ID}/users/by/external_id/{external_user_id}",
            headers=headers,
            json={"tags": tags},
            timeout=10,
        )
        if response.status_code in [200, 201]:
            logger.info(f"Tags added for user {external_user_id}")
            return {"success": True}
        else:
            return {"success": False, "error": response.text}
    except Exception as e:
        logger.error(f"OneSignal tags request failed: {str(e)}")
        return {"success": False, "error": str(e)}


# === RE-ENGAGEMENT NOTIFICATION TEMPLATES ===

ENGAGEMENT_TEMPLATES = {
    "inactive_1day": {
        "title": "Someone's waiting for you!",
        "message": "You have new activity on HeartLink. Don't miss out on potential matches!",
        "data": {"type": "engagement", "action": "open_discover"},
    },
    "inactive_3days": {
        "title": "We miss you!",
        "message": "5+ people viewed your profile while you were away. Come back and see who!",
        "data": {"type": "engagement", "action": "open_likes"},
    },
    "inactive_7days": {
        "title": "Your profile is getting cold!",
        "message": "Active users get 10x more matches. Come back and boost your profile!",
        "data": {"type": "engagement", "action": "open_discover"},
    },
    "new_likes": {
        "title": "{count} new likes!",
        "message": "People are interested in you! See who liked your profile.",
        "data": {"type": "like", "action": "open_likes"},
    },
    "unread_messages": {
        "title": "{count} unread messages",
        "message": "Your matches are waiting for your reply!",
        "data": {"type": "message", "action": "open_matches"},
    },
    "new_matches_nearby": {
        "title": "New singles near you!",
        "message": "{count} new people joined from your area. Discover them now!",
        "data": {"type": "discovery", "action": "open_discover"},
    },
    "profile_boost": {
        "title": "Free Profile Boost!",
        "message": "Get 3x more visibility for 30 minutes. Activate now!",
        "data": {"type": "boost", "action": "open_profile"},
    },
    "weekend_special": {
        "title": "Weekend Special!",
        "message": "More people are online on weekends. Perfect time to find your match!",
        "data": {"type": "promo", "action": "open_discover"},
    },
    "daily_pick": {
        "title": "Your Daily Pick is ready!",
        "message": "We found someone special for you. Don't miss this match!",
        "data": {"type": "daily_pick", "action": "open_discover"},
    },
    "profile_incomplete": {
        "title": "Complete your profile!",
        "message": "Profiles with more details get 5x more matches. Add more about yourself!",
        "data": {"type": "profile", "action": "open_profile"},
    },
    "first_match_tip": {
        "title": "Pro Tip!",
        "message": "Users who send the first message have 70% higher success rate. Say hi!",
        "data": {"type": "tip", "action": "open_matches"},
    },
    "mutual_interest": {
        "title": "You have something in common!",
        "message": "Someone with similar interests liked your profile. Check them out!",
        "data": {"type": "like", "action": "open_likes"},
    },
}


def send_engagement_notification(user_id: str, template_key: str, **kwargs) -> Dict:
    """Send pre-defined engagement notification to a user"""
    if template_key not in ENGAGEMENT_TEMPLATES:
        return {"success": False, "error": f"Unknown template: {template_key}"}

    template = ENGAGEMENT_TEMPLATES[template_key]
    title = template["title"].format(**kwargs) if kwargs else template["title"]
    message = template["message"].format(**kwargs) if kwargs else template["message"]

    return send_notification_to_user(
        user_id=user_id, title=title, message=message, data=template["data"]
    )


def send_bulk_engagement_notification(user_ids: List[str], template_key: str, **kwargs) -> Dict:
    """Send engagement notification to multiple users"""
    if template_key not in ENGAGEMENT_TEMPLATES:
        return {"success": False, "error": f"Unknown template: {template_key}"}

    template = ENGAGEMENT_TEMPLATES[template_key]
    title = template["title"].format(**kwargs) if kwargs else template["title"]
    message = template["message"].format(**kwargs) if kwargs else template["message"]

    return send_notification_to_users(
        user_ids=user_ids, title=title, message=message, data=template["data"]
    )


def send_custom_engagement_notification(
    user_ids: Optional[List[str]] = None,
    target_all: bool = False,
    title: str = "",
    message: str = "",
    action: str = "open_app",
) -> Dict:
    """Send custom engagement notification"""
    return send_onesignal_notification(
        title=title,
        message=message,
        target_user_ids=user_ids,
        target_all=target_all,
        data={"type": "custom", "action": action},
    )


def get_engagement_templates() -> Dict:
    """Return all available engagement templates for admin panel"""
    return ENGAGEMENT_TEMPLATES
