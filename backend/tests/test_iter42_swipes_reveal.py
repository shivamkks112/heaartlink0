# Iteration 42: server-side swipe limits, extra_swipes ad rewards caps, rewarded "see who liked you" reveal
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient


def _env(path, key):
    for line in open(path):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _env("/app/frontend/.env", "REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
db = MongoClient(_env("/app/backend/.env", "MONGO_URL"))[_env("/app/backend/.env", "DB_NAME")]

PREFIX = "TEST_ITER42_"


def ist_day():
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d")


def mk_user(gender="Male", premium=False, name=None, **extra):
    uid = PREFIX + str(uuid.uuid4())
    doc = {"id": uid, "email": f"{uid.lower()}@example.com", "name": name or uid[:20], "age": 25,
           "gender": gender, "looking_for": "Female" if gender == "Male" else "Male",
           "is_premium": premium, "photos": [], "profile_picture": None, "location": "Delhi",
           "interests": ["music"], "created_at": datetime.now(timezone.utc).isoformat()}
    doc.update(extra)
    db.users.insert_one(doc)
    return uid


def mk_like(liker, target):
    db.matches.insert_one({"id": str(uuid.uuid4()), "user1_id": liker, "user2_id": target, "user1_liked": True,
                           "matched": False, "created_at": datetime.now(timezone.utc).isoformat()})


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    ids = [u["id"] for u in db.users.find({"id": {"$regex": f"^{PREFIX}"}}, {"id": 1})]
    db.matches.delete_many({"$or": [{"user1_id": {"$in": ids}}, {"user2_id": {"$in": ids}}]})
    db.ad_rewards.delete_many({"user_id": {"$in": ids}})
    db.users.delete_many({"id": {"$in": ids}})


s = requests.Session()


def act(uid, target, action="pass"):
    return s.post(f"{API}/action/{uid}", json={"target_user_id": target, "action": action}, timeout=30)


# --- swipe status ---
class TestSwipeStatus:
    def test_fresh_user(self):
        uid = mk_user()
        r = s.get(f"{API}/swipes/{uid}")
        assert r.status_code == 200
        assert r.json() == {"limit": 50, "used": 0, "extra": 0, "remaining": 50}

    def test_old_day_resets(self):
        uid = mk_user(swipe_day="2020-01-01", swipe_count=50, extra_swipes=3)
        d = s.get(f"{API}/swipes/{uid}").json()
        assert d["used"] == 0 and d["extra"] == 3 and d["remaining"] == 53
        t = mk_user(gender="Female")
        assert act(uid, t).status_code == 200
        u = db.users.find_one({"id": uid})
        assert u["swipe_day"] == ist_day() and u["swipe_count"] == 1 and u["extra_swipes"] == 3


# --- swipe consumption in /action ---
class TestSwipeConsume:
    def test_pass_consumes_free_then_extra_then_429(self):
        uid = mk_user(swipe_day=ist_day(), swipe_count=48, extra_swipes=1)
        t = mk_user(gender="Female")
        assert act(uid, t).status_code == 200
        assert s.get(f"{API}/swipes/{uid}").json()["used"] == 49
        assert act(uid, t).status_code == 200
        d = s.get(f"{API}/swipes/{uid}").json()
        assert d["used"] == 50 and d["extra"] == 1 and d["remaining"] == 1
        assert act(uid, t).status_code == 200
        d = s.get(f"{API}/swipes/{uid}").json()
        assert d["extra"] == 0 and d["remaining"] == 0
        r = act(uid, t)
        assert r.status_code == 429 and r.json()["detail"] == "out_of_swipes"

    def test_nonpremium_like_403_no_consume(self):
        uid = mk_user(swipe_day=ist_day(), swipe_count=10)
        t = mk_user(gender="Female")
        r = act(uid, t, "like")
        assert r.status_code == 403
        assert s.get(f"{API}/swipes/{uid}").json()["used"] == 10

    def test_premium_unaffected(self):
        uid = mk_user(premium=True, swipe_day=ist_day(), swipe_count=50, extra_swipes=0)
        t = mk_user(gender="Female")
        assert act(uid, t).status_code == 200
        assert db.users.find_one({"id": uid})["swipe_count"] == 50

    def test_female_unaffected(self):
        uid = mk_user(gender="Female", swipe_day=ist_day(), swipe_count=50, extra_swipes=0)
        t = mk_user()
        assert act(uid, t).status_code == 200
        assert db.users.find_one({"id": uid})["swipe_count"] == 50


# --- ad reward caps ---
class TestAdRewards:
    def reward(self, uid, rt="extra_swipes", amount=10):
        return s.post(f"{API}/ads/reward", json={"user_id": uid, "reward_type": rt, "amount": amount,
                                                  "timestamp": datetime.now(timezone.utc).isoformat()})

    def test_clamp_and_daily_cap(self):
        uid = mk_user()
        r = self.reward(uid, amount=1000)
        assert r.status_code == 200 and r.json()["amount"] == 10
        assert s.get(f"{API}/swipes/{uid}").json()["extra"] == 10
        for _ in range(4):
            assert self.reward(uid).status_code == 200
        assert s.get(f"{API}/swipes/{uid}").json()["extra"] == 50
        r = self.reward(uid)
        assert r.status_code == 429
        assert s.get(f"{API}/swipes/{uid}").json()["extra"] == 50

    def test_negative_amount_clamped(self):
        uid = mk_user(extra_swipes=5)
        r = self.reward(uid, amount=-100)
        assert r.status_code == 200 and r.json()["amount"] == 0
        assert s.get(f"{API}/swipes/{uid}").json()["extra"] == 5

    def test_other_reward_types_unchanged(self):
        uid = mk_user()
        r = self.reward(uid, rt="priority_message", amount=25)
        assert r.status_code == 200 and r.json()["amount"] == 25
        assert db.users.find_one({"id": uid})["priority_messages"] == 25

    def test_unknown_user_404(self):
        assert self.reward("nope-" + str(uuid.uuid4())).status_code == 404


# --- like reveal + likes listing ---
class TestReveal:
    def test_reveal_flow(self):
        uid = mk_user()
        likers = [mk_user(gender="Female", name=f"TESTLiker{i}", photos=["https://x/p.jpg"], age=22) for i in range(5)]
        for lk in likers:
            mk_like(lk, uid)
        stranger = mk_user(gender="Female")
        r = s.post(f"{API}/likes/{uid}/reveal", json={"liker_id": stranger})
        assert r.status_code == 404
        r = s.post(f"{API}/likes/{uid}/reveal", json={"liker_id": likers[0]})
        assert r.status_code == 200 and r.json().get("remaining_today") == 2
        r = s.post(f"{API}/likes/{uid}/reveal", json={"liker_id": likers[0]})
        assert r.status_code == 200 and r.json().get("already_revealed") is True
        assert s.post(f"{API}/likes/{uid}/reveal", json={"liker_id": likers[1]}).status_code == 200
        assert s.post(f"{API}/likes/{uid}/reveal", json={"liker_id": likers[2]}).json()["remaining_today"] == 0
        r = s.post(f"{API}/likes/{uid}/reveal", json={"liker_id": likers[3]})
        assert r.status_code == 429
        u = db.users.find_one({"id": uid})
        assert set(u["revealed_likes"]) == set(likers[:3])

        data = s.get(f"{API}/likes/{uid}").json()
        allk = {x["id"]: x for x in data["regular_likes"] + data["super_likes"]}
        assert len(allk) == 5
        for i, lk in enumerate(likers):
            x = allk[lk]
            if i < 3:
                assert x["name"] == f"TESTLiker{i}" and x["age"] == 22 and x["photos"]
                assert x["revealed"] is True and "is_locked" not in x
            else:
                assert x["name"] == "???" and x["is_locked"] is True and x["photos"] == []

    def test_premium_reveal(self):
        uid = mk_user(premium=True)
        lk = mk_user(gender="Female", name="TESTPremLiker")
        mk_like(lk, uid)
        r = s.post(f"{API}/likes/{uid}/reveal", json={"liker_id": lk})
        assert r.status_code == 200 and r.json().get("already_premium") is True
        data = s.get(f"{API}/likes/{uid}").json()
        x = (data["regular_likes"] + data["super_likes"])[0]
        assert x["name"] == "TESTPremLiker" and "is_locked" not in x

    def test_unknown_user_404(self):
        assert s.post(f"{API}/likes/nope-{uuid.uuid4()}/reveal", json={"liker_id": "x"}).status_code == 404
