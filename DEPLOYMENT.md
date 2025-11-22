# HeartLink Dating App - Deployment Guide

## Environment Variables Required

### Backend Environment Variables
Create `backend/.env` with the following variables:

```bash
MONGO_URL="<provided-by-emergent-mongodb-atlas>"
DB_NAME="dating_app_db"
CORS_ORIGINS="https://your-domain.com,https://app.emergent.host"
EMERGENT_LLM_KEY="<your-emergent-llm-key>"
ADMIN_PASSWORD="<secure-admin-password>"

# SMTP Configuration
SMTP_HOST="smtpout.secureserver.net"
SMTP_PORT="587"
SMTP_USER="<your-email@domain.com>"
SMTP_PASSWORD="<your-smtp-password>"
SMTP_FROM_EMAIL="<your-email@domain.com>"
SMTP_FROM_NAME="HeartLink Support"

# Firebase Service Account (as JSON string)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

### Frontend Environment Variables
Create `frontend/.env` with the following variables:

```bash
REACT_APP_BACKEND_URL=https://your-backend-url.com
WDS_SOCKET_PORT=443
REACT_APP_ENABLE_VISUAL_EDITS=false

# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=<your-firebase-api-key>
REACT_APP_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://<your-project>.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID=<your-project-id>
REACT_APP_FIREBASE_STORAGE_BUCKET=<your-project>.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
REACT_APP_FIREBASE_APP_ID=<your-app-id>
REACT_APP_FIREBASE_MEASUREMENT_ID=<your-measurement-id>
REACT_APP_FIREBASE_VAPID_KEY=<your-vapid-key>
```

## Deployment Steps

1. **Set Environment Variables in Emergent Dashboard**
   - Navigate to your app's deployment settings
   - Add all backend and frontend environment variables
   - Emergent will automatically inject these during deployment

2. **Deploy**
   - Click "Deploy Now" in Emergent dashboard
   - Wait 10-15 minutes for build and deployment

3. **Verify Deployment**
   - Check health status in dashboard
   - Test backend API endpoints
   - Test frontend loading

## Important Notes

- **.env files are NOT committed to git** (they're in .gitignore)
- Use `.env.example` files as templates
- MongoDB URL will be provided automatically by Emergent for Atlas
- All sensitive data MUST be in environment variables
- No hardcoded URLs or secrets in source code

## Production Configuration

### MongoDB Atlas
- Emergent provides managed MongoDB Atlas instance
- MONGO_URL is automatically injected
- Database name: dating_app_db

### CORS Configuration
- Set CORS_ORIGINS to your production domain(s)
- Example: `https://heartlink.co.in,https://heartlink-app.emergent.host`

### Firebase
- Service account JSON must be set as FIREBASE_SERVICE_ACCOUNT_JSON
- Format: Single-line JSON string
- All frontend Firebase config in REACT_APP_FIREBASE_* variables

## Troubleshooting

### Build Fails
- Verify all environment variables are set in dashboard
- Check for syntax errors in .env values
- Ensure FIREBASE_SERVICE_ACCOUNT_JSON is valid JSON

### App Doesn't Start
- Check MongoDB connection string
- Verify CORS_ORIGINS includes production domain
- Check supervisor logs for errors

### Database Connection Fails
- Verify MONGO_URL is correct Atlas connection string
- Check DB_NAME matches database name
- Verify network connectivity to Atlas

## Security Checklist

✅ No hardcoded API keys in source code
✅ No hardcoded URLs in source code
✅ All secrets in environment variables
✅ Firebase service account key not in repository
✅ .env files in .gitignore
✅ CORS properly configured for production domain

## Support

For Emergent deployment support:
- Check deployment logs in dashboard
- Review build errors
- Contact Emergent support team
