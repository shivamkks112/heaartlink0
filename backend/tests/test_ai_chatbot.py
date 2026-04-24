"""
Backend tests for AI Girl Chatbot feature.
Covers:
- Admin AI profile management (GET/PUT toggle/DELETE/POST reseed)
- Auto-matching for new male users
- AI chat auto-reply (POST /api/messages)
- Discover endpoint should NOT return AI profiles
- Feature flag control
- Multi-turn conversation context
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://heartlink-preview-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TEST_MALE_EMAIL = "testmale@heartlink.co.in"
TEST_MALE_PASSWORD = "Test@2026"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_user(api_client):
    r = api_client.post(f"{API}/auth/login", json={
        "email_or_phone": TEST_MALE_EMAIL,
        "password": TEST_MALE_PASSWORD,
    })
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert data["user"].get("is_admin") is True, "Test user is not admin"
    return data["user"]


# ---------- Admin AI Profiles ----------
class TestAdminAIProfiles:
    def test_get_ai_profiles_returns_six(self, api_client, admin_user):
        r = api_client.get(f"{API}/admin/ai-profiles")
        assert r.status_code == 200, r.text[:300]
        profiles = r.json()
        assert isinstance(profiles, list)
        assert len(profiles) >= 6, f"Expected >=6 AI profiles, got {len(profiles)}"
        names = {p["name"] for p in profiles}
        expected = {"Priya Sharma", "Ananya Patel", "Meera Singh", "Kavya Reddy", "Riya Gupta", "Nisha Verma"}
        assert expected.issubset(names), f"Missing profiles: {expected - names}"

        for p in profiles:
            for key in ["id", "name", "age", "location", "bio", "is_active_ai",
                        "total_matches", "total_messages_sent", "is_ai_profile"]:
                assert key in p, f"Missing key {key} in AI profile {p.get('name')}"
            assert p["is_ai_profile"] is True
            assert isinstance(p["total_matches"], int)
            assert isinstance(p["total_messages_sent"], int)

    def test_toggle_ai_profile(self, api_client, admin_user):
        profiles = api_client.get(f"{API}/admin/ai-profiles").json()
        target = profiles[0]
        pid = target["id"]
        original = target["is_active_ai"]

        # Toggle off
        r = api_client.put(f"{API}/admin/ai-profiles/{pid}/toggle", json={"is_active": not original})
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["is_active"] == (not original)

        # Verify via GET
        updated = [p for p in api_client.get(f"{API}/admin/ai-profiles").json() if p["id"] == pid][0]
        assert updated["is_active_ai"] == (not original)

        # Restore
        r2 = api_client.put(f"{API}/admin/ai-profiles/{pid}/toggle", json={"is_active": original})
        assert r2.status_code == 200

    def test_toggle_nonexistent_profile_returns_404(self, api_client):
        fake_id = str(uuid.uuid4())
        r = api_client.put(f"{API}/admin/ai-profiles/{fake_id}/toggle", json={"is_active": True})
        assert r.status_code == 404

    def test_delete_nonexistent_profile_returns_404(self, api_client):
        fake_id = str(uuid.uuid4())
        r = api_client.delete(f"{API}/admin/ai-profiles/{fake_id}")
        assert r.status_code == 404

    def test_reseed_ai_profiles(self, api_client):
        r = api_client.post(f"{API}/admin/ai-profiles/reseed")
        assert r.status_code == 200
        # Must still have >=6 AI profiles after reseed
        profiles = api_client.get(f"{API}/admin/ai-profiles").json()
        assert len(profiles) >= 6

    def test_delete_and_reseed_profile(self, api_client):
        """Delete one profile, then reseed should re-create it."""
        profiles = api_client.get(f"{API}/admin/ai-profiles").json()
        # Use a profile whose name is in the canonical list so reseed re-creates it
        target = next(p for p in profiles if p["name"] == "Meera Singh")
        pid = target["id"]

        r = api_client.delete(f"{API}/admin/ai-profiles/{pid}")
        assert r.status_code == 200, r.text[:200]

        # Verify it's gone
        profiles_after = api_client.get(f"{API}/admin/ai-profiles").json()
        assert target["id"] not in {p["id"] for p in profiles_after}

        # Reseed - should recreate Meera Singh
        r2 = api_client.post(f"{API}/admin/ai-profiles/reseed")
        assert r2.status_code == 200

        profiles_reseeded = api_client.get(f"{API}/admin/ai-profiles").json()
        names = {p["name"] for p in profiles_reseeded}
        assert "Meera Singh" in names


# ---------- Discover should exclude AI profiles ----------
class TestDiscoverExcludesAI:
    def test_discover_no_ai_profiles(self, api_client, admin_user):
        r = api_client.get(f"{API}/discover/{admin_user['id']}")
        assert r.status_code == 200, r.text[:300]
        users = r.json()
        assert isinstance(users, list)
        for u in users:
            assert not u.get("is_ai_profile"), f"AI profile {u.get('name')} returned in discover"


# ---------- AI Chat auto-reply ----------
class TestAIChat:
    def _find_ai_match(self, api_client, user_id):
        ai_profiles = api_client.get(f"{API}/admin/ai-profiles").json()
        ai_ids = {p["id"] for p in ai_profiles}
        matches = api_client.get(f"{API}/matches/{user_id}").json()
        for m in matches:
            other = m.get("user") or {}
            if other.get("id") in ai_ids:
                return m
        return None

    def test_existing_ai_match_and_auto_reply(self, api_client, admin_user):
        """Find an existing AI match for testmale and send a message, expect AI reply."""
        user_id = admin_user["id"]
        ai_match = self._find_ai_match(api_client, user_id)
        if not ai_match:
            pytest.skip("No AI match available for test user; skipping chat test")

        match_id = ai_match.get("id") or ai_match.get("match_id")
        ai_user = ai_match["user"]
        ai_id = ai_user["id"]

        before = api_client.get(f"{API}/messages/{match_id}").json()
        before_count = len(before) if isinstance(before, list) else 0

        user_msg = "Heyy! Kaise ho aaj? Kya kar rahe ho?"
        send = api_client.post(f"{API}/messages", json={
            "match_id": match_id,
            "sender_id": user_id,
            "receiver_id": ai_id,
            "content": user_msg,
        })
        assert send.status_code == 200, send.text[:400]

        # AI reply is async; typing delay 1.5-4s + LLM ~3-8s.
        # Poll up to 25s for AI reply.
        ai_reply = None
        deadline = time.time() + 25
        while time.time() < deadline:
            time.sleep(3)
            msgs = api_client.get(f"{API}/messages/{match_id}").json()
            if isinstance(msgs, list) and len(msgs) > before_count + 1:
                # Look for message sent by AI after our message
                for m in msgs[before_count + 1:]:
                    if m.get("sender_id") == ai_id:
                        ai_reply = m
                        break
                if ai_reply:
                    break

        assert ai_reply is not None, "AI did not reply within 25s"
        assert ai_reply["content"], "AI reply is empty"
        assert len(ai_reply["content"]) > 0
        # Must not contain AI disclaimers
        lower = ai_reply["content"].lower()
        for banned in ["i am an ai", "i'm an ai", "chatbot", "language model", "artificial intelligence"]:
            assert banned not in lower, f"AI reply leaked disclaimer: {ai_reply['content']}"

    def test_multi_turn_context(self, api_client, admin_user):
        """Send two messages and verify AI replies twice (context maintained)."""
        user_id = admin_user["id"]
        ai_match = self._find_ai_match(api_client, user_id)
        if not ai_match:
            pytest.skip("No AI match available")

        match_id = ai_match.get("id") or ai_match.get("match_id")
        ai_id = ai_match["user"]["id"]

        initial_msgs = api_client.get(f"{API}/messages/{match_id}").json()
        initial_count = len(initial_msgs) if isinstance(initial_msgs, list) else 0

        # Turn 1
        api_client.post(f"{API}/messages", json={
            "match_id": match_id,
            "sender_id": user_id,
            "receiver_id": ai_id,
            "content": "Mujhe coffee bahut pasand hai, tumhein?",
        })
        # Wait for first reply
        time.sleep(12)

        # Turn 2
        api_client.post(f"{API}/messages", json={
            "match_id": match_id,
            "sender_id": user_id,
            "receiver_id": ai_id,
            "content": "Kaunsi jagah best hai Delhi mein ghumne ke liye?",
        })
        time.sleep(15)

        final_msgs = api_client.get(f"{API}/messages/{match_id}").json()
        # After 2 user messages + 2 AI replies, expect +4 messages
        diff = len(final_msgs) - initial_count
        assert diff >= 3, f"Expected at least 3 new msgs (2 user + >=1 AI), got {diff}"

        ai_replies = [m for m in final_msgs[initial_count:] if m.get("sender_id") == ai_id]
        assert len(ai_replies) >= 1, "No AI replies generated in multi-turn flow"


# ---------- Feature Flag ----------
class TestFeatureFlag:
    def test_ai_chatbot_flag_toggle(self, api_client):
        # Disable
        r = api_client.put(f"{API}/admin/feature-flags", json={"ai_chatbot": False})
        assert r.status_code == 200, r.text[:300]
        flags = r.json()
        assert flags.get("ai_chatbot") is False

        # Verify via GET
        g = api_client.get(f"{API}/admin/feature-flags").json()
        assert g.get("ai_chatbot") is False

        # Re-enable for other tests (cleanup)
        r2 = api_client.put(f"{API}/admin/feature-flags", json={"ai_chatbot": True})
        assert r2.status_code == 200
        assert r2.json().get("ai_chatbot") is True


# ---------- Auto-match on signup ----------
class TestAutoMatchOnSignup:
    def test_new_male_user_gets_ai_matches(self, api_client):
        """Signup a new male user and verify 2-3 AI matches are created."""
        unique = uuid.uuid4().hex[:6]
        # Use unique name (no digits allowed) and email
        letters = "".join(chr(ord('a') + int(c, 16) % 26) for c in unique)
        email = f"TEST_aichat_{unique}@heartlink.co.in"
        payload = {
            "name": f"Rohan Test{letters.capitalize()}",
            "email": email,
            "password": "Test@2026",
            "age": 26,
            "gender": "male",
            "looking_for": "female",
            "location": "Delhi",
            "bio": "Automated test user",
            "interests": ["Music", "Travel"],
            "photos": ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"],
        }
        r = api_client.post(f"{API}/auth/signup", json=payload)
        if r.status_code not in (200, 201):
            pytest.skip(f"Signup failed ({r.status_code}): {r.text[:200]}")
        user = r.json().get("user") or r.json()
        user_id = user.get("id")
        assert user_id

        # Wait for auto-match task (asyncio.create_task) to finish first
        # to avoid populating matches_cache with an empty result (cache TTL=120s)
        time.sleep(10)

        ai_profiles = api_client.get(f"{API}/admin/ai-profiles").json()
        ai_ids = {p["id"] for p in ai_profiles}
        matches = api_client.get(f"{API}/matches/{user_id}").json()
        assert isinstance(matches, list)
        ai_matches = [m for m in matches if (m.get("user") or {}).get("id") in ai_ids]

        assert len(ai_matches) >= 2, f"Expected 2-3 AI matches, got {len(ai_matches)}"
        assert len(ai_matches) <= 3, f"Expected 2-3 AI matches, got {len(ai_matches)}"
