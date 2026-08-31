"""Seed a 26h-old message from admin as the LAST message in match 5f5b1722 to trigger Smart Nudge."""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

env = dotenv_values("/app/backend/.env")
MONGO_URL = os.environ.get("MONGO_URL") or env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or env.get("DB_NAME")

ADMIN = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
REVIEW = "cca39b3f-9f7e-485d-9ae3-d6b210d424fb"
MATCH = "5f5b1722-cc69-4e4c-bde5-f41e21ed0747"


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    existing = await db.messages.find({"match_id": MATCH}, {"_id": 0}).sort("created_at", -1).limit(3).to_list(None)
    print("Existing last messages:")
    for m in existing:
        print(" ", repr(m.get("created_at")), type(m.get("created_at")).__name__, m.get("sender_id") == ADMIN and "ADMIN" or m.get("sender_id"), str(m.get("content"))[:40])

    sample_fmt = existing[0].get("created_at") if existing else None
    old = datetime.now(timezone.utc) - timedelta(hours=26)
    if isinstance(sample_fmt, datetime):
        created_at = old
    else:
        created_at = old.isoformat()

    # Remove previously seeded nudge messages to keep idempotent
    await db.messages.delete_many({"match_id": MATCH, "content": {"$regex": "^TEST_NUDGE"}})

    # Any messages NEWER than our seeded one from the other user would break the nudge.
    newer = [m for m in existing]
    doc = {
        "id": str(uuid.uuid4()),
        "match_id": MATCH,
        "sender_id": ADMIN,
        "receiver_id": REVIEW,
        "content": "TEST_NUDGE_LAST_MSG hey there, are you around?",
        "read": True,
        "delivered": True,
        "created_at": created_at,
        "message_type": "text",
        "reactions": {},
    }
    await db.messages.insert_one(doc)

    # Push all other messages in this match to be OLDER than the seeded one
    all_msgs = await db.messages.find({"match_id": MATCH}, {"_id": 0, "id": 1, "created_at": 1, "content": 1}).to_list(None)
    base = old
    idx = 1
    for m in all_msgs:
        if m["content"].startswith("TEST_NUDGE"):
            continue
        newts = base - timedelta(minutes=10 * idx)
        idx += 1
        val = newts if isinstance(m.get("created_at"), datetime) else newts.isoformat()
        await db.messages.update_one({"id": m["id"]}, {"$set": {"created_at": val}})

    # ensure no unread for review->admin so nudge indicator shows (unreadCount === 0)
    await db.messages.update_many({"match_id": MATCH, "receiver_id": ADMIN}, {"$set": {"read": True}})

    final = await db.messages.find({"match_id": MATCH}, {"_id": 0}).sort("created_at", -1).limit(3).to_list(None)
    print("After seed, last 3:")
    for m in final:
        print(" ", repr(m.get("created_at")), m.get("sender_id"), str(m.get("content"))[:50])
    client.close()


asyncio.run(main())
