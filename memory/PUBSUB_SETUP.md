# Google Play RTDN — Pub/Sub Setup Guide

## Step 1: Google Cloud Console
1. Go to https://console.cloud.google.com
2. Select your project (same project as your Play Console)

## Step 2: Create Pub/Sub Topic
1. Go to **Pub/Sub** → **Topics**
2. Click **Create Topic**
3. Topic ID: `heartlink-play-notifications`
4. Click **Create**

## Step 3: Grant Publisher Role
1. Click on the created topic
2. Go to **Permissions** tab
3. Click **Add Principal**
4. Principal: `google-play-developer-notifications@system.gserviceaccount.com`
5. Role: **Pub/Sub Publisher**
6. Click **Save**

## Step 4: Create Push Subscription
1. Inside the topic, click **Create Subscription**
2. Subscription ID: `heartlink-rtdn-push`
3. Delivery type: **Push**
4. Endpoint URL: `https://www.heartlink.co.in/api/webhooks/google-play`
5. Enable authentication (optional but recommended)
6. Click **Create**

## Step 5: Link to Play Console
1. Go to **Google Play Console** → Your App
2. **Monetization setup** → **Real-time developer notifications**
3. Topic name: `projects/YOUR_PROJECT_ID/topics/heartlink-play-notifications`
4. Click **Save**
5. Click **Send test notification** to verify

## Verification
After setup, test notifications will appear in backend logs:
```
tail -f /var/log/supervisor/backend.err.log | grep RTDN
```

## Webhook Endpoint
`POST https://www.heartlink.co.in/api/webhooks/google-play`

Handles all 13 subscription notification types:
- PURCHASED, RENEWED, RECOVERED, RESTARTED → Activate premium
- CANCELED → Keep premium until expiry
- IN_GRACE_PERIOD → Keep premium, payment retrying
- ON_HOLD → Pause premium
- PAUSED → User paused
- EXPIRED, REVOKED → Remove premium
