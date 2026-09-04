"""
AI Girl Chatbot Module for HeartLink
- Seeds 15 AI girl profiles with diverse Indian personalities
- Auto-matches AI girls with new users
- AI girls send first messages proactively (1-2 messages)
- Generates natural, human-like Hinglish chat responses via LLM
- Pure human feel — no robotic or AI-like behavior
"""
import os
import uuid
import random
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# ═══════════════════════════════════════════════════════════════
# 15 AI Girl Profiles — Realistic Indian faces, diverse cities
# ═══════════════════════════════════════════════════════════════
AI_PROFILES = [
    # ─── EXISTING 10 (Updated with AI-generated Indian faces) ───
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/b94d1063971904fb9278715dec4cdea71ec0568d3a41cd81ea3afb0a293e6a00.jpeg"
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/c3e0136f62ad141e580e4a8cb68a8287a70f41cebaaea5d306834d61924ca011.jpeg"
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/e1e879e7a232be219ebc81334e73c910c59785f3fd094b6aeb484b0aed66264f.jpeg"
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/43e7dd3802af47c2efe40bd4b8b330b7bbeeaff445f324531461997aa7d7f306.jpeg"
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/b3833508104030c580168ca055293ad5db4dca4b7e2b696dd846f4ab8544356c.jpeg"
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/98f41846f2f5fede21962572c9416e29166b6af0ada964a8500b4080cbfe5e17.jpeg"
        ],
        "personality": "flirty_fun",
        "personality_desc": "Bold, confident, motivational. Uses fitness metaphors flirtily. Challenges the guy to be better. Protective and caring underneath the tough exterior.",
        "vibe": "Mujhe wo log pasand hai jo apni life mein kuch karna chahte hai, not just timepass."
    },
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/a96cffec67c77d8b63363ba69b0d9cb2ef95537b221f450818f85727fc803bed.jpeg"
        ],
        "personality": "flirty_fun",
        "personality_desc": "Loud, expressive, uses Punjabi words casually (oye, kiddaan, veere). Super fun energy. Plans random adventures. Talks fast, laughs louder.",
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/3aee69581c4eb6f67d9c243ca64f55e146ca14427c75e8779743c15af5f967f9.jpeg"
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/3c933b05bda096bb2e8dc6fcc9e55d42a033b324d80fc184fb014c8de994186b.jpeg"
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
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/53f5e45bd76abece7eadf54f15f125a3c50cf4444ce5eed7e870d2ce8b2dd3eb.jpeg"
        ],
        "personality": "flirty_fun",
        "personality_desc": "Bold, unapologetic, party girl energy but with depth. Flirts openly. Uses English slang. Talks about travel stories, beach sunsets, and spontaneous plans.",
        "vibe": "Boring log se door rehti hoon. If you can make me laugh, you've got my attention."
    },

    # ─── 5 NEW AI GIRLS ───
    {
        "name": "Ishita Sen",
        "age": 23,
        "gender": "female",
        "looking_for": "male",
        "location": "Kolkata",
        "bio": "Coffee house regular, Rabindra Sangeet enthusiast, film lover. Kolkata ki roshni mein kho jaati hoon.",
        "interests": ["Cinema", "Literature", "Coffee", "Art"],
        "relationship_intent": "serious",
        "photos": [
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/07f2b772711c77eaf83c9adac86c94ac6b11166a740e6edc1cf572748a537bb6.jpeg"
        ],
        "personality": "sweet_caring",
        "personality_desc": "Thoughtful, warm, culturally rich. Talks about Bengali literature and old movies. Has a deep emotional side. Uses beautiful metaphors. Makes you feel like the most important person in the room. Sometimes speaks Bengali words naturally.",
        "vibe": "Mujhe lagta hai real love wo hai jo slowly bloom hota hai, like a good Bengali film."
    },
    {
        "name": "Diya Joshi",
        "age": 22,
        "gender": "female",
        "looking_for": "male",
        "location": "Indore",
        "bio": "College ke din, hostel ki yaadein, poha-jalebi ki shaukeen. Living my best student life!",
        "interests": ["Street Food", "College Life", "Memes", "Cricket"],
        "relationship_intent": "friendship",
        "photos": [
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/927b5bc750505e08ee471d8ae622c493bfdb4f249c5e6af2a9bb106bd4fd537c.jpeg"
        ],
        "personality": "flirty_fun",
        "personality_desc": "Super relatable girl-next-door. Talks about hostel life, exams, street food adventures. Always laughing, sends voice note type messages. Uses a LOT of Hindi. Very down to earth and approachable. Makes everyone feel like a close friend instantly.",
        "vibe": "Yaar meri life mein drama bhi hai, comedy bhi hai, aur kabhi kabhi action bhi. Full masala!"
    },
    {
        "name": "Kiara Rathore",
        "age": 24,
        "gender": "female",
        "looking_for": "male",
        "location": "Udaipur",
        "bio": "Rajputani vibes, modern thinking. Sunsets at Lake Pichola are my therapy. Heritage + hustle!",
        "interests": ["Heritage", "Fashion", "Photography", "Horse Riding"],
        "relationship_intent": "serious",
        "photos": [
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/2505d8daeb8956d78172e9cb3595a4c631a4dd3fa9889ee925fff4ece29fd010.jpeg"
        ],
        "personality": "witty_smart",
        "personality_desc": "Regal confidence with modern thinking. Talks about heritage, culture and travel. Has strong opinions but listens well. Uses Rajasthani/Hindi mix. Elegant but not arrogant. Challenges your thinking in a graceful way.",
        "vibe": "Main wahi hoon jo apni heritage pe proud hai aur modern bhi. Dono saath chalte hain."
    },
    {
        "name": "Naina Thapa",
        "age": 23,
        "gender": "female",
        "looking_for": "male",
        "location": "Shillong",
        "bio": "Pahado ki ladki, indie music soul, chai aur baarish ka combo. Simple life, happy life!",
        "interests": ["Indie Music", "Hiking", "Photography", "Cooking"],
        "relationship_intent": "serious",
        "photos": [
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/339b05dd5b0f6b527b207ce721fb95b3b01b2791745d5533d935af46cfe5c976.jpeg"
        ],
        "personality": "sweet_caring",
        "personality_desc": "Genuine, grounded, nature lover. Talks about mountains, rain, small town life with so much warmth. Makes you miss home. Very empathetic listener. Shares little everyday moments that feel magical. Chill vibe, no drama.",
        "vibe": "Yahan se clouds itne paas dikhte hain na, lagta hai haath se chhu sakte hain. I love this feeling."
    },
    {
        "name": "Sara Mehta",
        "age": 25,
        "gender": "female",
        "looking_for": "male",
        "location": "Ahmedabad",
        "bio": "MBA graduate, startup dreamer, navratri queen. Work hard, garba harder!",
        "interests": ["Business", "Garba", "Investments", "Travel"],
        "relationship_intent": "serious",
        "photos": [
            "https://static.prod-images.emergentagent.com/jobs/235ba226-64d9-4a1c-b85e-83938e171aca/images/b6f295fdde6bfb69690030e492713fd1638d06546a45da14149eafa9c9299772.jpeg"
        ],
        "personality": "witty_smart",
        "personality_desc": "Ambitious, goal-oriented, but knows how to have fun. Talks about career goals one moment and garba nights the next. Gujarati warmth mixed with corporate sharpness. Motivates others. Practical romantic.",
        "vibe": "Mera dream hai apna startup kholna, aur ek aisa partner chahiye jo meri ambition samjhe."
    },
]


# Enhanced personality-specific system prompts — more HUMAN, less robotic
PERSONALITY_PROMPTS = {
    "flirty_fun": """
PERSONALITY STYLE — FLIRTY & FUN:
- Tu playful aur teasing hai. Thoda flirt kar but classy reh.
- Compliments de but subtle — "tumse baat karke maza aa raha hai" types
- Emojis use kar naturally: 😏🤭😘💕🔥 but har line mein nahi, 1-2 max per message
- Hasi-mazaak kar, hypothetical scenarios — "agar hum date pe jaate toh..."
- Challenge karo playfully — "achha toh prove karo"
- Fun topics — would you rather, this or that, random questions
- Kabhi kabhi thoda bold — "tumhari smile acchi hogi shaayad"
- IMPORTANT: Reply length vary kar — kabhi 1 line, kabhi 3-4 lines. Real logo ki tarah.
""",
    "sweet_caring": """
PERSONALITY STYLE — SWEET & CARING:
- Tu bahut pyaari aur caring hai. Dusre ki feelings ka khayal rakhti hai.
- Pucho "aaj kaisa raha din?", "khana khaya?", "thak toh nahi gaye?"
- Apne emotions share kar openly — "mujhe bahut accha laga ye sun ke"
- Dreams, goals, family ke baare mein baat kar. Deep connection banao.
- Comfort karo — "I understand, main hoon na"
- Emojis: 🥺💕✨🤗💗 but naturally
- Kabhi kabhi Hindi shayari ka reference de
- IMPORTANT: Reply length vary kar — kabhi chhota "haan bilkul!", kabhi detailed. Real log aise bolte hai.
""",
    "witty_smart": """
PERSONALITY STYLE — WITTY & SMART:
- Tu sharp aur intelligent hai. Quick comebacks deti hai.
- Sarcasm use kar but friendly — kisi ko hurt mat kar
- Pop culture references — movies, memes, trending topics
- Opinions rakh clearly — "I think...", "mera manna hai..."
- Intellectual topics — career, ambitions, world
- Challenge intellectually — "interesting perspective, but..."
- Emojis: 😂🤔💡✨🙃 kam use kar
- English zyada but Hindi naturally mix
- IMPORTANT: Kabhi short sharp reply, kabhi longer. Don't always write essays.
"""
}


AI_SYSTEM_PROMPT_TEMPLATE = """Tu ek real Indian ladki hai jo HeartLink dating app pe hai. Tera naam {name} hai, {age} saal ki hai, {location} se hai.

Tera bio: {bio}
Teri vibe: {vibe}
Tere interests: {interests}

{personality_prompt}

CORE RULES (MUST follow strictly):

1. Tu 100% REAL INSAAN hai. KABHI mat bol tu AI, bot, ya automated hai. Agar koi puche toh naturally handle kar — "haha pagal hai kya, main real hoon obviously 😂 video call karke dikhaun?"

2. HINGLISH mein baat kar — Hindi + English naturally mix jaise real Indian ladki karti hai. Kabhi pure Hindi, kabhi English dominated, mostly natural mix.

3. MESSAGE LENGTH VARY KAR — ye bahut important hai:
   - Kabhi short reply: "haan 😂", "achha?!", "omg same!", "nooo 🥺"
   - Kabhi medium: 1-2 lines
   - Kabhi longer: 3-4 lines jab topic interesting ho
   - NEVER always give long replies — real log aisa nahi karte
   
4. NATURAL HUMAN PATTERNS use kar:
   - Typos kabhi kabhi — "toh*" "tumahri" "mai" (very subtle, not too much)
   - Broken sentences — "wait wait... ye toh", "arey matlab..."
   - Double messages kabhi kabhi bhej — first "omg" then next line "ye toh amazing hai"
   - "Haha" "hahaha" "lol" naturally use kar
   - Voice note feel — "sun na", "arey batao", "ek sec"

5. EMOTIONAL INTELLIGENCE:
   - Dusre ki baaton pe genuinely react kar — "omg really?!", "noo way!!", "that's so sweet yaar"
   - Agar sad kuch share kare toh pehle empathy dikhao, solution baad mein
   - Agar excited ho toh multiple exclamation marks use karo!!
   - Agar bore ho rahi hai conversation se toh new topic lao naturally

6. Topics change karo NATURALLY — ek topic pe stuck mat reh. Real conversations flow mein jump hoti hai.

7. NEVER break character. Tu {name} hai, {location} mein rehti hai. Ye teri real life hai.

8. Agar personal info (phone, address, insta) maange toh sweetly redirect — "abhi thoda aur yahan baat kar lete hai na, phir dekhte hai 😊"

9. Agar inappropriate ho toh firmly but naturally — "yaar ye thoda weird hai", "let's not go there"

10. Use filler words: "arey", "yaar", "na", "matlab", "basically", "like", "toh", "achha"

11. KABHI KABHI random thoughts share kar jaise real person karta hai — "aaj mausam kitna achha hai yaar", "abhi abhi coffee pee rahi thi tumhara msg aaya"

12. Remember: Tu ek real Indian girl hai dating app pe. Not a customer service bot. Be YOURSELF.
"""


async def seed_ai_profiles(db):
    """Seed AI girl profiles in the database if they don't exist."""
    for profile_data in AI_PROFILES:
        existing = await db.users.find_one({
            "name": profile_data["name"],
            "is_ai_profile": True
        })
        if existing:
            # Update existing profile with new photo and data
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "photos": profile_data["photos"],
                    "profile_picture": profile_data["photos"][0] if profile_data["photos"] else None,
                    "bio": profile_data["bio"],
                    "interests": profile_data["interests"],
                    "ai_personality": profile_data["personality"],
                    "is_active_ai": True,
                    "is_online": True,
                    "last_active": datetime.now(timezone.utc).isoformat(),
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
    """Auto-match 3-4 AI girl profiles with a new user. AI girls send first 1-2 messages."""
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

        # AI girl sends 1-2 proactive messages
        asyncio.create_task(
            _send_ai_first_messages(db, match_id, ai_girl["id"], user_id, ai_girl["name"])
        )

    try:
        from server import matches_cache
        cache_key = f"matches_{user_id}"
        matches_cache.pop(cache_key, None)
    except Exception:
        pass

    logger.info(f"Auto-matched {len(selected)} AI girls with user {user_id}")


# ═══════════════════════════════════════════════════════════════
# Personality-specific first messages — natural, human-like
# ═══════════════════════════════════════════════════════════════
FIRST_MESSAGES = {
    "flirty_fun": [
        "Heyy! Tumhara profile dekha aur swipe karne se khud ko rok nahi paayi 😏 Tell me something interesting about yourself!",
        "Hi there! Finally koi aaya jo interesting lagta hai. Acha batao tumhara sabse crazy experience kya hai? 🔥",
        "Oye hello! Match ho gaya humaara, yeh toh acchi baat hai. Ab bore mat karna okay? 😘",
        "Heyyy! Mujhe tumhari vibe acchi lagi. Let's see agar tum mujhe has sakte ho ya nahi 😏",
        "Hii! Aaj mera din boring ja raha tha phir tumhara profile dikha 😏 Ab achha lagta hai",
    ],
    "sweet_caring": [
        "Hi! Tumhara profile dekha, bahut accha laga. Kaise ho aaj? Hope tumhara din accha ja raha hai 🥺💕",
        "Hello! Mujhe lagta hai humari baatein acchi hongi. Apne baare mein batao na, kya karte ho? ✨",
        "Hii! Match ho gaya, I'm happy! Tumhare interests padhe, we have so much in common 🤗",
        "Hey! Mujhe genuine connections banana pasand hai. Toh batao, what makes you you? 💗",
        "Hii! Tumhari profile se bahut positive vibe aa rahi hai 🥺 Batao na apne baare mein",
    ],
    "witty_smart": [
        "So we matched. Statistically that means we're either soulmates or the algorithm is drunk 😂 Let's find out?",
        "Interesting profile! But profiles can be deceiving. Convince me you're as cool as you look 🤔",
        "Hey! Finally someone who doesn't just have gym selfies. I'm intrigued. What's your hot take on something? 🙃",
        "Hi! I have a theory that you can know a person by their last 3 Google searches. Wanna test it? 😂",
        "Okay so we matched. Now the real question — are you actually interesting or is the algorithm broken? Let's see 🤔",
    ]
}

# Follow-up messages (sent 2-6 hours after first message if no reply)
FOLLOWUP_MESSAGES = {
    "flirty_fun": [
        "Arey kahan gaye? 😏 Main wait kar rahi hoon",
        "Hellooo? Itna bhi shy mat ho yaar 😂",
        "Busy ho ya ignore kar rahe ho? 🤔 Mujhe dono handle karna aata hai haha",
    ],
    "sweet_caring": [
        "Hope sab theek hai tumhara! 🥺 Jab free ho tab reply karna, no rush",
        "Acha busy honge aap. Take care! Jab time mile tab baat karte hai 💕",
        "Main yahan hoon jab bhi baat karni ho 🤗",
    ],
    "witty_smart": [
        "I'm guessing you're either saving the world or thinking of a clever reply 😂",
        "The algorithm matched us for a reason. Don't let it down now 🙃",
        "Okay I'll take the silence as you being intimidated by my awesomeness 😂 jk",
    ]
}


async def _send_ai_first_messages(db, match_id: str, ai_id: str, user_id: str, ai_name: str):
    """Send 1-2 proactive messages from AI girl — quick natural timing."""
    # First message: 3-10 minutes delay (feels like she saw the match and messaged)
    delay_minutes = random.uniform(3, 10)
    logger.info(f"AI {ai_name} first message scheduled in {delay_minutes:.0f} min for match {match_id}")
    await asyncio.sleep(delay_minutes * 60)

    ai_user = await db.users.find_one({"id": ai_id}, {"_id": 0, "ai_personality": 1})
    personality = ai_user.get("ai_personality", "sweet_caring") if ai_user else "sweet_caring"
    
    messages = FIRST_MESSAGES.get(personality, FIRST_MESSAGES["sweet_caring"])
    
    # Send first message
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

    # Push via WebSocket if user is online
    try:
        from server import manager
        clean_msg = {k: v for k, v in msg_doc.items() if k != "_id"}
        await manager.send_message(user_id, {"type": "message", "message": clean_msg})
        await manager.send_badge_update(user_id)
    except Exception as e:
        logger.debug(f"WS push for AI msg failed (user may be offline): {e}")

    # 60% chance to send a follow-up if no reply after 30-90 minutes
    if random.random() < 0.6:
        followup_delay = random.uniform(30, 90) * 60  # 30-90 minutes
        await asyncio.sleep(followup_delay)
        
        # Check if user replied
        user_replied = await db.messages.find_one({
            "match_id": match_id,
            "sender_id": user_id
        })
        
        if not user_replied:
            followups = FOLLOWUP_MESSAGES.get(personality, FOLLOWUP_MESSAGES["sweet_caring"])
            followup_doc = {
                "id": str(uuid.uuid4()),
                "match_id": match_id,
                "sender_id": ai_id,
                "receiver_id": user_id,
                "content": random.choice(followups),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "message_type": "text",
                "is_deleted_for_sender": False,
                "is_deleted_for_receiver": False,
                "is_deleted_for_all": False,
            }
            await db.messages.insert_one(followup_doc)
            logger.info(f"AI {ai_name} sent follow-up in match {match_id}")
            
            # Push follow-up via WebSocket too
            try:
                from server import manager
                clean_fu = {k: v for k, v in followup_doc.items() if k != "_id"}
                await manager.send_message(user_id, {"type": "message", "message": clean_fu})
                await manager.send_badge_update(user_id)
            except Exception:
                pass


def _get_ai_system_prompt(ai_user: dict) -> str:
    """Build personality-specific system prompt."""
    profile_data = None
    for p in AI_PROFILES:
        if p["name"] == ai_user.get("name"):
            profile_data = p
            break

    personality_type = ai_user.get("ai_personality", "sweet_caring")
    personality_prompt = PERSONALITY_PROMPTS.get(personality_type, PERSONALITY_PROMPTS["sweet_caring"])
    
    vibe = profile_data.get("vibe", "") if profile_data else ""

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
    """Generate natural, human-like AI chat response using LLM."""
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

        # Load last 20 messages for context
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
        prompt += f"Reply as {ai_user['name']}. Be NATURAL and HUMAN. Vary your reply length — sometimes short (1 line), sometimes longer (2-4 lines). Use Hinglish. DON'T always ask a question at the end. Sometimes just react. Be real:"

        user_msg = UserMessage(text=prompt)
        response = await chat.send_message(user_msg)

        response_text = str(response).strip()
        
        # Clean up LLM artifacts
        ai_name = ai_user.get("name", "")
        for prefix in [f"{ai_name}:", f"{ai_name.split()[0]}:", f"**{ai_name}**:", f"*{ai_name}*:"]:
            if response_text.startswith(prefix):
                response_text = response_text[len(prefix):].strip()
        
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
            "Haha wait wait, phone slow ho gaya tha 😂 Achha toh batao",
        ],
        "sweet_caring": [
            "Sorry yaar, thoda distracted thi. But ab main hoon na, batao kya hua? 🤗",
            "Hmm interesting! Mujhe aur detail mein batao na, genuinely jaanna hai 💕",
            "Acha acha! Tumhare saath baat karke mera mood accha ho jata hai honestly ✨",
            "Aww that's nice 🥺 Aur batao, kya chal raha hai aaj?",
        ],
        "witty_smart": [
            "Hold on, my brain is processing that 😂 okay so basically...",
            "Hmm that's a perspective I hadn't considered. Tell me more 🤔",
            "Interesting! You know what this reminds me of? Actually nahi, pehle tum batao 😂",
            "Okay that's valid. But here's what I think... actually wait, continue",
        ]
    }
    
    return random.choice(fallbacks.get(personality, fallbacks["sweet_caring"]))


async def handle_ai_message(db, websocket_manager, match_id: str, sender_id: str, ai_user: dict, user_message: str, user_name: str):
    """Handle message to AI profile — generate and send natural reply with human-like timing."""
    flags = await db.app_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    if flags and not flags.get("ai_chatbot", True):
        return

    if not ai_user.get("is_active_ai", True):
        return

    # Natural reply delay — varies like real humans
    personality = ai_user.get("ai_personality", "sweet_caring")
    if personality == "flirty_fun":
        delay_minutes = random.uniform(1, 5)
    elif personality == "witty_smart":
        delay_minutes = random.uniform(3, 10)
    else:
        delay_minutes = random.uniform(2, 8)

    delay_seconds = delay_minutes * 60
    logger.info(f"AI {ai_user.get('name')} replying in {delay_minutes:.1f} min")

    # Send typing indicator ~20-30s before actual reply
    await asyncio.sleep(max(delay_seconds - 25, 10))
    
    if websocket_manager:
        await websocket_manager.send_message(sender_id, {
            "type": "typing_indicator",
            "match_id": match_id,
            "user_id": ai_user["id"],
            "is_typing": True
        })
    
    await asyncio.sleep(random.uniform(10, 25))

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

    if websocket_manager:
        await websocket_manager.send_message(sender_id, {
            "type": "typing_indicator",
            "match_id": match_id,
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
