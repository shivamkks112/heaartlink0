"""
Iteration 34 tests:
- Module: Admin Feature Flags (crush_feature)
- Module: Crush endpoint feature gate
- Module: Chat sync (conversations, matches, active users)
"""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

USER_A = {"email_or_phone": "shivamkks112@gmail.com", "password": "Shivam@2026"}
USER_B = {"email_or_phone": "review@heartlink.co.in", "password": "HeartLink@2026"}
UID_A = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
UID_B = "cca39b3f-9f7e-485d-9ae3-d6b210d424fb"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def login_a(client):
    r = client.post(f"{API}/auth/login", json=USER_A, timeout=45)
    if r.status_code != 200:
        pytest.fail(f"Login A failed {r.status_code}: {r.text[:300]}")
    return r.json()


@pytest.fixture(scope="session")
def login_b(client):
    r = client.post(f"{API}/auth/login", json=USER_B, timeout=45)
    if r.status_code != 200:
        pytest.fail(f"Login B failed {r.status_code}: {r.text[:300]}")
    return r.json()


# ---------- Auth ----------
class TestAuth:
    def test_login_a(self, login_a):
        assert login_a.get("user", {}).get("id") == UID_A

    def test_login_b(self, login_b):
        assert login_b.get("user", {}).get("id") == UID_B

    def test_login_bad_password(self, client):
        r = client.post(f"{API}/auth/login", json={"email_or_phone": USER_A["email_or_phone"], "password": "wrong"}, timeout=45)
        assert r.status_code in (400, 401), r.text[:200]


# ---------- Feature Flags ----------
class TestFeatureFlags:
    def test_get_flags_includes_crush(self, client):
        r = client.get(f"{API}/admin/feature-flags", timeout=45)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "crush_feature" in data, f"crush_feature missing: {data}"
        assert isinstance(data["crush_feature"], bool)
        assert "_id" not in data and "type" not in data

    def test_toggle_crush_on_and_persist(self, client):
        r = client.put(f"{API}/admin/feature-flags", json={"crush_feature": True}, timeout=45)
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("crush_feature") is True
        g = client.get(f"{API}/admin/feature-flags", timeout=45)
        assert g.json().get("crush_feature") is True

    def test_toggle_crush_off_and_persist(self, client):
        r = client.put(f"{API}/admin/feature-flags", json={"crush_feature": False}, timeout=45)
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("crush_feature") is False
        g = client.get(f"{API}/admin/feature-flags", timeout=45)
        assert g.json().get("crush_feature") is False

    def test_invalid_flag_rejected(self, client):
        r = client.put(f"{API}/admin/feature-flags", json={"bogus_flag": True}, timeout=45)
        assert r.status_code == 400, r.text[:300]

    def test_other_flags_untouched(self, client):
        r = client.get(f"{API}/admin/feature-flags", timeout=45)
        d = r.json()
        for k in ["referral_system", "daily_rewards", "ai_chatbot"]:
            assert k in d, f"{k} missing from flags"


# ---------- Crush Gate ----------
class TestCrushGate:
    def test_crush_blocked_when_off(self, client):
        client.put(f"{API}/admin/feature-flags", json={"crush_feature": False}, timeout=45)
        r = client.post(f"{API}/crush/{UID_A}", params={"target_user_id": UID_B}, timeout=45)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:300]}"
        assert "paused" in r.json().get("detail", "").lower()

    def test_crush_allowed_when_on(self, client):
        client.put(f"{API}/admin/feature-flags", json={"crush_feature": True}, timeout=45)
        r = client.post(f"{API}/crush/{UID_A}", params={"target_user_id": UID_B}, timeout=45)
        # 200 = created, 400 = already marked (both prove gate passed)
        assert r.status_code in (200, 400), f"got {r.status_code}: {r.text[:300]}"
        if r.status_code == 400:
            assert "already" in r.json().get("detail", "").lower()

    def test_crush_self_rejected_when_on(self, client):
        client.put(f"{API}/admin/feature-flags", json={"crush_feature": True}, timeout=45)
        r = client.post(f"{API}/crush/{UID_A}", params={"target_user_id": UID_A}, timeout=45)
        assert r.status_code == 400, r.text[:300]
        assert "yourself" in r.json().get("detail", "").lower()

    def test_restore_flag_off(self, client):
        r = client.put(f"{API}/admin/feature-flags", json={"crush_feature": False}, timeout=45)
        assert r.json().get("crush_feature") is False


# ---------- Chat Sync ----------
class TestChatSync:
    def test_conversations_a(self, client, login_a):
        r = client.get(f"{API}/conversations/{UID_A}", timeout=45)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        for c in data:
            assert "_id" not in c
            assert "match_id" in c or "id" in c

    def test_conversations_b(self, client, login_b):
        r = client.get(f"{API}/conversations/{UID_B}", timeout=45)
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), list)

    def test_matches_a(self, client):
        r = client.get(f"{API}/matches/{UID_A}", timeout=45)
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), list)

    def test_active_users(self, client, login_a, login_b):
        r = client.get(f"{API}/active-users/{UID_A}", timeout=45)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_conversation_unread_and_preview_shape(self, client):
        r = client.get(f"{API}/conversations/{UID_A}", timeout=45)
        data = r.json()
        if not data:
            pytest.skip("No conversations for user A")
        c = data[0]
        assert "unreadCount" in c, f"unreadCount missing: {list(c.keys())}"
        assert "lastMessage" in c, f"preview missing: {list(c.keys())}"
        assert "user" in c and c["user"].get("name")
        assert "is_online" in c["user"], f"online status missing: {list(c['user'].keys())}"
        if c["lastMessage"]:
            assert "content" in c["lastMessage"]
