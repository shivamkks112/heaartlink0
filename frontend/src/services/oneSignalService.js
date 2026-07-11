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
          console.log('OneSignal: Registered with backend');
        }
      } catch (e) {
        console.log('OneSignal: Backend registration skipped:', e.message);
      }
    }

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
