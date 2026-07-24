"""
Iteration 10: OneSignal device registration + targeted notification via player_id + tags fallback.
Tests the fixes for HeartLink Android notification delivery.
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-based-deploy.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "review@heartlink.co.in"
ADMIN_PASSWORD = "HeartLink@2026"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_login(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "user" in data
    return data


@pytest.fixture(scope="module")
def admin_user_id(admin_login):
    return admin_login["user"]["id"]


# ---------- Basic health ----------
def test_health(api):
    r = api.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") in ("ok", "healthy") or "status" in data


def test_admin_login_works(admin_login):
    assert admin_login["user"]["email"] == ADMIN_EMAIL


# ---------- OneSignal status ----------
def test_onesignal_status(api):
    r = api.get(f"{BASE_URL}/api/admin/onesignal/status")
    assert r.status_code == 200
    data = r.json()
    assert data["configured"] is True
    assert data["app_id"].startswith("ad0b57dc")
    assert data["can_send_notifications"] is True
    assert data["users_with_onesignal"] > 0, f"Expected users_with_onesignal > 0, got {data['users_with_onesignal']}"


# ---------- OneSignal test send (target=all) ----------
def test_onesignal_test_endpoint(api):
    r = api.post(f"{BASE_URL}/api/admin/onesignal/test")
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True, f"Expected success=true, got: {data}"
    assert data.get("notification_id"), f"Expected notification_id in response, got: {data}"


# ---------- Migrate FCM users ----------
def test_onesignal_migrate_fcm_users(api):
    r = api.post(f"{BASE_URL}/api/admin/onesignal/migrate-fcm-users")
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True
    assert "registered" in data
    assert "total_users" in data
    assert "failed" in data
    # Registered may be 0 (already migrated) - both acceptable
    assert isinstance(data["registered"], int)


# ---------- FCM token registration triggers OneSignal registration ----------
def test_fcm_register_token(api, admin_user_id):
    # Use a fake FCM token for registration (won't actually push but should return success)
    fake_token = "TEST_FCM_TOKEN_iteration10_" + admin_user_id[:8]
    r = api.post(f"{BASE_URL}/api/fcm/register-token", json={
        "user_id": admin_user_id,
        "fcm_token": fake_token,
    })
    assert r.status_code == 200, f"FCM register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True


# ---------- Admin send with target=all ----------
def test_onesignal_send_all(api):
    r = api.post(f"{BASE_URL}/api/admin/onesignal/send", json={
        "title": "TEST_it10 title",
        "message": "TEST_it10 message body from testing agent",
        "target": "all",
    })
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True, f"Expected success=true, got: {data}"


# ---------- Notifications endpoint for user ----------
def test_get_user_notifications(api, admin_user_id):
    r = api.get(f"{BASE_URL}/api/notifications/{admin_user_id}")
    assert r.status_code == 200
    data = r.json()
    # Accept both list and dict responses
    assert isinstance(data, (list, dict))


# ---------- Code-level checks ----------
ONESIGNAL_CFG = "/app/backend/onesignal_config.py"


def test_register_device_with_onesignal_exists():
    with open(ONESIGNAL_CFG) as f:
        code = f.read()
    assert "def register_device_with_onesignal(" in code
    assert "def _send_via_player_id(" in code
    assert "def _send_via_tags(" in code


def test_send_notification_to_user_fallback_chain():
    with open(ONESIGNAL_CFG) as f:
        code = f.read()
    # Extract send_notification_to_user function
    m = re.search(r"def send_notification_to_user\(.*?\n(?=\ndef |\Z)", code, re.DOTALL)
    assert m, "send_notification_to_user not found"
    body = m.group(0)
    # Must try player_id first, then tags fallback
    assert "_send_via_player_id" in body
    assert "_send_via_tags" in body
    # player_id path must be before tags fallback
    assert body.index("_send_via_player_id") < body.index("_send_via_tags")


def test_no_raw_onesignal_key_in_py_files():
    """No raw OneSignal REST API key pattern (os_v2_app_) in any backend .py file."""
    import glob
    offenders = []
    for path in glob.glob("/app/backend/**/*.py", recursive=True):
        if "/tests/" in path:
            continue
        with open(path) as f:
            content = f.read()
        if "os_v2_app_" in content:
            offenders.append(path)
    assert not offenders, f"Raw OneSignal key found in: {offenders}"


def test_send_push_to_user_helper_exists():
    with open("/app/backend/server.py") as f:
        code = f.read()
    assert "async def _send_push_to_user(" in code
    assert "onesignal_player_id" in code
