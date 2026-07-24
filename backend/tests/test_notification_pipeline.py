"""Test notification pipeline - FCM + OneSignal permanent fix (iteration 11)."""
import os
import re
import uuid
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
def auth(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    user_id = (data.get("user") or {}).get("id") or data.get("user_id")
    assert token, f"No token in login response: {data}"
    api.headers.update({"Authorization": f"Bearer {token}"})
    return {"token": token, "user_id": user_id, "data": data}


# --- Health ---
def test_health(api):
    r = api.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") in ("healthy", "ok", "up") or "healthy" in str(body).lower()


# --- Auth ---
def test_login(auth):
    assert auth["token"]
    assert auth["user_id"]


# --- FCM Admin Status ---
def test_fcm_status(api, auth):
    r = api.get(f"{BASE_URL}/api/admin/fcm-status", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("can_send_notifications") is True, f"can_send_notifications not true: {data}"
    assert data.get("users_with_fcm_token", 0) >= 2, f"users_with_fcm_token < 2: {data}"


# --- OneSignal Status ---
def test_onesignal_status(api, auth):
    r = api.get(f"{BASE_URL}/api/admin/onesignal/status", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("configured") is True, f"OneSignal not configured: {data}"
    app_id = data.get("app_id", "")
    assert app_id.startswith("ad0b57dc"), f"Unexpected app_id: {app_id}"


# --- OneSignal Test Broadcast ---
def test_onesignal_test(api, auth):
    r = api.post(f"{BASE_URL}/api/admin/onesignal/test", json={}, timeout=45)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True, f"OneSignal test not success: {data}"
    assert data.get("notification_id"), f"No notification_id: {data}"


# --- FCM Register Token ---
def test_fcm_register_token(api, auth):
    fake_token = f"TEST_fcm_token_{uuid.uuid4().hex}"
    payload = {"user_id": auth["user_id"], "fcm_token": fake_token}
    r = api.post(f"{BASE_URL}/api/fcm/register-token", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True, f"register-token not success: {data}"


# --- OneSignal Migrate FCM Users ---
def test_onesignal_migrate(api, auth):
    r = api.post(f"{BASE_URL}/api/admin/onesignal/migrate-fcm-users", json={}, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True, f"Migrate not success: {data}"


# --- Notifications list ---
def test_notifications_list(api, auth):
    r = api.get(f"{BASE_URL}/api/notifications/{auth['user_id']}", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    notifs = data if isinstance(data, list) else data.get("notifications", [])
    assert isinstance(notifs, list)


# --- Daily Notification Scheduler ---
def test_daily_notification_status(api, auth):
    r = api.get(f"{BASE_URL}/api/admin/daily-notification-status", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("scheduler_running") is True, f"Scheduler not running: {data}"


# --- Firebase config AndroidConfig ---
def test_firebase_android_config():
    with open("/app/backend/firebase_config.py") as f:
        src = f.read()
    assert "AndroidConfig" in src
    assert "channel_id='heartlink_notifications'" in src or 'channel_id="heartlink_notifications"' in src
    assert "priority='high'" in src or 'priority="high"' in src


# --- No raw OneSignal API keys in .py files ---
def test_no_raw_onesignal_key():
    import glob
    # Only production backend files, exclude tests dir which may reference keys in comments
    for py in glob.glob("/app/backend/*.py"):
        with open(py) as f:
            content = f.read()
        assert "os_v2_app_" not in content, f"Raw OneSignal key found in {py}"
