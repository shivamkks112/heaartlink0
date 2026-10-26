"""Razorpay alternative billing: one-time ₹49 payment = 30 days Premium (no auto-renew)."""
import os
import hmac
import hashlib
import logging
import asyncio
from datetime import datetime, timezone, timedelta

import razorpay
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from database import db, invalidate_user_cache

router = APIRouter()
logger = logging.getLogger(__name__)

PLAN_PAISE = 4900
PLAN_DAYS = 30
FEATURES = ["unlimited_swipes", "no_ads", "see_who_liked", "super_likes", "boost", "rewind"]


def _client():
    return razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))


class CreateOrder(BaseModel):
    user_id: str


class VerifyPayment(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


async def _grant(order_id: str, payment_id: str) -> dict:
    """Idempotent: one payment extends Premium exactly once."""
    order = await db.razorpay_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    claimed = await db.razorpay_orders.update_one(
        {"order_id": order_id, "status": {"$ne": "paid"}},
        {"$set": {"status": "paid", "payment_id": payment_id, "paid_at": datetime.now(timezone.utc).isoformat()}})
    user = await db.users.find_one({"id": order["user_id"]}, {"_id": 0, "premium_end": 1, "is_premium": 1})
    if claimed.modified_count == 0:
        return {"success": True, "is_premium": True, "expires_at": (user or {}).get("premium_end")}
    now = datetime.now(timezone.utc)
    start = now
    if user and user.get("is_premium") and user.get("premium_end"):
        try:
            current_end = datetime.fromisoformat(user["premium_end"].replace("Z", "+00:00"))
            start = max(now, current_end)
        except ValueError:
            pass
    expiry = (start + timedelta(days=PLAN_DAYS)).isoformat()
    await db.users.update_one({"id": order["user_id"]}, {"$set": {
        "is_premium": True, "premium_plan": "monthly", "premium_source": "razorpay",
        "premium_start": now.isoformat(), "premium_end": expiry, "subscription_status": "active",
        "auto_renew_enabled": False, "premium_features": FEATURES, "last_verified_at": now.isoformat(),
        "grace_notif_sent": False, "winback_sent": False,
    }})
    invalidate_user_cache(order["user_id"])
    logger.info(f"Razorpay premium granted to {order['user_id']} until {expiry}")
    return {"success": True, "is_premium": True, "expires_at": expiry}


@router.get("/razorpay/config")
async def razorpay_config():
    return {"key_id": os.environ["RAZORPAY_KEY_ID"], "amount": PLAN_PAISE, "currency": "INR", "days": PLAN_DAYS}


@router.post("/razorpay/create-order")
async def create_order(data: CreateOrder):
    user = await db.users.find_one({"id": data.user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    order = await asyncio.to_thread(_client().order.create, {
        "amount": PLAN_PAISE, "currency": "INR", "receipt": f"hl_{data.user_id[:8]}_{int(datetime.now().timestamp())}",
        "notes": {"user_id": data.user_id, "plan": "premium_monthly"}})
    await db.razorpay_orders.insert_one({"order_id": order["id"], "user_id": data.user_id, "amount": PLAN_PAISE,
                                         "status": "created", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"order_id": order["id"], "amount": PLAN_PAISE, "currency": "INR", "key_id": os.environ["RAZORPAY_KEY_ID"],
            "name": user.get("name", ""), "email": user.get("email", ""), "contact": user.get("phone", "")}


@router.post("/razorpay/verify")
async def verify_payment(data: VerifyPayment):
    expected = hmac.new(os.environ["RAZORPAY_KEY_SECRET"].encode(),
                        f"{data.razorpay_order_id}|{data.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, data.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment verification failed")
    return await _grant(data.razorpay_order_id, data.razorpay_payment_id)


@router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request):
    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET")
    body = await request.body()
    sig = request.headers.get("X-Razorpay-Signature", "")
    if not secret or not hmac.compare_digest(hmac.new(secret.encode(), body, hashlib.sha256).hexdigest(), sig):
        raise HTTPException(status_code=400, detail="Invalid signature")
    event = await request.json()
    if event.get("event") in ("payment.captured", "order.paid"):
        pay = event.get("payload", {}).get("payment", {}).get("entity", {})
        if pay.get("order_id"):
            try:
                await _grant(pay["order_id"], pay.get("id", ""))
            except HTTPException:
                pass
    return {"status": "ok"}


@router.get("/razorpay/status/{user_id}")
async def premium_status(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1, "premium_end": 1, "premium_source": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    payments = await db.razorpay_orders.find({"user_id": user_id, "status": "paid"}, {"_id": 0, "order_id": 1, "payment_id": 1, "amount": 1, "paid_at": 1}).sort("paid_at", -1).limit(12).to_list(None)
    return {**user, "payments": payments}
