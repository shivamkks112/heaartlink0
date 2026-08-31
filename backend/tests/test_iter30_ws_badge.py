"""WebSocket badge_update verification: connect as admin, receive badge_update after new message and after mark-read."""
import asyncio
import json
import os
import pytest
import requests
import websockets
from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
ADMIN_ID = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
REVIEW_ID = "cca39b3f-9f7e-485d-9ae3-d6b210d424fb"


async def collect(ws, seconds=8):
    events = []
    try:
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=seconds)
            try:
                events.append(json.loads(msg))
            except Exception:
                pass
    except asyncio.TimeoutError:
        pass
    return events


async def _badge_flow():
    matches = requests.get(f"{BASE_URL}/api/matches/{ADMIN_ID}", timeout=30).json()
    if not matches:
        pytest.skip("no matches; run seed_iter30.py")
    match_id = matches[0]["match_id"]

    async with websockets.connect(f"{WS_URL}/api/ws/{ADMIN_ID}", open_timeout=20) as ws:
        await collect(ws, 2)  # drain initial
        # Review sends a message to admin -> admin should get badge_update with unread>0
        r = requests.post(f"{BASE_URL}/api/messages", json={
            "match_id": match_id, "sender_id": REVIEW_ID, "receiver_id": ADMIN_ID,
            "content": "TEST_ws badge message"
        }, timeout=60)
        assert r.status_code == 200, r.text[:300]
        events = await collect(ws, 6)
        badges = [e for e in events if e.get("type") == "badge_update"]
        assert badges, f"no badge_update after new message; got types {[e.get('type') for e in events]}"
        assert badges[-1]["unread_messages"] >= 1, badges[-1]

        # Admin marks read -> badge_update with unread_messages == 0
        r2 = requests.post(f"{BASE_URL}/api/messages/{match_id}/mark-read/{ADMIN_ID}", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["marked_read"] >= 1, r2.json()
        events2 = await collect(ws, 6)
        badges2 = [e for e in events2 if e.get("type") == "badge_update"]
        assert badges2, f"no badge_update after mark-read; got {[e.get('type') for e in events2]}"
        # unread count for this conversation must be cleared (global count may include other chats)
        assert badges2[-1]["unread_messages"] < badges[-1]["unread_messages"], (badges[-1], badges2[-1])
        conv_unread = requests.get(
            f"{BASE_URL}/api/messages/{match_id}/unread-count/{ADMIN_ID}", timeout=30).json()["count"]
        assert conv_unread == 0, conv_unread


def test_badge_update_on_new_message_and_mark_read():
    asyncio.run(_badge_flow())
