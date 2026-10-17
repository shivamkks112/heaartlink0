"""
Iter41: Per-persona reply speed + online hours schedule (PUT /api/admin/ai-profiles/{id}/schedule)
and offline-delivery gating (_ack_message) for AI personas outside online hours.
All schedules touched are reset to defaults at teardown; TEST_SCHED_ messages cleaned up.
"""
import os
import json
import time
import asyncio
from datetime import datetime, timezone, timedelta

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
PRIYA = "cb373ffe-3469-49a4-8591-97dc8de4fc42"
SARA = "795ea396-fb74-4351-b7ac-9fe69edbf20f"   # always-online control
SARA_MATCH = "1b98d381-b615-4ad0-b3fa-461cd7bdb4bc"
TEST_AI = "4abeebfc-99e9-4c99-b167-9d31d1003ed9"  # Ananya Patel - used for CRUD
PRIYA_MATCH = "TEST_SCHED_MATCH_PRIYA"
DEFAULTS = {"reply_delay_min": None, "reply_delay_max": None, "online_start": None, "online_end": None}
IST_HOUR = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).hour


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _run(coro):
    return asyncio.run(coro)


def _find(coll, q, proj=None):
    async def f():
        return await getattr(_db(), coll).find_one(q, proj or {"_id": 0})
    return asyncio.run(f())


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": "shivamkks112@gmail.com", "password": "Shivam@2026"}, timeout=30)
    assert r.status_code == 200, r.text[:200]
    sess.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    yield sess
    # teardown: reset schedules + cleanup messages
    for pid in (PRIYA, TEST_AI, SARA):
        sess.put(f"{BASE_URL}/api/admin/ai-profiles/{pid}/schedule", json=DEFAULTS, timeout=30)

    async def _c():
        db = _db()
        r = await db.messages.delete_many({"$or": [{"content": {"$regex": "^TEST_SCHED_"}}, {"match_id": PRIYA_MATCH}]})
        print(f"cleanup removed {r.deleted_count} messages")
    _run(_c())


def put(s, pid, body):
    return s.put(f"{BASE_URL}/api/admin/ai-profiles/{pid}/schedule", json=body, timeout=30)


# ---- Auth / 404 ----
def test_schedule_requires_auth():
    r = requests.put(f"{BASE_URL}/api/admin/ai-profiles/{TEST_AI}/schedule", json=DEFAULTS, timeout=30)
    assert r.status_code in (401, 403), r.status_code
    print("no-token status", r.status_code)


def test_schedule_404_non_ai(s):
    r = put(s, ADMIN_ID, DEFAULTS)
    assert r.status_code == 404
    r = put(s, "nonexistent-id-xyz", DEFAULTS)
    assert r.status_code == 404


# ---- Validation ----
@pytest.mark.parametrize("body", [
    {"reply_delay_min": 2, "reply_delay_max": None},
    {"reply_delay_min": None, "reply_delay_max": 5},
    {"reply_delay_min": 6, "reply_delay_max": 2},
    {"reply_delay_min": 0.05, "reply_delay_max": 2},
    {"reply_delay_min": 1, "reply_delay_max": 181},
    {"reply_delay_min": "abc", "reply_delay_max": 2},
    {"online_start": 9, "online_end": None},
    {"online_start": None, "online_end": 9},
    {"online_start": -1, "online_end": 5},
    {"online_start": 5, "online_end": 24},
])
def test_schedule_validation(s, body):
    r = put(s, TEST_AI, body)
    assert r.status_code == 400, (body, r.status_code, r.text[:200])


# ---- Save + persistence ----
def test_save_custom_and_hours_persist(s):
    start, end = IST_HOUR, (IST_HOUR + 1) % 24  # online now
    r = put(s, TEST_AI, {"reply_delay_min": 1.5, "reply_delay_max": 4, "online_start": start, "online_end": end})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["reply_delay_min"] == 1.5 and d["reply_delay_max"] == 4.0
    assert d["online_hours"] == {"start": start, "end": end}
    assert d["is_online"] is True
    lst = s.get(f"{BASE_URL}/api/admin/ai-profiles", timeout=60).json()
    p = next(x for x in lst if x["id"] == TEST_AI)
    assert p.get("reply_delay_min") == 1.5 and p.get("reply_delay_max") == 4.0
    assert p.get("online_hours") == {"start": start, "end": end}


def test_save_offline_hours_sets_is_online_false(s):
    start, end = (IST_HOUR + 2) % 24, (IST_HOUR + 3) % 24
    r = put(s, TEST_AI, {"reply_delay_min": None, "reply_delay_max": None, "online_start": start, "online_end": end})
    assert r.status_code == 200
    assert r.json()["is_online"] is False
    u = _find("users", {"id": TEST_AI})
    assert u["is_online"] is False


def test_wraparound_hours_online(s):
    # start > end wraps midnight: e.g. (IST_HOUR-1) -> (IST_HOUR-3)  => online now
    start, end = (IST_HOUR - 1) % 24, (IST_HOUR - 3) % 24
    r = put(s, TEST_AI, {"online_start": start, "online_end": end})
    assert r.status_code == 200
    assert r.json()["is_online"] is True


def test_reset_defaults(s):
    r = put(s, TEST_AI, DEFAULTS)
    assert r.status_code == 200
    d = r.json()
    assert d == {"reply_delay_min": None, "reply_delay_max": None, "online_hours": None, "is_online": True}
    u = _find("users", {"id": TEST_AI})
    assert u["is_online"] is True and u["online_hours"] is None


def test_string_numbers_accepted(s):
    # UI custom inputs send strings
    r = put(s, TEST_AI, {"reply_delay_min": "2", "reply_delay_max": "6.5", "online_start": None, "online_end": None})
    assert r.status_code == 200
    assert r.json()["reply_delay_max"] == 6.5
    put(s, TEST_AI, DEFAULTS)


# ---- Delivery gating ----
async def _collect(ws, pred, timeout):
    seen, end = [], time.time() + timeout
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


def _ensure_priya_offline(s):
    start, end = (IST_HOUR + 2) % 24, (IST_HOUR + 3) % 24
    r = put(s, PRIYA, {"reply_delay_min": 0.3, "reply_delay_max": 1, "online_start": start, "online_end": end})
    assert r.status_code == 200 and r.json()["is_online"] is False


def test_offline_persona_rest_not_delivered(s):
    _ensure_priya_offline(s)
    content = f"TEST_SCHED_rest_{int(time.time())}"

    async def go():
        async with websockets.connect(f"{WS_BASE}/api/ws/{ADMIN_ID}", open_timeout=20) as ws:
            await asyncio.sleep(1)
            r = requests.post(f"{BASE_URL}/api/messages", json={"match_id": PRIYA_MATCH, "sender_id": ADMIN_ID,
                              "receiver_id": PRIYA, "content": content}, timeout=30)
            assert r.status_code in (200, 201), r.text[:300]
            ev, seen = await _collect(ws, lambda e: e.get("type") in ("message_delivered", "messages_read")
                                      and e.get("match_id") == PRIYA_MATCH, 10)
            return ev, seen
    ev, seen = _run(go())
    assert ev is None, f"unexpected ack event {ev}"
    m = _find("messages", {"content": content})
    assert m and not m.get("delivered") and not m.get("read"), m


def test_offline_persona_ws_not_delivered(s):
    _ensure_priya_offline(s)
    content = f"TEST_SCHED_ws_{int(time.time())}"

    async def go():
        async with websockets.connect(f"{WS_BASE}/api/ws/{ADMIN_ID}", open_timeout=20) as ws:
            await asyncio.sleep(1)
            await ws.send(json.dumps({"match_id": PRIYA_MATCH, "receiver_id": PRIYA, "content": content}))
            return await _collect(ws, lambda e: e.get("type") in ("message_delivered", "messages_read")
                                  and e.get("match_id") == PRIYA_MATCH, 10)
    ev, seen = _run(go())
    assert ev is None, f"unexpected ack event {ev}"
    m = _find("messages", {"content": content})
    assert m is not None, "WS message not stored"
    assert not m.get("delivered") and not m.get("read"), m


def test_always_online_persona_delivered(s):
    put(s, SARA, DEFAULTS)
    content = f"TEST_SCHED_ctrl_{int(time.time())}"

    async def go():
        async with websockets.connect(f"{WS_BASE}/api/ws/{ADMIN_ID}", open_timeout=20) as ws:
            await asyncio.sleep(1)
            await ws.send(json.dumps({"match_id": SARA_MATCH, "receiver_id": SARA, "content": content}))
            return await _collect(ws, lambda e: e.get("type") == "message_delivered" and e.get("match_id") == SARA_MATCH, 10)
    ev, seen = _run(go())
    assert ev is not None, f"no delivered event; seen={[e.get('type') for e in seen]}"
    m = _find("messages", {"content": content})
    assert m and m.get("delivered") is True
