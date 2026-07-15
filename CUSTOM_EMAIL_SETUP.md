# Custom Email Setup Guide - HeartLink

## ✅ Setup Complete! Now Add Your Password

### Step 1: Edit Backend .env File

**File Location:** `/app/backend/.env`

**Find this line:**
```
SMTP_PASSWORD=YOUR_TITAN_PASSWORD_HERE
```

**Replace with your actual Titan password:**
```
SMTP_PASSWORD=your_actual_password
```

---

### Step 2: Restart Backend

After adding password, restart backend:

```bash
sudo supervisorctl restart backend
```

---

### Step 3: Test Email

**Method 1: Forgot Password Test**
1. Go to: https://heartlink-safe.preview.emergentagent.com/forgot-password
2. Enter: demo1@heartlink.co.in (or any email from database)
3. Click "Send Reset Code"
4. ✅ OTP email will be sent to inbox!

**Method 2: Test via API**
```bash
curl -X POST "https://heartlink-safe.preview.emergentagent.com/api/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email_or_phone": "demo1@heartlink.co.in"}'
```

---

## 📧 Email Configuration Details

**SMTP Settings:**
```
Host: smtp.titan.email
Port: 587 (TLS)
Security: STARTTLS
Username: help@heartlink.co.in
From: HeartLink Support <help@heartlink.co.in>
```

**Email Types Configured:**
1. ✅ OTP/Password Reset - Beautiful branded template
2. ✅ Welcome Email - For new signups
3. ✅ Verification Status - Profile verification updates

---

## 🎨 Email Templates

### 1. OTP Email
- Pink/Orange gradient header
- Large OTP code display
- 15-minute expiry notice
- Professional footer with support email

### 2. Welcome Email
- Greeting with user name
- Getting started checklist
- Support contact info

### 3. Verification Email
- Status update (approved/rejected)
- Next steps guidance

---

## 🧪 Testing Checklist

- [ ] Password added to .env file
- [ ] Backend restarted
- [ ] Forgot password flow tested
- [ ] Email received in inbox
- [ ] Email template looks professional
- [ ] Links/buttons working
- [ ] Mobile responsive

---

## 🔧 Troubleshooting

### Email Not Received?

**1. Check Password:**
```bash
# View .env file (without showing password publicly)
cat /app/backend/.env | grep SMTP
```

**2. Check Backend Logs:**
```bash
tail -f /var/log/supervisor/backend.err.log
```

Look for:
- ✅ "Email sent successfully" = Working
- ❌ "Error sending email" = Check credentials

**3. Verify Titan Settings:**
- Login to Titan email dashboard
- Check if help@heartlink.co.in is active
- Verify SMTP is enabled

**4. Test SMTP Connection:**
```python
# Run in backend directory
python3 -c "
from email_service import send_email
result = send_email(
    'your_test_email@gmail.com',
    'Test Email',
    '<h1>Test</h1>'
)
print(result)
"
```

---

## 🚀 Next Steps

After email setup is working:

1. **Update Signup Flow:**
   - Send welcome email on new signup
   - Add email verification

2. **Add More Email Types:**
   - Match notifications
   - Message alerts
   - Weekly digest

3. **Email Analytics:**
   - Track open rates
   - Track click rates
   - Optimize templates

---

## 📝 Notes

- Emails are sent asynchronously
- Failed emails are logged in backend
- Fallback: OTP still shows on screen if email fails
- Professional templates with HeartLink branding
- Mobile-responsive HTML templates

---

## 🔐 Security

- Password stored in .env (not in code)
- .env file is in .gitignore
- SMTP uses TLS encryption
- No passwords in logs
