"""
Iter40: Read receipts (delivered / read ticks via WebSocket) + photo thumbnails (&w=) + v-hash consistency.
Uses admin(shivamkks112) <-> review@heartlink match for real-user tests, admin <-> Sara Mehta (AI) for AI tests.
All test messages are prefixed TEST_RR_ and cleaned up at module teardown.
"""
import os
import re
import json
import time
import asyncio
import hashlib
from datetime import datetime, timezone

import pytest
import requests
import websockets
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

ADMIN_ID = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
REVIEW_ID = "cca39b3f-9f7e-485d-9ae3-d6b210d424fb"
REAL_MATCH = "5f5b1722-cc69-4e4c-bde5-f41e21ed0747"
AI_ID = "795ea396-fb74-4351-b7ac-9fe69edbf20f"
AI_MATCH = "1b98d381-b615-4ad0-b3fa-461cd7bdb4bc"
B64_USER = "4fc1d920-f8c7-4192-82d6-adfb77b5670c"
START = datetime.now(timezone.utc).isoformat()


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


async def _get_msg(content):
    return await _db().messages.find_one({"content": content}, {"_id": 0})


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    async def _c():
        db = _db()
        r1 = await db.messages.delete_many({"content": {"$regex": "^TEST_RR_"}})
        r2 = await db.messages.delete_many({"match_id": AI_MATCH, "$or": [{"timestamp": {"$gte": START}}, {"created_at": {"$gte": START}}]})
        print(f"cleanup removed {r1.deleted_count}+{r2.deleted_count} messages")
    asyncio.run(_c())


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": "shivamkks112@gmail.com", "password": "Shivam@2026"}, timeout=30)
    assert r.status_code == 200, r.text[:200]
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        sess.headers["Authorization"] = f"Bearer {tok}"
    return sess


async def _collect(ws, pred, timeout):
    """Read events until pred(event) true or timeout. Returns (event|None, all_events)."""
    seen = []
    end = time.time() + timeout
    while time.time() < end:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=max(0.1, end - time.time()))
        except asyncio.TimeoutError:
            break
        ev = json.loads(raw)
        seen.append(ev)
        if pred(ev):
            return ev, seen
    return None, seen


# ---- Read receipts: receiver online ----
def test_delivered_and_read_receiver_online():
    content = f"TEST_RR_online_{int(time.time()*1000)}"

    async def run():
        async with websockets.connect(f"{WS_BASE}/api/ws/{ADMIN_ID}") as a, \
                websockets.connect(f"{WS_BASE}/api/ws/{REVIEW_ID}") as b:
            await asyncio.sleep(1.0)
            r = requests.post(f"{BASE_URL}/api/messages", json={
                "match_id": REAL_MATCH, "sender_id": ADMIN_ID, "receiver_id": REVIEW_ID, "content": content}, timeout=30)
            assert r.status_code == 200, r.text[:300]
            mid = r.json()["id"]
            ev, seen = await _collect(a, lambda e: e.get("type") == "message_delivered" and e.get("message_id") == mid, 8)
            assert ev, f"no message_delivered; got types {[e.get('type') for e in seen]}"
            assert ev["match_id"] == REAL_MATCH
            m = await _get_msg(content)
            assert m["delivered"] is True and m.get("read") in (False, None)
            # B marks read
            r = requests.post(f"{BASE_URL}/api/messages/{REAL_MATCH}/mark-read/{REVIEW_ID}", timeout=30)
            assert r.status_code == 200 and r.json()["marked_read"] >= 1
            ev, seen = await _collect(a, lambda e: e.get("type") == "messages_read" and e.get("match_id") == REAL_MATCH, 8)
            assert ev, f"no messages_read; got {[e.get('type') for e in seen]}"
            assert ev["read_by"] == REVIEW_ID
            m = await _get_msg(content)
            assert m["read"] is True and m["delivered"] is True
    asyncio.run(run())


# ---- Read receipts: via WS send path ----
def test_ws_send_path_delivered():
    content = f"TEST_RR_wssend_{int(time.time()*1000)}"

    async def run():
        async with websockets.connect(f"{WS_BASE}/api/ws/{ADMIN_ID}") as a, \
                websockets.connect(f"{WS_BASE}/api/ws/{REVIEW_ID}") as b:
            await asyncio.sleep(1.0)
            await a.send(json.dumps({"match_id": REAL_MATCH, "receiver_id": REVIEW_ID, "content": content}))
            ev, seen = await _collect(a, lambda e: e.get("type") == "message_delivered", 15)
            types = [e.get("type") for e in seen]
            assert ev, f"no message_delivered via WS send; got {types}"
            m = await _get_msg(content)
            assert m and m["delivered"] is True and ev["message_id"] == m["id"]
            # B should have received the message
            evb, _ = await _collect(b, lambda e: e.get("type") == "message" and e["message"]["content"] == content, 3)
            assert evb, "receiver did not get message event"
    asyncio.run(run())


# ---- Read receipts: receiver offline then comes online ----
def test_offline_then_online_delivers_pending():
    content = f"TEST_RR_offline_{int(time.time()*1000)}"

    async def run():
        async with websockets.connect(f"{WS_BASE}/api/ws/{ADMIN_ID}") as a:
            await asyncio.sleep(0.8)
            r = requests.post(f"{BASE_URL}/api/messages", json={
                "match_id": REAL_MATCH, "sender_id": ADMIN_ID, "receiver_id": REVIEW_ID, "content": content}, timeout=30)
            assert r.status_code == 200, r.text[:300]
            ev, _ = await _collect(a, lambda e: e.get("type") == "message_delivered" and e.get("match_id") == REAL_MATCH, 3)
            assert ev is None, f"got delivered while receiver offline: {ev}"
            m = await _get_msg(content)
            assert m.get("delivered") is not True, "delivered should be false while offline"
            async with websockets.connect(f"{WS_BASE}/api/ws/{REVIEW_ID}") as b:
                ev, seen = await _collect(a, lambda e: e.get("type") == "message_delivered" and e.get("all") is True, 8)
                assert ev, f"no all:true delivered; got {[e.get('type') for e in seen]}"
                assert ev["match_id"] == REAL_MATCH
                m = await _get_msg(content)
                assert m["delivered"] is True
    asyncio.run(run())


# ---- Read receipts: AI receiver ----
def test_ai_receiver_delivered_and_read():
    content = f"TEST_RR_ai_hello {int(time.time())}"

    async def run():
        async with websockets.connect(f"{WS_BASE}/api/ws/{ADMIN_ID}") as a:
            await asyncio.sleep(0.8)
            t0 = time.time()
            await a.send(json.dumps({"match_id": AI_MATCH, "receiver_id": AI_ID, "content": content}))
            ev, seen = await _collect(a, lambda e: e.get("type") == "message_delivered", 6)
            assert ev, f"AI: no delivered; {[e.get('type') for e in seen]}"
            ev, seen2 = await _collect(a, lambda e: e.get("type") == "messages_read" and e.get("match_id") == AI_MATCH, 10)
            dt = time.time() - t0
            print(f"AI read after {dt:.2f}s")
            assert ev, f"AI: no messages_read; {[e.get('type') for e in seen2]}"
            assert dt < 8
            m = await _get_msg(content)
            assert m["read"] is True and m["delivered"] is True
    asyncio.run(run())


# ---- Photo URLs: &w and no base64 ----
@pytest.mark.parametrize("path", ["likes/{uid}", "matches/{uid}", "conversations/{uid}"])
def test_list_endpoints_no_base64_and_widths(s, path):
    r = s.get(f"{BASE_URL}/api/" + path.format(uid=ADMIN_ID), timeout=60)
    assert r.status_code == 200, r.text[:200]
    t = r.text
    assert "data:image" not in t
    pps = re.findall(r'"profile_picture":\s*"([^"]*?/api/photo/[^"]+)"', t)
    for u in pps:
        assert "&w=400" in u, u
    photos = re.findall(r'/api/photo/[^/"]+/\d+\?v=[^"]+', t)
    for u in photos:
        assert "&w=720" in u, u


def test_chat_info_no_base64(s):
    r = s.get(f"{BASE_URL}/api/chat/{AI_MATCH}/info", params={"user_id": ADMIN_ID}, timeout=30)
    assert r.status_code in (200, 422), r.text[:200]
    if r.status_code == 200:
        assert "data:image" not in r.text


def test_thumbnail_small():
    big = requests.get(f"{BASE_URL}/api/photo/{B64_USER}/p", timeout=60)
    small = requests.get(f"{BASE_URL}/api/photo/{B64_USER}/p?w=400&v=x", timeout=60)
    assert big.status_code == 200 and small.status_code == 200
    assert small.headers["content-type"].startswith("image/jpeg")
    print(f"orig={len(big.content)} thumb={len(small.content)}")
    assert len(small.content) < 60_000 and len(small.content) < len(big.content) / 5


@pytest.fixture
def seeded_like():
    """Temporary like from base64-photo user -> admin so /api/likes has a B64 marker profile."""
    mid = "TEST_RR_like_seed"
    async def ins():
        await _db().matches.insert_one({"id": mid, "user1_id": B64_USER, "user2_id": ADMIN_ID, "user1_liked": True,
                                        "user2_liked": False, "matched": False, "created_at": datetime.now(timezone.utc).isoformat()})
    asyncio.run(ins())
    yield
    async def rm():
        await _db().matches.delete_many({"id": mid})
    asyncio.run(rm())


def test_v_hash_consistency(s, seeded_like):
    """v from /api/likes (Mongo marker path) must equal Python-computed hash from full DB value."""
    r = s.get(f"{BASE_URL}/api/likes/{ADMIN_ID}", timeout=60)
    assert r.status_code == 200
    urls = re.findall(r'/api/photo/([^/"]+)/p\?v=([a-f0-9]+)', r.text)
    assert urls, "no profile photo urls in likes"

    async def check():
        db = _db()
        bad = []
        for uid, v in urls[:15]:
            u = await db.users.find_one({"id": uid}, {"_id": 0, "profile_picture": 1})
            val = (u or {}).get("profile_picture") or ""
            if not val.startswith("data:"):
                continue
            exp = hashlib.md5(f"{len(val)}{val[-16:]}".encode()).hexdigest()[:10]
            if exp != v:
                bad.append((uid, v, exp))
        return bad
    bad = asyncio.run(check())
    assert not bad, f"hash mismatch: {bad}"
    # Cross endpoint consistency where users overlap
    m = s.get(f"{BASE_URL}/api/conversations/{ADMIN_ID}", timeout=60).text + s.get(f"{BASE_URL}/api/matches/{ADMIN_ID}", timeout=60).text
    other = dict(re.findall(r'/api/photo/([^/"]+)/p\?v=([a-f0-9]+)', m))
    likes_map = dict(urls)
    for uid in set(other) & set(likes_map):
        assert other[uid] == likes_map[uid], uid


def test_discover_endpoint_ok(s):
    r = s.get(f"{BASE_URL}/api/discover/{ADMIN_ID}", timeout=60)
    assert r.status_code == 200, r.text[:200]
    assert isinstance(r.json(), (list, dict))
