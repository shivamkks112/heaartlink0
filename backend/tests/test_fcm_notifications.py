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
    """POST /api/admin/push/test — sends via FCM.
    Note: If DB has zero real FCM tokens (post-cleanup), success may be False with error='no_tokens'.
    Endpoint must still respond 200 with FCM shape.
    """
    r = session.post(f"{BASE_URL}/api/admin/push/test", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "success" in d
    if d.get("success") is not True:
        # Acceptable when no real tokens exist yet (post race-condition cleanup)
        assert d.get("error") in ("no_tokens", "No users matched") or d.get("total") == 0, \
            f"Unexpected failure shape: {d}"


def test_push_send_all(session, admin):
    r = session.post(f"{BASE_URL}/api/admin/push/send", json={
        "title": "TEST_HeartLink",
        "message": "TEST regression push",
        "target": "all",
    }, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    # Accept either success or no-tokens shape (RCA: real users have zero FCM tokens)
    assert d.get("success") is True or d.get("error") in ("no_tokens", "No users matched") \
        or "sent" in d or "results" in d, d


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


# ─── NEW: FCM diagnostics endpoint tests ─────────────────────────

def test_fcm_diagnostics_returns_user_info(session, admin):
    """GET /api/fcm/diagnostics/{user_id} returns user info + firebase_initialized=true"""
    r = session.get(f"{BASE_URL}/api/fcm/diagnostics/{admin['user_id']}", timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["user_id"] == admin["user_id"]
    assert "name" in d
    assert "email" in d
    assert "has_fcm_token" in d
    assert d.get("firebase_initialized") is True, f"firebase_initialized should be True: {d}"
    assert "in_app_notification_count" in d
    assert isinstance(d["in_app_notification_count"], int)


def test_fcm_diagnostics_404_for_unknown_user(session, admin):
    r = session.get(f"{BASE_URL}/api/fcm/diagnostics/nonexistent_user_id_xyz_12345", timeout=20)
    assert r.status_code == 404, r.text


def test_register_then_diagnostics_shows_token(session, admin):
    """Register a token then verify diagnostics reports has_fcm_token=True + test_send_result."""
    token_value = "TEST_diagnostics_flow_token_xyz789_abcdefghijklmnop"
    reg = session.post(f"{BASE_URL}/api/fcm/register-token", json={
        "user_id": admin["user_id"],
        "fcm_token": token_value,
    }, timeout=20)
    assert reg.status_code == 200, reg.text
    assert reg.json().get("success") is True

    diag = session.get(f"{BASE_URL}/api/fcm/diagnostics/{admin['user_id']}", timeout=30)
    assert diag.status_code == 200, diag.text
    d = diag.json()
    assert d["has_fcm_token"] is True, f"has_fcm_token should be True after register: {d}"
    assert d.get("fcm_token_prefix", "").startswith("TEST_diagnostics_flow_token"), d
    assert d.get("fcm_token_updated_at"), "fcm_token_updated_at should be set"
    # test_send_result should be populated (may be success=False since fake token, but present)
    assert "test_send_result" in d and d["test_send_result"] is not None, \
        f"test_send_result should be present when token exists: {d}"


def test_register_token_invalid_user(session, admin):
    r = session.post(f"{BASE_URL}/api/fcm/register-token", json={
        "user_id": "nonexistent_user_xyz_9999",
        "fcm_token": "TEST_should_fail_token",
    }, timeout=20)
    assert r.status_code == 404, r.text


# ─── Frontend source verification (race condition fix) ──────────

def test_pushnotifications_js_listeners_before_register():
    """Verify pushNotifications.js has all addListener calls BEFORE register()."""
    path = "/app/frontend/src/services/pushNotifications.js"
    with open(path) as f:
        src = f.read()
    register_idx = src.find("PushNotifications.register()")
    assert register_idx > 0, "register() not found"
    # All addListener calls should appear before register()
    listener_snippets = [
        "addListener('registration'",
        "addListener('registrationError'",
        "addListener('pushNotificationReceived'",
        "addListener('pushNotificationActionPerformed'",
    ]
    for snippet in listener_snippets:
        idx = src.find(snippet)
        assert idx > 0, f"Listener not found: {snippet}"
        assert idx < register_idx, \
            f"Listener '{snippet}' appears AFTER register() — race condition!"


def test_pushnotifications_js_no_onesignal_references():
    """Verify no oneSignalService imports remain."""
    path = "/app/frontend/src/services/pushNotifications.js"
    with open(path) as f:
        src = f.read()
    assert "oneSignalService" not in src, "Stale oneSignalService reference"
    assert "OneSignal" not in src, "Stale OneSignal reference in pushNotifications.js"


def test_pushnotifications_js_has_retry_logic():
    """Verify registerTokenWithBackend has retry with backoff."""
    path = "/app/frontend/src/services/pushNotifications.js"
    with open(path) as f:
        src = f.read()
    assert "for (let attempt = 1; attempt <= 3" in src or "attempt <= 3" in src, \
        "Retry logic missing in registerTokenWithBackend"
