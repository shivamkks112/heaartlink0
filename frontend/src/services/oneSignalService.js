import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const ONESIGNAL_APP_ID = 'ad0b57dc-908b-4d84-8654-d6b5dd50684e';

export const initOneSignal = async (userId) => {
  try {
    // Dynamically import OneSignal
    const OneSignal = (await import('react-onesignal')).default;
    
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: { enable: false },
    });

    // Login with external user ID
    if (userId) {
      await OneSignal.login(userId);
      console.log('OneSignal: User logged in with ID:', userId);
      
      // Get subscription ID and register with backend
      try {
        const subscriptionId = await OneSignal.User.PushSubscription.id;
        if (subscriptionId) {
          await axios.post(`${API}/user/onesignal/register`, {
            user_id: userId,
            onesignal_player_id: subscriptionId
          });
          console.log('OneSignal: Registered with backend, subscription:', subscriptionId);
        }
      } catch (e) {
        console.log('OneSignal: Backend registration skipped:', e.message);
      }
    }

    // Set notification click handler for deep links
    OneSignal.Notifications.addEventListener('click', (event) => {
      console.log('OneSignal notification clicked:', event);
      const data = event.notification?.additionalData || {};
      
      if (data.route) {
        window.location.href = data.route;
      } else if (data.type === 'message' && data.match_id) {
        window.location.href = `/chat/${data.match_id}`;
      } else if (data.type === 'like' || data.type === 'superlike') {
        window.location.href = '/likes';
      } else if (data.type === 'match' && data.match_id) {
        window.location.href = `/chat/${data.match_id}`;
      } else if (data.type === 'profile_view' && data.viewer_id) {
        window.location.href = `/profile/${data.viewer_id}`;
      }
    });

    console.log('OneSignal initialized successfully');
  } catch (error) {
    console.error('OneSignal init error:', error);
  }
};

export const logoutOneSignal = async () => {
  try {
    const OneSignal = (await import('react-onesignal')).default;
    await OneSignal.logout();
  } catch (e) {
    console.log('OneSignal logout error:', e);
  }
};
