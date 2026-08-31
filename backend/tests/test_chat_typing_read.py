"""
Backend tests for HeartLink chat: Typing Indicators & Read Receipts.

Covers:
- POST /api/messages/{match_id}/typing
- POST /api/messages/{match_id}/read
- Message schema read/read_at fields (GET /api/messages/{match_id})
- WebSocket /api/ws/{user_id}: typing + mark_read events
"""
import os
import re
import json
import uuid
import asyncio
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

TIMEOUT = 30


# ---------- fixtures ----------

@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing test_credentials.md")
    c = p.read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?\**Email\**\s*:\s*\**\s*`?([^`\s*]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?\**Password\**\s*:\s*\**\s*`?([^`\s*]+)', c)
    if not e or not pw:
        pytest.skip("no creds parsed")
    return {"email": e.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def matched_pair(api):
    """Create two TEST_ users, make them match, return (userA, userB, match_id)."""
    suffix = uuid.uuid4().hex[:8]
    users = []
    for idx in (1, 2):
        payload = {
            "email": f"TEST_chat_{suffix}_{idx}@example.com",
            "password": "Test@1234",
            "name": f"TEST_Chat User{idx}",
            "age": 26,
            "gender": "female",
            "looking_for": "both",
            "location": "Mumbai",
            "bio": "TEST_ account for chat tests",
        }
        r = api.post(f"{BASE_URL}/api/auth/signup", json=payload, timeout=TIMEOUT)
        assert r.status_code in (200, 201), f"signup failed {r.status_code}: {r.text[:300]}"
        u = r.json().get("user") or r.json()
        assert u.get("id")
        users.append(u)

    a, b = users
    # a likes b
    r1 = api.post(f"{BASE_URL}/api/action/{a['id']}",
                  json={"target_user_id": b["id"], "action": "like"}, timeout=TIMEOUT)
    assert r1.status_code == 200, r1.text[:300]
    # b likes a -> match
    r2 = api.post(f"{BASE_URL}/api/action/{b['id']}",
                  json={"target_user_id": a["id"], "action": "like"}, timeout=TIMEOUT)
    assert r2.status_code == 200, r2.text[:300]
    data = r2.json()
    assert data.get("action") == "matched", f"expected match, got {data}"
    match_id = data["match_id"]

    yield {"a": a, "b": b, "match_id": match_id}

    # teardown: delete created users (admin endpoint is public per prior iteration)
    for u in users:
        try:
            api.delete(f"{BASE_URL}/api/admin/user/{u['id']}", timeout=TIMEOUT)
        except Exception:
            pass


def _send(api, pair, sender_key="a", content="TEST_hello"):
    s = pair[sender_key]
    r = pair["b"] if sender_key == "a" else pair["a"]
    resp = api.post(f"{BASE_URL}/api/messages", json={
        "match_id": pair["match_id"],
        "sender_id": s["id"],
        "receiver_id": r["id"],
        "content": content,
    }, timeout=TIMEOUT)
    return resp


# ---------- health / auth sanity ----------

class TestSanity:
    def test_login_existing_user(self, api, test_credentials):
        r = api.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": test_credentials["email"],
            "password": test_credentials["password"],
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["user"]["email"] == test_credentials["email"]
        assert "_id" not in data["user"], "raw MongoDB _id leaked in login response"

    def test_matches_endpoint(self, api, test_credentials):
        login = api.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": test_credentials["email"],
            "password": test_credentials["password"],
        }, timeout=TIMEOUT).json()
        uid = login["user"]["id"]
        r = api.get(f"{BASE_URL}/api/matches/{uid}", timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Message schema ----------

class TestMessageSchema:
    def test_send_message_and_schema_fields(self, api, matched_pair):
        resp = _send(api, matched_pair, "a", "TEST_schema_msg")
        assert resp.status_code == 200, resp.text[:400]
        msg = resp.json()
        for field in ("id", "match_id", "sender_id", "receiver_id", "content", "read", "created_at"):
            assert field in msg, f"missing {field} in send response: {msg}"
        assert msg["read"] is False

        # GET messages -> read_at present and None
        g = api.get(f"{BASE_URL}/api/messages/{matched_pair['match_id']}", timeout=TIMEOUT)
        assert g.status_code == 200
        msgs = g.json()
        assert len(msgs) >= 1
        target = [m for m in msgs if m["content"] == "TEST_schema_msg"]
        assert target, "sent message not persisted"
        m = target[0]
        assert "read_at" in m, "read_at field missing from Message schema response"
        assert m["read_at"] is None
        assert m["read"] is False
        assert "_id" not in m


# ---------- Read receipts ----------

class TestReadReceipts:
    def test_mark_read_marks_only_receiver_messages(self, api, matched_pair):
        pair = matched_pair
        _send(api, pair, "a", "TEST_read_1")
        _send(api, pair, "a", "TEST_read_2")
        _send(api, pair, "b", "TEST_read_from_b")

        # b reads messages sent to b (from a)
        r = api.post(f"{BASE_URL}/api/messages/{pair['match_id']}/read",
                     params={"reader_id": pair["b"]["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert "count" in body and isinstance(body["count"], int)
        assert body["count"] >= 2, f"expected >=2 marked, got {body}"

        msgs = api.get(f"{BASE_URL}/api/messages/{pair['match_id']}", timeout=TIMEOUT).json()
        for m in msgs:
            if m["receiver_id"] == pair["b"]["id"]:
                assert m["read"] is True, f"message to reader not marked read: {m}"
                assert m["read_at"], "read_at not persisted"
            else:
                # a's inbox (message from b) must remain unread
                assert m["read"] is False, f"wrong message marked read: {m}"
                assert m["read_at"] is None

    def test_mark_read_idempotent(self, api, matched_pair):
        pair = matched_pair
        api.post(f"{BASE_URL}/api/messages/{pair['match_id']}/read",
                 params={"reader_id": pair["b"]["id"]}, timeout=TIMEOUT)
        r = api.post(f"{BASE_URL}/api/messages/{pair['match_id']}/read",
                     params={"reader_id": pair["b"]["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["count"] == 0

    def test_mark_read_missing_reader_id_returns_422(self, api, matched_pair):
        r = api.post(f"{BASE_URL}/api/messages/{matched_pair['match_id']}/read", timeout=TIMEOUT)
        assert r.status_code == 422, f"expected 422 for missing reader_id, got {r.status_code}"

    def test_mark_read_unknown_match(self, api):
        r = api.post(f"{BASE_URL}/api/messages/{uuid.uuid4()}/read",
                     params={"reader_id": str(uuid.uuid4())}, timeout=TIMEOUT)
        # documents current behaviour: 200 with count 0 (no match validation)
        assert r.status_code == 200
        assert r.json()["count"] == 0


# ---------- Typing indicator ----------

class TestTypingIndicator:
    def test_typing_default_true(self, api, matched_pair):
        pair = matched_pair
        r = api.post(f"{BASE_URL}/api/messages/{pair['match_id']}/typing",
                     params={"user_id": pair["a"]["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        assert r.json() == {"message": "Typing status sent"}

    def test_typing_false(self, api, matched_pair):
        pair = matched_pair
        r = api.post(f"{BASE_URL}/api/messages/{pair['match_id']}/typing",
                     params={"user_id": pair["a"]["id"], "is_typing": "false"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]

    def test_typing_from_other_participant(self, api, matched_pair):
        pair = matched_pair
        r = api.post(f"{BASE_URL}/api/messages/{pair['match_id']}/typing",
                     params={"user_id": pair["b"]["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_typing_unknown_match_404(self, api, matched_pair):
        r = api.post(f"{BASE_URL}/api/messages/{uuid.uuid4()}/typing",
                     params={"user_id": matched_pair["a"]["id"]}, timeout=TIMEOUT)
        assert r.status_code == 404
        assert "not found" in r.json().get("detail", "").lower()

    def test_typing_missing_user_id_returns_422(self, api, matched_pair):
        r = api.post(f"{BASE_URL}/api/messages/{matched_pair['match_id']}/typing", timeout=TIMEOUT)
        assert r.status_code == 422, f"expected 422, got {r.status_code}"

    def test_typing_non_participant_is_rejected(self, api, matched_pair):
        """A user who is not part of the match should not be able to push typing
        events into that conversation (currently falls through to user1_id)."""
        outsider = str(uuid.uuid4())
        r = api.post(f"{BASE_URL}/api/messages/{matched_pair['match_id']}/typing",
                     params={"user_id": outsider}, timeout=TIMEOUT)
        assert r.status_code in (403, 404), (
            f"non-participant typing accepted with {r.status_code}; "
            "endpoint does not validate match membership and notifies user1_id"
        )


# ---------- WebSocket ----------

@pytest.mark.asyncio
class TestWebSocket:
    async def test_ws_typing_event_delivered(self, matched_pair):
        websockets = pytest.importorskip("websockets")
        pair = matched_pair
        url_a = f"{WS_BASE}/api/ws/{pair['a']['id']}"
        url_b = f"{WS_BASE}/api/ws/{pair['b']['id']}"
        async with websockets.connect(url_a) as wa, websockets.connect(url_b) as wb:
            await asyncio.sleep(1)
            await wa.send(json.dumps({
                "type": "typing",
                "match_id": pair["match_id"],
                "receiver_id": pair["b"]["id"],
                "is_typing": True,
            }))
            payload = None
            try:
                for _ in range(5):
                    raw = await asyncio.wait_for(wb.recv(), timeout=8)
                    data = json.loads(raw)
                    if data.get("type") == "typing":
                        payload = data
                        break
            except asyncio.TimeoutError:
                pass
            assert payload, "typing event not received over WebSocket"
            assert payload["user_id"] == pair["a"]["id"]
            assert payload["match_id"] == pair["match_id"]
            assert payload["is_typing"] is True

    async def test_ws_message_then_mark_read_notifies_sender(self, api, matched_pair):
        websockets = pytest.importorskip("websockets")
        pair = matched_pair
        content = f"TEST_ws_{uuid.uuid4().hex[:6]}"
        url_a = f"{WS_BASE}/api/ws/{pair['a']['id']}"
        url_b = f"{WS_BASE}/api/ws/{pair['b']['id']}"
        async with websockets.connect(url_a) as wa, websockets.connect(url_b) as wb:
            await asyncio.sleep(1)
            # a sends a message over WS
            await wa.send(json.dumps({
                "match_id": pair["match_id"],
                "receiver_id": pair["b"]["id"],
                "content": content,
            }))
            got_msg = None
            try:
                for _ in range(5):
                    data = json.loads(await asyncio.wait_for(wb.recv(), timeout=8))
                    if data.get("type") == "message" and data["message"]["content"] == content:
                        got_msg = data
                        break
            except asyncio.TimeoutError:
                pass
            assert got_msg, "message not delivered over WebSocket"
            assert got_msg["message"]["read"] is False
            assert got_msg["message"].get("read_at") is None

            # b marks read over WS -> a must get messages_read
            await wb.send(json.dumps({"type": "mark_read", "match_id": pair["match_id"]}))
            read_evt = None
            try:
                for _ in range(6):
                    data = json.loads(await asyncio.wait_for(wa.recv(), timeout=8))
                    if data.get("type") == "messages_read":
                        read_evt = data
                        break
            except asyncio.TimeoutError:
                pass
            assert read_evt, "messages_read event not received by sender"
            assert read_evt["match_id"] == pair["match_id"]
            assert read_evt["read_by"] == pair["b"]["id"]
            assert read_evt["read_at"]

        # verify persistence
        msgs = api.get(f"{BASE_URL}/api/messages/{pair['match_id']}", timeout=TIMEOUT).json()
        m = [x for x in msgs if x["content"] == content][0]
        assert m["read"] is True and m["read_at"], f"read state not persisted: {m}"
