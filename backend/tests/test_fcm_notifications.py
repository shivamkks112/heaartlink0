"""Regression tests for FCM notification system (OneSignal removed)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-based-deploy.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "review@heartlink.co.in"
ADMIN_PASSWORD = "HeartLink@2026"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    }, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    user = data.get("user") or {}
    user_id = user.get("id") or data.get("user_id")
    assert token, "No token in login response"
    session.headers.update({"Authorization": f"Bearer {token}"})
    return {"token": token, "user_id": user_id, "data": data}


def test_health(session):
    r = session.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") in ("healthy", "ok", "up") or body.get("healthy") is True or "status" in body


def test_admin_login(admin):
    assert admin["token"]
    assert admin["user_id"]


def test_push_status(session, admin):
    r = session.get(f"{BASE_URL}/api/admin/push/status", timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["provider"] == "fcm"
    assert d["configured"] is True
    assert d["can_send_notifications"] is True
    assert d["users_with_fcm_token"] >= 0  # Could be 0 if all stale — accept, but check exists
    # Requirement says > 0
    assert d["users_with_fcm_token"] > 0, f"Expected users_with_fcm_token>0, got {d}"


def test_push_test(session, admin):
    r = session.post(f"{BASE_URL}/api/admin/push/test", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("success") is True, f"success!=true: {d}"


def test_push_send_all(session, admin):
    r = session.post(f"{BASE_URL}/api/admin/push/send", json={
        "title": "TEST_HeartLink",
        "message": "TEST regression push",
        "target": "all",
    }, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("success") is True or "sent" in d or "results" in d, d


def test_fcm_register_token(session, admin):
    payload = {"user_id": admin["user_id"], "fcm_token": "TEST_fcm_regression_token_abc123"}
    r = session.post(f"{BASE_URL}/api/fcm/register-token", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("success") is True or d.get("status") == "success", d


def test_onesignal_status_compat(session, admin):
    r = session.get(f"{BASE_URL}/api/admin/onesignal/status", timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["provider"] == "fcm"


def test_onesignal_send_compat(session, admin):
    r = session.post(f"{BASE_URL}/api/admin/onesignal/send", json={
        "title": "TEST_Compat",
        "message": "TEST backward compat",
        "target": "all",
    }, timeout=30)
    assert r.status_code == 200, r.text


def test_onesignal_test_compat(session, admin):
    r = session.post(f"{BASE_URL}/api/admin/onesignal/test", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("success") is True, d


def test_daily_notification_status(session, admin):
    r = session.get(f"{BASE_URL}/api/admin/daily-notification-status", timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("scheduler_running") is True, d


def test_notifications_templates(session, admin):
    r = session.get(f"{BASE_URL}/api/admin/notifications/templates", timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "templates" in d
    assert isinstance(d["templates"], dict) and len(d["templates"]) > 0


def test_notifications_for_user(session, admin):
    r = session.get(f"{BASE_URL}/api/notifications/{admin['user_id']}", timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    # Accept list or {notifications: [...]}
    if isinstance(d, dict):
        assert "notifications" in d and isinstance(d["notifications"], list)
    else:
        assert isinstance(d, list)
