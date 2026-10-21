"""Seed a Play Store demo account (preview only) with AI-persona matches, chats, likes, crushes, views."""
import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
PHOTO = "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/c5b07cf286bf01bd75c0eb9a6adfc63c46014661060bcfa6ba02cd6677e4696f.jpeg"
EMAIL = "demo.rahul@heartlink.co.in"
PASSWORD = "DemoStore@2026"
CHATS = [
    [("u", "hii, tumhari profile pe Goa wali photo bahut mast hai"), ("a", "haha thanks, pichle mahine gayi thi"), ("u", "nice, beach person ho ya mountains?"), ("a", "beach hamesha"), ("a", "tum?"), ("u", "mountains, but beach ke liye convince ho sakta hoon"), ("a", "acha ji, dekhte hain")],
    [("a", "hey"), ("u", "hi, kaisa raha din?"), ("a", "thoda busy tha, abhi free hui"), ("u", "chai ya coffee?"), ("a", "chai obviously")],
    [("u", "weekend plans?"), ("a", "abhi kuch fix nahi"), ("a", "tum batao")],
    [("a", "tumhe bhi cricket pasand hai?"), ("u", "haan, kal ka match dekha?")],
    [("u", "good morning"), ("a", "good morning, itni jaldi uth gaye")],
    [("a", "hii")],
]


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc)
    old = await db.users.find_one({"email": EMAIL}, {"id": 1})
    if old:
        uid = old["id"]
        for coll, f in [("matches", "user1_id"), ("matches", "user2_id"), ("messages", "sender_id"), ("messages", "receiver_id"),
                        ("crushes", "crushed_id"), ("profile_views", "viewed_user_id"), ("notifications", "user_id")]:
            await db[coll].delete_many({f: uid})
        await db.users.delete_one({"id": uid})
    await db.users.delete_many({"is_demo_showcase": True})
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid, "email": EMAIL, "password_hash": bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode(),
        "name": "Rahul", "age": 26, "gender": "Male", "looking_for": "Female",
        "bio": "Product designer | weekend trekker | chai > coffee", "location": "Delhi, India",
        "interests": ["Travel", "Music", "Cricket", "Photography", "Food"], "photos": [PHOTO], "profile_picture": PHOTO,
        "verified": True, "verification_status": "verified", "selfie_verification_status": "verified",
        "is_premium": True, "premium_plan": "monthly", "premium_end": (now + timedelta(days=30)).isoformat(),
        "privacy_settings": {"show_profile": True, "show_photos": True, "incognito_mode": False},
        "blocked_users": [], "muted_users": [], "profile_views": 0, "is_online": True,
        "last_active": now.isoformat(), "created_at": (now - timedelta(days=20)).isoformat(),
        "welcome_shown_at": now.isoformat(), "last_daily_reward": (now + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d"),
        "profile_prompts": [{"question": "My ideal weekend looks like...", "answer": "Sunrise trek, maggi at the top, long nap"}],
        "app_version": "3.3.0", "is_demo": True,
    })
    ais = await db.users.find({"is_ai_profile": True, "is_active_ai": True, "photos.0": {"$exists": True}},
                              {"_id": 0, "password_hash": 0}).to_list(None)
    ais = [a for a in ais if a.get("profile_picture") or a.get("photos")]
    random.shuffle(ais)
    matches, likers, crushers, viewers, show = ais[:6], ais[6:14], ais[14:16], ais[16:22], ais[22:26]
    # Discover shows only non-AI users: add showcase clones (AI-generated photos) and hide all real users
    for a in show:
        clone = {k: v for k, v in a.items() if k not in ("is_ai_profile", "is_active_ai", "ai_personality", "persona_context")}
        clone.update(id=str(uuid.uuid4()), email=f"showcase.{uuid.uuid4().hex[:8]}@heartlink.co.in", is_demo_showcase=True,
                     verified=True, is_online=True, last_active=now.isoformat(),
                     privacy_settings={"show_profile": True, "show_photos": True})
        await db.users.insert_one(clone)
    real = await db.users.find({"is_ai_profile": {"$ne": True}, "is_demo_showcase": {"$ne": True}, "id": {"$ne": uid}},
                               {"_id": 0, "id": 1}).to_list(None)
    if real:
        await db.matches.insert_many([{"id": str(uuid.uuid4()), "user1_id": uid, "user2_id": r["id"], "user1_liked": False,
                                       "matched": False, "created_at": now.isoformat()} for r in real])
    for i, ai in enumerate(matches):
        mid = str(uuid.uuid4())
        t0 = now - timedelta(hours=2 * i + 1)
        await db.matches.insert_one({"id": mid, "user1_id": uid, "user2_id": ai["id"], "user1_liked": True, "user2_liked": True,
                                     "matched": True, "compatibility_score": random.choice([82.0, 88.0, 91.0, 76.0]),
                                     "created_at": (t0 - timedelta(days=1)).isoformat()})
        for j, (who, text) in enumerate(CHATS[i]):
            s, r = (uid, ai["id"]) if who == "u" else (ai["id"], uid)
            await db.messages.insert_one({"id": str(uuid.uuid4()), "match_id": mid, "sender_id": s, "receiver_id": r,
                                          "content": text, "read": True, "delivered": True,
                                          "created_at": (t0 + timedelta(minutes=3 * j)).isoformat()})
    for k, ai in enumerate(likers):
        await db.matches.insert_one({"id": str(uuid.uuid4()), "user1_id": ai["id"], "user2_id": uid, "user1_liked": True,
                                     "matched": False, "is_superlike": k < 3, "created_at": (now - timedelta(hours=k)).isoformat()})
    for ai in crushers:
        await db.crushes.insert_one({"id": str(uuid.uuid4()), "crusher_id": ai["id"], "crushed_id": uid,
                                     "created_at": now.isoformat(), "revealed": False})
    for k, ai in enumerate(viewers):
        await db.profile_views.insert_one({"viewed_user_id": uid, "profile_id": uid, "viewer_id": ai["id"],
                                           "viewed_at": (now - timedelta(minutes=20 * k)).isoformat()})
    print("demo user", uid, "matches", [m["name"] for m in matches])


asyncio.run(main())
