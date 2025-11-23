import { PushNotifications } from '@capacitor/push-notifications';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export const initPushNotifications = async (userId) => {
  try {
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

    // Handle notification received (app in foreground)
    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        console.log('Push notification received:', notification);
        // Show in-app notification or update UI
      }
    );

    // Handle notification tapped (app in background)
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification) => {
        console.log('Push notification action performed:', notification);
        // Navigate to relevant screen
        const data = notification.notification.data;
        if (data.type === 'message') {
          // Navigate to chat
          window.location.href = `/chat/${data.match_id}`;
        } else if (data.type === 'like' || data.type === 'match') {
          // Navigate to matches
          window.location.href = '/matches';
        }
      }
    );

    console.log('Push notifications initialized successfully');
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};

export const removePushNotifications = async () => {
  try {
    await PushNotifications.removeAllListeners();
  } catch (error) {
    console.error('Error removing push notification listeners:', error);
  }
};
