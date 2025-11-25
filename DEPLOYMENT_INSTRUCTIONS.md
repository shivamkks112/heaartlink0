# 🚀 Production Deployment Instructions

## Files Modified:
- `/app/backend/server.py` - Added admin creation endpoint

## New Endpoint Added:
```
POST /api/admin/make-me-admin-once
Body: {
  "secret_code": "HeartLink@Admin#2024",
  "user_email": "user@example.com"
}
```

## Deployment Steps:

### Option 1: Git Push
```bash
cd /app
git add backend/server.py
git commit -m "Add admin creation endpoint"
git push origin production  # or main
```

### Option 2: Manual Upload
1. Download: /app/backend/server.py
2. Upload to production server: /path/to/backend/server.py
3. Restart backend server

### Option 3: Hosting Dashboard
1. Go to hosting provider dashboard
2. Click "Deploy" or "Redeploy"
3. Select latest code
4. Wait for deployment complete

## After Deployment:

### Test Endpoint:
```bash
curl https://heartlink.co.in/api/admin/make-me-admin-once
# Should NOT return 404
```

### Create Admin:
```bash
curl -X POST https://heartlink.co.in/api/admin/make-me-admin-once \
  -H "Content-Type: application/json" \
  -d '{
    "secret_code": "HeartLink@Admin#2024",
    "user_email": "shivamkks112@gmail.com"
  }'
```

### Expected Response:
```json
{
  "success": true,
  "message": "✅ Admin account created successfully!",
  "user": {
    "email": "shivamkks112@gmail.com",
    "is_admin": true
  }
}
```

## Security:

After creating admin, disable endpoint by adding to .env:
```
ADMIN_SETUP_COMPLETE=true
```

## Troubleshooting:

### 404 Error:
- Code not deployed properly
- Server not restarted
- Check backend logs

### Invalid Secret Code:
- Check spelling: HeartLink@Admin#2024
- Case sensitive!

### User Not Found:
- Signup first on heartlink.co.in
- Then run admin command
