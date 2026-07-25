"""
Iteration 20 tests - HeartLink UI overhaul backend verification
- /api/health
- /api/auth/login with review credentials
- /api/messages/{message_id}/react (new endpoint)
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-based-deploy.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "review@heartlink.co.in"
ADMIN_PASSWORD = "HeartLink@2026"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_user(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()


def test_health(session):
    r = session.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") in ("ok", "healthy") or "status" in data


def test_admin_login(admin_user):
    # user object nested under 'user' key or top-level
    user = admin_user.get("user") or admin_user
    assert user.get("email") == ADMIN_EMAIL or user.get("id")


def test_login_wrong_password(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email_or_phone": ADMIN_EMAIL, "password": "wrong-password-XYZ"}, timeout=10)
    assert r.status_code in (400, 401, 403)


def test_react_invalid_reaction(session):
    # Should return 400 for invalid reaction (before checking msg existence, since validation happens first)
    fake_msg = str(uuid.uuid4())
    r = session.post(f"{BASE_URL}/api/messages/{fake_msg}/react",
                     json={"message_id": fake_msg, "user_id": "u1", "reaction": "invalid_emoji"}, timeout=10)
    assert r.status_code == 400
    assert "Invalid reaction" in r.text


def test_react_message_not_found(session):
    fake_msg = str(uuid.uuid4())
    r = session.post(f"{BASE_URL}/api/messages/{fake_msg}/react",
                     json={"message_id": fake_msg, "user_id": "u1", "reaction": "heart"}, timeout=10)
    assert r.status_code == 404


def test_react_on_real_message(session, admin_user):
    """Fetch an existing message from the DB and react to it."""
    user = admin_user.get("user") or admin_user
    user_id = user.get("id")
    if not user_id:
        pytest.skip("No admin user id")

    # Get matches for this admin user
    r = session.get(f"{BASE_URL}/api/matches/{user_id}", timeout=15)
    if r.status_code != 200 or not r.json():
        pytest.skip("No matches available for admin user")

    matches = r.json()
    message_id = None
    match_id_used = None
    for m in matches:
        mid = m.get("match_id") or m.get("id")
        if not mid:
            continue
        mr = session.get(f"{BASE_URL}/api/messages/{mid}?user_id={user_id}&limit=10", timeout=15)
        if mr.status_code == 200 and mr.json():
            msgs = mr.json()
            if msgs:
                message_id = msgs[0].get("id")
                match_id_used = mid
                break

    if not message_id:
        pytest.skip("No messages found in any match to react to")

    # React with heart
    rr = session.post(f"{BASE_URL}/api/messages/{message_id}/react",
                      json={"message_id": message_id, "user_id": user_id, "reaction": "heart"}, timeout=15)
    assert rr.status_code == 200, f"React failed: {rr.status_code} {rr.text}"
    body = rr.json()
    assert body.get("success") is True
    assert "reactions" in body

    # Toggle off
    rr2 = session.post(f"{BASE_URL}/api/messages/{message_id}/react",
                       json={"message_id": message_id, "user_id": user_id, "reaction": "heart"}, timeout=15)
    assert rr2.status_code == 200
    # Reaction from user should be removed
    assert user_id not in rr2.json().get("reactions", {})
