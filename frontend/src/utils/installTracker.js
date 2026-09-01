/**
 * HeartLink Install Tracker
 * Tracks first-open/install events for acquisition analytics.
 * Privacy-safe: uses a random UUID, no device fingerprinting.
 */
import { API } from '@/config/api';
import { Capacitor } from '@capacitor/core';

const INSTALL_KEY = 'heartlink_installation_id';
const TRACKED_KEY = 'heartlink_install_tracked';

function generateInstallId() {
  return 'hl_' + crypto.randomUUID();
}

function getInstallId() {
  let id = localStorage.getItem(INSTALL_KEY);
  if (!id) {
    id = generateInstallId();
    localStorage.setItem(INSTALL_KEY, id);
  }
  return id;
}

function getPlatform() {
  if (Capacitor.isNativePlatform()) return Capacitor.getPlatform(); // 'android' or 'ios'
  return 'web';
}

function getAppVersion() {
  return '4.0.0'; // Update with each release
}

function getAcquisitionSource() {
  // Check URL params for UTM / deep-link attribution
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    if (utmSource) {
      if (utmSource.includes('facebook') || utmSource.includes('meta') || utmSource.includes('fb')) return 'meta_ads';
      if (utmSource.includes('google') || utmSource.includes('gclid')) return 'google_ads';
      if (utmSource.includes('referral')) return 'referral';
      return 'organic';
    }
    if (params.get('gclid')) return 'google_ads';
    if (params.get('fbclid')) return 'meta_ads';
    if (params.get('ref')) return 'referral';
    // Check referrer
    if (document.referrer) {
      if (document.referrer.includes('facebook.com') || document.referrer.includes('instagram.com')) return 'meta_ads';
      if (document.referrer.includes('google.com')) return 'google_ads';
      return 'organic';
    }
  } catch (_) {}
  return 'direct';
}

function getUtmParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null,
    };
  } catch (_) {
    return {};
  }
}

/**
 * Track first open. Idempotent — only sends once per installation.
 */
export async function trackInstall() {
  const alreadyTracked = localStorage.getItem(TRACKED_KEY);
  const installId = getInstallId();
  
  if (alreadyTracked) {
    // Just ping last_active
    try {
      await fetch(`${API}/analytics/track-install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installation_id: installId }),
      });
    } catch (_) {}
    return installId;
  }
  
  try {
    const utm = getUtmParams();
    const resp = await fetch(`${API}/analytics/track-install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installation_id: installId,
        platform: getPlatform(),
        app_version: getAppVersion(),
        acquisition_source: getAcquisitionSource(),
        ...utm,
      }),
    });
    if (resp.ok) {
      localStorage.setItem(TRACKED_KEY, 'true');
    }
  } catch (err) {
    console.warn('Install tracking failed:', err);
  }
  return installId;
}

/**
 * Track a funnel event (signup_started, signup_completed, first_login, etc.)
 */
export async function trackEvent(eventType, extra = {}) {
  const installId = getInstallId();
  try {
    await fetch(`${API}/analytics/track-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installation_id: installId,
        event_type: eventType,
        ...extra,
      }),
    });
  } catch (_) {}
}

/**
 * Get the current installation ID (for linking to signup)
 */
export function getStoredInstallId() {
  return localStorage.getItem(INSTALL_KEY);
}
