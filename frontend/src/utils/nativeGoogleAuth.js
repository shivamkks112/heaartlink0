/**
 * Native Google Authentication Helper
 * Uses @codetrix-studio/capacitor-google-auth for native sign-in
 */
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

const WEB_CLIENT_ID = '22174933674-hd0na7ri4rq69eo3q71is8k7quk6kmf.apps.googleusercontent.com';

/**
 * Initialize Google Auth
 * Call this once on app startup
 */
export const initGoogleAuth = () => {
  if (Capacitor.getPlatform() !== 'web') {
    GoogleAuth.initialize({
      clientId: WEB_CLIENT_ID,
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    });
  }
};

/**
 * Native Google Sign-in for Android/iOS
 * @returns {Promise<Object>} User data from Google
 */
export const nativeGoogleSignIn = async () => {
  try {
    console.log('🔍 Starting native Google Sign-in...');
    
    const result = await GoogleAuth.signIn();
    
    console.log('✅ Native Google Sign-in successful');
    console.log('User:', result);
    
    // Return user data in Firebase format
    return {
      uid: result.id,
      email: result.email,
      displayName: result.name,
      photoURL: result.imageUrl,
      phoneNumber: null,
    };
  } catch (error) {
    console.error('❌ Native Google Sign-in error:', error);
    throw error;
  }
};

/**
 * Sign out from Google
 */
export const nativeGoogleSignOut = async () => {
  try {
    await GoogleAuth.signOut();
    console.log('✅ Signed out from Google');
  } catch (error) {
    console.error('❌ Sign out error:', error);
  }
};

/**
 * Check if running on native platform
 */
export const isNativePlatform = () => {
  return Capacitor.getPlatform() !== 'web';
};
