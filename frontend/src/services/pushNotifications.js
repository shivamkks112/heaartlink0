import { Capacitor } from '@capacitor/core';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export const initPushNotifications = async (userId) => {
  // Only run on native platforms (Android/iOS), skip web
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications: Skipped (web platform)');
    return;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Request permission
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission denied');
      return;
    }

    // Register with FCM
    await PushNotifications.register();

    // Listen for registration
    await PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      
      // Send FCM token to backend
      try {
        await axios.post(`${API}/fcm/register-token`, {
          user_id: userId,
          fcm_token: token.value
        });
        console.log('FCM token registered with backend');
      } catch (error) {
        console.error('Failed to register FCM token with backend:', error);
      }
    });

    // Listen for registration errors
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    // Handle notification received (app in FOREGROUND)
    // Show a local notification so user sees it even when app is open
    await PushNotifications.addListener(
      'pushNotificationReceived',
      async (notification) => {
        console.log('Push notification received (foreground):', notification);
        
        try {
          // Show as local notification so heads-up popup appears
          await LocalNotifications.schedule({
            notifications: [
              {
                title: notification.title || 'HeartLink',
                body: notification.body || '',
                id: Date.now(),
                schedule: { at: new Date(Date.now() + 100) },
                sound: 'default',
                extra: notification.data || {},
                channelId: 'heartlink_notifications',
              },
            ],
          });
        } catch (localErr) {
          console.log('Local notification fallback failed:', localErr);
        }
      }
    );

    // Handle notification tapped (app in BACKGROUND or KILLED)
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification) => {
        console.log('Push notification action performed:', notification);
        const data = notification.notification.data;
        handleNotificationNavigation(data);
      }
    );

    // Handle local notification tapped (foreground re-display)
    try {
      await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (notification) => {
          console.log('Local notification tapped:', notification);
          const data = notification.notification.extra || {};
          handleNotificationNavigation(data);
        }
      );
    } catch (e) {
      console.log('Local notification listener setup skipped:', e);
    }

    // Create notification channel for Android 8+ (HIGH importance for heads-up)
    try {
      await LocalNotifications.createChannel({
        id: 'heartlink_notifications',
        name: 'HeartLink Notifications',
        description: 'All HeartLink notifications',
        importance: 5, // MAX importance for heads-up
        visibility: 1, // Public
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#FF6B9D',
      });
      console.log('Notification channel created');
    } catch (e) {
      console.log('Channel creation skipped (may already exist):', e);
    }

    console.log('Push notifications initialized successfully');
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};

/**
 * Handle deep link navigation from notification tap
 */
function handleNotificationNavigation(data) {
  if (!data) return;
  
  // Use route from notification data (most reliable)
  if (data.route) {
    window.location.href = data.route;
    return;
  }
  
  // Fallback navigation based on type
  switch (data.type) {
    case 'message':
      if (data.match_id) {
        window.location.href = `/chat/${data.match_id}`;
      } else {
        window.location.href = '/matches';
      }
      break;
    case 'match':
    case 'new_match':
      if (data.match_id) {
        window.location.href = `/chat/${data.match_id}`;
      } else {
        window.location.href = '/matches';
      }
      break;
    case 'like':
    case 'superlike':
    case 'new_like':
      window.location.href = '/likes';
      break;
    case 'profile_view':
      if (data.viewer_id) {
        window.location.href = `/profile/${data.viewer_id}`;
      } else {
        window.location.href = '/profile-viewers';
      }
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
    case 'welcome':
    case 'engagement':
    case 'discovery':
      window.location.href = '/discover';
      break;
    case 'admin':
    case 'custom':
    case 'promo':
    default:
      window.location.href = '/discover';
      break;
  }
}

export const removePushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await PushNotifications.removeAllListeners();
    await LocalNotifications.removeAllListeners();
  } catch (error) {
    console.error('Error removing push notification listeners:', error);
  }
};
