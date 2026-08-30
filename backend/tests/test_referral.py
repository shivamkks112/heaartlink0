"""Referral System backend tests - HeartLink

Covers:
- GET /api/referral/{user_id}/code
- GET /api/referral/validate/{code}
- POST /api/referral/apply
- POST /api/referral/complete/{new_user_id}
- GET /api/referral/{user_id}/stats
"""
import os
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

REFERRER_EMAIL = "referraltest@heartlink.com"
REFERRER_PASSWORD = "Test@123"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _signup(client, tag):
    email = f"TEST_ref_{tag}_{uuid.uuid4().hex[:8]}@qatestmail.com"
    payload = {
        "email": email,
        "password": "Test@123",
        "name": f"TESTUser{tag}",
        "age": 26,
        "gender": "male",
        "looking_for": "female",
        "bio": "TEST user for referral tests",
        "location": "Mumbai",
        "interests": ["music"],
    }
    r = client.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200, f"signup failed {r.status_code} {r.text[:300]}"
    data = r.json()
    assert "user_id" in data
    return data["user_id"], email


@pytest.fixture(scope="session")
def created_user_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup(created_user_ids):
    yield
    try:
        from pymongo import MongoClient
        backend_env = dotenv_values("/app/backend/.env")
        mongo_url = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")
        if mongo_url and db_name:
            mc = MongoClient(mongo_url)
            db = mc[db_name]
            for uid in created_user_ids:
                db.users.delete_one({"id": uid})
                db.referrals.delete_many({"referred_id": uid})
                db.referrals.delete_many({"referrer_id": uid})
            mc.close()
    except Exception as e:  # pragma: no cover
        print(f"cleanup skipped: {e}")


@pytest.fixture(scope="session")
def referrer(client, created_user_ids):
    """Main referrer: use provided credentials, else create one."""
    r = client.post(f"{API}/auth/login", json={
        "email_or_phone": REFERRER_EMAIL, "password": REFERRER_PASSWORD})
    if r.status_code == 200:
        user = r.json()["user"]
        return {"id": user["id"], "email": REFERRER_EMAIL, "seeded": True}
    pytest.fail(f"Login failed for provided referral test user: {r.status_code} {r.text[:300]}")


# ---------- GET /referral/{user_id}/code ----------
class TestReferralCode:
    def test_get_code_for_seeded_user(self, client, referrer):
        r = client.get(f"{API}/referral/{referrer['id']}/code")
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert isinstance(d.get("referral_code"), str) and len(d["referral_code"]) >= 5
        assert d["referral_code"] in d["share_link"]
        assert d["referral_code"] in d["share_text"]
        assert "_id" not in d
        referrer["code"] = d["referral_code"]

    def test_code_is_idempotent(self, client, referrer):
        a = client.get(f"{API}/referral/{referrer['id']}/code").json()["referral_code"]
        b = client.get(f"{API}/referral/{referrer['id']}/code").json()["referral_code"]
        assert a == b, "referral code changed between calls"

    def test_code_created_for_new_user_and_persists(self, client, created_user_ids):
        uid, _ = _signup(client, "codegen")
        created_user_ids.append(uid)
        r = client.get(f"{API}/referral/{uid}/code")
        assert r.status_code == 200, r.text[:300]
        code = r.json()["referral_code"]
        assert len(code) == 7, f"expected 3 alpha + 4 random = 7 chars, got {code}"
        # persisted -> validate endpoint should resolve it
        v = client.get(f"{API}/referral/validate/{code}")
        assert v.status_code == 200
        assert v.json()["valid"] is True

    def test_code_invalid_user_404(self, client):
        r = client.get(f"{API}/referral/{uuid.uuid4()}/code")
        assert r.status_code == 404


# ---------- GET /referral/validate/{code} ----------
class TestValidateCode:
    def test_validate_valid_code(self, client, referrer):
        code = client.get(f"{API}/referral/{referrer['id']}/code").json()["referral_code"]
        r = client.get(f"{API}/referral/validate/{code}")
        assert r.status_code == 200
        d = r.json()
        assert d["valid"] is True
        assert isinstance(d["referrer_name"], str) and d["referrer_name"]
        assert d["bonus"] == "3 FREE Super Likes"
        assert "_id" not in d

    def test_validate_case_insensitive(self, client, referrer):
        code = client.get(f"{API}/referral/{referrer['id']}/code").json()["referral_code"]
        r = client.get(f"{API}/referral/validate/{code.lower()}")
        assert r.status_code == 200
        assert r.json()["valid"] is True

    def test_validate_invalid_code(self, client):
        r = client.get(f"{API}/referral/validate/NOPE999")
        assert r.status_code == 200
        assert r.json()["valid"] is False
        assert "message" in r.json()


# ---------- POST /referral/apply ----------
class TestApplyReferral:
    def test_apply_gives_bonus_and_persists(self, client, referrer, created_user_ids):
        code = client.get(f"{API}/referral/{referrer['id']}/code").json()["referral_code"]
        before = client.get(f"{API}/referral/{referrer['id']}/stats").json()["total_referrals"]

        uid, _ = _signup(client, "apply")
        created_user_ids.append(uid)

        r = client.post(f"{API}/referral/apply", json={"referral_code": code, "new_user_id": uid})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["success"] is True
        assert d["bonus"]["super_likes"] == 3
        assert "Super Likes" in d["message"]

        # referrer total_referrals incremented and referred user listed
        stats = client.get(f"{API}/referral/{referrer['id']}/stats").json()
        assert stats["total_referrals"] == before + 1
        names = [u["name"] for u in stats["referred_users"]]
        assert any(n.startswith("TESTUserapply") for n in names)
        pending = [u for u in stats["referred_users"] if u["name"].startswith("TESTUserapply")]
        assert pending[0]["status"] == "pending"

        # new user got 3 super likes persisted
        prof = client.get(f"{API}/profile/{uid}")
        if prof.status_code == 200:
            assert prof.json().get("super_likes", 0) >= 3, "welcome bonus not persisted"

    def test_apply_twice_rejected(self, client, referrer, created_user_ids):
        code = client.get(f"{API}/referral/{referrer['id']}/code").json()["referral_code"]
        uid, _ = _signup(client, "twice")
        created_user_ids.append(uid)
        r1 = client.post(f"{API}/referral/apply", json={"referral_code": code, "new_user_id": uid})
        assert r1.status_code == 200
        r2 = client.post(f"{API}/referral/apply", json={"referral_code": code, "new_user_id": uid})
        assert r2.status_code == 400, f"expected 400, got {r2.status_code} {r2.text[:200]}"
        assert "already" in r2.json()["detail"].lower()

    def test_apply_own_code_rejected(self, client, created_user_ids):
        uid, _ = _signup(client, "selfref")
        created_user_ids.append(uid)
        code = client.get(f"{API}/referral/{uid}/code").json()["referral_code"]
        r = client.post(f"{API}/referral/apply", json={"referral_code": code, "new_user_id": uid})
        assert r.status_code == 400, f"self-referral must be rejected, got {r.status_code}"

    def test_apply_invalid_code_404(self, client, created_user_ids):
        uid, _ = _signup(client, "badcode")
        created_user_ids.append(uid)
        r = client.post(f"{API}/referral/apply", json={"referral_code": "ZZZ0000", "new_user_id": uid})
        assert r.status_code == 404

    def test_apply_invalid_user_404(self, client, referrer):
        code = client.get(f"{API}/referral/{referrer['id']}/code").json()["referral_code"]
        r = client.post(f"{API}/referral/apply", json={"referral_code": code, "new_user_id": str(uuid.uuid4())})
        assert r.status_code == 404

    def test_apply_missing_fields_422(self, client):
        r = client.post(f"{API}/referral/apply", json={"referral_code": "ABC1234"})
        assert r.status_code == 422


# ---------- POST /referral/complete + milestone rewards ----------
class TestCompleteAndRewards:
    def test_complete_marks_successful_and_rewards_milestone(self, client, created_user_ids):
        # fresh referrer so milestone 1 is unclaimed
        ref_id, _ = _signup(client, "milestone")
        created_user_ids.append(ref_id)
        code = client.get(f"{API}/referral/{ref_id}/code").json()["referral_code"]

        new_id, _ = _signup(client, "joiner")
        created_user_ids.append(new_id)
        assert client.post(f"{API}/referral/apply", json={
            "referral_code": code, "new_user_id": new_id}).status_code == 200

        r = client.post(f"{API}/referral/complete/{new_id}")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["success"] is True
        time.sleep(1)

        stats = client.get(f"{API}/referral/{ref_id}/stats").json()
        assert stats["successful_referrals"] == 1
        assert 1 in stats["rewards_claimed"], f"milestone 1 not claimed: {stats['rewards_claimed']}"
        assert stats["next_milestone"] == 3
        assert stats["referrals_until_next"] == 2
        assert any(u["status"] == "successful" for u in stats["referred_users"])

        prof = client.get(f"{API}/profile/{ref_id}")
        if prof.status_code == 200:
            assert prof.json().get("super_likes", 0) >= 5, "milestone reward super likes missing"

    def test_complete_idempotent_no_double_reward(self, client, created_user_ids):
        ref_id, _ = _signup(client, "idem")
        created_user_ids.append(ref_id)
        code = client.get(f"{API}/referral/{ref_id}/code").json()["referral_code"]
        new_id, _ = _signup(client, "idemjoiner")
        created_user_ids.append(new_id)
        client.post(f"{API}/referral/apply", json={"referral_code": code, "new_user_id": new_id})
        client.post(f"{API}/referral/complete/{new_id}")
        r2 = client.post(f"{API}/referral/complete/{new_id}")
        assert r2.status_code == 200
        stats = client.get(f"{API}/referral/{ref_id}/stats").json()
        assert stats["successful_referrals"] == 1, "double counted successful referral"
        assert stats["rewards_claimed"].count(1) == 1, "milestone rewarded twice"

    def test_complete_no_pending_referral(self, client, created_user_ids):
        uid, _ = _signup(client, "nopending")
        created_user_ids.append(uid)
        r = client.post(f"{API}/referral/complete/{uid}")
        assert r.status_code == 200
        assert "No pending referral" in r.json()["message"]


# ---------- GET /referral/{user_id}/stats ----------
class TestStats:
    def test_stats_structure_new_user(self, client, created_user_ids):
        uid, _ = _signup(client, "stats")
        created_user_ids.append(uid)
        r = client.get(f"{API}/referral/{uid}/stats")
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for key in ["referral_code", "total_referrals", "successful_referrals",
                    "rewards_claimed", "referred_users", "next_milestone",
                    "next_reward", "referrals_until_next", "all_rewards"]:
            assert key in d, f"missing {key}"
        assert d["total_referrals"] == 0
        assert d["successful_referrals"] == 0
        assert d["referred_users"] == []
        assert d["next_milestone"] == 1
        assert d["next_reward"] == "5 Super Likes"
        assert set(d["all_rewards"].keys()) == {"1", "3", "5", "10"}
        assert "_id" not in d

    def test_stats_invalid_user_404(self, client):
        r = client.get(f"{API}/referral/{uuid.uuid4()}/stats")
        assert r.status_code == 404
