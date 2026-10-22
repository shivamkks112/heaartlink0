"""
FCM Push Notification Service - Production Grade
Single source of truth for ALL push notifications in HeartLink.
Uses Firebase Cloud Messaging directly - no third-party middleman.
"""

import os
import asyncio
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

# ─── Firebase Init ───────────────────────────────────────────────

_firebase_ok = False

def _init_firebase():
    global _firebase_ok
    
    # Try HEARTLINK_ prefixed base64 key first (not overridden by K8s)
    import base64
    b64_key = os.environ.get('HEARTLINK_FIREBASE_B64')
    if b64_key:
        try:
            creds_json = base64.b64decode(b64_key).decode('utf-8')
        except Exception:
            creds_json = None
    else:
        creds_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
    
    if not creds_json:
        logger.warning("Firebase credentials not found — push disabled")
        return
    try:
        cred_dict = json.loads(creds_json)
        cred = credentials.Certificate(cred_dict)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        _firebase_ok = True
        logger.info(f"Firebase FCM ready (project: {cred_dict.get('project_id')}, key_id: {cred_dict.get('private_key_id','?')[:8]}...)")
    except Exception as e:
        logger.error(f"Firebase init failed: {e}")

_init_firebase()


# ─── Android Config ──────────────────────────────────────────────

def _android_config(channel_id: str = 'heartlink_messages', sound: str = 'heartlink_message') -> messaging.AndroidConfig:
    """High-priority Android config with custom notification channel and sound."""
    return messaging.AndroidConfig(
        priority='high',
        ttl=86400,
        notification=messaging.AndroidNotification(
            channel_id=channel_id,
            priority='max',
            sound=sound,
            default_vibrate_timings=True,
            visibility='public',
            color='#FF6B9D',
        ),
    )

def _get_channel_for_type(data: Optional[Dict] = None) -> tuple:
    """Return (channel_id, sound) based on notification type."""
    if not data:
        return 'heartlink_messages', 'heartlink_message'
    ntype = data.get('type', '')
    if ntype in ('match', 'mutual_crush'):
        return 'heartlink_matches', 'heartlink_match'
    elif ntype in ('like', 'superlike', 'crush'):
        return 'heartlink_likes', 'heartlink_like'
    return 'heartlink_messages', 'heartlink_message'


# ─── Core Send Functions ─────────────────────────────────────────

def send_fcm(token: str, title: str, body: str, data: Optional[Dict] = None) -> Dict:
    """Send a single FCM push notification."""
    if not _firebase_ok:
        return {"success": False, "error": "Firebase not initialized"}
    if not token:
        return {"success": False, "error": "No FCM token"}
    try:
        clean_data = {k: str(v) for k, v in (data or {}).items()}
        channel_id, sound = _get_channel_for_type(data)
        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=clean_data,
            token=token,
            android=_android_config(channel_id, sound),
        )
        resp = messaging.send(msg)
        logger.info(f"FCM OK → {resp}")
        return {"success": True, "message_id": resp}
    except messaging.UnregisteredError:
        logger.warning(f"FCM token stale: {token[:20]}…")
        return {"success": False, "error": "token_stale", "stale": True}
    except messaging.SenderIdMismatchError:
        logger.error("FCM SenderIdMismatch — google-services.json may differ from service account")
        return {"success": False, "error": "sender_mismatch"}
    except Exception as e:
        logger.error(f"FCM send error: {e}")
        return {"success": False, "error": str(e)}


def send_fcm_multi(tokens: List[str], title: str, body: str, data: Optional[Dict] = None) -> Dict:
    """Send FCM to multiple devices (max 500 per batch)."""
    if not _firebase_ok:
        return {"success": False, "error": "Firebase not initialized"}
    if not tokens:
        return {"success": False, "error": "No tokens"}
    try:
        clean_data = {k: str(v) for k, v in (data or {}).items()}
        total_ok, total_fail = 0, 0
        stale_tokens = []
        for i in range(0, len(tokens), 500):
            batch = tokens[i:i+500]
            msg = messaging.MulticastMessage(
                notification=messaging.Notification(title=title, body=body),
                data=clean_data,
                tokens=batch,
                android=_android_config(),
            )
            resp = messaging.send_each_for_multicast(msg)
            total_ok += resp.success_count
            total_fail += resp.failure_count
            for idx, send_resp in enumerate(resp.responses):
                if send_resp.exception and isinstance(send_resp.exception, messaging.UnregisteredError):
                    stale_tokens.append(batch[idx])
        logger.info(f"FCM multi: {total_ok} ok, {total_fail} fail, {len(stale_tokens)} stale")
        return {
            "success": True,
            "success_count": total_ok,
            "failure_count": total_fail,
            "stale_tokens": stale_tokens,
        }
    except Exception as e:
        logger.error(f"FCM multi error: {e}")
        return {"success": False, "error": str(e)}


# ─── DB-aware helpers (need db reference passed in) ──────────────

async def send_to_user(db, user_id: str, title: str, body: str, data: Optional[Dict] = None) -> Dict:
    """Look up user's FCM token and send push. Returns result dict."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "fcm_token": 1})
    if not user or not user.get("fcm_token"):
        return {"success": False, "error": "no_token"}
    return await asyncio.to_thread(send_fcm, user["fcm_token"], title, body, data)


async def send_to_users(db, user_ids: List[str], title: str, body: str, data: Optional[Dict] = None) -> Dict:
    """Look up multiple users' FCM tokens and batch send."""
    if not user_ids:
        return {"success": False, "error": "no_users"}
    users = await db.users.find(
        {"id": {"$in": user_ids}, "fcm_token": {"$exists": True, "$nin": [None, ""]}},
        {"_id": 0, "fcm_token": 1}
    ).to_list(None)
    tokens = [u["fcm_token"] for u in users if u.get("fcm_token")]
    if not tokens:
        return {"success": False, "error": "no_tokens"}
    result = send_fcm_multi(tokens, title, body, data)
    # Clean stale tokens from DB
    if result.get("stale_tokens"):
        await db.users.update_many(
            {"fcm_token": {"$in": result["stale_tokens"]}},
            {"$set": {"fcm_token": None}}
        )
        logger.info(f"Cleared {len(result['stale_tokens'])} stale FCM tokens")
    return result


async def send_to_all(db, title: str, body: str, data: Optional[Dict] = None) -> Dict:
    """Send to ALL users with FCM tokens."""
    users = await db.users.find(
        {"fcm_token": {"$exists": True, "$nin": [None, ""]}, "is_ai_profile": {"$ne": True}},
        {"_id": 0, "fcm_token": 1}
    ).to_list(None)
    tokens = [u["fcm_token"] for u in users if u.get("fcm_token")]
    if not tokens:
        return {"success": False, "error": "no_tokens", "total": 0}
    result = send_fcm_multi(tokens, title, body, data)
    if result.get("stale_tokens"):
        await db.users.update_many(
            {"fcm_token": {"$in": result["stale_tokens"]}},
            {"$set": {"fcm_token": None}}
        )
    result["total_targeted"] = len(tokens)
    return result


async def send_to_gender(db, target_gender: str, title: str, body: str, data: Optional[Dict] = None, exclude_user_id: str = None) -> Dict:
    """Send push to users of a specific gender, excluding AI profiles and optionally a user."""
    query = {
        "fcm_token": {"$exists": True, "$nin": [None, ""]},
        "is_ai_profile": {"$ne": True},
        "gender": {"$regex": f"^{target_gender}$", "$options": "i"}
    }
    if exclude_user_id:
        query["id"] = {"$ne": exclude_user_id}
    
    users = await db.users.find(query, {"_id": 0, "fcm_token": 1}).to_list(None)
    tokens = [u["fcm_token"] for u in users if u.get("fcm_token")]
    if not tokens:
        return {"success": False, "error": "no_tokens", "total": 0}
    result = send_fcm_multi(tokens, title, body, data)
    if result.get("stale_tokens"):
        await db.users.update_many(
            {"fcm_token": {"$in": result["stale_tokens"]}},
            {"$set": {"fcm_token": None}}
        )
    result["total_targeted"] = len(tokens)
    return result


# ─── Event-Specific Notifications ────────────────────────────────

async def notify_new_message(db, receiver_id: str, sender_name: str, preview: str, match_id: str):
    return await send_to_user(db, receiver_id,
        title=f"New message from {sender_name}",
        body=preview[:100],
        data={"type": "message", "match_id": match_id, "route": f"/chat/{match_id}"},
    )

async def _should_notify_by_gender(db, receiver_id: str, sender_id: str) -> bool:
    """Check if notification should be sent based on gender preference.
    Male users only get engagement notifs from females, and vice versa.
    Returns True if notification should proceed."""
    try:
        users = await db.users.find(
            {"id": {"$in": [receiver_id, sender_id]}},
            {"_id": 0, "id": 1, "gender": 1}
        ).to_list(2)
        user_map = {u["id"]: u.get("gender", "").lower() for u in users}
        r_gender = user_map.get(receiver_id, "")
        s_gender = user_map.get(sender_id, "")
        if not r_gender or not s_gender:
            return True  # Unknown gender — allow
        return r_gender != s_gender  # Only opposite gender
    except Exception:
        return True  # On error, allow notification

async def notify_new_match(db, user_id: str, matched_name: str, match_id: str):
    return await send_to_user(db, user_id,
        title="New Match!",
        body=f"You matched with {matched_name}! Start chatting now.",
        data={"type": "match", "match_id": match_id, "route": f"/chat/{match_id}"},
    )

async def notify_new_like(db, user_id: str, liker_name: str, liker_id: str = ""):
    if liker_id and not await _should_notify_by_gender(db, user_id, liker_id):
        return None
    return await send_to_user(db, user_id,
        title="Someone likes you!",
        body=f"{liker_name} liked your profile. Check them out!",
        data={"type": "like", "route": "/likes"},
    )

async def notify_superlike(db, user_id: str, liker_name: str, liker_id: str = ""):
    if liker_id and not await _should_notify_by_gender(db, user_id, liker_id):
        return None
    return await send_to_user(db, user_id,
        title="Super Like!",
        body=f"{liker_name} superliked you! They really like you!",
        data={"type": "superlike", "route": "/likes"},
    )

async def notify_profile_view(db, user_id: str, viewer_name: str, viewer_id: str, anonymous: bool = False):
    if not await _should_notify_by_gender(db, user_id, viewer_id):
        return None
    if anonymous:
        return await send_to_user(db, user_id,
            title="Someone viewed your profile",
            body="Dekho kaun hai — Premium pe reveal karo",
            data={"type": "profile_view", "route": "/likes"},
        )
    return await send_to_user(db, user_id,
        title="Profile Viewed!",
        body=f"{viewer_name} viewed your profile.",
        data={"type": "profile_view", "viewer_id": viewer_id, "route": f"/profile/{viewer_id}"},
    )

async def notify_welcome(db, user_id: str, name: str):
    return await send_to_user(db, user_id,
        title="Welcome to HeartLink!",
        body="Thanks for joining us. Stay active to discover new people, get matches and start meaningful conversations.",
        data={"type": "welcome", "route": "/discover"},
    )

async def notify_verification(db, user_id: str, status: str, reason: str = ""):
    if status == "approved":
        title, body = "Profile Verified!", "Your profile has been verified!"
    else:
        title = "Profile Update Needed"
        body = f"Please update: {reason}" if reason else "Your profile needs changes."
    return await send_to_user(db, user_id, title=title, body=body,
        data={"type": "verification", "status": status, "route": "/profile"},
    )

async def notify_photo_approval(db, user_id: str, approved: bool):
    if approved:
        return await send_to_user(db, user_id,
            title="Profile Approved!",
            body="Your profile is now visible. Start matching!",
            data={"type": "photo_approved", "route": "/discover"},
        )
    else:
        return await send_to_user(db, user_id,
            title="Photo Not Approved",
            body="Please upload a clear face photo.",
            data={"type": "photo_rejected", "route": "/profile"},
        )

async def notify_online_status(db, user_ids: List[str], online_name: str, online_user_id: str = ""):
    """Send smart 'match is online' push — varied messages, opposite gender only."""
    import random as _rand
    if online_user_id and user_ids:
        online_user = await db.users.find_one({"id": online_user_id}, {"_id": 0, "gender": 1})
        online_gender = (online_user.get("gender", "") if online_user else "").lower()
        if online_gender:
            receivers = await db.users.find(
                {"id": {"$in": user_ids}},
                {"_id": 0, "id": 1, "gender": 1}
            ).to_list(len(user_ids))
            user_ids = [u["id"] for u in receivers if u.get("gender", "").lower() != online_gender]
    
    if not user_ids:
        return None
    
    # Varied engaging messages
    messages = [
        (f"{online_name} is online!", f"Your match {online_name} is online right now. Say hi!"),
        (f"{online_name} just came online", f"Now's a great time to chat with {online_name}!"),
        (f"Someone special is online", f"{online_name} is active on HeartLink. Don't miss out!"),
        (f"{online_name} is here!", f"Your match is online — start a conversation with {online_name}!"),
    ]
    title, body = _rand.choice(messages)
    
    return await send_to_users(db, user_ids,
        title=title,
        body=body,
        data={"type": "online_status", "route": "/matches", "user_id": online_user_id},
    )

async def notify_unread_reminder(db, user_id: str, count: int):
    return await send_to_user(db, user_id,
        title=f"{count} unread messages",
        body="Your matches are waiting for your reply!",
        data={"type": "unread_reminder", "route": "/matches"},
    )

async def notify_screenshot(db, user_id: str, who_name: str, match_id: str):
    return await send_to_user(db, user_id,
        title="Screenshot Detected!",
        body=f"{who_name} took a screenshot of your chat.",
        data={"type": "screenshot", "match_id": match_id, "route": f"/chat/{match_id}"},
    )


# ─── Admin / Broadcast Helpers ───────────────────────────────────

async def admin_broadcast(db, title: str, body: str, target: str = "all") -> Dict:
    """Admin broadcast: all / male / female / inactive."""
    query = {"fcm_token": {"$exists": True, "$nin": [None, ""]}, "is_ai_profile": {"$ne": True}}
    if target == "male":
        query["gender"] = {"$regex": "^male$", "$options": "i"}
    elif target == "female":
        query["gender"] = {"$regex": "^female$", "$options": "i"}
    elif target == "inactive":
        from datetime import timedelta
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["last_active"] = {"$lt": week_ago}

    users = await db.users.find(query, {"_id": 0, "fcm_token": 1}).to_list(None)
    tokens = [u["fcm_token"] for u in users if u.get("fcm_token")]
    if not tokens:
        return {"success": False, "error": "No users matched", "total": 0}
    result = send_fcm_multi(tokens, title, body, {"type": "admin", "route": "/discover"})
    if result.get("stale_tokens"):
        await db.users.update_many(
            {"fcm_token": {"$in": result["stale_tokens"]}},
            {"$set": {"fcm_token": None}}
        )
    result["total_targeted"] = len(tokens)
    return result


# ─── Engagement Templates ────────────────────────────────────────

ENGAGEMENT_TEMPLATES = {
    "inactive_1day": {"title": "Someone's waiting for you!", "body": "Don't miss out on potential matches!", "data": {"type": "engagement", "route": "/discover"}},
    "inactive_3days": {"title": "We miss you!", "body": "5+ people viewed your profile. Come back!", "data": {"type": "engagement", "route": "/likes"}},
    "inactive_7days": {"title": "Your profile is getting cold!", "body": "Active users get 10x more matches.", "data": {"type": "engagement", "route": "/discover"}},
    "weekend_special": {"title": "Weekend Special!", "body": "More people online. Perfect time to match!", "data": {"type": "promo", "route": "/discover"}},
    "daily_pick": {"title": "Your Daily Pick is ready!", "body": "We found someone special for you!", "data": {"type": "daily_pick", "route": "/discover"}},
    "profile_incomplete": {"title": "Complete your profile!", "body": "More details = 5x more matches.", "data": {"type": "profile", "route": "/profile"}},
    "first_match_tip": {"title": "Pro Tip!", "body": "First message senders have 70% higher success.", "data": {"type": "tip", "route": "/matches"}},
}

def get_engagement_templates():
    return ENGAGEMENT_TEMPLATES


# ─── Status Check ────────────────────────────────────────────────

def is_fcm_ready() -> bool:
    return _firebase_ok
