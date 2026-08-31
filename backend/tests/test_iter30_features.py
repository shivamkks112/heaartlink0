"""Iteration 30: login flow, mark-read endpoint + badge_update websocket, conversations API."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

ADMIN = {"email_or_phone": "shivamkks112@gmail.com", "password": "Shivam@2026"}
REVIEW = {"email_or_phone": "review@heartlink.co.in", "password": "HeartLink@2026"}
ADMIN_ID = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
REVIEW_ID = "cca39b3f-9f7e-485d-9ae3-d6b210d424fb"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def login(client, creds):
    r = client.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    return r


# --- Auth / login flow ---
class TestLogin:
    def test_admin_login(self, client):
        r = login(client, ADMIN)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert "user" in data or "id" in data, data
        user = data.get("user", data)
        assert user.get("id") == ADMIN_ID
        # photo gate check
        photos = user.get("photos") or []
        assert len(photos) > 0 or user.get("profile_photo"), "admin has no profile photo -> mandatory photo gate"

    def test_review_login(self, client):
        r = login(client, REVIEW)
        assert r.status_code == 200, r.text[:400]
        user = r.json().get("user", r.json())
        assert user.get("id") == REVIEW_ID
        photos = user.get("photos") or []
        assert len(photos) > 0 or user.get("profile_photo"), "review has no profile photo -> mandatory photo gate"

    def test_login_wrong_password(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login",
                        json={"email_or_phone": ADMIN["email_or_phone"], "password": "WrongPass@1"}, timeout=30)
        assert r.status_code in (400, 401), r.status_code


# --- Conversations / mark-read ---
class TestMessagesMarkRead:
    def test_matches_list(self, client):
        r = client.get(f"{BASE_URL}/api/matches/{ADMIN_ID}", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        for conv in data:
            assert "_id" not in conv
            assert "match_id" in conv

    def test_last_message_and_unread_count(self, client):
        matches = client.get(f"{BASE_URL}/api/matches/{ADMIN_ID}", timeout=30).json()
        if not matches:
            pytest.skip("no matches for admin user")
        match_id = matches[0]["match_id"]
        r1 = client.get(f"{BASE_URL}/api/messages/{match_id}/last", timeout=30)
        assert r1.status_code == 200, r1.text[:300]
        r2 = client.get(f"{BASE_URL}/api/messages/{match_id}/unread-count/{ADMIN_ID}", timeout=30)
        assert r2.status_code == 200, r2.text[:300]
        assert isinstance(r2.json().get("count"), int)

    def test_mark_read_returns_marked_read(self, client):
        matches = client.get(f"{BASE_URL}/api/matches/{ADMIN_ID}", timeout=30).json()
        if not matches:
            pytest.skip("no matches for admin user")
        match_id = matches[0]["match_id"]
        r = client.post(f"{BASE_URL}/api/messages/{match_id}/mark-read/{ADMIN_ID}", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "marked_read" in data
        assert isinstance(data["marked_read"], int)

    def test_mark_read_unknown_match(self, client):
        r = client.post(f"{BASE_URL}/api/messages/nonexistent-match-id/mark-read/{ADMIN_ID}", timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["marked_read"] == 0

    def test_badge_counts_endpoint(self, client):
        r = client.get(f"{BASE_URL}/api/notifications/counts/{ADMIN_ID}", timeout=30)
        if r.status_code == 404:
            pytest.skip("no badge counts endpoint")
        assert r.status_code == 200, r.text[:300]


# --- send_badge_update presence / correctness (source level) ---
class TestBadgeUpdateFunction:
    def test_send_badge_update_exists(self):
        import sys
        sys.path.insert(0, "/app/backend")
        src = open("/app/backend/server.py").read()
        assert "async def send_badge_update" in src
        assert '"type": "badge_update"' in src

    def test_mark_read_triggers_badge_update(self):
        src = open("/app/backend/server.py").read()
        idx = src.index('@api_router.post("/messages/{match_id}/mark-read/{user_id}")')
        block = src[idx:idx + 1800]
        assert "send_badge_update" in block, "mark-read endpoint does not trigger badge update"
