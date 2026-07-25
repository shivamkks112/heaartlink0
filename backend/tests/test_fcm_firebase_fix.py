"""
Test FCM Firebase key fix (HEARTLINK_FIREBASE_B64 override).
Iteration 15 - verifies push notification infrastructure works with new key.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trust-based-deploy.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "review@heartlink.co.in"
ADMIN_PASSWORD = "HeartLink@2026"


@pytest.fixture(scope="module")
def login_data():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin_token(login_data):
    tok = login_data.get("access_token") or login_data.get("token")
    assert tok, f"No token in login response: {login_data}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_user_id(login_data):
    uid = (login_data.get("user") or {}).get("id")
    assert uid, f"No user.id in login response: {login_data}"
    return uid


def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=30)
    assert r.status_code == 200
    print(f"Health: {r.json()}")


def test_admin_login(admin_token):
    assert admin_token
    print(f"Admin token length: {len(admin_token)}")


def test_push_status(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/push/status", headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"push/status: {r.status_code} {r.text}"
    d = r.json()
    print(f"push/status: {d}")
    assert d.get("configured") is True, f"configured != true: {d}"
    assert d.get("provider") == "fcm", f"provider != fcm: {d}"
    assert d.get("can_send_notifications") is True, f"can_send_notifications != true: {d}"


def test_onesignal_backcompat(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/onesignal/status", headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"onesignal/status: {r.status_code} {r.text}"
    d = r.json()
    print(f"onesignal/status: {d}")
    assert d.get("provider") == "fcm"


def test_register_fcm_token(admin_headers, admin_user_id):
    fake_token = "fake_fcm_token_iter15_test_" + "x" * 100
    r = requests.post(f"{BASE_URL}/api/fcm/register-token",
                      headers=admin_headers,
                      json={"user_id": admin_user_id, "fcm_token": fake_token},
                      timeout=30)
    print(f"register-token: {r.status_code} {r.text[:300]}")
    assert r.status_code == 200, f"register-token failed: {r.status_code} {r.text}"


def test_fcm_diagnostics_no_jwt_signature_error(admin_headers, admin_user_id):
    """Critical: after fix, error should NOT be 'Invalid JWT Signature'."""
    r = requests.get(f"{BASE_URL}/api/fcm/diagnostics/{admin_user_id}", headers=admin_headers, timeout=45)
    assert r.status_code == 200, f"diagnostics failed: {r.status_code} {r.text}"
    d = r.json()
    print(f"diagnostics: {d}")
    assert d.get("firebase_initialized") is True, f"firebase_initialized != true: {d}"
    test_result = d.get("test_send_result") or {}
    err = (test_result.get("error") or "").lower()
    print(f"test_send_result.error: {err}")
    assert "invalid jwt signature" not in err, (
        f"FIX NOT APPLIED - still getting 'Invalid JWT Signature': {test_result}"
    )


def test_admin_push_test(admin_headers):
    r = requests.post(f"{BASE_URL}/api/admin/push/test", headers=admin_headers, json={}, timeout=30)
    print(f"push/test: {r.status_code} {r.text[:300]}")
    assert r.status_code == 200, f"push/test failed: {r.status_code} {r.text}"


def test_admin_push_send_all(admin_headers):
    r = requests.post(f"{BASE_URL}/api/admin/push/send",
                      headers=admin_headers,
                      json={"title": "Test iter15", "message": "verification", "target": "all"},
                      timeout=60)
    print(f"push/send: {r.status_code} {r.text[:500]}")
    assert r.status_code == 200, f"push/send failed: {r.status_code} {r.text}"
    d = r.json()
    # Verify NOT jwt error
    err = str(d.get("error", "")).lower()
    assert "invalid jwt signature" not in err, f"JWT sig error on push/send: {d}"


def test_daily_notification_status(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/daily-notification-status", headers=admin_headers, timeout=30)
    print(f"daily-notif-status: {r.status_code} {r.text[:300]}")
    assert r.status_code == 200
    d = r.json()
    assert d.get("scheduler_running") is True, f"scheduler_running != true: {d}"
