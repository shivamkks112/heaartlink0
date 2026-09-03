"""
Welcome Message Routes — Smart welcome system for new and returning users
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from database import db

router = APIRouter()

DEFAULT_WELCOME_SETTINGS = {
    "type": "welcome_messages",
    "new_user_enabled": True,
    "new_user_title": "Welcome to HeartLink",
    "new_user_message": "We're happy to have you here. Complete your profile, discover interesting people and start making meaningful connections.",
    "new_user_cta": "Explore HeartLink",
    "returning_user_enabled": True,
    "returning_user_title": "Welcome back, {firstName}!",
    "returning_user_message": "We've missed you. See who's new, check your matches and continue your conversations.",
    "returning_user_cta": "Continue Exploring",
    "returning_inactivity_days": 7,
}


@router.get("/welcome-check/{user_id}")
async def check_welcome_message(user_id: str):
    """Check if the user should see a welcome message."""
    user = await db.users.find_one({"id": user_id}, {
        "_id": 0, "id": 1, "name": 1, "welcome_shown_at": 1,
        "welcome_back_shown_at": 1, "last_active": 1, "prev_last_active": 1, "created_at": 1
    })
    if not user:
        return {"show": False}

    settings = await db.app_settings.find_one({"type": "welcome_messages"}, {"_id": 0})
    if not settings:
        settings = {**DEFAULT_WELCOME_SETTINGS}
        await db.app_settings.insert_one({**settings})

    first_name = (user.get("name") or "").split()[0] if user.get("name") else ""

    if not user.get("welcome_shown_at") and settings.get("new_user_enabled", True):
        title = settings.get("new_user_title", DEFAULT_WELCOME_SETTINGS["new_user_title"])
        msg = settings.get("new_user_message", DEFAULT_WELCOME_SETTINGS["new_user_message"])
        cta = settings.get("new_user_cta", DEFAULT_WELCOME_SETTINGS["new_user_cta"])
        title = title.replace("{firstName}", first_name).replace("{fullName}", user.get("name", ""))
        msg = msg.replace("{firstName}", first_name).replace("{fullName}", user.get("name", ""))
        return {"show": True, "type": "new_user", "title": title, "message": msg, "cta": cta}

    if settings.get("returning_user_enabled", True):
        inactivity_days = settings.get("returning_inactivity_days", 7)
        last_active = user.get("prev_last_active") or user.get("last_active")
        welcome_back_at = user.get("welcome_back_shown_at")
        if last_active:
            try:
                last_active_dt = datetime.fromisoformat(last_active.replace("Z", "+00:00"))
                days_inactive = (datetime.now(timezone.utc) - last_active_dt).days
                if days_inactive >= inactivity_days:
                    if welcome_back_at:
                        wb_dt = datetime.fromisoformat(welcome_back_at.replace("Z", "+00:00"))
                        if (datetime.now(timezone.utc) - wb_dt).days < inactivity_days:
                            return {"show": False}
                    title = settings.get("returning_user_title", DEFAULT_WELCOME_SETTINGS["returning_user_title"])
                    msg = settings.get("returning_user_message", DEFAULT_WELCOME_SETTINGS["returning_user_message"])
                    cta = settings.get("returning_user_cta", DEFAULT_WELCOME_SETTINGS["returning_user_cta"])
                    title = title.replace("{firstName}", first_name).replace("{fullName}", user.get("name", ""))
                    msg = msg.replace("{firstName}", first_name).replace("{fullName}", user.get("name", ""))
                    return {"show": True, "type": "welcome_back", "title": title, "message": msg, "cta": cta}
            except Exception:
                pass

    return {"show": False}


@router.post("/welcome-shown/{user_id}")
async def mark_welcome_shown(user_id: str, request: Request):
    """Mark that the welcome message has been shown."""
    try:
        data = await request.json()
    except Exception:
        data = {}

    welcome_type = data.get("type", "new_user")
    now = datetime.now(timezone.utc).isoformat()

    if welcome_type == "new_user":
        await db.users.update_one({"id": user_id}, {"$set": {"welcome_shown_at": now}})
        await db.app_settings.update_one({"type": "welcome_analytics"}, {"$inc": {"new_user_welcome_shown": 1}}, upsert=True)
    elif welcome_type == "welcome_back":
        await db.users.update_one({"id": user_id}, {"$set": {"welcome_back_shown_at": now}})
        await db.app_settings.update_one({"type": "welcome_analytics"}, {"$inc": {"welcome_back_shown": 1}}, upsert=True)

    return {"status": "ok"}


@router.post("/welcome-clicked/{user_id}")
async def mark_welcome_clicked(user_id: str, request: Request):
    """Track CTA click on welcome message."""
    try:
        data = await request.json()
    except Exception:
        data = {}

    welcome_type = data.get("type", "new_user")
    field = "new_user_welcome_clicked" if welcome_type == "new_user" else "welcome_back_clicked"
    await db.app_settings.update_one({"type": "welcome_analytics"}, {"$inc": {field: 1}}, upsert=True)
    return {"status": "ok"}


@router.get("/admin/welcome-settings")
async def get_welcome_settings():
    """Get welcome message settings for admin."""
    settings = await db.app_settings.find_one({"type": "welcome_messages"}, {"_id": 0})
    if not settings:
        settings = {**DEFAULT_WELCOME_SETTINGS}
        await db.app_settings.insert_one({**settings})

    analytics = await db.app_settings.find_one({"type": "welcome_analytics"}, {"_id": 0})
    return {
        "settings": {k: v for k, v in settings.items() if k != "type"},
        "analytics": {k: v for k, v in (analytics or {}).items() if k not in ("type", "_id")}
    }


@router.put("/admin/welcome-settings")
async def update_welcome_settings(request: Request):
    """Update welcome message settings from admin."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    allowed_keys = {
        "new_user_enabled", "new_user_title", "new_user_message", "new_user_cta",
        "returning_user_enabled", "returning_user_title", "returning_user_message",
        "returning_user_cta", "returning_inactivity_days"
    }
    updates = {k: v for k, v in data.items() if k in allowed_keys}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid settings provided")

    await db.app_settings.update_one({"type": "welcome_messages"}, {"$set": updates}, upsert=True)
    settings = await db.app_settings.find_one({"type": "welcome_messages"}, {"_id": 0})
    return {k: v for k, v in settings.items() if k != "type"}
