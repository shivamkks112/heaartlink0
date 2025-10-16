// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase config from user
const firebaseConfig = {
  apiKey: "AIzaSyCbcKatJZVvXgShJ8lOGg-EgMjpgYNyZrk",
  authDomain: "heartlink-6abe9.firebaseapp.com",
  databaseURL: "https://heartlink-6abe9-default-rtdb.firebaseio.com",
  projectId: "heartlink-6abe9",
  storageBucket: "heartlink-6abe9.firebasestorage.app",
  messagingSenderId: "803969423139",
  appId: "1:803969423139:web:f6ff59de191329b3fade96",
  measurementId: "G-MEQ38V74VL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

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
