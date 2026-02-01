# 🔐 HeartLink Admin Credentials

## Admin Access Details

### Login Credentials:
```
Email: admin@heartlink.com
Password: Admin@HeartLink2024
```

### Admin Dashboard URL:
```
https://dating-admin-1.preview.emergentagent.com/admin
```

---

## How to Access Admin Dashboard

### Step 1: Login
1. Go to: https://dating-admin-1.preview.emergentagent.com/auth
2. Enter credentials above
3. Click "Login"

### Step 2: Navigate to Admin
**Option A:** Direct URL
- Go to: `/admin` route after login

**Option B:** Via Navbar (if admin)
- Bottom navigation में "Admin" tab दिखेगा
- Purple color का icon होगा
- Click करो to open admin dashboard

---

## Admin Dashboard Features

### 1. User Verification
- View pending verification requests
- Approve/Reject user profiles
- Verification reason entry

### 2. User Management
- View all users
- Filter by verification status
- See user details

### 3. Reports Management
- View reported users
- Check report reasons
- Take action on reports

---

## Admin User Details

```json
{
  "id": "f69b3dc0-6b93-46af-a989-c787e35a1736",
  "email": "admin@heartlink.com",
  "name": "Admin",
  "is_admin": true,
  "age": 30,
  "gender": "male",
  "location": "Delhi"
}
```

---

## Security Notes

⚠️ **Important:**
1. Keep these credentials secure
2. Don't share publicly
3. Change password after first login
4. Use different admin account for production

### To Change Admin Password:
```bash
# Via API
curl -X POST <BACKEND_URL>/api/auth/change-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@heartlink.com",
    "old_password": "Admin@HeartLink2024",
    "new_password": "YourNewSecurePassword"
  }'
```

---

## Create Additional Admins

To make another user admin:

### Method 1: Via MongoDB
```javascript
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { is_admin: true } }
)
```

### Method 2: Via Python Script
```python
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def make_admin(email):
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['dating_app_db']
    
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"is_admin": True}}
    )
    
    print(f"Updated: {result.modified_count} user(s)")
    client.close()

asyncio.run(make_admin("new_admin@heartlink.com"))
```

---

## Testing Admin Access

### Quick Test:
```bash
# Login
curl -X POST https://dating-admin-1.preview.emergentagent.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email_or_phone":"admin@heartlink.com","password":"Admin@HeartLink2024"}'

# Response should include:
# "is_admin": true
```

---

## Admin Navbar Visibility

Admin tab will only show if:
1. User is logged in
2. `user.is_admin === true`
3. Located in bottom navigation bar
4. Purple/Indigo color theme

---

## Troubleshooting

### Issue 1: Admin Tab Not Showing
**Solution:**
- Logout and login again
- Clear browser cache
- Check `is_admin` field in localStorage

### Issue 2: Can't Access /admin Route
**Solution:**
- Verify login status
- Check if `is_admin` is true
- Clear cookies and re-login

### Issue 3: Forgot Admin Password
**Solution:**
- Use MongoDB to reset:
```javascript
db.users.updateOne(
  { email: "admin@heartlink.com" },
  { $set: { password_hash: "<new_hash>" } }
)
```

---

## Production Deployment

For production environment:

1. **Create Strong Password:**
   - Minimum 16 characters
   - Mix of upper, lower, numbers, symbols
   - Example: `@dMin#HearTL!nk$2024`

2. **Use Environment Variables:**
   ```bash
   ADMIN_EMAIL=admin@heartlink.com
   ADMIN_PASSWORD=<secure_password>
   ```

3. **Enable 2FA (Future Enhancement):**
   - Add OTP verification
   - SMS/Email verification
   - Authenticator app support

---

## API Endpoints (Admin Only)

### Get Users for Verification
```
GET /api/admin/users?status=pending
```

### Verify User
```
POST /api/admin/verify-user
{
  "user_id": "<user_id>",
  "action": "approve|reject",
  "reason": "optional reason",
  "verified_by": "<admin_id>"
}
```

### Get All Users
```
GET /api/admin/all-users
```

---

**Created:** November 2025  
**Last Updated:** November 2025  
**Status:** ✅ Active

---

## Quick Access Summary

| Item | Value |
|------|-------|
| Email | `admin@heartlink.com` |
| Password | `Admin@HeartLink2024` |
| Dashboard | `/admin` route |
| User ID | `f69b3dc0-6b93-46af-a989-c787e35a1736` |
| Status | ✅ Active & Verified |
