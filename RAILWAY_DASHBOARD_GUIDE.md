# Railway Dashboard Deployment (No CLI)

## Prerequisites:
1. GitHub account
2. Code pushed to GitHub (use Emergent's "Save to Github" feature)

## Step-by-Step Guide:

### 1. Setup Railway Account
- Go to: https://railway.app
- Click "Start a New Project"
- Sign up with GitHub
- Authorize Railway

### 2. Create New Project
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose your HeartLink repository
- Railway auto-detects: Python + Node.js ✅

### 3. Configure Backend Service
Railway creates service automatically. Click on it:

**Settings:**
- Name: `heartlink-backend`
- Root Directory: `backend`
- Build Command: (auto-detected)
- Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

**Variables Tab - Add these:**
```
MONGO_URL = mongodb+srv://username:password@cluster.mongodb.net/dating_app_db
DB_NAME = dating_app_db
CORS_ORIGINS = *
ADMIN_PASSWORD = Shivam@#110
EMERGENT_LLM_KEY = sk-emergent-2260bA559E38924EeD
SMTP_HOST = smtpout.secureserver.net
SMTP_PORT = 587
SMTP_USER = help@heartlink.co.in
SMTP_PASSWORD = Shivamkks120
SMTP_FROM_EMAIL = help@heartlink.co.in
SMTP_FROM_NAME = HeartLink Support
FIREBASE_SERVICE_ACCOUNT_JSON = {"type":"service_account",...full json...}
```

### 4. Configure Frontend Service
Click "Add Service" → "From GitHub"

**Settings:**
- Name: `heartlink-frontend`
- Root Directory: `frontend`
- Build Command: `yarn install && yarn build`
- Start Command: `npx serve -s build -p $PORT`

**Variables Tab - Add these:**
```
REACT_APP_BACKEND_URL = https://heartlink-backend.up.railway.app
REACT_APP_FIREBASE_API_KEY = AIzaSyCbcKatJZVvXgShJ8lOGg-EgMjpgYNyZrk
REACT_APP_FIREBASE_AUTH_DOMAIN = heartlink-6abe9.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL = https://heartlink-6abe9-default-rtdb.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID = heartlink-6abe9
REACT_APP_FIREBASE_STORAGE_BUCKET = heartlink-6abe9.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID = 803969423139
REACT_APP_FIREBASE_APP_ID = 1:803969423139:web:f6ff59de191329b3fade96
REACT_APP_FIREBASE_MEASUREMENT_ID = G-MEQ38V74VL
REACT_APP_FIREBASE_VAPID_KEY = BCyXviBrmyC7D8R81Ax9SPEl8iHCTkg8zpR_n5T8buv97Z1pLruI6VUP7c0KJ2nTigl0yNz7T8hcPylk2nLae0w
```

### 5. Add MongoDB (Optional - Free Tier)
- Click "New" → "Database" → "Add MongoDB"
- Railway provides free MongoDB instance!
- Connection string automatically added to backend variables

### 6. Deploy!
- Both services will build automatically
- Watch deployment logs in real-time
- Wait 3-5 minutes for completion

### 7. Get Your URLs
**Backend URL:**
- Click backend service → Settings → Generate Domain
- You'll get: `https://heartlink-backend.up.railway.app`
- Update this in frontend's REACT_APP_BACKEND_URL

**Frontend URL:**
- Click frontend service → Settings → Generate Domain
- You'll get: `https://heartlink-frontend.up.railway.app`
- This is your live app! 🎉

### 8. Custom Domain (heartlink.co.in)
**Frontend Service:**
- Settings → Networking → Custom Domain
- Add: `heartlink.co.in`
- Railway shows DNS records to add

**Update GoDaddy:**
- Go to GoDaddy DNS Management
- Add CNAME record:
  - Type: CNAME
  - Name: @
  - Value: [Railway provides this]
- Wait 5-10 minutes for DNS propagation

### 9. Verify Deployment
- Visit: https://heartlink.co.in
- Test login with: shivam.fresh@heartlink.com / Shivam@#110
- Check matches page
- Test chat feature

## Troubleshooting:

**Build Failed?**
- Check logs in deployment tab
- Verify all environment variables are set
- Ensure root directory is correct

**Backend not connecting to MongoDB?**
- Verify MONGO_URL is correct
- Check if MongoDB Atlas allows Railway IPs (add 0.0.0.0/0 in whitelist)

**Frontend can't reach backend?**
- Verify REACT_APP_BACKEND_URL points to backend Railway URL
- Check CORS_ORIGINS in backend includes frontend URL

**Custom domain not working?**
- DNS takes 5-10 minutes to propagate
- Check GoDaddy DNS settings are correct
- Verify CNAME points to Railway domain

## Cost:
- Free tier: $5 credit (lasts 1-2 months for small apps)
- Paid tier: $5/month for unlimited usage

## Benefits:
✅ Auto-deploys on git push
✅ Free MongoDB included
✅ SSL certificate automatic
✅ Easy rollback to previous deployments
✅ Built-in monitoring and logs
✅ Zero-downtime deployments

Your HeartLink app will be LIVE! 🚀
