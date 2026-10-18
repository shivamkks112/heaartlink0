# Seed/cleanup temp users for iter42 UI test. Usage: python seed_iter42_ui.py seed|clean
import sys, uuid, bcrypt
from datetime import datetime, timezone
from pymongo import MongoClient

def _env(key):
    for line in open("/app/backend/.env"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')

db = MongoClient(_env("MONGO_URL"))[_env("DB_NAME")]
P = "TEST_ITER42UI_"
now = datetime.now(timezone.utc).isoformat()
if sys.argv[1] == "seed":
    me = P + "me"
    base = dict(age=25, location="Delhi", interests=["music"], created_at=now, last_active=now, verified=False,
                is_blocked=False, is_permanently_banned=False, privacy_settings={"show_profile": True, "show_photos": True, "incognito_mode": False})
    db.users.insert_one({**base, "id": me, "email": "test_iter42ui@example.com", "name": "TestIter42",
                         "password_hash": bcrypt.hashpw(b"TestIter42@2026", bcrypt.gensalt()).decode(),
                         "gender": "Male", "looking_for": "Female", "is_premium": False, "photos": ["https://randomuser.me/api/portraits/men/1.jpg"],
                         "profile_picture": "https://randomuser.me/api/portraits/men/1.jpg", "bio": "test", "onboarding_completed": True, "profile_completed": True})
    for i in range(2):
        lid = P + f"liker{i}"
        pic = f"https://randomuser.me/api/portraits/women/{i+10}.jpg"
        db.users.insert_one({**base, "id": lid, "email": f"test_iter42ui_l{i}@example.com", "name": f"Kavya{i}", "age": 23,
                             "gender": "Female", "looking_for": "Male", "is_premium": False, "photos": [pic], "profile_picture": pic})
        db.matches.insert_one({"id": str(uuid.uuid4()), "user1_id": lid, "user2_id": me, "user1_liked": True, "matched": False, "created_at": now})
    print("seeded", me)
else:
    ids = [u["id"] for u in db.users.find({"id": {"$regex": "^" + P}}, {"id": 1})]
    db.matches.delete_many({"$or": [{"user1_id": {"$in": ids}}, {"user2_id": {"$in": ids}}]})
    db.ad_rewards.delete_many({"user_id": {"$in": ids}})
    for c in ["notifications", "login_attempts", "sessions", "profile_views", "ad_impressions"]:
        db[c].delete_many({"user_id": {"$in": ids}})
    print("deleted", db.users.delete_many({"id": {"$in": ids}}).deleted_count)
