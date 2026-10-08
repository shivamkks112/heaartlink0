"""
Ads & Monetization Routes
- Ad impression tracking
- Reward tracking & application
- Frequency caps
- Admin ad analytics
"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from database import db, invalidate_user_cache
from models.schemas import AdImpressionRequest, AdRewardRequest

router = APIRouter()


@router.post("/ads/impression")
async def track_ad_impression(data: AdImpressionRequest):
    """Track ad impression for analytics + auto-grant super like after 3 rewarded ads"""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("gender", "").lower() != "male":
        raise HTTPException(status_code=403, detail="Ads only for male users")
    if user.get("is_premium") or user.get("isPremium"):
        raise HTTPException(status_code=403, detail="Premium users don't see ads")

    impression_doc = {
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "ad_type": data.ad_type,
        "reward_type": data.reward_type,
        "amount": data.amount,
        "timestamp": data.timestamp,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ad_impressions.insert_one(impression_doc)
    await db.users.update_one(
        {"id": data.user_id},
        {"$inc": {f"ad_stats.{data.ad_type}_count": 1}, "$set": {"ad_stats.last_ad_shown": data.timestamp}}
    )
    
    result = {"success": True, "impression_id": impression_doc["id"]}
    
    # Auto-grant super like after every 3 rewarded ads (server-side, no app update needed)
    if data.ad_type == "rewarded":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        today_rewarded = await db.ad_impressions.count_documents({
            "user_id": data.user_id,
            "ad_type": "rewarded",
            "created_at": {"$gte": today_start}
        })
        
        # Every 3rd rewarded ad → grant 1 super like for 30 min
        if today_rewarded > 0 and today_rewarded % 3 == 0:
            superlike_until = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
            await db.users.update_one(
                {"id": data.user_id},
                {"$set": {
                    "bonus_superlike_until": superlike_until,
                    "bonus_superlike_count": user.get("bonus_superlike_count", 0) + 1,
                }}
            )
            invalidate_user_cache(data.user_id)
            result["bonus_superlike"] = True
            result["superlike_until"] = superlike_until
            result["message"] = "You earned 1 Super Like for 30 minutes!"
    
    return result


@router.post("/ads/reward")
async def track_ad_reward(data: AdRewardRequest):
    """Track reward earned from watching ad"""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reward_doc = {
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "reward_type": data.reward_type,
        "amount": data.amount,
        "timestamp": data.timestamp,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ad_rewards.insert_one(reward_doc)

    update_fields = {}
    if data.reward_type == "extra_swipes":
        update_fields["extra_swipes"] = user.get("extra_swipes", 0) + data.amount
    elif data.reward_type == "profile_boost":
        boost_end = datetime.now(timezone.utc) + timedelta(minutes=data.amount)
        update_fields["profile_boost_end"] = boost_end.isoformat()
        update_fields["is_boosted"] = True
    elif data.reward_type == "priority_message":
        update_fields["priority_messages"] = user.get("priority_messages", 0) + data.amount

    if update_fields:
        await db.users.update_one({"id": data.user_id}, {"$set": update_fields})
    invalidate_user_cache(data.user_id)
    return {"success": True, "reward_applied": data.reward_type, "amount": data.amount}


@router.get("/ads/stats/{user_id}")
async def get_ad_stats(user_id: str):
    """Get user's ad statistics"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_impressions = await db.ad_impressions.count_documents({"user_id": user_id, "created_at": {"$gte": today_start.isoformat()}})
    today_interstitials = await db.ad_impressions.count_documents({"user_id": user_id, "ad_type": "interstitial", "created_at": {"$gte": today_start.isoformat()}})

    rewards_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$reward_type", "total_amount": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    rewards_summary = await db.ad_rewards.aggregate(rewards_pipeline).to_list(None)

    return {
        "user_id": user_id,
        "is_eligible": user.get("gender", "").lower() == "male" and not user.get("is_premium"),
        "today_impressions": today_impressions,
        "today_interstitials": today_interstitials,
        "can_show_interstitial": today_interstitials < 1,
        "extra_swipes": user.get("extra_swipes", 0),
        "priority_messages": user.get("priority_messages", 0),
        "is_boosted": user.get("is_boosted", False),
        "boost_end": user.get("profile_boost_end"),
        "rewards_summary": {r["_id"]: {"total": r["total_amount"], "count": r["count"]} for r in rewards_summary}
    }


@router.get("/ads/frequency-cap/{user_id}")
async def check_frequency_cap(user_id: str):
    """Check if user can see interstitial ad today"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("gender", "").lower() != "male":
        return {"can_show": False, "reason": "female_user"}
    if user.get("is_premium") or user.get("isPremium"):
        return {"can_show": False, "reason": "premium_user"}

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_interstitials = await db.ad_impressions.count_documents({"user_id": user_id, "ad_type": "interstitial", "created_at": {"$gte": today_start.isoformat()}})
    if today_interstitials >= 1:
        tomorrow = today_start + timedelta(days=1)
        return {"can_show": False, "reason": "daily_limit_reached", "next_eligible_at": tomorrow.isoformat()}
    return {"can_show": True}


@router.get("/admin/ad-analytics")
async def get_admin_ad_analytics():
    """Admin endpoint: Ad impression, reward, and revenue analytics."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    total_impressions = await db.ad_impressions.count_documents({})
    today_impressions = await db.ad_impressions.count_documents({"created_at": {"$gte": today_start}})
    week_impressions = await db.ad_impressions.count_documents({"created_at": {"$gte": week_ago}})
    month_impressions = await db.ad_impressions.count_documents({"created_at": {"$gte": month_ago}})
    total_rewards = await db.ad_rewards.count_documents({})
    today_rewards = await db.ad_rewards.count_documents({"created_at": {"$gte": today_start}})

    type_pipeline = [{"$group": {"_id": "$ad_type", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    type_breakdown = await db.ad_impressions.aggregate(type_pipeline).to_list(None)

    reward_pipeline = [{"$group": {"_id": "$reward_type", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount"}}}, {"$sort": {"count": -1}}]
    reward_breakdown = await db.ad_rewards.aggregate(reward_pipeline).to_list(None)

    daily_pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$addFields": {"date_str": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$date_str", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    daily_impressions = await db.ad_impressions.aggregate(daily_pipeline).to_list(None)

    top_users_pipeline = [{"$group": {"_id": "$user_id", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 10}]
    top_users_raw = await db.ad_impressions.aggregate(top_users_pipeline).to_list(None)
    top_users = []
    for tu in top_users_raw:
        u = await db.users.find_one({"id": tu["_id"]}, {"_id": 0, "name": 1, "id": 1})
        top_users.append({"user_id": tu["_id"], "name": u.get("name", "Unknown") if u else "Deleted", "impressions": tu["count"]})

    unique_users_total = len(await db.ad_impressions.distinct("user_id"))
    unique_users_today = len(await db.ad_impressions.distinct("user_id", {"created_at": {"$gte": today_start}}))

    interstitial_count = sum(t["count"] for t in type_breakdown if t["_id"] == "interstitial")
    rewarded_count = sum(t["count"] for t in type_breakdown if t["_id"] == "rewarded")
    banner_count = sum(t["count"] for t in type_breakdown if t["_id"] == "banner")
    est_revenue = (interstitial_count * 0.75 + rewarded_count * 2.0 + banner_count * 0.15) / 1000

    return {
        "summary": {
            "total_impressions": total_impressions, "today_impressions": today_impressions,
            "week_impressions": week_impressions, "month_impressions": month_impressions,
            "total_rewards": total_rewards, "today_rewards": today_rewards,
            "unique_users_total": unique_users_total, "unique_users_today": unique_users_today,
            "estimated_revenue_usd": round(est_revenue, 2),
        },
        "type_breakdown": {t["_id"]: t["count"] for t in type_breakdown},
        "reward_breakdown": {r["_id"]: {"count": r["count"], "total_amount": r["total_amount"]} for r in reward_breakdown},
        "daily_impressions": [{"date": d["_id"], "count": d["count"]} for d in daily_impressions],
        "top_users": top_users,
    }
