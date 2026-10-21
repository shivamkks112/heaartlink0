# Iteration 46: direct check of ai_chatbot.post_story_photo (1 real Gemini generation). Run: python tests/manual_story_photo_iter46.py
import asyncio, os, sys, base64, io
sys.path.insert(0, '/app/backend')
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image
import ai_chatbot as ac

PID = "4abeebfc-99e9-4c99-b167-9d31d1003ed9"  # Ananya Patel


def png(c):
    b = io.BytesIO(); Image.new("RGB", (8, 8), c).save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


async def main():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    orig = await db.users.find_one({"id": PID}, {"_id": 0})
    fakes = [png(c) for c in ("red", "green", "blue", "yellow", "white")]
    try:
        await db.users.update_one({"id": PID}, {"$set": {"photos": fakes, "profile_picture": fakes[0], "photos_approved": True}})
        ok = await ac.post_story_photo(db, orig)
        u = await db.users.find_one({"id": PID}, {"_id": 0, "photos": 1, "profile_picture": 1, "last_story_photo_at": 1, "photos_approved": 1})
        print("ok", ok, "count", len(u["photos"]), "new_first", u["photos"][0] not in fakes,
              "pp==first", u["profile_picture"] == u["photos"][0], "dropped_last", fakes[4] not in u["photos"],
              "order_kept", u["photos"][1:] == fakes[:4], "last_story", u.get("last_story_photo_at"), "approved", u.get("photos_approved"))
    finally:
        restore = {k: orig.get(k) for k in ("photos", "profile_picture")}
        await db.users.update_one({"id": PID}, {"$set": restore, "$unset": {"last_story_photo_at": "", "photos_approved": ""}})
        if "photos_approved" in orig:
            await db.users.update_one({"id": PID}, {"$set": {"photos_approved": orig["photos_approved"]}})
        print("restored")

asyncio.run(main())
