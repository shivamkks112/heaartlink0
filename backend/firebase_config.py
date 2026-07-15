"""
Firebase Admin SDK Configuration for Push Notifications
"""
import firebase_admin
from firebase_admin import credentials, messaging
import os
import json

# Initialize Firebase Admin SDK
# Load from environment variable only (no file fallback for production)
firebase_creds = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')

if not firebase_creds:
    print("⚠️ WARNING: FIREBASE_SERVICE_ACCOUNT_JSON environment variable not set!")
    print("⚠️ Push notifications will not work!")
    # Create a dummy app to prevent import errors
    firebase_admin.initialize_app() if not firebase_admin._apps else None
else:
    try:
        cred_dict = json.loads(firebase_creds)
        cred = credentials.Certificate(cred_dict)
        # Initialize app if not already initialized
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized successfully")
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing FIREBASE_SERVICE_ACCOUNT_JSON: {e}")
        print("⚠️ Push notifications will not work!")
        firebase_admin.initialize_app() if not firebase_admin._apps else None

def send_notification(token: str, title: str, body: str, data: dict = None):
    """
    Send push notification to a specific device
    
    Args:
        token: FCM device token
        title: Notification title
        body: Notification body text
        data: Additional data to send with notification
    """
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
            # Android heads-up popup config — routes to high-importance channel
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="heartlink_high_v2",
                    sound="default",
                    default_vibrate_timings=True,
                    default_sound=True,
                    default_light_settings=True,
                    priority="max",
                    visibility="public",
                ),
            ),
            # iOS heads-up config (if any iOS build exists)
            apns=messaging.APNSConfig(
                headers={"apns-priority": "10"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default", badge=1, content_available=True)
                ),
            ),
        )
        
        response = messaging.send(message)
        print(f"✅ Notification sent successfully: {response}")
        return {"success": True, "message_id": response}
    except Exception as e:
        print(f"❌ Error sending notification: {str(e)}")
        return {"success": False, "error": str(e)}


def send_notification_to_multiple(tokens: list, title: str, body: str, data: dict = None):
    """
    Send push notification to multiple devices
    
    Args:
        tokens: List of FCM device tokens
        title: Notification title
        body: Notification body text
        data: Additional data to send with notification
    """
    try:
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            tokens=tokens,
            # Android heads-up popup config — routes to high-importance channel
            # Android heads-up popup config — routes to high-importance channel
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="heartlink_high_v2",
                    sound="default",
                    default_vibrate_timings=True,
                    default_sound=True,
                    default_light_settings=True,
                    priority="max",
                    visibility="public",
                ),
            ),
            apns=messaging.APNSConfig(
                headers={"apns-priority": "10"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default", badge=1, content_available=True)
                ),
            ),
        )
        
        response = messaging.send_multicast(message)
        print(f"✅ Sent to {response.success_count} devices")
        print(f"❌ Failed for {response.failure_count} devices")
        return {
            "success": True,
            "success_count": response.success_count,
            "failure_count": response.failure_count
        }
    except Exception as e:
        print(f"❌ Error sending multicast notification: {str(e)}")
        return {"success": False, "error": str(e)}


def send_match_notification(token: str, user_name: str, compatibility_score: int):
    """Send notification when users match"""
    return send_notification(
        token=token,
        title="💕 It's a Match!",
        body=f"You matched with {user_name}! Compatibility: {compatibility_score}%",
        data={
            "type": "new_match",
            "user_name": user_name,
            "compatibility_score": str(compatibility_score)
        }
    )


def send_message_notification(token: str, sender_name: str, message_preview: str):
    """Send notification for new chat message"""
    return send_notification(
        token=token,
        title=f"💬 New message from {sender_name}",
        body=message_preview[:100],
        data={
            "type": "new_message",
            "sender_name": sender_name
        }
    )


def send_like_notification(token: str, user_name: str):
    """Send notification when someone likes you"""
    return send_notification(
        token=token,
        title="❤️ Someone likes you!",
        body=f"{user_name} liked your profile",
        data={
            "type": "new_like",
            "user_name": user_name
        }
    )


def send_verification_notification(token: str, status: str):
    """Send notification about profile verification status"""
    if status == "approved":
        title = "✅ Profile Verified!"
        body = "Congratulations! Your profile has been verified by admin."
    else:
        title = "❌ Profile Not Approved"
        body = "Your profile verification was not approved. Please update your profile."
    
    return send_notification(
        token=token,
        title=title,
        body=body,
        data={
            "type": "verification",
            "status": status
        }
    )


def send_promotional_notification(tokens: list, title: str, body: str):
    """Send promotional/engagement notification to multiple users"""
    return send_notification_to_multiple(
        tokens=tokens,
        title=title,
        body=body,
        data={"type": "promotional"}
    )


def send_daily_reminder(token: str):
    """Send daily engagement reminder"""
    return send_notification(
        token=token,
        title="💕 New matches waiting!",
        body="Someone special might be waiting for you. Open HeartLink now!",
        data={"type": "daily_reminder"}
    )


def send_inactive_user_notification(token: str, days_inactive: int):
    """Send notification to inactive users"""
    return send_notification(
        token=token,
        title="😢 We miss you!",
        body=f"You haven't checked HeartLink in {days_inactive} days. New profiles are waiting!",
        data={"type": "re_engagement"}
    )


def send_profile_view_notification(token: str, viewer_name: str):
    """Send notification when someone views the profile"""
    return send_notification(
        token=token,
        title="👀 Someone checked you out!",
        body=f"{viewer_name} just viewed your profile.",
        data={
            "type": "profile_view",
            "action": "open_profile_views",
            "viewer_name": viewer_name,
        }
    )


def send_premium_notification(token: str, plan_id: str):
    """Send notification when premium subscription is activated"""
    plan_label = {"monthly": "Monthly", "quarterly": "Quarterly", "yearly": "Yearly"}.get(plan_id, plan_id.title())
    return send_notification(
        token=token,
        title="⭐ Premium Activated!",
        body=f"Welcome to HeartLink {plan_label} Premium. Unlock all features and start connecting!",
        data={
            "type": "premium",
            "plan": plan_id,
            "action": "open_premium",
        }
    )
