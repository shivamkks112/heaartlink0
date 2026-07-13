/**
 * Native Firebase Phone Auth for Capacitor
 * Uses @capacitor-firebase/authentication for native OTP (no reCAPTCHA needed)
 * Falls back to web-based Firebase auth if native is not available
 */
import { Capacitor } from '@capacitor/core';

let FirebaseAuth = null;
let verificationId = null;

const isNative = Capacitor.isNativePlatform();

// Lazy load native plugin
const getFirebaseAuth = async () => {
  if (!FirebaseAuth) {
    if (isNative) {
      const mod = await import('@capacitor-firebase/authentication');
      FirebaseAuth = mod.FirebaseAuthentication;
    }
  }
  return FirebaseAuth;
};

/**
 * Send OTP to phone number using native Firebase Auth
 */
export const sendNativeOTP = async (phoneNumber) => {
  try {
    if (!isNative) {
      return { success: false, error: 'Native platform required', useWebFallback: true };
    }

    const auth = await getFirebaseAuth();
    if (!auth) {
      return { success: false, error: 'Firebase Auth plugin not available', useWebFallback: true };
    }

    const result = await auth.signInWithPhoneNumber({ phoneNumber });
    verificationId = result.verificationId;

    return { success: true, verificationId: result.verificationId };
  } catch (error) {
    console.error('Native OTP error:', error);
    return { success: false, error: error.message || 'Failed to send OTP' };
  }
};

/**
 * Verify OTP code
 */
export const verifyNativeOTP = async (code) => {
  try {
    if (!verificationId) {
      return { success: false, error: 'No verification in progress' };
    }

    const auth = await getFirebaseAuth();
    const result = await auth.confirmVerificationCode({
      verificationId,
      verificationCode: code,
    });

    // Get user info
    const user = result.user;
    verificationId = null;

    return {
      success: true,
      user: {
        uid: user?.uid,
        phoneNumber: user?.phoneNumber,
      }
    };
  } catch (error) {
    console.error('Verify OTP error:', error);
    let errorMessage = error.message || 'Invalid OTP';
    if (error.message?.includes('invalid-verification-code')) {
      errorMessage = 'Galat OTP. Sahi code daalo.';
    } else if (error.message?.includes('session-expired')) {
      errorMessage = 'OTP expire ho gaya. Dobara bhejo.';
    }
    return { success: false, error: errorMessage };
  }
};

/**
 * Check if native phone auth is available
 */
export const isNativeAuthAvailable = () => isNative;
