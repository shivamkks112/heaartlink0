"""
Boost Routes — Profile boost system
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from database import db, invalidate_user_cache

router = APIRouter()


@router.post("/boost/{user_id}")
async def activate_boost(user_id: str):
    """Activate a 30-minute profile boost (1 free per day)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "last_boost": 1, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    last_boost = user.get("last_boost")
    if last_boost:
        try:
            lb = datetime.fromisoformat(last_boost.replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - lb).total_seconds() < 86400:
                raise HTTPException(status_code=429, detail="Daily boost already used. Try again tomorrow or upgrade to Premium.")
        except (ValueError, TypeError):
            pass

    boost_end = datetime.now(timezone.utc) + timedelta(minutes=30)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_boosted": True,
            "profile_boost_end": boost_end.isoformat(),
            "last_boost": datetime.now(timezone.utc).isoformat()
        }}
    )
    invalidate_user_cache(user_id)
    return {"success": True, "boost_end": boost_end.isoformat(), "duration_minutes": 30}


@router.get("/boost/{user_id}/status")
async def get_boost_status(user_id: str):
    """Get current boost status"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "is_boosted": 1, "profile_boost_end": 1, "last_boost": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_active = False
    remaining_seconds = 0
    boost_end = user.get("profile_boost_end")

    if boost_end:
        try:
            end_time = datetime.fromisoformat(boost_end.replace("Z", "+00:00"))
            remaining = (end_time - datetime.now(timezone.utc)).total_seconds()
            if remaining > 0:
                is_active = True
                remaining_seconds = int(remaining)
            else:
                if user.get("is_boosted"):
                    await db.users.update_one({"id": user_id}, {"$set": {"is_boosted": False}})
        except (ValueError, TypeError):
            pass

    can_boost = True
    last_boost = user.get("last_boost")
    if last_boost:
        try:
            lb = datetime.fromisoformat(last_boost.replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - lb).total_seconds() < 86400:
                can_boost = False
        except (ValueError, TypeError):
            pass

    return {
        "is_active": is_active,
        "remaining_seconds": remaining_seconds,
        "can_boost_free": can_boost,
        "boost_end": boost_end
    }
