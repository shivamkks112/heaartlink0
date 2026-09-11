"""
Girls Safety Module for HeartLink
- Creepy Message Detection (AI-based)
- Night Mode Safety (11pm-6am IST block for new matches)
- Safe Word Emergency System
"""
import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("safety")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# ── SAFE WORD CONFIG ──
DEFAULT_SAFE_WORDS = ["heartlink sos", "hl sos", "i feel unsafe"]

# ── NIGHT MODE CONFIG ──
NIGHT_START_HOUR = 23  # 11 PM IST
NIGHT_END_HOUR = 6     # 6 AM IST
NEW_MATCH_HOURS = 48   # Only block for matches < 48 hours old


async def check_creepy_message(content: str) -> dict:
    """Use AI to detect inappropriate/sexual/threatening messages.
    Returns: {"is_creepy": bool, "severity": "low"|"medium"|"high", "reason": str}
    """
    if not EMERGENT_LLM_KEY or len(content.strip()) < 3:
        return {"is_creepy": False, "severity": "none", "reason": ""}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"safety_check_{hash(content) % 10000}",
            system_message="""You are a content safety classifier for an Indian dating app. 
Classify the given message as SAFE or UNSAFE.

UNSAFE messages include:
- Sexual/vulgar content or requests
- Threats or intimidation
- Stalking language ("I know where you live", "I'm watching you")
- Extreme pressure for meeting/phone/photos
- Abusive language, slurs, derogatory terms
- Unsolicited sexual advances

SAFE messages include:
- Normal flirting, compliments
- Asking about interests, hobbies, plans
- Casual conversation, jokes
- Expressing feelings politely

Respond ONLY in this exact JSON format, nothing else:
{"unsafe": true/false, "severity": "low/medium/high", "reason": "brief reason"}

If safe: {"unsafe": false, "severity": "none", "reason": ""}"""
        )
        chat.with_model("gemini", "gemini-2.5-flash")

        response = await chat.send_message(UserMessage(text=f"Classify: \"{content}\""))
        resp_text = str(response).strip()

        # Parse JSON response
        import json
        # Extract JSON from response
        start = resp_text.find('{')
        end = resp_text.rfind('}') + 1
        if start >= 0 and end > start:
            result = json.loads(resp_text[start:end])
            return {
                "is_creepy": result.get("unsafe", False),
                "severity": result.get("severity", "none"),
                "reason": result.get("reason", "")
            }

    except Exception as e:
        logger.error(f"Creepy message check failed: {e}")

    return {"is_creepy": False, "severity": "none", "reason": ""}


async def handle_creepy_detection(db, sender_id: str, receiver_id: str, match_id: str, content: str, ws_manager=None):
    """Full flow: detect → warn sender → increment warnings → auto-ban at 3."""
    result = await check_creepy_message(content)

    if not result["is_creepy"]:
        return False  # Message is safe

    severity = result["severity"]
    reason = result["reason"]

    # Increment warning count
    await db.users.update_one(
        {"id": sender_id},
        {"$inc": {"safety_warnings": 1}}
    )

    sender = await db.users.find_one({"id": sender_id}, {"_id": 0, "safety_warnings": 1, "name": 1})
    warning_count = sender.get("safety_warnings", 1)

    # Send warning to sender via WS
    if ws_manager:
        if warning_count >= 3:
            warn_msg = f"Your account has been suspended for repeated inappropriate behavior. Warning #{warning_count}."
        elif severity == "high":
            warn_msg = f"Your message was flagged as inappropriate. This is warning #{warning_count}/3. One more and your account will be suspended."
        else:
            warn_msg = f"Please keep conversations respectful. Warning #{warning_count}/3."

        await ws_manager.send_message(sender_id, {
            "type": "system_warning",
            "message": f"⚠️ {warn_msg}"
        })

    # Notify receiver (girl) — option to report
    if ws_manager:
        await ws_manager.send_message(receiver_id, {
            "type": "safety_alert",
            "message": "A message was flagged as inappropriate and blocked.",
            "sender_id": sender_id,
            "match_id": match_id,
            "action": "report_option"
        })

    # Log for admin
    await db.safety_reports.insert_one({
        "type": "ai_detection",
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "match_id": match_id,
        "content": content,
        "severity": severity,
        "reason": reason,
        "warning_number": warning_count,
        "auto_action": "banned" if warning_count >= 3 else "warned",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Auto-ban at 3 warnings
    if warning_count >= 3:
        await db.users.update_one(
            {"id": sender_id},
            {"$set": {"is_blocked": True, "block_reason": "Auto-banned: 3 inappropriate message warnings", "blocked_at": datetime.now(timezone.utc).isoformat()}}
        )
        logger.warning(f"AUTO-BANNED user {sender_id} after {warning_count} warnings")
        
        # Notify admins about auto-ban
        try:
            admin_users = await db.users.find({"is_admin": True}, {"_id": 0, "id": 1}).to_list(None)
            if admin_users:
                import fcm_service
                await fcm_service.send_to_users(
                    db, [a["id"] for a in admin_users],
                    title="Auto-Ban: 3 Warnings",
                    body=f"User {sender_id[:8]}... auto-banned after 3 inappropriate message warnings.",
                    data={"type": "admin_alert", "alert_type": "auto_ban", "route": "/admin"}
                )
        except Exception as e:
            logger.error(f"Admin auto-ban FCM failed: {e}")

    logger.info(f"Creepy message detected from {sender_id}: severity={severity}, warning #{warning_count}")
    return True  # Message was blocked


def is_night_mode_ist() -> bool:
    """Check if current IST time is between 11pm-6am."""
    ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(ist)
    return now_ist.hour >= NIGHT_START_HOUR or now_ist.hour < NIGHT_END_HOUR


async def check_night_mode_block(db, sender_id: str, receiver_id: str, match_id: str) -> tuple:
    """Returns (blocked: bool, reason: str). Blocks new match boys messaging girls at night."""
    if not is_night_mode_ist():
        return False, ""

    # Check if receiver is female and has night mode enabled
    receiver = await db.users.find_one(
        {"id": receiver_id},
        {"_id": 0, "gender": 1, "night_safety_enabled": 1}
    )
    if not receiver or receiver.get("gender", "").lower() != "female":
        return False, ""
    if not receiver.get("night_safety_enabled", True):  # Default ON for girls
        return False, ""

    # Check if sender is male
    sender = await db.users.find_one({"id": sender_id}, {"_id": 0, "gender": 1})
    if not sender or sender.get("gender", "").lower() != "male":
        return False, ""

    # Check match age — only block for new matches (< 48 hours)
    match_doc = await db.matches.find_one({"id": match_id}, {"_id": 0, "created_at": 1})
    if match_doc and match_doc.get("created_at"):
        try:
            match_created = datetime.fromisoformat(match_doc["created_at"].replace("Z", "+00:00"))
            hours_since = (datetime.now(timezone.utc) - match_created).total_seconds() / 3600
            if hours_since >= NEW_MATCH_HOURS:
                return False, ""  # Old match, allow
        except Exception:
            pass

    return True, ""


async def check_safe_word(db, sender_id: str, receiver_id: str, match_id: str, content: str, ws_manager=None) -> bool:
    """Check if a girl typed the safe word. Returns True if triggered."""
    content_lower = content.strip().lower()

    # Get admin-configured safe words or use defaults
    config = await db.app_settings.find_one({"type": "safety_config"}, {"_id": 0})
    safe_words = DEFAULT_SAFE_WORDS
    if config and config.get("safe_words"):
        safe_words = config["safe_words"]

    triggered = any(sw in content_lower for sw in safe_words)
    if not triggered:
        return False

    # Verify sender is female
    sender = await db.users.find_one({"id": sender_id}, {"_id": 0, "gender": 1, "name": 1})
    if not sender or sender.get("gender", "").lower() != "female":
        return False

    # EMERGENCY: Block the other user from girl's perspective
    await db.users.update_one(
        {"id": sender_id},
        {"$addToSet": {"blocked_users": receiver_id}}
    )

    # Auto-report
    await db.safety_reports.insert_one({
        "type": "safe_word_triggered",
        "triggered_by": sender_id,
        "reported_user": receiver_id,
        "match_id": match_id,
        "safe_word_used": content_lower,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending_review"
    })

    # Notify admin
    await db.admin_alerts.insert_one({
        "type": "safe_word_emergency",
        "girl_id": sender_id,
        "girl_name": sender.get("name", "Unknown"),
        "reported_user_id": receiver_id,
        "match_id": match_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    })

    # Notify admin via FCM push
    try:
        admin_users = await db.users.find(
            {"is_admin": True},
            {"_id": 0, "id": 1}
        ).to_list(None)
        admin_ids = [a["id"] for a in admin_users]
        if admin_ids:
            import fcm_service
            await fcm_service.send_to_users(
                db, admin_ids,
                title="EMERGENCY: Safe Word Triggered",
                body=f"{sender.get('name', 'A user')} triggered safe word against user {receiver_id[:8]}...",
                data={"type": "admin_alert", "alert_type": "safe_word_emergency", "route": "/admin"}
            )
    except Exception as e:
        logger.error(f"Admin FCM alert failed: {e}")

    # Send confirmation to girl via WS
    if ws_manager:
        await ws_manager.send_message(sender_id, {
            "type": "system_warning",
            "message": "User has been blocked and reported. You are safe. Our team will review this immediately."
        })

    logger.warning(f"SAFE WORD triggered by {sender_id} against {receiver_id}")
    return True
