/**
 * Firebase Cloud Messaging Helper Functions
 */
import { messaging } from './config';
import { getToken, onMessage } from 'firebase/messaging';
import axios from 'axios';

import { BACKEND_URL, API } from '@/config/api';

// VAPID key from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || import.meta.env.REACT_APP_FIREBASE_VAPID_KEY;

/**
 * Request permission and get FCM token
 * @param {string} userId - Current user ID
 * @returns {Promise<string|null>} FCM token or null
 */
export const requestNotificationPermission = async (userId) => {
  try {
    if (!messaging) {
      console.log('Messaging not supported');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY
      });
      
      if (token) {
        console.log('✅ FCM Token:', token);
        
        // Register token with backend
        await registerTokenWithBackend(userId, token);
        
        return token;
      } else {
        console.log('❌ No registration token available');
        return null;
      }
    } else {
      console.log('❌ Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

/**
 * Register FCM token with backend
 * @param {string} userId - User ID
 * @param {string} fcmToken - FCM token
 */
const registerTokenWithBackend = async (userId, fcmToken) => {
  try {
    const response = await axios.post(`${API}/fcm/register-token`, {
      user_id: userId,
      fcm_token: fcmToken
    });
    console.log('✅ FCM token registered with backend:', response.data);
  } catch (error) {
    console.error('❌ Error registering FCM token:', error);
  }
};

/**
 * Setup foreground message listener
 * This handles notifications when app is open
 */
export const setupForegroundMessageListener = (onMessageCallback) => {
  if (!messaging) {
    console.log('Messaging not supported');
    return () => {};
  }

  // Listen for foreground messages
  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('🔔 Foreground message received:', payload);
    
    const { notification, data } = payload;
    
    // Show browser notification
    if (notification && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data?.type || 'default',
        requireInteraction: true,
        data: data
      });
    }
    
    // Call custom callback
    if (onMessageCallback) {
      onMessageCallback(payload);
    }
  });
  
  return unsubscribe;
};

/**
 * Send test notification
 * @param {string} userId - User ID to send test notification to
 */
export const sendTestNotification = async (userId) => {
  try {
    const response = await axios.post(`${API}/fcm/send-test?user_id=${userId}`);
    console.log('✅ Test notification sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    throw error;
  }
};

/**
 * Check if notifications are supported
 * @returns {boolean}
 */
export const areNotificationsSupported = () => {
  return 'Notification' in window && messaging !== null;
};

/**
 * Get current notification permission status
 * @returns {NotificationPermission}
 */
export const getNotificationPermission = () => {
  if ('Notification' in window) {
    return Notification.permission;
  }
  return 'default';
};
