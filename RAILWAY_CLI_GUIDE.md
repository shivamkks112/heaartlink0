# Railway Deployment via CLI (Without GitHub)

## Step 1: Install Railway CLI

1. Open Terminal/Command Prompt on your local machine
2. Install Railway CLI:
   ```bash
   npm i -g @railway/cli
   ```

## Step 2: Login to Railway

```bash
railway login
```
- Browser window khulega
- Railway.app account banao (GitHub se sign up)
- Login complete!

## Step 3: Download Your Code

Option A - From Emergent:
- Code download karo apne local machine pe
- Ya Emergent dashboard se "Download as ZIP"

Option B - Git Clone:
```bash
git clone <your-repo-url>
cd heartlink
```

## Step 4: Deploy Backend

```bash
cd backend
railway init
railway up
```

Railway puchega:
- Project name? → "heartlink-backend"
- Start command? → `uvicorn server:app --host 0.0.0.0 --port $PORT`

## Step 5: Add Environment Variables (Backend)

```bash
railway variables set MONGO_URL="your-mongodb-atlas-url"
railway variables set DB_NAME="dating_app_db"
railway variables set ADMIN_PASSWORD="Shivam@#110"
railway variables set CORS_ORIGINS="*"
```

For Firebase (single command):
```bash
railway variables set FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"heartlink-6abe9",...}'
```

## Step 6: Deploy Frontend

```bash
cd ../frontend
railway init
railway up
```

Railway puchega:
- Project name? → "heartlink-frontend"
- Build command? → `yarn build`
- Start command? → `npx serve -s build -p $PORT`

## Step 7: Add Environment Variables (Frontend)

```bash
railway variables set REACT_APP_BACKEND_URL="<backend-railway-url>"
railway variables set REACT_APP_FIREBASE_API_KEY="AIzaSyCbcKatJZVvXgShJ8lOGg-EgMjpgYNyZrk"
# ... add all other REACT_APP_FIREBASE_* variables
```

## Step 8: Get URLs

```bash
railway domain
```

You'll get:
- Backend: https://heartlink-backend.up.railway.app
- Frontend: https://heartlink-frontend.up.railway.app

## Step 9: Custom Domain

Railway dashboard pe jao:
- Frontend service select karo
- Settings → Domain → Add heartlink.co.in
- Update GoDaddy DNS

## Done! 🎉

Your app is LIVE on Railway!

## Troubleshooting:

**If build fails:**
```bash
railway logs
```

**Update environment variable:**
```bash
railway variables set KEY="value"
```

**Redeploy:**
```bash
railway up --detach
```
