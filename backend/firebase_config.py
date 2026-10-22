"""
Firebase Admin SDK Configuration for Push Notifications
Production-grade with proper Android high-priority config
"""
import firebase_admin
from firebase_admin import credentials, messaging
import os
import json
import logging

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
# Try HEARTLINK_ prefixed base64 key first (not overridden by K8s platform)
import base64 as _b64
_fb_b64 = os.environ.get('HEARTLINK_FIREBASE_B64')
if _fb_b64:
    try:
        firebase_creds = _b64.b64decode(_fb_b64).decode('utf-8')
    except Exception:
        firebase_creds = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
else:
    firebase_creds = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')

if not firebase_creds:
    logger.warning("FIREBASE_SERVICE_ACCOUNT_JSON not set - FCM push disabled")
    if not firebase_admin._apps:
        try:
            firebase_admin.initialize_app()
        except Exception:
            pass
else:
    try:
        cred_dict = json.loads(firebase_creds)
        cred = credentials.Certificate(cred_dict)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        logger.info(f"Firebase Admin SDK initialized (project: {cred_dict.get('project_id')})")
    except Exception as e:
        logger.error(f"Firebase init error: {e}")
        if not firebase_admin._apps:
            try:
                firebase_admin.initialize_app()
            except Exception:
                pass


def send_notification(token: str, title: str, body: str, data: dict = None):
    """Send high-priority push notification to a specific device."""
    try:
        # Ensure all data values are strings (FCM requirement)
        clean_data = {k: str(v) for k, v in (data or {}).items()}

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=clean_data,
            token=token,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    channel_id='heartlink_messages',
                    priority='max',
                    default_sound=True,
                    default_vibrate_timings=True,
                    visibility='public',
                    color='#FF6B9D',
                ),
            ),
        )

        response = messaging.send(message)
        logger.info(f"FCM sent: {response}")
        return {"success": True, "message_id": response}
    except messaging.UnregisteredError:
        logger.warning(f"FCM token unregistered (stale): {token[:20]}...")
        return {"success": False, "error": "Token unregistered", "stale_token": True}
    except messaging.InvalidArgumentError as e:
        logger.error(f"FCM invalid arg: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"FCM send error: {e}")
        return {"success": False, "error": str(e)}


def send_notification_to_multiple(tokens: list, title: str, body: str, data: dict = None):
    """Send push notification to multiple devices."""
    if not tokens:
        return {"success": False, "error": "No tokens"}
    try:
        clean_data = {k: str(v) for k, v in (data or {}).items()}

        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data=clean_data,
            tokens=tokens,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    channel_id='heartlink_messages',
                    priority='max',
                    default_sound=True,
                    default_vibrate_timings=True,
                    visibility='public',
                    color='#FF6B9D',
                ),
            ),
        )

        response = messaging.send_each_for_multicast(message)
        logger.info(f"FCM multicast: {response.success_count} ok, {response.failure_count} fail")
        return {
            "success": True,
            "success_count": response.success_count,
            "failure_count": response.failure_count,
        }
    except Exception as e:
        logger.error(f"FCM multicast error: {e}")
        return {"success": False, "error": str(e)}


def send_match_notification(token: str, user_name: str, compatibility_score: int):
    return send_notification(
        token=token,
        title="New Match!",
        body=f"You matched with {user_name}! Compatibility: {compatibility_score}%",
        data={"type": "new_match", "user_name": user_name, "compatibility_score": str(compatibility_score)},
    )


def send_message_notification(token: str, sender_name: str, message_preview: str):
    return send_notification(
        token=token,
        title=f"New message from {sender_name}",
        body=message_preview[:100],
        data={"type": "new_message", "sender_name": sender_name},
    )


def send_like_notification(token: str, user_name: str):
    return send_notification(
        token=token,
        title="Someone likes you!",
        body=f"{user_name} liked your profile",
        data={"type": "new_like", "user_name": user_name},
    )


def send_verification_notification(token: str, status: str):
    if status == "approved":
        title = "Profile Verified!"
        body = "Your profile has been verified by admin."
    else:
        title = "Profile Not Approved"
        body = "Your profile verification was not approved. Please update."
    return send_notification(token=token, title=title, body=body, data={"type": "verification", "status": status})


def send_promotional_notification(tokens: list, title: str, body: str):
    return send_notification_to_multiple(tokens=tokens, title=title, body=body, data={"type": "promotional"})


def send_daily_reminder(token: str):
    return send_notification(
        token=token,
        title="New matches waiting!",
        body="Someone special might be waiting for you. Open HeartLink now!",
        data={"type": "daily_reminder"},
    )


def send_inactive_user_notification(token: str, days_inactive: int):
    return send_notification(
        token=token,
        title="We miss you!",
        body=f"You haven't checked HeartLink in {days_inactive} days. New profiles are waiting!",
        data={"type": "re_engagement"},
    )
