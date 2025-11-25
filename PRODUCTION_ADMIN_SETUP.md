# 🔐 Production Admin Account Setup (heartlink.co.in)

## ⚠️ Important Notice

**Preview Site** (`cupids-arrow-23.preview.emergentagent.com`) aur **Production Site** (`heartlink.co.in`) ke **alag-alag databases** hain.

Jo admin account yahan create kiya hai, wo **sirf preview site pe kaam karega**.

---

## 🎯 Production Site Pe Admin Kaise Banayein?

### Method 1: API se Create करें (Recommended)

**Step 1: Admin User Signup**
```bash
curl -X POST https://heartlink.co.in/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@heartlink.com",
    "password": "Admin@HeartLink2024",
    "name": "Admin",
    "age": 30,
    "gender": "male",
    "looking_for": "female",
    "bio": "System Administrator",
    "location": "Delhi",
    "interests": ["admin"]
  }'
```

**Response:**
```json
{
  "message": "Signup successful",
  "user": {
    "id": "user_id_here",
    "email": "admin@heartlink.com",
    ...
  }
}
```

**Step 2: Make User Admin (Database Access Required)**

You'll need direct MongoDB access to production database:

```javascript
// Connect to production MongoDB
use dating_app_db  // or your production DB name

// Make user admin
db.users.updateOne(
  { email: "admin@heartlink.com" },
  { $set: { is_admin: true } }
)

// Verify
db.users.findOne({ email: "admin@heartlink.com" }, { email: 1, is_admin: 1 })
```

---

### Method 2: SSH Access to Production Server

Agar aapke paas production server ka SSH access hai:

```bash
# SSH into production server
ssh user@your-production-server

# Run Python script
python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def create_admin():
    # Connect to production MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['dating_app_db']  # Your production DB name
    
    # Make user admin
    result = await db.users.update_one(
        {"email": "admin@heartlink.com"},
        {"$set": {"is_admin": True}}
    )
    
    if result.modified_count > 0:
        print("✅ Admin created successfully!")
    else:
        print("❌ User not found. Please signup first.")
    
    client.close()

asyncio.run(create_admin())
EOF
```

---

### Method 3: Existing User Ko Admin Banayein

Agar aapke paas already koi user account hai heartlink.co.in pe:

```javascript
// MongoDB query
db.users.updateOne(
  { email: "your_existing_email@example.com" },
  { $set: { is_admin: true } }
)
```

---

## 🔒 Production Security Best Practices

### 1. Strong Password Use Karein
```
❌ Weak: Admin@123
✅ Strong: @dMin#HearTL!nk$Pr0d2024!
```

### 2. Environment Variables Use Karein
```bash
# .env file in production
ADMIN_EMAIL=admin@heartlink.com
ADMIN_PASSWORD=<secure_password>
```

### 3. Password Immediately Change Karein
First login ke baad immediately password change karein.

---

## 📋 Step-by-Step Production Setup

### Step 1: Create Account
```bash
# heartlink.co.in pe signup karein
1. Go to: https://heartlink.co.in/auth
2. Create account with admin email
3. Complete profile
```

### Step 2: Get User ID
```bash
# Login and check response
curl -X POST https://heartlink.co.in/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email_or_phone":"admin@heartlink.com","password":"YourPassword"}'

# Note down the user ID from response
```

### Step 3: Database Access
```
1. Connect to production MongoDB
2. Use production database
3. Update is_admin field to true
```

### Step 4: Verify
```bash
# Login again and check
curl -X POST https://heartlink.co.in/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email_or_phone":"admin@heartlink.com","password":"YourPassword"}' \
  | grep "is_admin"

# Should show: "is_admin": true
```

---

## 🚨 Common Issues

### Issue 1: No MongoDB Access
**Solution Options:**
1. Use MongoDB hosting dashboard (Atlas, etc.)
2. Ask your hosting provider
3. Use server admin panel if available

### Issue 2: Can't SSH to Production
**Alternative:**
- Create a one-time API endpoint to make user admin
- Use it once, then remove it for security

**Example API Endpoint (Temporary):**
```python
# Add this temporarily in server.py
@api_router.post("/admin/make-admin-once")
async def make_admin_once(secret_key: str, user_email: str):
    # Use a secret key for security
    if secret_key != "YOUR_SECRET_KEY_HERE":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    result = await db.users.update_one(
        {"email": user_email},
        {"$set": {"is_admin": True}}
    )
    
    return {"success": result.modified_count > 0}

# Call it once:
# curl -X POST https://heartlink.co.in/api/admin/make-admin-once \
#   -H "Content-Type: application/json" \
#   -d '{"secret_key":"YOUR_SECRET_KEY_HERE","user_email":"admin@heartlink.com"}'

# Then REMOVE this endpoint immediately!
```

---

## 📊 Verification Checklist

- [ ] Admin account created on heartlink.co.in
- [ ] User ID noted down
- [ ] is_admin set to true in production database
- [ ] Login successful with admin credentials
- [ ] Admin dashboard accessible at /admin
- [ ] Admin tab visible in navigation
- [ ] Can approve/reject user verifications
- [ ] Password changed to secure one

---

## 🔄 Environment Comparison

| Feature | Preview Site | Production Site |
|---------|-------------|----------------|
| URL | cupids-arrow-23.preview.emergentagent.com | heartlink.co.in |
| Database | Preview DB | Production DB |
| Admin Account | ✅ Created | ❌ Need to Create |
| Admin Email | admin@heartlink.com | admin@heartlink.com |
| Admin Access | `/admin` | `/admin` |

---

## 💡 Quick Solution

**Easiest Way (If you have MongoDB access):**

```bash
# 1. Signup on heartlink.co.in first
# 2. Then run this in MongoDB:

use dating_app_db
db.users.updateOne(
  { email: "admin@heartlink.com" },
  { $set: { is_admin: true } }
)
```

**Without MongoDB Access:**
- Contact your hosting provider
- Ask them to run the MongoDB query
- Or use MongoDB Atlas dashboard

---

## 🆘 Need Help?

If you don't have MongoDB access:
1. Check your hosting dashboard
2. Look for database management tools
3. Contact hosting support
4. Use MongoDB Atlas console (if using Atlas)

---

## 📞 Contact Information

Database typically hosted on:
- MongoDB Atlas
- AWS DocumentDB
- Self-hosted MongoDB

Check your `.env` file for `MONGO_URL` to identify hosting.

---

**Created:** November 2025  
**For:** Production deployment on heartlink.co.in  
**Status:** Instructions provided
