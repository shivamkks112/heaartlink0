// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Phone Auth helpers
export const setupRecaptcha = (containerId) => {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      'size': 'invisible',
      'callback': (response) => {
        console.log('reCAPTCHA solved');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
        window.recaptchaVerifier = null;
      }
    });
  }
  return window.recaptchaVerifier;
};

export const sendOTP = async (phoneNumber, recaptchaVerifier) => {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    window.confirmationResult = confirmationResult;
    return { success: true, confirmationResult };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return { success: false, error: error.message };
  }
};

export const verifyOTP = async (otp) => {
  try {
    if (!window.confirmationResult) {
      throw new Error('No OTP was sent. Please request a new OTP.');
    }
    const result = await window.confirmationResult.confirm(otp);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { success: false, error: error.message };
  }
};

// Initialize Firebase Cloud Messaging
let messaging = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.log('Messaging not available:', error);
  }
}
export { messaging };

// Analytics (optional)
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.log('Analytics not available:', error);
  }
}
export { analytics };

export default app;
