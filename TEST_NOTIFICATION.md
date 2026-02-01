# Test Push Notification - HeartLink

## Method 1: Via Backend API

```bash
# Replace USER_ID with actual user ID
curl -X POST "https://dating-admin-1.preview.emergentagent.com/api/fcm/send-test?user_id=USER_ID"
```

## Method 2: Via Browser Console

1. Login to app
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run:

```javascript
// Import function
import { sendTestNotification } from './firebase/messaging';

// Get user ID from localStorage
const user = JSON.parse(localStorage.getItem('user'));

// Send test notification
sendTestNotification(user.id);
```

## Method 3: Trigger Real Actions

1. **Test Match Notification:**
   - User A likes User B
   - User B likes User A back
   - Both get match notification! 💕

2. **Test Like Notification:**
   - User A likes User B
   - User B gets "Someone likes you!" notification ❤️

3. **Test Message Notification:**
   - User A sends message to User B
   - User B gets "New message from [Name]" notification 💬

4. **Test Verification:**
   - Admin verifies a user
   - User gets verification notification ✅

## Expected Results:

### Web Browser:
- Browser notification popup appears
- Sound plays (if enabled)
- Notification shows in system tray

### Android App:
- Push notification in status bar
- Sound/vibration (if enabled)
- Click opens app

## Troubleshooting:

### No Notification Received?

1. **Check Permission:**
   ```javascript
   console.log(Notification.permission); // Should be "granted"
   ```

2. **Check FCM Token:**
   ```javascript
   const user = JSON.parse(localStorage.getItem('user'));
   console.log('User ID:', user.id);
   // Check if token is registered in backend
   ```

3. **Check Backend Logs:**
   ```bash
   tail -f /var/log/supervisor/backend.err.log
   ```

4. **Check Firebase Console:**
   - Go to Firebase Console
   - Check Cloud Messaging tab
   - Verify configuration

## Firebase Setup Required:

For Android APK, you need:

1. **google-services.json** in `/app/frontend/android/app/`
2. **Firebase project** with Cloud Messaging enabled
3. **VAPID key** (already configured in messaging.js)
4. **firebase-admin-key.json** in `/app/backend/` (already present)
