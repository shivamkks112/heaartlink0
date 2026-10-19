# Iter45: AI chat daily limit + rewarded-ad extend, crush reveal via video, public feature flags, crush ordering
import os, sys, uuid, copy, json, asyncio
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
import pytest, requests, bcrypt
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
TAG = "iter45"
PW = "TestIter45@2026"


def ist_day():
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d")


def _mk_user(name, gender, premium, **extra):
    tmpl = mdb.users.find_one({"email": "Shivamkks122@gmail.com"}) or {}
    doc = copy.deepcopy(tmpl)
    doc.pop("_id", None)
    for k in list(doc.keys()):
        if k.startswith("ai_msg_") or k.startswith("ai_visit") or k in ("account_locked_until", "last_ai_crush_at"):
            doc.pop(k, None)
    doc.update({
        "id": str(uuid.uuid4()), "email": f"test_{TAG}_{name.lower()}@example.com",
        "phone": "+9198" + str(uuid.uuid4().int)[:8], "name": f"TEST_{name}", "gender": gender,
        "is_premium": premium, "password_hash": bcrypt.hashpw(PW.encode(), bcrypt.gensalt()).decode(),
        "last_active": datetime.now(timezone.utc).isoformat(), "failed_login_attempts": 0, "test_tag": TAG,
        "is_ai_profile": False, "auto_chat_enabled": False, "privacy_settings": {}, "is_banned": False,
        "women_safety_mode": False, "ladies_first_enabled": False,
    })
    doc.update(extra)
    mdb.users.insert_one(doc)
    return doc["id"]


def _cleanup(ids):
    q_any = {"$in": ids}
    mdb.crushes.delete_many({"$or": [{"crushed_id": q_any}, {"crusher_id": q_any}]})
    mdb.ad_rewards.delete_many({"user_id": q_any})
    mdb.messages.delete_many({"$or": [{"sender_id": q_any}, {"receiver_id": q_any}]})
    mdb.matches.delete_many({"$or": [{"user1_id": q_any}, {"user2_id": q_any}]})
    mdb.in_app_notifications.delete_many({"user_id": q_any})
    mdb.profile_views.delete_many({"$or": [{"viewed_user_id": q_any}, {"viewer_id": q_any}]})
    mdb.users.delete_many({"id": q_any})


@pytest.fixture(scope="module")
def ctx():
    flags = mdb.app_settings.find_one({"type": "feature_flags"}) or {}
    orig_flag = flags.get("crush_feature", False)
    _cleanup([x["id"] for x in mdb.users.find({"test_tag": TAG}, {"id": 1})])
    ai = mdb.users.find_one({"is_ai_profile": True}, {"id": 1})
    stealth = mdb.users.find_one({"auto_chat_enabled": True, "is_ai_profile": {"$ne": True}}, {"id": 1})
    c = {
        "free": _mk_user("FreeMale", "male", False),
        "freeCap": _mk_user("FreeMaleCap", "Male", False),
        "prem": _mk_user("PremMale", "male", True),
        "girl": _mk_user("Girl", "female", False),
        "real_girl": _mk_user("RealGirl", "female", False),
        "ai": ai["id"], "stealth": stealth["id"] if stealth else None,
    }
    for k in ("free", "prem", "girl", "freeCap"):
        mid = str(uuid.uuid4())
        mdb.matches.insert_one({"id": mid, "user1_id": c[k], "user2_id": c["ai"], "matched": True, "user1_liked": True,
                                "user2_liked": True, "created_at": datetime.now(timezone.utc).isoformat(), "test_tag": TAG})
        c[f"match_{k}"] = mid
    ids = [c[k] for k in ("free", "freeCap", "prem", "girl", "real_girl")]
    yield c
    _cleanup(ids)
    mdb.app_settings.update_one({"type": "feature_flags"}, {"$set": {"crush_feature": orig_flag}})


def _send(c, who, to, content="hi TEST"):
    return requests.post(f"{BASE_URL}/api/messages", json={
        "match_id": c.get(f"match_{who}", str(uuid.uuid4())), "sender_id": c[who], "receiver_id": to, "content": content},
        timeout=30)


def _set_ai(uid, count, extra=0, day=None):
    mdb.users.update_one({"id": uid}, {"$set": {"ai_msg_day": day or ist_day(), "ai_msg_count": count, "ai_msg_extra": extra}})


# --- public feature flags
class TestPublicFlags:
    def test_public_flags(self, ctx):
        mdb.app_settings.update_one({"type": "feature_flags"}, {"$set": {"crush_feature": True}})
        r = requests.get(f"{BASE_URL}/api/feature-flags/public")
        assert r.status_code == 200 and r.json() == {"crush_feature": True}
        mdb.app_settings.update_one({"type": "feature_flags"}, {"$set": {"crush_feature": False}})
        assert requests.get(f"{BASE_URL}/api/feature-flags/public").json() == {"crush_feature": False}


# --- POST /crush ordering: premium before duplicate, 404 target
class TestCrushOrdering:
    def test_crush_checks(self, ctx):
        mdb.app_settings.update_one({"type": "feature_flags"}, {"$set": {"crush_feature": True}})
        # insert a pre-existing crush from free user -> premium check must still win (403 not 400)
        mdb.crushes.insert_one({"id": str(uuid.uuid4()), "crusher_id": ctx["free"], "crushed_id": ctx["real_girl"],
                                "created_at": datetime.now(timezone.utc).isoformat(), "revealed": False})
        r = requests.post(f"{BASE_URL}/api/crush/{ctx['free']}", params={"target_user_id": ctx["real_girl"]})
        assert r.status_code == 403 and r.json()["detail"] == "Premium required to send crush"
        r = requests.post(f"{BASE_URL}/api/crush/{ctx['prem']}", params={"target_user_id": str(uuid.uuid4())})
        assert r.status_code == 404
        mdb.crushes.delete_many({"crusher_id": ctx["free"]})


# --- legacy profile-viewers premium gate + 6h dedupe
class TestLegacyViewers:
    def test_legacy_viewers_free_empty(self, ctx):
        mdb.users.update_one({"id": ctx["free"]}, {"$set": {"profile_viewers": [{"user_id": ctx["girl"], "viewed_at": "x"}]}})
        r = requests.get(f"{BASE_URL}/api/user/{ctx['free']}/profile-viewers")
        assert r.status_code == 200 and r.json()["viewers"] == [] and r.json()["is_premium"] is False
        r = requests.get(f"{BASE_URL}/api/user/{ctx['prem']}/profile-viewers")
        assert r.status_code == 200

    def test_view_dedupe_6h(self, ctx):
        for _ in range(3):
            assert requests.post(f"{BASE_URL}/api/profile/{ctx['free']}/view", params={"viewer_id": ctx["girl"]}).status_code == 200
        assert mdb.profile_views.count_documents({"viewed_user_id": ctx["free"], "viewer_id": ctx["girl"]}) == 1
        assert mdb.in_app_notifications.count_documents({"user_id": ctx["free"], "type": "profile_view"}) == 1


# --- AI chat limit
class TestAIChatLimit:
    def test_status_free_and_premium(self, ctx):
        r = requests.get(f"{BASE_URL}/api/ai-chat/limit/{ctx['free']}").json()
        assert r == {"unlimited": False, "limit": 30, "used": 0, "extra": 0, "remaining": 30}
        assert requests.get(f"{BASE_URL}/api/ai-chat/limit/{ctx['prem']}").json() == {"unlimited": True}
        assert requests.get(f"{BASE_URL}/api/ai-chat/limit/{ctx['girl']}").json() == {"unlimited": True}

    def test_stale_day_resets(self, ctx):
        _set_ai(ctx["free"], 30, 0, day="2000-01-01")
        assert requests.get(f"{BASE_URL}/api/ai-chat/limit/{ctx['free']}").json()["remaining"] == 30

    def test_send_counts_and_429(self, ctx):
        _set_ai(ctx["free"], 28)
        r = _send(ctx, "free", ctx["ai"])
        assert r.status_code == 200, r.text
        d = requests.get(f"{BASE_URL}/api/ai-chat/limit/{ctx['free']}").json()
        assert d["used"] == 29 and d["remaining"] == 1
        assert _send(ctx, "free", ctx["ai"]).status_code == 200
        before = mdb.messages.count_documents({"sender_id": ctx["free"]})
        r = _send(ctx, "free", ctx["ai"], "should be blocked TEST")
        assert r.status_code == 429 and r.json()["detail"] == "ai_chat_limit"
        assert mdb.messages.count_documents({"sender_id": ctx["free"]}) == before
        assert mdb.messages.count_documents({"sender_id": ctx["free"], "content": "should be blocked TEST"}) == 0

    def test_capitalized_male_also_limited(self, ctx):
        _set_ai(ctx["freeCap"], 30)
        assert _send(ctx, "freeCap", ctx["ai"]).status_code == 429

    def test_premium_and_girl_unlimited(self, ctx):
        _set_ai(ctx["prem"], 99)
        _set_ai(ctx["girl"], 99)
        assert _send(ctx, "prem", ctx["ai"]).status_code == 200
        assert _send(ctx, "girl", ctx["ai"]).status_code == 200

    def test_real_and_stealth_not_limited(self, ctx):
        _set_ai(ctx["free"], 30)
        r = _send(ctx, "free", ctx["real_girl"], "hello real TEST")
        assert r.status_code != 429, r.text
        if ctx["stealth"]:
            r = _send(ctx, "free", ctx["stealth"], "hello stealth TEST")
            assert r.status_code != 429, r.text
        # counter untouched
        assert mdb.users.find_one({"id": ctx["free"]})["ai_msg_count"] == 30

    def test_extend_adds_10_and_unblocks(self, ctx):
        _set_ai(ctx["free"], 30)
        mdb.ad_rewards.delete_many({"user_id": ctx["free"]})
        r = requests.post(f"{BASE_URL}/api/ai-chat/extend/{ctx['free']}")
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True and d["added"] == 10 and d["extra"] == 10 and d["remaining"] == 10
        assert _send(ctx, "free", ctx["ai"]).status_code == 200
        assert requests.get(f"{BASE_URL}/api/ai-chat/limit/{ctx['free']}").json()["extra"] == 9

    def test_extend_cap_parallel(self, ctx):
        mdb.ad_rewards.delete_many({"user_id": ctx["freeCap"]})
        _set_ai(ctx["freeCap"], 30, 0)
        with ThreadPoolExecutor(8) as ex:
            codes = list(ex.map(lambda _: requests.post(f"{BASE_URL}/api/ai-chat/extend/{ctx['freeCap']}").status_code, range(8)))
        assert codes.count(200) == 5 and codes.count(429) == 3, codes
        assert mdb.users.find_one({"id": ctx["freeCap"]})["ai_msg_extra"] == 50
        assert requests.post(f"{BASE_URL}/api/ai-chat/extend/{ctx['freeCap']}").status_code == 429

    def test_ws_limit_event(self, ctx):
        import websockets
        _set_ai(ctx["free"], 30, 0)
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + f"/api/ws/{ctx['free']}"

        async def run():
            async with websockets.connect(ws_url, open_timeout=15) as ws:
                await ws.send(json.dumps({"match_id": ctx["match_free"], "receiver_id": ctx["ai"], "content": "ws blocked TEST"}))
                for _ in range(10):
                    m = json.loads(await asyncio.wait_for(ws.recv(), 10))
                    if m.get("type") == "ai_chat_limit":
                        return m
            return None
        m = asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())
        assert m is not None and m["match_id"] == ctx["match_free"] and m["content"] == "ws blocked TEST"
        assert mdb.messages.count_documents({"content": "ws blocked TEST"}) == 0


# --- crush reveal via rewarded video
class TestCrushReveal:
    def test_reveal_flow(self, ctx):
        mdb.crushes.delete_many({"crushed_id": ctx["free"]})
        mdb.ad_rewards.delete_many({"user_id": ctx["free"], "reward_type": "crush_reveal"})
        base = datetime.now(timezone.utc)
        crushers = [ctx["girl"], ctx["real_girl"], ctx["prem"]]
        for i, cid in enumerate(crushers):
            mdb.crushes.insert_one({"id": f"TEST_{TAG}_{i}", "crusher_id": cid, "crushed_id": ctx["free"],
                                    "created_at": (base - timedelta(minutes=10 - i)).isoformat(), "revealed": False})
        d = requests.get(f"{BASE_URL}/api/crushes/{ctx['free']}").json()
        assert d["crushes"] == [] and d["total"] == 3 and d["hidden"] == 3 and d["is_premium"] is False
        r = requests.post(f"{BASE_URL}/api/crushes/{ctx['free']}/reveal")
        assert r.status_code == 200 and r.json()["crush_id"] == f"TEST_{TAG}_2"  # newest
        d = requests.get(f"{BASE_URL}/api/crushes/{ctx['free']}").json()
        assert d["total"] == 3 and d["hidden"] == 2 and len(d["crushes"]) == 1
        c = d["crushes"][0]
        assert c["revealed"] is True and c["user"]["id"] == ctx["prem"] and c["user"]["name"] == "TEST_PremMale"
        assert requests.post(f"{BASE_URL}/api/crushes/{ctx['free']}/reveal").status_code == 200
        r = requests.post(f"{BASE_URL}/api/crushes/{ctx['free']}/reveal")
        assert r.status_code == 429
        d = requests.get(f"{BASE_URL}/api/crushes/{ctx['free']}").json()
        assert d["hidden"] == 1 and len(d["crushes"]) == 2

    def test_reveal_404_when_none(self, ctx):
        r = requests.post(f"{BASE_URL}/api/crushes/{ctx['freeCap']}/reveal")
        assert r.status_code == 404

    def test_premium_crushes_unchanged(self, ctx):
        mdb.crushes.insert_one({"id": f"TEST_{TAG}_p", "crusher_id": ctx["girl"], "crushed_id": ctx["prem"],
                                "created_at": datetime.now(timezone.utc).isoformat(), "revealed": False})
        d = requests.get(f"{BASE_URL}/api/crushes/{ctx['prem']}").json()
        assert d["is_premium"] is True and d["total"] == 1 and d["hidden"] == 0
        assert d["crushes"][0]["user"]["name"] == "TEST_Girl"
