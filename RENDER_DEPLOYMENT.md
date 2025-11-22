# HeartLink - Render.com Deployment Guide

## Quick Setup (10 Minutes)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up (free tier available)

### Step 2: Deploy Backend (FastAPI)
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name:** heartlink-backend
   - **Root Directory:** backend
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Environment:** Python 3

4. Add Environment Variables:
   ```
   MONGO_URL=<your-mongodb-atlas-url>
   DB_NAME=dating_app_db
   CORS_ORIGINS=https://heartlink.onrender.com
   ADMIN_PASSWORD=Shivam@#110
   FIREBASE_SERVICE_ACCOUNT_JSON=<your-firebase-json>
   SMTP_HOST=smtpout.secureserver.net
   SMTP_PORT=587
   SMTP_USER=help@heartlink.co.in
   SMTP_PASSWORD=Shivamkks120
   SMTP_FROM_EMAIL=help@heartlink.co.in
   SMTP_FROM_NAME=HeartLink Support
   ```

### Step 3: Deploy Frontend (React)
1. Click "New +" → "Static Site"
2. Connect repository
3. Configure:
   - **Name:** heartlink-frontend
   - **Root Directory:** frontend
   - **Build Command:** `yarn install && yarn build`
   - **Publish Directory:** build

4. Add Environment Variables:
   ```
   REACT_APP_BACKEND_URL=https://heartlink-backend.onrender.com
   REACT_APP_FIREBASE_API_KEY=AIzaSyCbcKatJZVvXgShJ8lOGg-EgMjpgYNyZrk
   REACT_APP_FIREBASE_AUTH_DOMAIN=heartlink-6abe9.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=heartlink-6abe9
   REACT_APP_FIREBASE_STORAGE_BUCKET=heartlink-6abe9.firebasestorage.app
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=803969423139
   REACT_APP_FIREBASE_APP_ID=1:803969423139:web:f6ff59de191329b3fade96
   REACT_APP_FIREBASE_MEASUREMENT_ID=G-MEQ38V74VL
   REACT_APP_FIREBASE_VAPID_KEY=BCyXviBrmyC7D8R81Ax9SPEl8iHCTkg8zpR_n5T8buv97Z1pLruI6VUP7c0KJ2nTigl0yNz7T8hcPylk2nLae0w
   ```

### Step 4: Connect Custom Domain
1. Go to frontend settings
2. Add Custom Domain: heartlink.co.in
3. Update GoDaddy DNS:
   - A Record → Render IP
   - CNAME → heartlink-frontend.onrender.com

### Done! ✅
Your app will be live at:
- Backend: https://heartlink-backend.onrender.com
- Frontend: https://heartlink.co.in

## Free Tier Limits:
- Backend: 750 hours/month (enough for 24/7)
- Auto-sleep after 15 min inactivity (wakes up on request)
- Upgrade to paid ($7/month) for always-on

## MongoDB Atlas Setup:
1. Create free cluster at mongodb.com/cloud/atlas
2. Get connection string
3. Add to MONGO_URL environment variable
