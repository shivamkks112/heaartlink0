# Iteration 46: Admin AI Photo Review grid + Story-style photos + Online tab AI personas
import os
import time
import base64
import io
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
load_dotenv('/app/backend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
mdb = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]

ADMIN = {"email_or_phone": "shivamkks112@gmail.com", "password": "Shivam@2026"}
ADMIN_ID = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
PID = "cb373ffe-3469-49a4-8591-97dc8de4fc42"  # Priya Sharma (AI)


def _png(color):
    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", (8, 8), color).save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


@pytest.fixture(scope="module")
def s():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code}")
    ss = requests.Session()
    ss.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return ss


@pytest.fixture(scope="module")
def backup():
    u = mdb.users.find_one({"id": PID}, {"_id": 0, "photos": 1, "profile_picture": 1, "photos_approved": 1})
    yield u
    mdb.users.update_one({"id": PID}, {"$set": {"photos": u.get("photos") or [], "profile_picture": u.get("profile_picture")}})
    if "photos_approved" in u:
        mdb.users.update_one({"id": PID}, {"$set": {"photos_approved": u["photos_approved"]}})
    else:
        mdb.users.update_one({"id": PID}, {"$unset": {"photos_approved": ""}})


def _get(s, pending=False):
    r = s.get(f"{BASE_URL}/api/admin/ai-photos", params={"pending_only": str(pending).lower()})
    assert r.status_code == 200, r.text
    return r.json()


def _profile(s, pid=PID):
    return next((p for p in _get(s)["profiles"] if p["id"] == pid), None)


# --- list endpoint
class TestList:
    def test_unauth(self):
        assert requests.get(f"{BASE_URL}/api/admin/ai-photos").status_code in (401, 403)

    def test_list_shape_no_base64(self, s):
        d = _get(s)
        assert "story" in d and "enabled" in d["story"] and "every_days" in d["story"]
        assert len(d["profiles"]) > 0
        for p in d["profiles"]:
            for k in ("id", "name", "photos", "busy"):
                assert k in p
            for u in p["photos"]:
                assert not u.startswith("data:") and u.startswith("http")
            if p.get("profile_picture"):
                assert not p["profile_picture"].startswith("data:")
        print("size bytes", len(str(d)))


# --- approve / main / delete
class TestEdit:
    def test_approve_and_pending_filter(self, s, backup):
        r = s.post(f"{BASE_URL}/api/admin/ai-photos/{PID}/approve")
        assert r.status_code == 200
        assert _profile(s)["photos_approved"] is True
        assert all(p["id"] != PID for p in _get(s, True)["profiles"])

    def test_approve_non_ai_404(self, s):
        assert s.post(f"{BASE_URL}/api/admin/ai-photos/{ADMIN_ID}/approve").status_code == 404

    def test_main_and_delete(self, s, backup):
        a, b, c = _png("red"), _png("green"), _png("blue")
        mdb.users.update_one({"id": PID}, {"$set": {"photos": [a, b, c], "profile_picture": a}})
        r = s.post(f"{BASE_URL}/api/admin/ai-photos/{PID}/2/main")
        assert r.status_code == 200
        u = mdb.users.find_one({"id": PID}, {"photos": 1, "profile_picture": 1})
        assert u["photos"] == [c, a, b] and u["profile_picture"] == c
        assert s.post(f"{BASE_URL}/api/admin/ai-photos/{PID}/9/main").status_code == 404
        # delete main -> pp becomes new first
        assert s.delete(f"{BASE_URL}/api/admin/ai-photos/{PID}/0").status_code == 200
        u = mdb.users.find_one({"id": PID}, {"photos": 1, "profile_picture": 1})
        assert u["photos"] == [a, b] and u["profile_picture"] == a
        # delete non-main
        assert s.delete(f"{BASE_URL}/api/admin/ai-photos/{PID}/1").status_code == 200
        u = mdb.users.find_one({"id": PID}, {"photos": 1, "profile_picture": 1})
        assert u["photos"] == [a] and u["profile_picture"] == a
        # last photo -> 400
        assert s.delete(f"{BASE_URL}/api/admin/ai-photos/{PID}/0").status_code == 400
        assert s.delete(f"{BASE_URL}/api/admin/ai-photos/{PID}/5").status_code == 404
        # MAIN badge semantics: API pp version == photos[0] version
        p = _profile(s)
        assert p["profile_picture"].split("v=")[1].split("&")[0] == p["photos"][0].split("v=")[1].split("&")[0]

    def test_redo_bad_index(self, s):
        assert s.post(f"{BASE_URL}/api/admin/ai-photos/{PID}/6/redo").status_code == 400
        assert s.post(f"{BASE_URL}/api/admin/ai-photos/{PID}/-1/redo").status_code in (400, 404, 422)


# --- story settings
class TestStory:
    def test_save_and_validate(self, s):
        r = s.put(f"{BASE_URL}/api/admin/ai-story-photos", json={"enabled": True, "every_days": 3})
        assert r.status_code == 200 and r.json() == {"enabled": True, "every_days": 3}
        assert _get(s)["story"] == {"enabled": True, "every_days": 3}
        assert s.put(f"{BASE_URL}/api/admin/ai-story-photos", json={"enabled": True, "every_days": 0}).status_code == 400
        assert s.put(f"{BASE_URL}/api/admin/ai-story-photos", json={"enabled": True, "every_days": 31}).status_code == 400
        r = s.put(f"{BASE_URL}/api/admin/ai-story-photos", json={"enabled": False, "every_days": 4})
        assert r.json()["enabled"] is False

    def test_non_numeric_every_days(self, s):
        r = s.put(f"{BASE_URL}/api/admin/ai-story-photos", json={"enabled": False, "every_days": "abc"})
        s.put(f"{BASE_URL}/api/admin/ai-story-photos", json={"enabled": False, "every_days": 4})
        assert r.status_code == 400, f"got {r.status_code}"


# --- Online tab
class TestOnline:
    def test_active_users_include_ai(self, s):
        r = requests.get(f"{BASE_URL}/api/active-users/{ADMIN_ID}")
        assert r.status_code == 200
        d = r.json()
        ai_ids = {u["id"] for u in mdb.users.find({"is_ai_profile": True, "is_active_ai": True, "is_online": True}, {"id": 1})}
        ais = [u for u in d if u["id"] in ai_ids]
        print("total", len(d), "ai", len(ais), "real", len(d) - len(ais))
        assert len(ais) > 0
        assert all(u["is_online"] for u in ais)


# --- real Gemini redo (ONE generation)
class TestRedo:
    def test_redo_single(self, s, backup):
        mdb.users.update_one({"id": PID}, {"$set": {"photos_approved": True}})
        before = _profile(s)["photos"][0]
        assert s.post(f"{BASE_URL}/api/admin/ai-photos/{PID}/0/redo").json()["started"] is True
        time.sleep(1.5)
        assert 0 in _profile(s)["busy"]
        for _ in range(30):
            time.sleep(5)
            p = _profile(s)
            if 0 not in p["busy"]:
                break
        assert 0 not in p["busy"], "redo still busy after 150s"
        assert p["photos"][0] != before, "photo version unchanged after redo"
        assert p["photos_approved"] is False
        assert p["profile_picture"].split("v=")[1].split("&")[0] == p["photos"][0].split("v=")[1].split("&")[0]
        img = requests.get(p["photos"][0])
        assert img.status_code == 200 and img.headers["content-type"].startswith("image/")
