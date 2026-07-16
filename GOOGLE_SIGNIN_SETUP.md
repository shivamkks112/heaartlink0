# 🔐 Google Sign-In Setup Guide - Firebase Console

## ❌ Current Error:
```
Firebase: Error (auth/unauthorized-domain)
```

This means your app domain is not authorized in Firebase Console.

---

## ✅ Step-by-Step Fix (5 Minutes)

### Step 1: Open Firebase Console
1. Go to: **https://console.firebase.google.com**
2. Login with your Google account
3. Select **"heartlink-6abe9"** project

### Step 2: Navigate to Authentication Settings
1. Click **"Authentication"** in left sidebar (🔐 icon)
2. Click **"Settings"** tab at the top
3. Scroll down to **"Authorized domains"** section

### Step 3: Add Your Domains
You need to add these domains:

**Required Domains:**
```
heartlink-app-2.preview.emergentagent.com
localhost
```

**Optional (if you have custom domain):**
```
heartlink.co.in
www.heartlink.co.in
```

### Step 4: How to Add Domain
1. In "Authorized domains" section, click **"Add domain"** button
2. Enter domain: `heartlink-app-2.preview.emergentagent.com`
3. Click **"Add"**
4. Repeat for `localhost`

### Step 5: Verify
After adding, you should see:
```
✅ heartlink-app-2.preview.emergentagent.com
✅ localhost
✅ heartlink-6abe9.firebaseapp.com (default)
✅ heartlink-6abe9.web.app (default)
```

---

## 🔍 Troubleshooting

### Issue: "Domain is already in use by another project"
- You may have added it to wrong project
- Check you're in "heartlink-6abe9" project

### Issue: Can't find "Authorized domains"
- Make sure you're in **Authentication** → **Settings** tab
- Not in "Sign-in method" tab
- Scroll down, it's below "Authorized domains for OAuth redirects"

### Issue: Still getting error after adding
1. **Clear browser cache**
2. **Hard refresh**: Ctrl+Shift+R (Cmd+Shift+R on Mac)
3. **Try incognito/private window**
4. **Wait 2-3 minutes** for Firebase to propagate changes

---

## 📸 Visual Guide

### Where to find "Authorized domains":

```
Firebase Console
├── Authentication (left sidebar)
    ├── Sign-in method (tab)
    └── Settings (tab) ← Click here
        ├── Project Settings
        ├── Security Rules
        └── Authorized domains ← Scroll to here
            └── [Add domain] button ← Click this
```

---

## ✅ After Adding Domains

### Test Google Sign-In:
1. Go to: https://trust-based-deploy.preview.emergentagent.com/auth
2. Click **"Sign in with Google"** button
3. Google login popup should appear
4. Select your Google account
5. You'll be logged into HeartLink! 🎉

---

## 📋 Checklist

Before testing, make sure:
- [ ] Opened Firebase Console
- [ ] Selected correct project (heartlink-6abe9)
- [ ] Went to Authentication → Settings
- [ ] Added `heartlink-app-2.preview.emergentagent.com`
- [ ] Added `localhost`
- [ ] Saved changes
- [ ] Waited 1-2 minutes
- [ ] Cleared browser cache
- [ ] Ready to test!

---

## 🎯 What Happens After Setup

**User Flow:**
1. User clicks "Sign in with Google"
2. Google login popup appears
3. User selects Google account
4. **First time:** New account created automatically in HeartLink
5. **Returning user:** Logged in directly
6. Redirected to Discover page
7. Ready to use app! ✨

**Backend Auto-handles:**
- ✅ Check if user exists
- ✅ Create account if new user
- ✅ Login if existing user
- ✅ Store Google profile data
- ✅ Generate user ID
- ✅ Save to MongoDB

---

## 🔧 Technical Details

**What Firebase checks:**
- Domain of the page making the request
- Authorized domains list in Firebase
- If domain matches → Allow sign-in
- If domain doesn't match → Error

**Domain format:**
- ✅ Correct: `heartlink-app-2.preview.emergentagent.com`
- ❌ Wrong: `https://trust-based-deploy.preview.emergentagent.com`
- ❌ Wrong: `heartlink-app-2.preview.emergentagent.com/`
- Just the domain, no protocol, no trailing slash

---

## 💡 Pro Tips

1. **Add localhost for development:**
   - Test Google Sign-in locally without deploying

2. **Add your custom domain:**
   - If you have heartlink.co.in or any custom domain
   - Add both www and non-www versions

3. **Multiple environments:**
   - Dev: localhost
   - Staging: preview.emergentagent.com
   - Production: your custom domain

4. **Security:**
   - Only add domains you control
   - Firebase allows you to add multiple domains
   - Each app instance can only authenticate from authorized domains

---

## 📞 Need Help?

**If still facing issues:**
1. Take a screenshot of Firebase Console → Authentication → Settings → Authorized domains
2. Share the screenshot
3. I'll help debug the exact issue

**Common mistakes:**
- Adding wrong domain name (typo)
- Adding URL instead of domain
- Not saving after adding
- Being in wrong Firebase project
- Not waiting for changes to propagate

---

## 🎉 Success Indicators

**You'll know it's working when:**
- No error in browser console
- Google popup appears smoothly
- Account creation/login happens automatically
- Redirected to Discover page
- User can see profiles and matches

---

**Last Updated:** October 16, 2025
**Status:** Waiting for domain authorization
**Next Step:** Add domain to Firebase Console
