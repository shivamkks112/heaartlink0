/**
 * HeartLink API Configuration
 * 
 * PERMANENT FIX for the "git pull breaks APK" issue:
 * - On Capacitor (Android APK): Always uses PRODUCTION_URL
 * - On Web browser: Uses REACT_APP_BACKEND_URL from .env
 * 
 * This file is the SINGLE SOURCE OF TRUTH for the API base URL.
 * No other file should read process.env.REACT_APP_BACKEND_URL directly.
 */

import { Capacitor } from '@capacitor/core';

// Production URL — hardcoded so git pull can never break it
const PRODUCTION_URL = 'https://www.heartlink.co.in';

function getBackendUrl() {
  // On native Android/iOS: ALWAYS use production URL
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_URL;
  }
  // On web: use .env (preview, production deploy, or local dev)
  return process.env.REACT_APP_BACKEND_URL || PRODUCTION_URL;
}

export const BACKEND_URL = getBackendUrl();
export const API = `${BACKEND_URL}/api`;
export const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
