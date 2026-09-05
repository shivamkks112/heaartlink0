"""Iteration 35 — E2E: welcome + new_user_discovery gating via notification_config toggles."""
import asyncio
import os
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

fe = dotenv_values("/app/frontend/.env")
be = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or fe.get("REACT_APP_BACKEND_URL")).rstrip("/")
MONGO_URL = be["MONGO_URL"]
DB_NAME = be["DB_NAME"]

created_emails = []


def _mongo():
    return AsyncIOMotorClient(MONGO_URL)[DB_NAME]


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def seed_verified_otp(email):
    async def _s():
        db = _mongo()
        await db.signup_otps.update_one(
            {"email": email.lower()},
            {"$set": {"email": email.lower(), "verified": True, "otp": "123456"}},
            upsert=True,
        )
    run(_s())


def set_toggle(**kwargs):
    r = requests.put(f"{BASE_URL}/api/admin/notification-config", json=kwargs, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def signup(email, gender="female"):
    payload = {
        "email": email, "password": "TestUser@2026", "name": "TEST Notif User",
        "age": 25, "gender": gender, "looking_for": "male" if gender == "female" else "female",
        "location": "Delhi, India", "bio": "TEST account for notif gating",
    }
    return requests.post(f"{BASE_URL}/api/auth/signup", json=payload, timeout=60)


def notif_logs(email_user_id, ntype=None):
    async def _q():
        db = _mongo()
        q = {"user_id": email_user_id}
        if ntype:
            q["type"] = ntype
        return await db.notification_log.find(q, {"_id": 0}).to_list(None)
    return run(_q())


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    async def _c():
        db = _mongo()
        for em in created_emails:
            u = await db.users.find_one({"email": em.lower()}, {"_id": 0, "id": 1})
            if u:
                await db.notification_log.delete_many({"user_id": u["id"]})
                await db.notifications.delete_many({"user_id": u["id"]})
                await db.app_settings.delete_many({"type": "new_user_notif_log", "new_user_id": u["id"]})
                await db.users.delete_many({"id": u["id"]})
            await db.signup_otps.delete_many({"email": em.lower()})
    run(_c())
    set_toggle(welcome_enabled=True, new_user_discovery_enabled=True,
               max_notifications_per_user_per_day=3)


# --- welcome_enabled = True → welcome notification logged ---
def test_welcome_enabled_logs_notification():
    set_toggle(welcome_enabled=True, new_user_discovery_enabled=True)
    email = f"test_notif_on_{uuid.uuid4().hex[:8]}@heartlinktest.com"
    created_emails.append(email)
    seed_verified_otp(email)
    r = signup(email, gender="female")
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text[:300]}"
    uid = r.json().get("user", {}).get("id") or r.json().get("user_id")
    assert uid, f"no user id in signup response: {r.text[:300]}"
    logs = notif_logs(uid, "welcome")
    assert len(logs) == 1, f"expected 1 welcome notification_log entry, got {logs}"


# --- welcome_enabled = False → no welcome notification logged ---
def test_welcome_disabled_skips_notification():
    set_toggle(welcome_enabled=False)
    email = f"test_notif_off_{uuid.uuid4().hex[:8]}@heartlinktest.com"
    created_emails.append(email)
    seed_verified_otp(email)
    r = signup(email, gender="female")
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text[:300]}"
    uid = r.json().get("user", {}).get("id") or r.json().get("user_id")
    logs = notif_logs(uid, "welcome")
    assert len(logs) == 0, f"welcome notification sent despite toggle OFF: {logs}"
    set_toggle(welcome_enabled=True)


# --- new_user_discovery_enabled = True → discovery log created (background task, 5s delay) ---
def test_new_user_discovery_enabled_logs():
    set_toggle(new_user_discovery_enabled=True, welcome_enabled=True)
    email = f"test_disc_on_{uuid.uuid4().hex[:8]}@heartlinktest.com"
    created_emails.append(email)
    seed_verified_otp(email)
    r = signup(email, gender="female")
    assert r.status_code in (200, 201), r.text[:300]
    uid = r.json().get("user", {}).get("id") or r.json().get("user_id")
    logs = []
    for _ in range(12):
        time.sleep(2)
        logs = notif_logs(uid, "new_user_discovery")
        if logs:
            break
    assert len(logs) >= 1, "new_user_discovery notification_log entry not created within 24s"


# --- new_user_discovery_enabled = False → no discovery log ---
def test_new_user_discovery_disabled_skips():
    set_toggle(new_user_discovery_enabled=False)
    email = f"test_disc_off_{uuid.uuid4().hex[:8]}@heartlinktest.com"
    created_emails.append(email)
    seed_verified_otp(email)
    r = signup(email, gender="female")
    assert r.status_code in (200, 201), r.text[:300]
    uid = r.json().get("user", {}).get("id") or r.json().get("user_id")
    time.sleep(15)
    logs = notif_logs(uid, "new_user_discovery")
    assert len(logs) == 0, f"discovery notification sent despite toggle OFF: {logs}"
    set_toggle(new_user_discovery_enabled=True)


# --- analytics reflects logged notifications ---
def test_analytics_chart_reflects_logs():
    r = requests.get(f"{BASE_URL}/api/admin/notification-analytics-chart?days=7", timeout=30)
    assert r.status_code == 200
    chart = r.json()["chart"]
    today = chart[-1]
    assert today["total"] >= 1, f"today's chart total should include test notifications: {today}"
    cfg = requests.get(f"{BASE_URL}/api/admin/notification-config", timeout=30).json()
    assert cfg["recent_24h"] >= 1, f"recent_24h should reflect logs: {cfg['recent_24h']}"
    assert "welcome" in cfg["type_breakdown_24h"], cfg["type_breakdown_24h"]
