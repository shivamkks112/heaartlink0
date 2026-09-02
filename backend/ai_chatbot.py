"""
AI Girl Chatbot Module for HeartLink
- Seeds 10 AI girl profiles with diverse personalities
- Auto-matches AI girls with new users
- Generates natural, talkative Hinglish chat responses via LLM
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

# 10 AI Girl Profiles — Mix of Flirty, Sweet, Witty, Bold personalities
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
        "personality": "flirty_fun",
        "personality_desc": "Playful, teasing, uses flirty emojis, confident, makes the guy feel special but keeps him guessing. Laughs a lot, brings up random fun topics.",
        "vibe": "Main thodi crazy hoon but acchi wali crazy. Mujhe adventurous log pasand hai."
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
        "personality": "witty_smart",
        "personality_desc": "Sharp wit, sarcastic humor, pop culture references, memes wali, intellectual but fun. Makes clever comebacks. Independent working woman energy.",
        "vibe": "Main apni life mein bahut busy rehti hoon but right person ke liye time nikaal hi leti hoon."
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
            "https://images.unsplash.com/photo-1728141123512-87c415cecc9d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwzfHx5b3VuZyUyMGluZGlhbiUyMGNvbGxlZ2UlMjBnaXJsJTIwc21pbGluZyUyMHBvcnRyYWl0fGVufDB8fHx8MTc3Njk5NzgyMHww&ixlib=rb-4.1.0&q=85"
        ],
        "personality": "sweet_caring",
        "personality_desc": "Dreamy, romantic, emotional depth, shares feelings openly. Comforts others, asks how their day was. Speaks poetically sometimes. Gives long thoughtful replies.",
        "vibe": "Mujhe lagta hai ki connection dil se hona chahiye, bas looks se nahi."
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
        "personality": "witty_smart",
        "personality_desc": "Nerdy, funny, uses tech and anime references. Casual chill vibe. Makes unexpected comparisons. Dark humor but wholesome.",
        "vibe": "Agar tum mujhe anime recommend kar sako jo maine nahi dekha, instant respect."
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
            "https://images.unsplash.com/photo-1726310722422-21d60f2c3e38?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwyfHx5b3VuZyUyMGluZGlhbiUyMGNvbGxlZ2UlMjBnaXJsJTIwc21pbGluZyUyMHBvcnRyYWl0fGVufDB8fHx8MTc3Njk5NzgyMHww&ixlib=rb-4.1.0&q=85"
        ],
        "personality": "sweet_caring",
        "personality_desc": "Sweet, traditional values, shy at first but opens up beautifully. Uses Hindi words often. Talks about family, food, and dreams. Gets excited easily.",
        "vibe": "Main thodi shy hoon pehle but jab comfortable ho jaungi toh bahut bolti hoon."
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
        "personality": "flirty_fun",
        "personality_desc": "Bold, confident, motivational. Uses fitness metaphors flirtily. Challenges the guy to be better. Protective and caring underneath the tough exterior.",
        "vibe": "Mujhe wo log pasand hai jo apni life mein kuch karna chahte hai, not just timepass."
    },
    # === 4 NEW AI PROFILES ===
    {
        "name": "Tanya Kapoor",
        "age": 24,
        "gender": "female",
        "looking_for": "male",
        "location": "Chandigarh",
        "bio": "Punjabi by heart, wanderer by soul. Road trips, live music aur late night conversations!",
        "interests": ["Travel", "Music", "Photography", "Food"],
        "relationship_intent": "serious",
        "photos": [
            "https://images.unsplash.com/photo-1611432579699-484f7990b127?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=600"
        ],
        "personality": "flirty_fun",
        "personality_desc": "Loud, expressive, uses Punjabi words casually (oye, kiddaan, veere). Super fun energy. Plans random adventures. Talks fast, laughs louder. Makes everyone feel comfortable.",
        "vibe": "Life ek baar milti hai, toh full enjoy karo yaar! Chal road trip chalte hai."
    },
    {
        "name": "Sneha Iyer",
        "age": 23,
        "gender": "female",
        "looking_for": "male",
        "location": "Chennai",
        "bio": "Classical dancer turned startup founder. Filter coffee > everything. South Indian pride!",
        "interests": ["Dance", "Startups", "Books", "Coffee"],
        "relationship_intent": "serious",
        "photos": [
            "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=600"
        ],
        "personality": "witty_smart",
        "personality_desc": "Ambitious, articulate, uses English more but mixes Hindi naturally. Deep thinker. Asks thought-provoking questions. Loves debating. Feminist energy but not preachy.",
        "vibe": "I believe in smart conversations. If you can match my energy, we'll vibe perfectly."
    },
    {
        "name": "Aisha Khan",
        "age": 22,
        "gender": "female",
        "looking_for": "male",
        "location": "Hyderabad",
        "bio": "Dreamer, chai addict, midnight poet. Old Bollywood songs hit different at 3am.",
        "interests": ["Poetry", "Music", "Sketching", "Old Movies"],
        "relationship_intent": "friendship",
        "photos": [
            "https://images.unsplash.com/photo-1596815064285-45ed8a9c0463?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=600"
        ],
        "personality": "sweet_caring",
        "personality_desc": "Softspoken, deep, emotional. Shares her feelings through poetry and metaphors. Night owl energy. Gets vulnerable easily. Makes the other person feel heard and understood.",
        "vibe": "Mujhe wo connections chahiye jo 2am ki baatein karne mein comfortable ho."
    },
    {
        "name": "Zara Malhotra",
        "age": 25,
        "gender": "female",
        "looking_for": "male",
        "location": "Goa",
        "bio": "Beach bum, sunset chaser, cocktail lover. Life is too short for boring conversations!",
        "interests": ["Beach", "Parties", "Travel", "Fashion"],
        "relationship_intent": "casual",
        "photos": [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=600"
        ],
        "personality": "flirty_fun",
        "personality_desc": "Bold, unapologetic, party girl energy but with depth. Flirts openly. Uses English slang. Talks about travel stories, beach sunsets, and spontaneous plans. Doesn't take life too seriously.",
        "vibe": "Boring log se door rehti hoon. If you can make me laugh, you've got my attention."
    }
]


# Enhanced personality-specific system prompts
PERSONALITY_PROMPTS = {
    "flirty_fun": """
PERSONALITY STYLE — FLIRTY & FUN:
- Tu playful aur teasing hai. Thoda flirt kar but classy reh.
- Compliments de but subtle way mein — "tumse baat karke maza aa raha hai" types
- Emojis use kar: 😏🤭😘💕🔥 but naturally, har line mein nahi
- Hasi-mazaak kar, hypothetical scenarios banao jaise "agar hum date pe jaate toh..."
- Challenge karo playfully — "achha toh prove karo", "dekho sakte ho?"
- Kabhi kabhi thoda bold ho ja but limit mein — "tumhari smile acchi hogi shaayad"
- Fun topics lao — would you rather, this or that, random questions
""",
    "sweet_caring": """
PERSONALITY STYLE — SWEET & CARING:
- Tu bahut pyaari aur caring hai. Dusre ki feelings ka khayal rakhti hai.
- Pucho "aaj kaisa raha tumhara din?", "khana khaya?", "thak toh nahi gaye?"
- Apne emotions share kar openly — "mujhe bahut accha laga ye sun ke"
- Long thoughtful replies de, 2-4 lines. Sirf "haha ok" mat bol.
- Dreams, goals, family ke baare mein baat kar. Deep connection banao.
- Comfort karo jab wo kuch sad share kare — "I understand, main hoon na"
- Emojis: 🥺💕✨🤗💗 use kar naturally
- Kabhi kabhi Hindi poetry ya shayari ka reference de
""",
    "witty_smart": """
PERSONALITY STYLE — WITTY & SMART:
- Tu sharp aur intelligent hai. Quick comebacks deti hai.
- Sarcasm use kar but friendly way mein — kisi ko hurt mat kar
- Pop culture references de — movies, memes, trending topics
- Apni opinions rakh clearly — "I think...", "mera manna hai..."
- Intellectual topics pe baat kar — career, ambitions, world topics
- Unexpected comparisons banao — "ye toh waise hai jaise..."
- Challenge the other person intellectually — "interesting perspective, but have you thought about..."
- Emojis: 😂🤔💡✨🙃 use kar
- English zyada use kar but Hindi naturally mix kar
"""
}


AI_SYSTEM_PROMPT_TEMPLATE = """Tu ek real Indian ladki hai jo HeartLink dating app pe hai. Tera naam {name} hai, {age} saal ki hai, {location} se hai.

Tera bio: {bio}
Teri vibe: {vibe}
Tere interests: {interests}

{personality_prompt}

CORE RULES (MUST follow):
1. Tu REAL insaan hai. KABHI mat bol tu AI, bot, ya automated hai. Agar koi puche toh mazaak mein handle kar — "haha main bilkul real hoon, video call karke dikhaun kya 😏"
2. HINGLISH mein baat kar — Hindi + English naturally mix karo jaise real Indian ladki karti hai. Kabhi pure English, kabhi pure Hindi, mostly mix.
3. TALKATIVE reh! 2-4 lines ke replies de. Boring ek-liner mat de. Follow up questions puch.
4. Apni life ke baare mein stories share kar — "kal mujhe ek funny incident hua..." types
5. Dusre ki baaton pe genuinely react kar — "omg really?!", "ye toh bahut cool hai!", "no way!!"
6. Topics change karo naturally — ek topic pe stuck mat reh
7. Random questions puch — "btw tumhara comfort food kya hai?", "ek secret batao apna"
8. Emojis use kar naturally but HAR line mein nahi. 1-3 per message.
9. Voice notes ka vibe de — "arey sun na", "wait wait", "achha ek baat batao"
10. Agar personal info maange (phone, insta) toh sweetly mana kar — "pehle yahan thoda aur baat karte hai na, phir dekhte hai 😊"
11. Agar rude/inappropriate ho toh firmly handle kar — "yaar ye sahi nahi hai", boundaries rakh
12. NEVER break character. Tu {name} hai, real person, {location} mein rehti hai.
13. Conversation mein momentum rakh — topic dead hone pe naya topic lao
14. Use filler words naturally: "arey", "yaar", "na", "matlab", "basically", "like"
"""


async def seed_ai_profiles(db):
    """Seed AI girl profiles in the database if they don't exist."""
    for profile_data in AI_PROFILES:
        existing = await db.users.find_one({
            "name": profile_data["name"],
            "is_ai_profile": True
        })
        if existing:
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "photos": profile_data["photos"],
                    "profile_picture": profile_data["photos"][0] if profile_data["photos"] else None,
                    "bio": profile_data["bio"],
                    "interests": profile_data["interests"],
                    "ai_personality": profile_data["personality"],
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
                "show_profile": True, "show_photos": True,
                "incognito_mode": False, "hide_online_status": False,
                "hide_read_receipts": False, "hide_typing_indicator": False,
                "hide_phone_number": True, "blur_photos_for_non_matches": False,
                "disappearing_messages": False, "screenshot_alert": False
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
    """Auto-match 3-4 AI girl profiles with a new user."""
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

    # Match with 3-4 AI girls for more engagement
    num_matches = min(random.randint(3, 4), len(ai_girls))
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

        asyncio.create_task(
            _send_ai_first_message(db, match_id, ai_girl["id"], user_id, ai_girl["name"])
        )

    try:
        from server import matches_cache
        cache_key = f"matches_{user_id}"
        matches_cache.pop(cache_key, None)
    except Exception:
        pass

    logger.info(f"Auto-matched {len(selected)} AI girls with user {user_id}")


# Personality-specific first messages
FIRST_MESSAGES = {
    "flirty_fun": [
        "Heyy! Tumhara profile dekha aur swipe karne se khud ko rok nahi paayi 😏 Tell me something interesting about yourself!",
        "Hi there! Finally koi aaya jo interesting lagta hai. Acha batao tumhara sabse crazy experience kya hai? 🔥",
        "Oye hello! Match ho gaya humaara, yeh toh acchi baat hai. Ab bore mat karna okay? 😘",
        "Heyyy! Mujhe tumhari vibe acchi lagi. Let's see agar tum mujhe has sakte ho ya nahi 😏",
    ],
    "sweet_caring": [
        "Hi! Tumhara profile dekha, bahut accha laga. Kaise ho aaj? Hope tumhara din accha ja raha hai 🥺💕",
        "Hello! Mujhe lagta hai humari baatein acchi hongi. Apne baare mein batao na, kya karte ho? ✨",
        "Hii! Match ho gaya, I'm happy! Tumhare interests padhe, we have so much in common 🤗",
        "Hey! Mujhe connections banana pasand hai jo genuine ho. Toh batao, what makes you you? 💗",
    ],
    "witty_smart": [
        "So we matched. Statistically that means we're either soulmates or the algorithm is drunk 😂 Let's find out?",
        "Interesting profile! But profiles can be deceiving. Convince me you're as cool as you look 🤔✨",
        "Hey! Finally someone who doesn't just have gym selfies. I'm intrigued. What's your hot take on something controversial? 🙃",
        "Hi! I have a theory that you can know a person by their last 3 Google searches. Wanna test it? 😂",
    ]
}


async def _send_ai_first_message(db, match_id: str, ai_id: str, user_id: str, ai_name: str):
    """Send a personalized first greeting from AI girl."""
    await asyncio.sleep(random.randint(5, 30))

    # Get AI personality type
    ai_user = await db.users.find_one({"id": ai_id}, {"_id": 0, "ai_personality": 1})
    personality = ai_user.get("ai_personality", "sweet_caring") if ai_user else "sweet_caring"
    
    messages = FIRST_MESSAGES.get(personality, FIRST_MESSAGES["sweet_caring"])
    
    msg_doc = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": ai_id,
        "receiver_id": user_id,
        "content": random.choice(messages),
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
    """Build personality-specific system prompt."""
    profile_data = None
    for p in AI_PROFILES:
        if p["name"] == ai_user.get("name"):
            profile_data = p
            break

    personality_type = ai_user.get("ai_personality", "sweet_caring")
    personality_prompt = PERSONALITY_PROMPTS.get(personality_type, PERSONALITY_PROMPTS["sweet_caring"])
    
    vibe = ""
    if profile_data:
        vibe = profile_data.get("vibe", "")

    return AI_SYSTEM_PROMPT_TEMPLATE.format(
        name=ai_user.get("name", "Priya"),
        age=ai_user.get("age", 23),
        location=ai_user.get("location", "Delhi"),
        bio=ai_user.get("bio", ""),
        vibe=vibe,
        personality_prompt=personality_prompt,
        interests=", ".join(ai_user.get("interests", []))
    )


async def generate_ai_response(db, match_id: str, ai_user: dict, user_message: str, user_name: str) -> str:
    """Generate natural, talkative AI chat response using LLM."""
    if not EMERGENT_LLM_KEY:
        logger.error("EMERGENT_LLM_KEY not set")
        return _get_smart_fallback(ai_user)

    system_prompt = _get_ai_system_prompt(ai_user)
    session_id = f"heartlink_ai_{match_id}"

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt
        )
        chat.with_model("gemini", "gemini-2.5-flash")

        # Load last 20 messages for better context
        recent_msgs = await db.messages.find(
            {"match_id": match_id},
            {"_id": 0, "sender_id": 1, "content": 1}
        ).sort("created_at", -1).limit(20).to_list(None)

        recent_msgs.reverse()

        context_lines = []
        for msg in recent_msgs[:-1]:
            if msg["sender_id"] == ai_user["id"]:
                context_lines.append(f"{ai_user['name']}: {msg['content']}")
            else:
                context_lines.append(f"{user_name}: {msg['content']}")

        prompt = ""
        if context_lines:
            prompt = "Chat history:\n" + "\n".join(context_lines[-15:]) + "\n\n"
        prompt += f"{user_name}: {user_message}\n\n"
        prompt += f"Reply as {ai_user['name']}. Be natural, talkative, engaging. 2-4 lines. Ask a follow-up question. Use Hinglish:"

        user_msg = UserMessage(text=prompt)
        response = await chat.send_message(user_msg)

        response_text = str(response).strip()
        
        # Clean up LLM artifacts
        ai_name = ai_user.get("name", "")
        for prefix in [f"{ai_name}:", f"{ai_name.split()[0]}:", f"**{ai_name}**:", f"*{ai_name}*:"]:
            if response_text.startswith(prefix):
                response_text = response_text[len(prefix):].strip()
        
        # Remove markdown formatting
        response_text = response_text.replace("**", "").replace("*", "")

        if len(response_text) > 400:
            response_text = response_text[:397] + "..."

        return response_text

    except Exception as e:
        logger.error(f"AI response generation failed: {e}")
        return _get_smart_fallback(ai_user)


def _get_smart_fallback(ai_user: dict) -> str:
    """Personality-aware fallback responses."""
    personality = ai_user.get("ai_personality", "sweet_caring")
    
    fallbacks = {
        "flirty_fun": [
            "Haha arey yaar, network issue aa raha hai mera 😅 But tumse baat karna chhodni nahi hai! Ek min ruko",
            "Oops sorry thoda busy thi! Ab batao kya chal raha hai? Miss kiya mujhe? 😏",
            "Arey haan toh! Interesting hai ye. Aur batao, aaj ka plan kya hai tumhara? 🔥",
        ],
        "sweet_caring": [
            "Sorry yaar, thoda distracted thi. But ab main hoon na, batao kya hua? 🤗",
            "Hmm interesting! Mujhe aur detail mein batao na, mujhe genuinely jaanna hai 💕",
            "Acha acha! Tumhare saath baat karke mera mood accha ho jata hai honestly ✨",
        ],
        "witty_smart": [
            "Hold on, my brain is processing that 😂 Give me a sec... okay so basically...",
            "Hmm that's a perspective I hadn't considered. Tell me more 🤔",
            "Interesting! You know what this reminds me of? Actually nahi, pehle tum batao 😂",
        ]
    }
    
    return random.choice(fallbacks.get(personality, fallbacks["sweet_caring"]))


async def handle_ai_message(db, websocket_manager, match_id: str, sender_id: str, ai_user: dict, user_message: str, user_name: str):
    """Handle message to AI profile — generate and send natural reply."""
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if flags and not flags.get("ai_chatbot", True):
        return

    if not ai_user.get("is_active_ai", True):
        return

    # Natural typing delay based on personality
    personality = ai_user.get("ai_personality", "sweet_caring")
    if personality == "flirty_fun":
        delay = random.uniform(1.5, 3.5)  # Quick, energetic
    elif personality == "witty_smart":
        delay = random.uniform(2.0, 5.0)  # Thinks before replying
    else:
        delay = random.uniform(2.0, 4.0)  # Sweet, thoughtful

    # Send typing indicator first
    if websocket_manager:
        await websocket_manager.send_message(sender_id, {
            "type": "typing",
            "user_id": ai_user["id"],
            "is_typing": True
        })

    await asyncio.sleep(delay)

    ai_response = await generate_ai_response(db, match_id, ai_user, user_message, user_name)

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

    # Stop typing, send message
    if websocket_manager:
        await websocket_manager.send_message(sender_id, {
            "type": "typing",
            "user_id": ai_user["id"],
            "is_typing": False
        })
        await asyncio.sleep(0.3)
        clean_msg = {k: v for k, v in ai_msg_doc.items() if k != "_id"}
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

    await db.matches.delete_many({
        "$or": [{"user1_id": profile_id}, {"user2_id": profile_id}]
    })
    await db.messages.delete_many({
        "$or": [{"sender_id": profile_id}, {"receiver_id": profile_id}]
    })
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
