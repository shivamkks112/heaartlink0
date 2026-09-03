"""
Games Routes — Play With Match game system
"""
import uuid
import random
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from database import db

router = APIRouter()

MATCH_QUIZ_QUESTIONS = [
    {"id": "q1", "question": "What's your idea of a perfect date?", "options": ["Candlelight dinner", "Movie night", "Adventure trip", "Cooking together"]},
    {"id": "q2", "question": "What's your love language?", "options": ["Words of affirmation", "Quality time", "Physical touch", "Acts of service"]},
    {"id": "q3", "question": "How do you handle disagreements?", "options": ["Talk it out calmly", "Take space first", "Humor & lighten up", "Compromise quickly"]},
    {"id": "q4", "question": "What matters most in a partner?", "options": ["Honesty", "Sense of humor", "Ambition", "Kindness"]},
    {"id": "q5", "question": "Ideal weekend together?", "options": ["Explore a new city", "Binge-watch shows", "Outdoor adventure", "Stay in & cook"]},
]

COMPATIBILITY_CHALLENGE_QUESTIONS = [
    {"id": "c1", "question": "Morning person or night owl?", "options": ["Early bird", "Night owl", "Depends on mood", "Both!"]},
    {"id": "c2", "question": "Travel style?", "options": ["Backpacking", "Luxury resort", "Road trips", "Spontaneous"]},
    {"id": "c3", "question": "Favorite cuisine?", "options": ["Indian", "Italian", "Chinese", "Street food"]},
    {"id": "c4", "question": "How do you relax?", "options": ["Music & chill", "Gym & fitness", "Reading", "Gaming"]},
    {"id": "c5", "question": "What's your dream?", "options": ["Travel the world", "Build a business", "Happy family", "Creative career"]},
]


@router.post("/game/create")
async def create_game_session(match_id: str, game_type: str, sender_id: str):
    """Create a game invitation"""
    match = await db.matches.find_one({"id": match_id, "matched": True})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    questions = MATCH_QUIZ_QUESTIONS if game_type == "match_quiz" else COMPATIBILITY_CHALLENGE_QUESTIONS
    selected = random.sample(questions, min(3, len(questions)))

    game_doc = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "game_type": game_type,
        "sender_id": sender_id,
        "receiver_id": match["user2_id"] if match["user1_id"] == sender_id else match["user1_id"],
        "questions": selected,
        "answers": {},
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "result": None
    }
    await db.games.insert_one(game_doc)

    game_msg = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": sender_id,
        "receiver_id": game_doc["receiver_id"],
        "content": f"__GAME_INVITE__{game_doc['id']}__{game_type}__",
        "message_type": "game_invite",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_deleted_for_sender": False,
        "is_deleted_for_receiver": False,
        "is_deleted_for_all": False,
    }
    await db.messages.insert_one(game_msg)

    return {"game_id": game_doc["id"], "questions": selected, "status": "pending"}


@router.post("/game/{game_id}/respond")
async def respond_to_game(game_id: str, user_id: str, accepted: bool):
    """Accept or decline a game invitation"""
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game["receiver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not the receiver")

    if accepted:
        await db.games.update_one({"id": game_id}, {"$set": {"status": "active"}})
        return {"status": "active", "questions": game["questions"]}
    else:
        await db.games.update_one({"id": game_id}, {"$set": {"status": "declined"}})
        return {"status": "declined"}


@router.post("/game/{game_id}/answer")
async def submit_game_answer(game_id: str, user_id: str, answers: dict):
    """Submit answers for a game"""
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if user_id not in [game["sender_id"], game["receiver_id"]]:
        raise HTTPException(status_code=403, detail="Not a participant")

    game_answers = game.get("answers", {})
    game_answers[user_id] = answers
    update = {"answers": game_answers}

    if len(game_answers) >= 2:
        sender_answers = game_answers.get(game["sender_id"], {})
        receiver_answers = game_answers.get(game["receiver_id"], {})
        matching = sum(1 for q in game["questions"] if sender_answers.get(q["id"]) == receiver_answers.get(q["id"]))
        total = len(game["questions"])
        score = round((matching / total) * 100) if total > 0 else 0

        update["status"] = "completed"
        update["completed_at"] = datetime.now(timezone.utc).isoformat()
        update["result"] = {
            "matching_answers": matching,
            "total_questions": total,
            "compatibility_score": score,
            "message": "Amazing match!" if score >= 80 else "Great compatibility!" if score >= 50 else "Opposites attract!"
        }

    await db.games.update_one({"id": game_id}, {"$set": update})
    updated = await db.games.find_one({"id": game_id}, {"_id": 0})
    return updated


@router.get("/game/{game_id}")
async def get_game(game_id: str):
    """Get game details"""
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.get("/game/match/{match_id}")
async def get_match_games(match_id: str):
    """Get all games for a match"""
    games = await db.games.find({"match_id": match_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return games
