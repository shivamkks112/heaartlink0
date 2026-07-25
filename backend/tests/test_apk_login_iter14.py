"""
Iteration 14: Verify APK login/forgot-password/FCM endpoints for HeartLink.
Focused test coverage requested by main agent to confirm the production API is
returning the expected responses.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-based-deploy.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "review@heartlink.co.in"
ADMIN_PASSWORD = "HeartLink@2026"
USER_EMAIL = "shivamkks112@gmail.com"
USER_PASSWORD = "Shivam@2026"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health ---
def test_health(client):
    r = client.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") in ("healthy", "ok"), data


# --- Login flows ---
def test_login_user(client):
    r = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_phone": USER_EMAIL, "password": USER_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "access_token" in body or "token" in body, body
    assert "user" in body or "user_id" in body or body.get("message"), body


def test_login_admin(client):
    r = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "access_token" in body or "token" in body, body


def test_login_invalid(client):
    r = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_phone": USER_EMAIL, "password": "wrong-password"},
        timeout=20,
    )
    assert r.status_code in (400, 401), r.text


# --- Forgot password ---
def test_forgot_password(client):
    r = client.post(
        f"{BASE_URL}/api/auth/forgot-password",
        json={"email_or_phone": USER_EMAIL},
        timeout=25,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # accept either 'message' with reset code sent semantics
    text = (body.get("message") or "").lower()
    assert "reset" in text or "code" in text or "sent" in text or body.get("success"), body


# --- FCM / Push endpoints ---
@pytest.fixture(scope="module")
def user_id(client):
    r = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_phone": USER_EMAIL, "password": USER_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip("login failed for user_id fixture")
    body = r.json()
    uid = (body.get("user") or {}).get("id") or body.get("user_id")
    if not uid:
        pytest.skip("no user_id in login response")
    return uid


def test_fcm_register_token(client, user_id):
    r = client.post(
        f"{BASE_URL}/api/fcm/register-token",
        json={"user_id": user_id, "fcm_token": "TEST_FCM_TOKEN_iter14_dummy"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True or "message" in body, body


def test_fcm_diagnostics(client, user_id):
    r = client.get(f"{BASE_URL}/api/fcm/diagnostics/{user_id}", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("firebase_initialized") is True, body


def test_admin_push_status(client):
    # login admin to get token
    login = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert login.status_code == 200
    token = login.json().get("access_token") or login.json().get("token")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = client.get(f"{BASE_URL}/api/admin/push/status", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("provider") == "fcm", body
    assert body.get("configured") is True, body


# --- Static asset / config checks (local file system) ---
def test_capacitor_http_enabled():
    import json
    with open("/app/frontend/capacitor.config.json") as f:
        cfg = json.load(f)
    assert cfg["plugins"]["CapacitorHttp"]["enabled"] is True


def test_android_icons_exist():
    base = "/app/frontend/android/app/src/main/res"
    for density in ("mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"):
        p = f"{base}/mipmap-{density}/ic_launcher.png"
        assert os.path.exists(p), f"Missing icon: {p}"
        assert os.path.getsize(p) > 0, f"Empty icon: {p}"
