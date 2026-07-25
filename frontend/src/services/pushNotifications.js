/**
 * HeartLink Push Notification Service — Firebase Cloud Messaging Only
 *
 * Handles:
 * - Android 13+ POST_NOTIFICATIONS permission
 * - FCM token registration + auto-refresh
 * - Foreground / Background / Terminated states
 * - Deep-link navigation on tap
 * - Notification channel creation
 * - Debug logging
 */

import { Capacitor } from '@capacitor/core';
import axios from 'axios';
import { API } from '@/config/api';

const TAG = '[FCM]';

let _currentUserId = null;

// ─── Public API ──────────────────────────────────────────────────

export const initPushNotifications = async (userId) => {
  if (!Capacitor.isNativePlatform()) {
    console.log(TAG, 'Skipped — web platform');
    return;
  }

  _currentUserId = userId;
  console.log(TAG, 'Initializing for user:', userId);

  const { PushNotifications } = await import('@capacitor/push-notifications');

  // 1. Android 13+ runtime permission
  let perm = await PushNotifications.checkPermissions();
  console.log(TAG, 'Permission status:', perm.receive);

  if (perm.receive === 'prompt') {
    perm = await PushNotifications.requestPermissions();
    console.log(TAG, 'Permission after request:', perm.receive);
  }
  if (perm.receive !== 'granted') {
    console.warn(TAG, 'Permission denied — push disabled');
    return;
  }

  // 2. Create notification channel FIRST (Android 8+)
  await createNotificationChannel();

  // 3. Remove old listeners to prevent duplicates
  await PushNotifications.removeAllListeners();

  // ━━━ SET UP ALL LISTENERS BEFORE register() ━━━

  // 4. Token received — MUST be before register()
  await PushNotifications.addListener('registration', async (token) => {
    console.log(TAG, 'TOKEN RECEIVED:', token.value?.substring(0, 40) + '…');
    await registerTokenWithBackend(_currentUserId, token.value);
  });

  // 5. Token error
  await PushNotifications.addListener('registrationError', (err) => {
    console.error(TAG, 'REGISTRATION ERROR:', JSON.stringify(err));
  });

  // 6. Foreground — show local notification
  await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
    console.log(TAG, 'FOREGROUND notification:', JSON.stringify(notification));
    await showLocalNotification(notification);
  });

  // 7. Background / Terminated — user tapped notification
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log(TAG, 'NOTIFICATION TAPPED:', JSON.stringify(action));
    const data = action.notification?.data || {};
    navigateToScreen(data);
  });

  // 8. Local notification tap (for foreground re-displayed ones)
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log(TAG, 'LOCAL NOTIFICATION TAPPED:', JSON.stringify(action));
      const data = action.notification?.extra || {};
      navigateToScreen(data);
    });
  } catch (e) {
    console.log(TAG, 'LocalNotifications listener skip:', e.message);
  }

  // ━━━ NOW REGISTER — listeners are ready to catch the token ━━━

  // 9. Register with FCM (triggers 'registration' event above)
  await PushNotifications.register();
  console.log(TAG, 'FCM register() called — waiting for token callback');
};

export const removePushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.removeAllListeners();
    } catch (_) { /* ok */ }
    console.log(TAG, 'Listeners removed');
  } catch (e) {
    console.error(TAG, 'Cleanup error:', e);
  }
};

// ─── Token Registration ──────────────────────────────────────────

async function registerTokenWithBackend(userId, token) {
  if (!userId || !token) {
    console.error(TAG, 'Cannot register — missing userId or token');
    return;
  }

  // Retry up to 3 times with backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(TAG, `Registering token (attempt ${attempt})...`);
      const res = await axios.post(`${API}/fcm/register-token`, {
        user_id: userId,
        fcm_token: token,
      });
      console.log(TAG, 'TOKEN REGISTERED WITH BACKEND:', res.data?.success);
      
      // Store locally for diagnostics
      try {
        localStorage.setItem('heartlink_fcm_token', token.substring(0, 30) + '…');
        localStorage.setItem('heartlink_fcm_registered_at', new Date().toISOString());
      } catch (_) {}
      
      return; // Success — exit retry loop
    } catch (e) {
      console.error(TAG, `Token register attempt ${attempt} failed:`, e.message);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 2000)); // 2s, 4s backoff
      }
    }
  }
  console.error(TAG, 'TOKEN REGISTRATION FAILED after 3 attempts');
}

// ─── Notification Channel ────────────────────────────────────────

async function createNotificationChannel() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.createChannel({
      id: 'heartlink_messages',
      name: 'HeartLink Messages',
      description: 'Chat messages, matches, likes and alerts',
      importance: 5, // MAX — heads-up popup
      visibility: 1, // PUBLIC
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#FF6B9D',
    });
    console.log(TAG, 'Channel created: heartlink_messages');
  } catch (e) {
    console.log(TAG, 'Channel creation skipped:', e.message);
  }
}

// ─── Foreground Display ──────────────────────────────────────────

async function showLocalNotification(notification) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{
        title: notification.title || 'HeartLink',
        body: notification.body || '',
        id: Math.floor(Math.random() * 100000),
        schedule: { at: new Date(Date.now() + 100) },
        sound: 'default',
        channelId: 'heartlink_messages',
        extra: notification.data || {},
      }],
    });
    console.log(TAG, 'Foreground notification shown locally');
  } catch (e) {
    console.log(TAG, 'Local notification fallback failed:', e.message);
  }
}

// ─── Deep Link Navigation ────────────────────────────────────────

function navigateToScreen(data) {
  if (!data) return;
  console.log(TAG, 'Navigating for data:', JSON.stringify(data));

  if (data.route) {
    window.location.href = data.route;
    return;
  }

  switch (data.type) {
    case 'message':
      window.location.href = data.match_id ? `/chat/${data.match_id}` : '/matches';
      break;
    case 'match':
      window.location.href = data.match_id ? `/chat/${data.match_id}` : '/matches';
      break;
    case 'like':
    case 'superlike':
      window.location.href = '/likes';
      break;
    case 'profile_view':
      window.location.href = data.viewer_id ? `/profile/${data.viewer_id}` : '/profile-viewers';
      break;
    case 'verification':
    case 'photo_approved':
    case 'photo_rejected':
      window.location.href = '/profile';
      break;
    case 'online_status':
    case 'unread_reminder':
      window.location.href = '/matches';
      break;
    default:
      window.location.href = '/discover';
      break;
  }
}
