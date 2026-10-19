# Iter44: Paid Profile Views / Secret Crush (counts-only for free) + AI profile activity
import os, sys, uuid, asyncio, copy
from datetime import datetime, timezone, timedelta
import pytest, requests, bcrypt
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mc = MongoClient(os.environ["MONGO_URL"])
mdb = mc[os.environ["DB_NAME"]]
TAG = "iter44"
PW = "TestIter44@2026"


def _mk_user(name, gender, premium, **extra):
    tmpl = mdb.users.find_one({"email": "Shivamkks122@gmail.com"}) or {}
    doc = copy.deepcopy(tmpl)
    doc.pop("_id", None)
    uid = str(uuid.uuid4())
    doc.update({
        "id": uid, "email": f"test_{TAG}_{name.lower()}@example.com", "phone": "+9199" + str(uuid.uuid4().int)[:8],
        "name": f"TEST_{name}", "gender": gender, "is_premium": premium,
        "password_hash": bcrypt.hashpw(PW.encode(), bcrypt.gensalt()).decode(),
        "last_active": datetime.now(timezone.utc).isoformat(), "failed_login_attempts": 0,
        "test_tag": TAG, "is_ai_profile": False, "auto_chat_enabled": False,
        "privacy_settings": {}, "is_banned": False,
    })
    for k in ("ai_visit_day", "ai_visit_count", "ai_visit_target", "last_ai_crush_at", "account_locked_until"):
        doc.pop(k, None)
    doc.update(extra)
    mdb.users.insert_one(doc)
    return uid


def _cleanup(ids):
    mdb.profile_views.delete_many({"$or": [{"viewed_user_id": {"$in": ids}}, {"profile_id": {"$in": ids}}, {"viewer_id": {"$in": ids}}]})
    mdb.crushes.delete_many({"$or": [{"crushed_id": {"$in": ids}}, {"crusher_id": {"$in": ids}}]})
    mdb.in_app_notifications.delete_many({"user_id": {"$in": ids}})
    mdb.users.delete_many({"id": {"$in": ids}})


@pytest.fixture(scope="module")
def users():
    flags = mdb.app_settings.find_one({"type": "feature_flags"}) or {}
    orig_flag = flags.get("crush_feature", False)
    _cleanup([x["id"] for x in mdb.users.find({"test_tag": TAG}, {"id": 1})])
    u = {
        "free": _mk_user("FreeMale", "male", False),
        "prem": _mk_user("PremMale", "male", True),
        "fviewer": _mk_user("ViewerGirl", "female", False),
        "fviewer2": _mk_user("ViewerGirl2", "female", False),
    }
    yield u
    _cleanup(list(u.values()))
    mdb.app_settings.update_one({"type": "feature_flags"}, {"$set": {"crush_feature": orig_flag}})


def _view(owner, viewer):
    r = requests.post(f"{BASE_URL}/api/profile/{owner}/view", params={"viewer_id": viewer})
    assert r.status_code == 200, r.text
    return r


# --- profile views: storage + counts-only for free
class TestProfileViews:
    def test_free_counts_only_no_leak(self, users):
        _view(users["free"], users["fviewer"])
        _view(users["free"], users["fviewer2"])
        doc = mdb.profile_views.find_one({"viewed_user_id": users["free"], "viewer_id": users["fviewer"]})
        assert doc is not None, "viewed_user_id not stored"
        r = requests.get(f"{BASE_URL}/api/profile-viewers/{users['free']}")
        assert r.status_code == 200
        d = r.json()
        assert d["viewers"] == [] and d["is_premium"] is False
        assert d["total_views"] == 2 and d["today_views"] == 2
        assert users["fviewer"] not in r.text and "TEST_ViewerGirl" not in r.text

    def test_free_notification_anonymous(self, users):
        r = requests.get(f"{BASE_URL}/api/notifications/{users['free']}")
        assert r.status_code == 200
        pv = [n for n in r.json()["notifications"] if n["type"] == "profile_view"]
        assert len(pv) == 2
        for n in pv:
            assert "Kisi ne tumhari profile dekhi" in n["body"]
            assert n["data"].get("route") == "/likes"
            assert "viewer_id" not in n["data"] or n["data"]["viewer_id"] is None
        assert users["fviewer"] not in r.text and "TEST_ViewerGirl" not in r.text

    def test_premium_full_list_deduped(self, users):
        _view(users["prem"], users["fviewer"])
        _view(users["prem"], users["fviewer"])
        _view(users["prem"], users["fviewer2"])
        r = requests.get(f"{BASE_URL}/api/profile-viewers/{users['prem']}")
        d = r.json()
        assert d["is_premium"] is True and d["total_views"] == 3
        ids = [v["user"]["id"] for v in d["viewers"]]
        assert sorted(ids) == sorted([users["fviewer"], users["fviewer2"]])
        assert all(v["locked"] is False and v["user"]["name"].startswith("TEST_") for v in d["viewers"])
        # latest first
        ts = [v["viewed_at"] for v in d["viewers"]]
        assert ts == sorted(ts, reverse=True)

    def test_premium_notification_has_name(self, users):
        r = requests.get(f"{BASE_URL}/api/notifications/{users['prem']}")
        pv = [n for n in r.json()["notifications"] if n["type"] == "profile_view"]
        assert len(pv) == 3
        assert any("TEST_ViewerGirl" in n["body"] for n in pv)
        assert any(n["data"].get("viewer_id") == users["fviewer"] for n in pv)

    def test_incognito_viewer_not_stored(self, users):
        mdb.users.update_one({"id": users["fviewer2"]}, {"$set": {"privacy_settings": {"incognito_mode": True}}})
        r = _view(users["free"], users["fviewer2"])
        assert r.json()["incognito"] is True
        d = requests.get(f"{BASE_URL}/api/profile-viewers/{users['free']}").json()
        assert d["total_views"] == 2
        mdb.users.update_one({"id": users["fviewer2"]}, {"$set": {"privacy_settings": {}}})


# --- secret crush: premium gate + counts-only for free
class TestCrush:
    def test_crush_paused_when_flag_off(self, users):
        mdb.app_settings.update_one({"type": "feature_flags"}, {"$set": {"crush_feature": False}})
        r = requests.post(f"{BASE_URL}/api/crush/{users['prem']}", params={"target_user_id": users["fviewer"]})
        assert r.status_code == 403 and "paused" in r.json()["detail"]

    def test_non_premium_crush_403(self, users):
        mdb.app_settings.update_one({"type": "feature_flags"}, {"$set": {"crush_feature": True}})
        r = requests.post(f"{BASE_URL}/api/crush/{users['free']}", params={"target_user_id": users["fviewer"]})
        assert r.status_code == 403
        assert r.json()["detail"] == "Premium required to send crush"
        assert mdb.crushes.count_documents({"crusher_id": users["free"]}) == 0

    def test_premium_and_female_can_crush(self, users):
        r = requests.post(f"{BASE_URL}/api/crush/{users['fviewer']}", params={"target_user_id": users["free"]})
        assert r.status_code == 200 and r.json()["action"] == "crush_sent"
        r = requests.post(f"{BASE_URL}/api/crush/{users['fviewer']}", params={"target_user_id": users["prem"]})
        assert r.status_code == 200
        r = requests.post(f"{BASE_URL}/api/crush/{users['fviewer']}", params={"target_user_id": users["prem"]})
        assert r.status_code == 400

    def test_free_crushes_counts_only(self, users):
        r = requests.get(f"{BASE_URL}/api/crushes/{users['free']}")
        d = r.json()
        assert d == {"crushes": [], "total": 1, "is_premium": False}

    def test_premium_crushes_full(self, users):
        d = requests.get(f"{BASE_URL}/api/crushes/{users['prem']}").json()
        assert d["is_premium"] is True and d["total"] == 1
        c = d["crushes"][0]
        assert c["revealed"] is True and c["user"]["id"] == users["fviewer"] and c["user"]["name"] == "TEST_ViewerGirl"


# --- AI profile activity (_run_ai_profile_activity) direct invocation
class TestAIActivity:
    def test_ai_activity_logic(self, users, monkeypatch):
        import server
        from motor.motor_asyncio import AsyncIOMotorClient

        async def run():
            # fresh motor client bound to this loop
            server.db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
            import services.helpers as h
            h.db = server.db
            fixed = datetime(2027, 1, 15, 8, 0, tzinfo=timezone.utc)  # 13:30 IST

            class FakeDT(datetime):
                @classmethod
                def now(cls, tz=None):
                    return fixed if tz else fixed.replace(tzinfo=None)
            monkeypatch.setattr(server, "datetime", FakeDT)
            # restrict to our users: patch random so visits always fire
            monkeypatch.setattr(server.random, "random", lambda: 0.0)

            async def noop(*a, **k):
                return None
            monkeypatch.setattr(server.fcm_service, "notify_profile_view", noop)
            monkeypatch.setattr(server.fcm_service, "send_to_user", noop)
            for uid in (users["free"], users["prem"]):
                await server.db.users.update_one({"id": uid}, {"$set": {"last_active": fixed.isoformat()}})
            before = {uid: mdb.profile_views.count_documents({"viewed_user_id": uid}) for uid in (users["free"],)}
            for _ in range(6):
                await server._run_ai_profile_activity()
            return before

        before = asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())
        u = mdb.users.find_one({"id": users["free"]})
        assert u["ai_visit_day"] == "2027-01-15"
        assert 1 <= u["ai_visit_target"] <= 3
        assert u["ai_visit_count"] == u["ai_visit_target"], "count should reach target but never exceed"
        ai_views = list(mdb.profile_views.find({"viewed_user_id": users["free"], "viewer_id": {"$nin": [users["fviewer"], users["fviewer2"]]}}))
        assert len(ai_views) == u["ai_visit_target"]
        vids = [v["viewer_id"] for v in ai_views]
        assert len(set(vids)) == len(vids), "same AI visitor repeated within 24h"
        for vid in vids:
            v = mdb.users.find_one({"id": vid})
            assert v["gender"].lower() == "female" and (v.get("is_ai_profile") or v.get("auto_chat_enabled"))
        # crush flag is on (set by TestCrush) -> exactly one AI crush (6-day cap)
        ai_cr = mdb.crushes.count_documents({"crushed_id": users["free"], "crusher_id": {"$ne": users["fviewer"]}})
        assert ai_cr == 1
        assert u.get("last_ai_crush_at")


# --- AI activity must also cover users stored with gender "Male" (capitalized; real users like Shivamkks122)
def test_ai_activity_capitalized_male(monkeypatch):
    import server
    from motor.motor_asyncio import AsyncIOMotorClient
    _cleanup([x["id"] for x in mdb.users.find({"test_tag": TAG + "b"}, {"id": 1})])
    fixed = datetime(2027, 1, 15, 8, 0, tzinfo=timezone.utc)
    uid = _mk_user("CapMale", "Male", False, test_tag=TAG + "b", last_active=fixed.isoformat())
    try:
        async def run():
            server.db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
            import services.helpers as h
            h.db = server.db

            class FakeDT(datetime):
                @classmethod
                def now(cls, tz=None):
                    return fixed if tz else fixed.replace(tzinfo=None)
            monkeypatch.setattr(server, "datetime", FakeDT)
            monkeypatch.setattr(server.random, "random", lambda: 0.0)

            async def noop(*a, **k):
                return None
            monkeypatch.setattr(server.fcm_service, "notify_profile_view", noop)
            monkeypatch.setattr(server.fcm_service, "send_to_user", noop)
            await server._run_ai_profile_activity()
        asyncio.run(run())
        u = mdb.users.find_one({"id": uid})
        assert u.get("ai_visit_day") == "2027-01-15", "gender 'Male' user skipped by AI activity (exact-match 'male' query)"
    finally:
        _cleanup([uid])
