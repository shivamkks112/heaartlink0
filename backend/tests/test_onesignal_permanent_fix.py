"""
Iteration 9: OneSignal Permanent Fix verification.
Tests all endpoints from review_request features_or_bugs_to_test list.
"""
import os
import re
import sys
import glob
import pytest
import requests

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

# Frontend .env holds the public backend URL
BASE_URL = ""
with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "review@heartlink.co.in"
ADMIN_PASSWORD = "HeartLink@2026"
TEST_USER_EMAIL = "shivamkks112@gmail.com"


@pytest.fixture(scope="session")
def admin_login():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def admin_token(admin_login):
    token = admin_login.get("access_token") or admin_login.get("token")
    assert token, f"No token in response: {admin_login}"
    return token


@pytest.fixture(scope="session")
def admin_user_id(admin_login):
    return admin_login["user"]["id"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Basic health & auth ----------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") in ("healthy", "ok", "up") or "healthy" in str(body).lower()


def test_login_returns_token(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 10


# ---------- OneSignal config & endpoints ----------
def test_onesignal_status(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/onesignal/status", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("configured") is True, data
    app_id = data.get("app_id", "")
    assert app_id.startswith("ad0b57dc"), f"Wrong app_id: {app_id}"
    assert data.get("can_send_notifications") is True, data


def test_onesignal_test_endpoint(admin_headers):
    r = requests.post(f"{BASE_URL}/api/admin/onesignal/test", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    # Accept nested or flat shape
    success = data.get("success") or (data.get("result") or {}).get("success")
    notif_id = data.get("notification_id") or (data.get("result") or {}).get("notification_id")
    assert success is True, data
    assert notif_id, data


def test_onesignal_send_all(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/admin/onesignal/send",
        headers=admin_headers,
        json={"title": "TEST_ITER9", "message": "Iteration 9 broadcast", "target_all": True},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    success = data.get("success") or (data.get("result") or {}).get("success")
    assert success is True, data


def test_daily_notification_status(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/daily-notification-status", headers=admin_headers, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("scheduler_running") is True, data


def test_delivery_log(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/notifications/delivery-log", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "logs" in data and "summary" in data, data


def test_get_notifications_for_user(admin_headers, admin_user_id):
    uid = admin_user_id
    r = requests.get(f"{BASE_URL}/api/notifications/{uid}", headers=admin_headers, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    # Accept either list or dict-with-list
    if isinstance(data, dict):
        assert "notifications" in data or "items" in data or isinstance(data.get("data"), list), data
    else:
        assert isinstance(data, list)


# ---------- Security: no raw secrets in code ----------
def test_no_raw_onesignal_key_in_python():
    pattern = re.compile(r"os_v2_app_[A-Z0-9]{40,}", re.IGNORECASE)
    hits = []
    for path in glob.glob("/app/backend/**/*.py", recursive=True):
        if "__pycache__" in path or "/tests/" in path:
            continue
        try:
            with open(path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
            if pattern.search(content):
                hits.append(path)
        except Exception:
            pass
    assert not hits, f"Raw OneSignal API key found in: {hits}"


def test_app_id_uuid_validation_rejects_slug(monkeypatch):
    """Reload onesignal_config with a bad env var and ensure it falls back."""
    import importlib
    monkeypatch.setenv("HEARTLINK_ONESIGNAL_APP_ID", "trust-based-deploy")
    import onesignal_config
    importlib.reload(onesignal_config)
    assert onesignal_config.ONESIGNAL_APP_ID == "ad0b57dc-908b-4d84-8654-d6b5dd50684e"
    # Also confirms UUID regex
    monkeypatch.delenv("HEARTLINK_ONESIGNAL_APP_ID", raising=False)
    importlib.reload(onesignal_config)


# ---------- Approve profile triggers notification (best-effort) ----------
def test_admin_approve_profile_reachable(admin_headers):
    # Find any pending or existing user
    r = requests.get(f"{BASE_URL}/api/admin/users?limit=1", headers=admin_headers, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin/users unavailable: {r.status_code}")
    users = r.json()
    if isinstance(users, dict):
        users = users.get("users") or users.get("data") or []
    if not users:
        pytest.skip("No users to test approve")
    uid = users[0].get("id") or users[0].get("_id")
    resp = requests.post(
        f"{BASE_URL}/api/admin/approve-profile",
        headers=admin_headers,
        json={"user_id": uid, "approved": True},
        timeout=15,
    )
    # Endpoint should be reachable (200/400/404 are all fine; 500 is not)
    assert resp.status_code < 500, resp.text
