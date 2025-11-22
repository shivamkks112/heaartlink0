# HeartLink - Railway.app Deployment Guide

## Quick Setup (15 Minutes)

### Step 1: Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Get $5 free credit

### Step 2: Deploy Entire App (One Click!)
1. Click "New Project"
2. "Deploy from GitHub repo"
3. Select your HeartLink repository
4. Railway auto-detects FastAPI + React!

### Step 3: Add MongoDB
1. Click "New" → "Database" → "MongoDB"
2. Railway provides free MongoDB instance
3. Connection string auto-added to environment

### Step 4: Configure Environment
Railway auto-reads from .env files, but verify:
- All backend/.env variables are set
- All frontend/.env variables are set

### Step 5: Custom Domain
1. Click on service → Settings → Domain
2. Add heartlink.co.in
3. Update DNS to Railway's provided values

### Done! ✅
- Automatic deployments on git push
- Free tier: $5 credit (lasts 1-2 months)
- Upgrade: $5/month for unlimited

## Advantages:
- Zero configuration needed
- Auto-detects your stack
- Free MongoDB included
- Faster than Render
