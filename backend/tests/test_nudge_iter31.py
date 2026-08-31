"""Backend tests supporting the Smart Nudge feature (iteration 31).

Modules covered:
- Auth login (email_or_phone)
- GET /api/matches/{user_id}
- GET /api/messages/{match_id} (asc/desc order, created_at timezone format)
- GET /api/messages/{match_id}/unread-count/{user_id}
"""
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

ADMIN_ID = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
NUDGE_MATCH = "5f5b1722-cc69-4e4c-bde5-f41e21ed0747"


@pytest.fixture(scope="session")
def creds():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("no credentials file")
    c = p.read_text()
    email = re.search(r"Email:\s*(\S+)", c).group(1)
    password = re.search(r"Password:\s*(\S+)", c).group(1)
    return {"email_or_phone": email, "password": password}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def logged_in(client, creds):
    r = client.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    data = r.json()
    assert "user" in data or "id" in data, data
    user = data.get("user", data)
    assert user["id"] == ADMIN_ID, f"unexpected admin id {user['id']}"
    token = data.get("token") or data.get("access_token")
    if token:
        client.headers.update({"Authorization": f"Bearer {token}"})
    return user


# --- matches ---
def test_matches_list_contains_nudge_match(client, logged_in):
    r = client.get(f"{BASE_URL}/api/matches/{ADMIN_ID}", timeout=30)
    assert r.status_code == 200, r.text[:300]
    matches = r.json()
    assert isinstance(matches, list) and len(matches) > 0
    ids = [m["match_id"] for m in matches]
    assert NUDGE_MATCH in ids, f"seeded match missing, got {ids}"
    m = next(x for x in matches if x["match_id"] == NUDGE_MATCH)
    assert "user" in m and m["user"].get("id")


# --- messages ordering / timestamps ---
def test_messages_last_is_seeded_nudge_message(client, logged_in):
    r = client.get(f"{BASE_URL}/api/messages/{NUDGE_MATCH}", params={"user_id": ADMIN_ID}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    payload = r.json()
    msgs = payload["messages"] if isinstance(payload, dict) else payload
    assert len(msgs) > 0
    last = msgs[-1]
    assert last["sender_id"] == ADMIN_ID, "last message must be from current user for nudge"
    assert last["content"].startswith("TEST_NUDGE_LAST_MSG"), last["content"]


def test_message_created_at_is_tz_aware_iso(client, logged_in):
    r = client.get(f"{BASE_URL}/api/messages/{NUDGE_MATCH}", params={"user_id": ADMIN_ID, "order": "desc", "limit": 1}, timeout=30)
    assert r.status_code == 200
    payload = r.json()
    msgs = payload["messages"] if isinstance(payload, dict) else payload
    ts = msgs[0]["created_at"]
    assert isinstance(ts, str)
    parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None, f"created_at not timezone-aware: {ts} (JS Date() would parse as local time)"
    hours = (datetime.now(timezone.utc) - parsed).total_seconds() / 3600
    assert hours >= 24, f"seeded message only {hours:.1f}h old; nudge would not trigger"


def test_unread_count_zero_for_admin(client, logged_in):
    r = client.get(f"{BASE_URL}/api/messages/{NUDGE_MATCH}/unread-count/{ADMIN_ID}", timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    count = data.get("unread_count", data.get("count"))
    assert count == 0, f"unread_count={count}; nudge indicator on MatchesPage requires 0"
