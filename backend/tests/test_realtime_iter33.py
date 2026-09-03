"""
Iteration 33 — Realtime messaging / presence / conversations tests
Covers:
  - POST /api/auth/login (email_or_phone)
  - GET  /api/conversations/{user_id}   (new endpoint)
  - GET  /api/active-users/{user_id}    (presence + gender prefs)
  - POST /api/messages                 (HTTP send -> conversations reflect immediately)
  - WS   /api/ws/{user_id}              (connect, ping, presence)
"""
import os
import json
import time
import asyncio
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base.rstrip("/")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

USER_A = {"email_or_phone": "shivamkks112@gmail.com", "password": "Shivam@2026"}
USER_B = {"email_or_phone": "review@heartlink.co.in", "password": "HeartLink@2026"}
UID_A = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
UID_B = "cca39b3f-9f7e-485d-9ae3-d6b210d424fb"
MATCH_ID = "5f5b1722-cc69-4e4c-bde5-f41e21ed0747"

created_message_ids = []


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup(client):
    yield
    for mid in created_message_ids:
        try:
            client.delete(f"{BASE_URL}/api/messages/{mid}?user_id={UID_A}&delete_for_all=true", timeout=30)
        except Exception:
            pass


# ── Auth ──
class TestAuth:
    def test_login_user_a(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login", json=USER_A, timeout=60)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("user", {}).get("id") == UID_A
        assert data["user"]["gender"].lower() == "male"

    def test_login_user_b(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login", json=USER_B, timeout=60)
        assert r.status_code == 200, r.text[:400]
        assert r.json().get("user", {}).get("id") == UID_B

    def test_login_wrong_password(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login",
                        json={"email_or_phone": USER_A["email_or_phone"], "password": "WrongPass@1"}, timeout=60)
        assert r.status_code in (400, 401), r.status_code


# ── Conversations endpoint ──
class TestConversations:
    def test_conversations_shape(self, client):
        r = client.get(f"{BASE_URL}/api/conversations/{UID_A}", timeout=60)
        assert r.status_code == 200, r.text[:400]
        convos = r.json()
        assert isinstance(convos, list)
        assert len(convos) > 0, "expected at least one conversation for user A"
        for c in convos:
            assert "match_id" in c and "user" in c and "lastMessage" in c and "unreadCount" in c
            assert isinstance(c["unreadCount"], int)
            assert c["lastMessage"] is not None
            assert "content" in c["lastMessage"] or "message_type" in c["lastMessage"]
            assert "_id" not in c["lastMessage"], "mongo _id leaked in lastMessage"
            assert "_id" not in c["user"]
            assert isinstance(c["user"]["is_online"], bool)

    def test_conversations_sorted_desc(self, client):
        r = client.get(f"{BASE_URL}/api/conversations/{UID_A}", timeout=60)
        ts = [c["lastMessage"].get("created_at", "") for c in r.json()]
        assert ts == sorted(ts, reverse=True), f"not sorted newest first: {ts[:5]}"

    def test_conversations_unknown_user(self, client):
        r = client.get(f"{BASE_URL}/api/conversations/does-not-exist-123", timeout=60)
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert r.json() == []

    def test_target_match_present(self, client):
        r = client.get(f"{BASE_URL}/api/conversations/{UID_A}", timeout=60)
        ids = [c["match_id"] for c in r.json()]
        assert MATCH_ID in ids, f"seeded match missing from conversations: {ids[:5]}"


# ── Send message via HTTP and verify conversations reflects it ──
class TestSendMessage:
    def test_send_and_reflect(self, client):
        content = f"TEST_iter33_{int(time.time())}"
        r = client.post(f"{BASE_URL}/api/messages", json={
            "match_id": MATCH_ID,
            "sender_id": UID_A,
            "receiver_id": UID_B,
            "content": content,
            "message_type": "text",
        }, timeout=60)
        assert r.status_code == 200, r.text[:500]
        msg = r.json()
        assert msg["content"] == content
        assert msg["sender_id"] == UID_A
        assert "_id" not in msg
        created_message_ids.append(msg["id"])

        # conversations for sender
        ca = client.get(f"{BASE_URL}/api/conversations/{UID_A}", timeout=60).json()
        conv_a = next(c for c in ca if c["match_id"] == MATCH_ID)
        assert conv_a["lastMessage"]["content"] == content
        assert ca[0]["match_id"] == MATCH_ID, "newest conversation should be first"

        # conversations for receiver -> unread count > 0
        cb = client.get(f"{BASE_URL}/api/conversations/{UID_B}", timeout=60).json()
        conv_b = next(c for c in cb if c["match_id"] == MATCH_ID)
        assert conv_b["lastMessage"]["content"] == content
        assert conv_b["unreadCount"] >= 1, f"expected unread>=1 got {conv_b['unreadCount']}"

    def test_messages_list_contains_message(self, client):
        r = client.get(f"{BASE_URL}/api/messages/{MATCH_ID}?user_id={UID_A}", timeout=60)
        assert r.status_code == 200, r.text[:300]
        msgs = r.json()
        assert isinstance(msgs, list) and len(msgs) > 0
        assert all("_id" not in m for m in msgs)
        if created_message_ids:
            assert created_message_ids[-1] in [m["id"] for m in msgs]


# ── Active users / presence ──
class TestActiveUsers:
    def test_active_users_for_a(self, client):
        # ensure B recently active
        client.post(f"{BASE_URL}/api/auth/login", json=USER_B, timeout=60)
        r = client.get(f"{BASE_URL}/api/active-users/{UID_A}", timeout=60)
        assert r.status_code == 200, r.text[:400]
        users = r.json()
        assert isinstance(users, list)
        assert len(users) > 0, "Active users list empty (Active (0) bug)"
        ids = [u["id"] for u in users]
        assert UID_B in ids, f"HeartLink Reviewer not in active users: {[u['name'] for u in users]}"
        for u in users:
            assert "_id" not in u
            assert isinstance(u["is_online"], bool)
        assert UID_A not in ids, "self should be excluded"

    def test_active_users_gender_preference(self, client):
        r = client.get(f"{BASE_URL}/api/active-users/{UID_A}", timeout=60)
        prof = client.get(f"{BASE_URL}/api/profile/{UID_A}", timeout=60)
        assert prof.status_code == 200, prof.text[:200]
        looking_for = prof.json().get("looking_for", "female").lower()
        for u in r.json():
            up = client.get(f"{BASE_URL}/api/profile/{u['id']}", timeout=60)
            if up.status_code == 200:
                g = (up.json().get("gender") or "").lower()
                assert g == looking_for, f"{u['name']} gender={g} violates looking_for={looking_for}"

    def test_active_users_unknown_user_404(self, client):
        r = client.get(f"{BASE_URL}/api/active-users/nope-123", timeout=60)
        assert r.status_code == 404


# ── WebSocket ──
class TestWebSocket:
    def test_ws_connect_ping_and_realtime_delivery(self):
        import websockets

        async def run():
            uri = f"{WS_URL}/api/ws/{UID_B}"
            async with websockets.connect(uri, open_timeout=30) as ws:
                # initial badge_update
                first = json.loads(await asyncio.wait_for(ws.recv(), timeout=20))
                assert first.get("type") in ("badge_update", "status_update"), first
                # ping should not kill connection
                await ws.send(json.dumps({"type": "ping"}))
                await asyncio.sleep(1)

                # B should now be online in active-users from A's perspective
                r = requests.get(f"{BASE_URL}/api/active-users/{UID_A}", timeout=60)
                b = next((u for u in r.json() if u["id"] == UID_B), None)
                assert b is not None, "WS-connected user missing from active-users"
                assert b["is_online"] is True

                # Send message from A via HTTP -> expect new_message over B's socket
                content = f"TEST_iter33_ws_{int(time.time())}"
                pr = requests.post(f"{BASE_URL}/api/messages", json={
                    "match_id": MATCH_ID, "sender_id": UID_A, "receiver_id": UID_B,
                    "content": content, "message_type": "text",
                }, timeout=60)
                assert pr.status_code == 200, pr.text[:300]
                created_message_ids.append(pr.json()["id"])

                got = None
                deadline = time.time() + 25
                while time.time() < deadline:
                    try:
                        evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                    except asyncio.TimeoutError:
                        break
                    # Backend emits {"type": "message", "message": {...}}
                    if evt.get("type") == "message" and evt.get("message", {}).get("content") == content:
                        got = evt
                        break
                assert got is not None, "message event not pushed over WebSocket in time"
                assert got["message"]["match_id"] == MATCH_ID
                assert "_id" not in got["message"]

                # delivered flag set because receiver is WS-connected
                await asyncio.sleep(1)
                msgs = requests.get(f"{BASE_URL}/api/messages/{MATCH_ID}?user_id={UID_A}", timeout=60).json()
                sent = next((m for m in msgs if m["content"] == content), None)
                assert sent is not None
                assert sent.get("delivered") is True, "message not marked delivered for WS-connected receiver"

        asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())
