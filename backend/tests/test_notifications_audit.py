"""
Notification System Audit Tests for HeartLink
Tests all endpoints from review_request iteration 8.
"""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-based-deploy.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "review@heartlink.co.in"
ADMIN_PASS = "HeartLink@2026"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    user = data.get("user") or {}
    assert token, f"no access_token in {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return {"session": s, "user_id": user.get("id"), "token": token}


# ---------------- Basic health ----------------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") in ("healthy", "ok", "up")


def test_login_returns_access_token(admin_session):
    assert admin_session["user_id"]
    assert admin_session["token"]


# ---------------- OneSignal / config ----------------
def test_onesignal_status(admin_session):
    r = admin_session["session"].get(f"{API}/admin/onesignal/status", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("configured") is True
    assert data.get("can_send_notifications") is True


def test_daily_notification_status(admin_session):
    r = admin_session["session"].get(f"{API}/admin/daily-notification-status", timeout=10)
    assert r.status_code == 200
    data = r.json()
    # scheduler_running key expected
    assert "scheduler_running" in data
    assert data["scheduler_running"] is True


def test_notification_templates(admin_session):
    r = admin_session["session"].get(f"{API}/admin/notifications/templates", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "templates" in data
    assert isinstance(data["templates"], dict)
    assert len(data["templates"]) > 0


def test_delivery_log(admin_session):
    r = admin_session["session"].get(f"{API}/admin/notifications/delivery-log", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "logs" in data
    assert "summary" in data
    assert "by_type" in data["summary"]


def test_notification_stats(admin_session):
    r = admin_session["session"].get(f"{API}/admin/notifications/stats", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "total_sent" in data or "total" in data
    assert "by_type" in data


# ---------------- User notifications ----------------
def test_get_user_notifications(admin_session):
    uid = admin_session["user_id"]
    r = admin_session["session"].get(f"{API}/notifications/{uid}", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "notifications" in data
    assert "unread_count" in data
    assert isinstance(data["notifications"], list)


def test_mark_all_read(admin_session):
    uid = admin_session["user_id"]
    r = admin_session["session"].post(f"{API}/notifications/{uid}/read-all", timeout=10)
    assert r.status_code == 200


def test_mark_single_read_if_available(admin_session):
    uid = admin_session["user_id"]
    r = admin_session["session"].get(f"{API}/notifications/{uid}", timeout=10)
    notifs = r.json().get("notifications", [])
    if not notifs:
        pytest.skip("no notifications to mark read")
    nid = notifs[0].get("id")
    assert nid
    r2 = admin_session["session"].post(f"{API}/notifications/{nid}/read", params={"user_id": uid}, timeout=10)
    assert r2.status_code == 200


# ---------------- Admin OneSignal send ----------------
def test_admin_onesignal_send_all(admin_session):
    payload = {"title": "TEST_Audit", "message": "iteration 8 automated test", "target": "all"}
    r = admin_session["session"].post(f"{API}/admin/onesignal/send", json=payload, timeout=20)
    assert r.status_code == 200
    # Result should be a dict, may or may not have success depending on OneSignal
    data = r.json()
    assert isinstance(data, dict)


# ---------------- Scheduled notifications ----------------
def test_schedule_notification(admin_session):
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    payload = {"title": "TEST_Sched", "body": "scheduled audit test", "target": "all", "schedule_time": future}
    r = admin_session["session"].post(f"{API}/admin/schedule-notification", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True
    assert data.get("scheduled_id")
    # cleanup
    admin_session["session"].delete(f"{API}/admin/scheduled-notification/{data['scheduled_id']}", timeout=10)


def test_get_scheduled_notifications(admin_session):
    r = admin_session["session"].get(f"{API}/admin/scheduled-notifications", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------------- Daily trigger ----------------
def test_trigger_daily_notification(admin_session):
    r = admin_session["session"].post(f"{API}/admin/trigger-daily-notification", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)


# ---------------- Profile approval push+in-app ----------------
def test_profile_approve_endpoint_shape(admin_session):
    """Verify the profile-approve endpoint exists and validates payload."""
    # Send with invalid user to test endpoint reachability (not causing side effects)
    payload = {"user_id": "nonexistent-user-audit", "action": "approve"}
    r = admin_session["session"].post(f"{API}/admin/approve-profile", json=payload, timeout=15)
    # Should either be 404 (user not found) or 400 (validation). Not 500.
    assert r.status_code in (200, 400, 404, 422), f"unexpected {r.status_code} {r.text}"
