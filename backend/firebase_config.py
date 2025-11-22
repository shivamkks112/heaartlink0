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
            data=data or {},
            token=token,
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
            data=data or {},
            tokens=tokens,
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
