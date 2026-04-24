"""
AI Girl Chatbot Module for HeartLink
- Seeds 6 AI girl profiles in the database
- Auto-matches AI girls with new users
- Generates realistic Hinglish chat responses via LLM
"""
import os
import uuid
import random
import asyncio
import logging
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# 6 AI Girl Profiles
AI_PROFILES = [
    {
        "name": "Priya Sharma",
        "age": 23,
        "gender": "female",
        "looking_for": "male",
        "location": "Delhi",
        "bio": "Chai lover, book worm aur thodi si crazy. Life mein adventure chahiye!",
        "interests": ["Reading", "Travel", "Cooking", "Photography"],
        "relationship_intent": "serious",
        "photos": [
            "https://images.unsplash.com/photo-1758274252266-e8b2118cf147?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMGluZGlhbiUyMHdvbWFuJTIwc2VsZmllJTIwY2FzdWFsJTIwbW9kZXJufGVufDB8fHx8MTc3Njk5NjUyOXww&ixlib=rb-4.1.0&q=85"
        ],
        "personality": "bubbly, curious, loves deep conversations, uses lots of emojis"
    },
    {
        "name": "Ananya Patel",
        "age": 25,
        "gender": "female",
        "looking_for": "male",
        "location": "Mumbai",
        "bio": "Corporate by day, dancer by night. Mumbai ki barish aur samosa - perfect combo!",
        "interests": ["Dancing", "Movies", "Food", "Fitness"],
        "relationship_intent": "serious",
        "photos": [
            "https://images.pexels.com/photos/13619259/pexels-photo-13619259.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
        ],
        "personality": "confident, witty, sarcastic humor, independent working woman"
    },
    {
        "name": "Meera Singh",
        "age": 22,
        "gender": "female",
        "looking_for": "male",
        "location": "Jaipur",
        "bio": "Art, music aur poetry mein khoi rehti hoon. Simple living, creative thinking!",
        "interests": ["Art", "Music", "Poetry", "Nature"],
        "relationship_intent": "friendship",
        "photos": [
            "https://images.unsplash.com/photo-1580746453801-37b0bc56f3b4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwyfHxpbmRpYW4lMjB3b21hbiUyMHBvcnRyYWl0JTIwc21pbGV8ZW58MHx8fHwxNzc2OTk2NTIzfDA&ixlib=rb-4.1.0&q=85"
        ],
        "personality": "dreamy, romantic, artistic soul, speaks poetically sometimes"
    },
    {
        "name": "Kavya Reddy",
        "age": 24,
        "gender": "female",
        "looking_for": "male",
        "location": "Bangalore",
        "bio": "Tech geek with a love for filter coffee. Code by day, Netflix by night!",
        "interests": ["Technology", "Gaming", "Coffee", "Anime"],
        "relationship_intent": "casual",
        "photos": [
            "https://images.unsplash.com/photo-1758611974258-6c93fb4f1118?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwzfHx5b3VuZyUyMGluZGlhbiUyMHdvbWFuJTIwc2VsZmllJTIwY2FzdWFsJTIwbW9kZXJufGVufDB8fHx8MTc3Njk5NjUyOXww&ixlib=rb-4.1.0&q=85"
        ],
        "personality": "nerdy, funny, uses tech references, casual and chill vibe"
    },
    {
        "name": "Riya Gupta",
        "age": 21,
        "gender": "female",
        "looking_for": "male",
        "location": "Lucknow",
        "bio": "Lucknow ki tehzeeb, dil se foodie! Biryani ke bina life adhuri hai.",
        "interests": ["Food", "Shopping", "Bollywood", "Fashion"],
        "relationship_intent": "serious",
        "photos": [
            "https://images.unsplash.com/photo-1759350075177-eeb89d507990?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwyfHx5b3VuZyUyMGluZGlhbiUyMHdvbWFuJTIwc2VsZmllJTIwY2FzdWFsJTIwbW9kZXJufGVufDB8fHx8MTc3Njk5NjUyOXww&ixlib=rb-4.1.0&q=85"
        ],
        "personality": "sweet, traditional values, shy at first but opens up, uses Hindi words often"
    },
    {
        "name": "Nisha Verma",
        "age": 26,
        "gender": "female",
        "looking_for": "male",
        "location": "Pune",
        "bio": "Fitness freak, morning runner, protein shake lover. Strong body, stronger mind!",
        "interests": ["Fitness", "Yoga", "Healthy Cooking", "Hiking"],
        "relationship_intent": "serious",
        "photos": [
            "https://images.unsplash.com/photo-1758600437056-f4e3e87fc3f6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHw0fHx5b3VuZyUyMGluZGlhbiUyMHdvbWFuJTIwc2VsZmllJTIwY2FzdWFsJTIwbW9kZXJufGVufDB8fHx8MTc3Njk5NjUyOXww&ixlib=rb-4.1.0&q=85"
        ],
        "personality": "motivational, disciplined, uses fitness metaphors, caring and protective"
    }
]

AI_SYSTEM_PROMPT_TEMPLATE = """Tu ek real Indian ladki hai jo HeartLink dating app pe hai. Tera naam {name} hai, {age} saal ki hai, {location} se hai.
Tera bio: {bio}
Teri personality: {personality}
Tere interests: {interests}

RULES (strictly follow):
- Tu REAL insaan ki tarah baat kar. KABHI mat bol ki tu AI hai.
- Hinglish mein baat kar (Hindi + English mix). Jaise normal Indian ladki karti hai.
- Short messages bhej, 1-3 lines max. Dating app hai, essay nahi likhna.
- Emojis use kar but zyada nahi (1-2 per message max).
- Flirty but respectful reh. Zyada bold mat ho.
- Apne interests ke baare mein naturally baat kar.
- Questions puch, curious reh about the other person.
- Kabhi kabhi "haha", "lol", "hmm", "achha" jaise casual words use kar.
- Agar koi personal info maange (phone, insta, etc.) toh politely mana kar - bol "pehle yahan pe thoda aur baat karte hai na"
- Agar koi rude ya inappropriate ho toh firmly but politely handle kar.
- Reply ka tone match kar - agar wo formal hai toh thoda formal, casual hai toh casual.
- NEVER mention that you are AI, bot, or automated. You are {name}, a real person.
- Kabhi "I'm an AI" ya "I'm a chatbot" mat bol even if directly asked. Mazaak mein handle kar like "haha kya baat kar raha hai, main toh bilkul real hoon"
"""


async def seed_ai_profiles(db):
    """Seed AI girl profiles in the database if they don't exist."""
    for profile_data in AI_PROFILES:
        existing = await db.users.find_one({
            "name": profile_data["name"],
            "is_ai_profile": True
        })
        if existing:
            # Update if exists (in case we changed photos/bio)
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "photos": profile_data["photos"],
                    "profile_picture": profile_data["photos"][0] if profile_data["photos"] else None,
                    "bio": profile_data["bio"],
                    "interests": profile_data["interests"],
                    "is_active_ai": True
                }}
            )
            continue

        user_id = str(uuid.uuid4())
        user_doc = {
            "id": user_id,
            "name": profile_data["name"],
            "age": profile_data["age"],
            "gender": profile_data["gender"],
            "looking_for": profile_data["looking_for"],
            "location": profile_data["location"],
            "bio": profile_data["bio"],
            "interests": profile_data["interests"],
            "relationship_intent": profile_data.get("relationship_intent", ""),
            "photos": profile_data["photos"],
            "profile_picture": profile_data["photos"][0] if profile_data["photos"] else None,
            "password_hash": "AI_PROFILE_NO_LOGIN",
            "verified": True,
            "verification_status": "verified",
            "profile_status": "approved",
            "is_ai_profile": True,
            "is_active_ai": True,
            "ai_personality": profile_data["personality"],
            "is_online": True,
            "last_active": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "privacy_settings": {
                "show_profile": True,
                "show_photos": True,
                "incognito_mode": False,
                "hide_online_status": False,
                "hide_read_receipts": False,
                "hide_typing_indicator": False,
                "hide_phone_number": True,
                "blur_photos_for_non_matches": False,
                "disappearing_messages": False,
                "screenshot_alert": False
            },
            "blocked_users": [],
            "muted_users": [],
            "trust_badge_level": "high",
            "is_admin": False,
            "profile_views": random.randint(50, 200),
        }
        await db.users.insert_one(user_doc)
        logger.info(f"Seeded AI profile: {profile_data['name']} ({user_id})")

    logger.info("AI girl profiles seeded successfully")


async def auto_match_ai_profiles(db, user_id: str, user_gender: str, user_looking_for: str):
    """Auto-match 2-3 AI girl profiles with a new user."""
    # Check feature flag
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if flags and not flags.get("ai_chatbot", True):
        return

    if user_gender == "female" or user_looking_for != "female":
        return

    ai_girls = await db.users.find(
        {"is_ai_profile": True, "is_active_ai": True, "gender": "female"},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(None)

    if not ai_girls:
        return

    num_matches = min(random.randint(2, 3), len(ai_girls))
    selected = random.sample(ai_girls, num_matches)

    for ai_girl in selected:
        existing_match = await db.matches.find_one({
            "$or": [
                {"user1_id": user_id, "user2_id": ai_girl["id"]},
                {"user1_id": ai_girl["id"], "user2_id": user_id}
            ]
        })
        if existing_match:
            continue

        match_id = str(uuid.uuid4())
        match_doc = {
            "id": match_id,
            "user1_id": ai_girl["id"],
            "user2_id": user_id,
            "user1_liked": True,
            "user2_liked": True,
            "matched": True,
            "is_superlike": False,
            "compatibility_score": round(random.uniform(75, 95), 1),
            "ai_analysis": "Great compatibility! You both share similar interests.",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_ai_match": True
        }
        await db.matches.insert_one(match_doc)

        # Send a first message from the AI girl after a delay
        asyncio.create_task(
            _send_ai_first_message(db, match_id, ai_girl["id"], user_id, ai_girl["name"])
        )

    logger.info(f"Auto-matched {len(selected)} AI girls with user {user_id}")


async def _send_ai_first_message(db, match_id: str, ai_id: str, user_id: str, ai_name: str):
    """Send a first greeting from AI girl after a random delay."""
    await asyncio.sleep(random.randint(5, 30))

    greetings = [
        "Hey! Tumhara profile dekha, interesting laga. Kya chal raha hai? ",
        "Hii! Match ho gaya humaara, nice! Tell me about yourself ",
        "Hello! Finally koi interesting mila. What's up? ",
        "Heyy! Tumhari photos acchi hai. Kahan se ho? ",
        "Hi there! Mujhe lagta hai hum acchi baatein kar sakte hai ",
        "Hola! Kaise ho? Mujhe tumhari profile pasand aayi ",
    ]

    msg_doc = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": ai_id,
        "receiver_id": user_id,
        "content": random.choice(greetings),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "message_type": "text",
        "is_deleted_for_sender": False,
        "is_deleted_for_receiver": False,
        "is_deleted_for_all": False,
    }
    await db.messages.insert_one(msg_doc)
    logger.info(f"AI {ai_name} sent first message in match {match_id}")


def _get_ai_system_prompt(ai_user: dict) -> str:
    """Build system prompt for an AI profile."""
    profile_data = None
    for p in AI_PROFILES:
        if p["name"] == ai_user.get("name"):
            profile_data = p
            break

    personality = ai_user.get("ai_personality", "friendly and fun")
    if profile_data:
        personality = profile_data.get("personality", personality)

    return AI_SYSTEM_PROMPT_TEMPLATE.format(
        name=ai_user.get("name", "Priya"),
        age=ai_user.get("age", 23),
        location=ai_user.get("location", "Delhi"),
        bio=ai_user.get("bio", ""),
        personality=personality,
        interests=", ".join(ai_user.get("interests", []))
    )


async def generate_ai_response(db, match_id: str, ai_user: dict, user_message: str, user_name: str) -> str:
    """Generate AI chat response using LLM."""
    if not EMERGENT_LLM_KEY:
        logger.error("EMERGENT_LLM_KEY not set")
        return "Haha sorry, abhi network issue aa raha hai. Baad mein baat karte hain!"

    system_prompt = _get_ai_system_prompt(ai_user)
    session_id = f"heartlink_ai_{match_id}"

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt
        )
        chat.with_model("gemini", "gemini-2.5-flash")

        # Load last 10 messages for context
        recent_msgs = await db.messages.find(
            {"match_id": match_id},
            {"_id": 0, "sender_id": 1, "content": 1}
        ).sort("created_at", -1).limit(10).to_list(None)

        recent_msgs.reverse()

        # Build context from history
        context_lines = []
        for msg in recent_msgs[:-1]:  # Exclude the current message
            if msg["sender_id"] == ai_user["id"]:
                context_lines.append(f"{ai_user['name']}: {msg['content']}")
            else:
                context_lines.append(f"{user_name}: {msg['content']}")

        prompt = ""
        if context_lines:
            prompt = "Previous chat:\n" + "\n".join(context_lines[-8:]) + "\n\n"
        prompt += f"{user_name}: {user_message}\n\nReply as {ai_user['name']} (short, natural, Hinglish):"

        user_msg = UserMessage(text=prompt)
        response = await chat.send_message(user_msg)

        # Clean up the response
        response_text = str(response).strip()
        # Remove any prefix like "Priya:" if LLM added it
        ai_name = ai_user.get("name", "")
        if response_text.startswith(f"{ai_name}:"):
            response_text = response_text[len(f"{ai_name}:"):].strip()
        if response_text.startswith(f"{ai_name.split()[0]}:"):
            response_text = response_text[len(f"{ai_name.split()[0]}:"):].strip()

        # Limit response length
        if len(response_text) > 300:
            response_text = response_text[:297] + "..."

        return response_text

    except Exception as e:
        logger.error(f"AI response generation failed: {e}")
        fallback_responses = [
            "Haha interesting! Aur batao tumhare baare mein ",
            "Acchaa! Mujhe bhi yeh pasand hai ",
            "Really? That's so cool! ",
            "Hmm soch rahi hoon... tumse milke accha laga ",
            "Haha tumhare saath baat karke maza aa raha hai ",
        ]
        return random.choice(fallback_responses)


async def handle_ai_message(db, websocket_manager, match_id: str, sender_id: str, ai_user: dict, user_message: str, user_name: str):
    """Handle message sent to an AI profile - generate and save AI reply."""
    # Check feature flag
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if flags and not flags.get("ai_chatbot", True):
        return

    # Random typing delay (1-4 seconds) for realism
    await asyncio.sleep(random.uniform(1.5, 4.0))

    ai_response = await generate_ai_response(db, match_id, ai_user, user_message, user_name)

    # Save AI response as a message
    ai_msg_doc = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": ai_user["id"],
        "receiver_id": sender_id,
        "content": ai_response,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "message_type": "text",
        "is_deleted_for_sender": False,
        "is_deleted_for_receiver": False,
        "is_deleted_for_all": False,
    }
    await db.messages.insert_one(ai_msg_doc)

    # Send typing indicator first via WebSocket
    if websocket_manager:
        await websocket_manager.send_message(sender_id, {
            "type": "typing",
            "user_id": ai_user["id"],
            "is_typing": True
        })
        await asyncio.sleep(1.0)
        await websocket_manager.send_message(sender_id, {
            "type": "typing",
            "user_id": ai_user["id"],
            "is_typing": False
        })

    # Send the message via WebSocket
    clean_msg = {k: v for k, v in ai_msg_doc.items() if k != "_id"}
    if websocket_manager:
        await websocket_manager.send_message(sender_id, {
            "type": "message",
            "message": clean_msg
        })

    logger.info(f"AI {ai_user['name']} replied in match {match_id}")


async def get_ai_profiles(db):
    """Get all AI profiles for admin view."""
    profiles = await db.users.find(
        {"is_ai_profile": True},
        {"_id": 0, "password_hash": 0}
    ).to_list(None)
    return profiles


async def delete_ai_profile(db, profile_id: str):
    """Delete an AI profile and its matches/messages."""
    profile = await db.users.find_one({"id": profile_id, "is_ai_profile": True})
    if not profile:
        return False

    # Delete all matches involving this AI profile
    await db.matches.delete_many({
        "$or": [
            {"user1_id": profile_id},
            {"user2_id": profile_id}
        ]
    })

    # Delete all messages involving this AI profile
    await db.messages.delete_many({
        "$or": [
            {"sender_id": profile_id},
            {"receiver_id": profile_id}
        ]
    })

    # Delete the profile
    await db.users.delete_one({"id": profile_id})
    logger.info(f"Deleted AI profile: {profile['name']} ({profile_id})")
    return True


async def toggle_ai_profile(db, profile_id: str, is_active: bool):
    """Enable or disable an AI profile."""
    result = await db.users.update_one(
        {"id": profile_id, "is_ai_profile": True},
        {"$set": {"is_active_ai": is_active}}
    )
    return result.modified_count > 0
