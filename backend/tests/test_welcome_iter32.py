"""Welcome Message System tests (iteration 32).

Covers: GET /api/welcome-check/{user_id}, POST /api/welcome-shown/{user_id},
POST /api/welcome-clicked/{user_id}, GET+PUT /api/admin/welcome-settings
Plus regression: login, discover, matches
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")

ADMIN_EMAIL = "shivamkks112@gmail.com"
ADMIN_PASSWORD = "Shivam@2026"


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def original_settings(api):
    r = api.get(f"{API}/admin/welcome-settings")
    assert r.status_code == 200, r.text
    return r.json()["settings"]


@pytest.fixture(scope="module", autouse=True)
def restore_settings(api, original_settings):
    yield
    api.put(f"{API}/admin/welcome-settings", json=original_settings)


def _mk_user(mongo, name, **extra):
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "name": name,
        "email": f"TEST_{uid[:8]}@example.test",
        "age": 25,
        "gender": "male",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_test_data": True,
    }
    doc.update(extra)
    mongo.users.insert_one(doc)
    return uid


@pytest.fixture(scope="module")
def users(mongo):
    """Seed three test users: new, inactive-8-days, active-now."""
    now = datetime.now(timezone.utc)
    ids = {
        "new": _mk_user(mongo, "TEST Newbie Kumar", last_active=now.isoformat()),
        "inactive": _mk_user(
            mongo, "TEST Shuba Sharma",
            welcome_shown_at=(now - timedelta(days=30)).isoformat(),
            last_active=(now - timedelta(days=8)).isoformat(),
        ),
        "active": _mk_user(
            mongo, "TEST Active Singh",
            welcome_shown_at=(now - timedelta(days=30)).isoformat(),
            last_active=(now - timedelta(hours=2)).isoformat(),
        ),
    }
    yield ids
    mongo.users.delete_many({"id": {"$in": list(ids.values())}})


class TestWelcomeCheck:
    def test_1_new_user_shows_new_user_welcome(self, api, users, original_settings):
        r = api.get(f"{API}/welcome-check/{users['new']}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["show"] is True
        assert d["type"] == "new_user"
        assert d["title"] == original_settings["new_user_title"]
        assert d["message"] == original_settings["new_user_message"]
        assert d["cta"] == original_settings["new_user_cta"]

    def test_2_mark_shown_then_no_welcome(self, api, users, mongo):
        uid = users["new"]
        r = api.post(f"{API}/welcome-shown/{uid}", json={"type": "new_user"})
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ok"
        # persisted
        doc = mongo.users.find_one({"id": uid}, {"_id": 0, "welcome_shown_at": 1})
        assert doc.get("welcome_shown_at")
        # subsequent check
        r2 = api.get(f"{API}/welcome-check/{uid}")
        assert r2.status_code == 200
        assert r2.json()["show"] is False

    def test_3_inactive_user_shows_welcome_back(self, api, users):
        r = api.get(f"{API}/welcome-check/{users['inactive']}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["show"] is True, f"expected welcome_back, got {d}"
        assert d["type"] == "welcome_back"
        assert "TEST" in d["title"], f"firstName not interpolated: {d['title']}"
        assert "{firstName}" not in d["title"]
        assert d["message"]

    def test_3b_welcome_back_shown_suppresses_repeat(self, api, users, mongo):
        uid = users["inactive"]
        r = api.post(f"{API}/welcome-shown/{uid}", json={"type": "welcome_back"})
        assert r.status_code == 200
        assert mongo.users.find_one({"id": uid}).get("welcome_back_shown_at")
        assert api.get(f"{API}/welcome-check/{uid}").json()["show"] is False

    def test_4_active_user_no_welcome(self, api, users):
        d = api.get(f"{API}/welcome-check/{users['active']}").json()
        assert d["show"] is False, f"active user should not see welcome: {d}"

    def test_4b_unknown_user_no_welcome(self, api):
        r = api.get(f"{API}/welcome-check/{uuid.uuid4()}")
        assert r.status_code == 200
        assert r.json()["show"] is False

    def test_clicked_tracking(self, api, users):
        r = api.post(f"{API}/welcome-clicked/{users['active']}", json={"type": "new_user"})
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


class TestAdminWelcomeSettings:
    def test_5_disable_new_user_welcome(self, api, mongo, original_settings):
        uid = _mk_user(mongo, "TEST Disabled Flow")
        try:
            assert api.get(f"{API}/welcome-check/{uid}").json()["show"] is True
            r = api.put(f"{API}/admin/welcome-settings", json={"new_user_enabled": False})
            assert r.status_code == 200, r.text
            assert r.json()["new_user_enabled"] is False
            d = api.get(f"{API}/welcome-check/{uid}").json()
            assert d["show"] is False, f"welcome shown despite disabled: {d}"
        finally:
            api.put(f"{API}/admin/welcome-settings", json={"new_user_enabled": True})
            mongo.users.delete_one({"id": uid})

    def test_6_edit_message_text_reflected(self, api, mongo):
        uid = _mk_user(mongo, "TEST Edited Msg")
        new_title = "TEST_Custom Hello {firstName}"
        new_msg = "TEST_Custom body copy."
        new_cta = "TEST_Go"
        try:
            r = api.put(f"{API}/admin/welcome-settings", json={
                "new_user_title": new_title,
                "new_user_message": new_msg,
                "new_user_cta": new_cta,
            })
            assert r.status_code == 200, r.text
            d = api.get(f"{API}/welcome-check/{uid}").json()
            assert d["show"] is True
            assert d["title"] == "TEST_Custom Hello TEST"
            assert d["message"] == new_msg
            assert d["cta"] == new_cta
            # GET admin returns persisted values
            s = api.get(f"{API}/admin/welcome-settings").json()["settings"]
            assert s["new_user_title"] == new_title
        finally:
            mongo.users.delete_one({"id": uid})

    def test_6b_invalid_payload_rejected(self, api):
        r = api.put(f"{API}/admin/welcome-settings", json={"bogus_key": 1})
        assert r.status_code == 400, r.text

    def test_7_analytics_counters(self, api):
        r = api.get(f"{API}/admin/welcome-settings")
        assert r.status_code == 200
        body = r.json()
        assert "settings" in body and "analytics" in body
        a = body["analytics"]
        before = a.get("new_user_welcome_clicked", 0)
        api.post(f"{API}/welcome-clicked/{uuid.uuid4()}", json={"type": "new_user"})
        after = api.get(f"{API}/admin/welcome-settings").json()["analytics"]
        assert after.get("new_user_welcome_clicked", 0) == before + 1
        for k in ("new_user_welcome_shown", "welcome_back_shown"):
            assert k in after, f"missing analytics counter {k}: {after}"
        assert "_id" not in str(body)

    def test_admin_settings_requires_no_auth_security_note(self, api):
        """Documents that admin welcome-settings endpoints are unauthenticated."""
        fresh = requests.Session()
        r = fresh.get(f"{API}/admin/welcome-settings")
        assert r.status_code == 200
        pytest.skip("SECURITY: /api/admin/welcome-settings accessible without auth (reported)")


class TestRegression:
    def test_login(self, api):
        r = api.post(f"{API}/auth/login", json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("user", {}).get("id") or d.get("id")

    def test_discover(self, api):
        uid = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
        r = api.get(f"{API}/discover/{uid}")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), (list, dict))

    def test_matches(self, api):
        uid = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
        r = api.get(f"{API}/matches/{uid}")
        assert r.status_code == 200, r.text
