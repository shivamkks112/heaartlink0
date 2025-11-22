# HeartLink - Push Notification Guide

## 🔔 How Notifications Work

### Where Notifications Appear:

**Desktop/Laptop:**
- Windows: Bottom right corner (system notification)
- Mac: Top right corner (notification center)
- Linux: Top right corner

**Mobile (Android):**
- Notification bar (swipe down from top)
- Lock screen
- App icon badge (if PWA installed)

**Mobile (iOS):**
- Notification center
- Lock screen
- Banner at top (if PWA installed)

## 📱 Step-by-Step Setup

### For Mobile Users (Android/iOS):

**Step 1: Open HeartLink**
```
Visit: https://heartlink.co.in
Login with your account
```

**Step 2: Allow Notifications**
When you first login, a popup will appear:
```
"heartlink.co.in wants to send you notifications"
[Block] [Allow]
```
**Tap "Allow"** ✅

**Step 3: Install as App (Optional but Recommended)**

**Android:**
1. Open Chrome browser
2. Visit heartlink.co.in
3. Tap menu (3 dots) → "Install app" or "Add to Home screen"
4. Now it works like a native app!
5. Notifications will work even when browser is closed

**iOS (iPhone):**
1. Open Safari browser
2. Visit heartlink.co.in
3. Tap share button → "Add to Home Screen"
4. Open from home screen (works like native app)

### For Desktop/Laptop Users:

**Step 1: Login**
```
https://heartlink.co.in
```

**Step 2: Allow Browser Notifications**
Browser will show popup at top:
```
"heartlink.co.in wants to show notifications"
[Block] [Allow]
```
**Click "Allow"** ✅

**Step 3: Keep Browser Open (or Install PWA)**
- Notifications work when browser is open
- OR install as desktop app (Chrome: Menu → Install HeartLink)

## 🔔 When Will You Get Notifications?

### 1. Someone Likes You
```
💖 "Priya liked your profile!"
[Tap to view]
```

### 2. Someone Super Likes You
```
⭐ "Raj sent you a Super Like!"
[Tap to view]
```

### 3. New Match!
```
🎉 "It's a Match! You and Anjali matched!"
Compatibility: 92%
[Start chatting]
```

### 4. New Message
```
💬 "Riya sent you a message"
[Open chat]
```

## 🧪 How to Test:

**Method 1: Use 2 Devices**
- Device 1: Your phone (logged in as User A)
- Device 2: Friend's phone or laptop (logged in as User B)
- Device 2: Like User A
- Device 1: Should get notification! 🔔

**Method 2: Use Incognito Window**
- Window 1: Normal browser (User A)
- Window 2: Incognito mode (User B - different account)
- Window 2: Like User A
- Window 1: Notification appears!

## ⚙️ If Notifications Not Working:

### Check 1: Permission Granted?
**Android:**
- Settings → Apps → Chrome → Notifications → Enabled?
- Settings → Apps → HeartLink (if PWA) → Notifications → Enabled?

**Desktop:**
- Chrome: chrome://settings/content/notifications
- Check if heartlink.co.in is "Allowed"

**iOS:**
- Settings → Safari → Websites → Notifications
- Check heartlink.co.in is allowed

### Check 2: Browser Supports Notifications?
✅ Chrome (Desktop & Android)
✅ Edge (Desktop)
✅ Firefox (Desktop)
✅ Safari (iOS 16.4+, Mac)
❌ Safari (older iOS versions)

### Check 3: HTTPS Enabled?
- Notifications only work on HTTPS
- http://localhost = No notifications
- https://heartlink.co.in = Notifications work ✅

## 🎯 Best Experience:

**For Mobile:**
1. Install as PWA (Add to Home Screen)
2. Allow notifications
3. Keep app in background
4. Notifications work even when app closed!

**For Desktop:**
1. Allow browser notifications
2. Keep tab open (or install as app)
3. Notifications appear even when on different tab

## 🔍 Troubleshooting:

**"I allowed but no notifications"**
- Check console logs (F12 → Console)
- Should see: "✅ FCM Token: ..."
- If not, Firebase might not be initialized

**"Popup never appeared"**
- Browser might have auto-blocked
- Check address bar for 🔔 icon (notification blocked)
- Click it and allow manually

**"Notifications work on desktop but not mobile"**
- Mobile browsers need PWA installation for best experience
- Or keep browser open in background

**"iOS not getting notifications"**
- iOS 16.4+ required for web notifications
- Works better as PWA (Add to Home Screen)
- Safari only (Chrome/Firefox won't work on iOS)

## 💡 Pro Tips:

1. **Install as App:** Better reliability + offline support
2. **Background Sync:** PWA apps can receive notifications even when closed
3. **Sound:** Enable notification sounds in device settings
4. **Do Not Disturb:** Disable DND mode for notifications

## 🎊 Summary:

**Setup (One Time):**
1. Login to heartlink.co.in
2. Click "Allow" on notification popup
3. (Optional) Install as app

**Usage:**
- Get notified when someone likes/matches/messages you
- Tap notification to open app
- Works on mobile and desktop!

**Notification Types:**
- 💖 Like
- ⭐ Super Like
- 🎉 Match
- 💬 Message

Your HeartLink app is ready to send real-time notifications! 🚀
