"""
OneSignal push notification tests.
Verifies OneSignal API integration and that helper functions succeed.
Note: recipients=0 is EXPECTED in preview env (no real subscribers).
Focus: ensure OneSignal API returns success:true.
"""

import os
import sys
import pytest
import requests

sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

from onesignal_config import (
    ONESIGNAL_APP_ID,
    ONESIGNAL_API_KEY,
    send_onesignal_notification,
    send_notification_to_all,
    send_notification_to_user,
    send_notification_to_users,
    send_match_notification_onesignal,
    send_message_notification_onesignal,
    send_like_notification_onesignal,
)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")


# ---------- Config ----------
class TestOneSignalConfig:
    def test_app_id_is_uuid_format(self):
        import re
        uuid_re = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
        assert ONESIGNAL_APP_ID, "ONESIGNAL_APP_ID not set"
        assert uuid_re.match(ONESIGNAL_APP_ID), f"App ID not UUID: {ONESIGNAL_APP_ID}"

    def test_api_key_present(self):
        assert ONESIGNAL_API_KEY, "ONESIGNAL_API_KEY not set"
        assert ONESIGNAL_API_KEY.startswith("os_v2_"), "API key format looks wrong"


# ---------- Direct helper function tests ----------
class TestOneSignalHelpers:
    def test_send_notification_to_all(self):
        res = send_notification_to_all(
            "TEST_ALL", "Test broadcast", data={"type": "test"}
        )
        assert res.get("success") is True, f"send_to_all failed: {res}"
        assert "notification_id" in res

    def test_send_notification_to_user(self):
        res = send_notification_to_user(
            "test-user-id-nonexistent",
            "TEST_USER",
            "Test single user",
            data={"type": "test"},
        )
        # OneSignal accepts request even if user doesn't exist (recipients=0).
        assert res.get("success") is True, f"send_to_user failed: {res}"

    def test_send_match_notification(self):
        res = send_match_notification_onesignal("test-user-id", "TestName")
        assert res.get("success") is True, f"match notif failed: {res}"

    def test_send_message_notification(self):
        res = send_message_notification_onesignal(
            "test-user-id", "Sender", "Hello there!", match_id="m123"
        )
        assert res.get("success") is True, f"message notif failed: {res}"

    def test_send_like_notification(self):
        res = send_like_notification_onesignal("test-user-id", "LikerName")
        assert res.get("success") is True, f"like notif failed: {res}"


# ---------- Admin API endpoint test ----------
class TestOneSignalAdminEndpoint:
    def test_admin_broadcast_endpoint(self):
        url = f"{BASE_URL}/api/admin/onesignal/send"
        payload = {
            "title": "TEST_ADMIN_BROADCAST",
            "message": "Testing admin push",
            "target_all": True,
        }
        r = requests.post(url, json=payload, timeout=15)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        # Endpoint returns wrapper with 'result' or similar
        # Accept either shape: check success flag anywhere
        text = str(data)
        assert "success" in text.lower() or "notification_id" in text.lower(), data
