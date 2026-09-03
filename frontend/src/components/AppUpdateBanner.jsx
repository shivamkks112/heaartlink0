import { useState, useEffect, useCallback } from 'react';
import { X, Download, Rocket } from 'lucide-react';
import { API } from '@/config/api';

const DISMISS_STORAGE_KEY = 'heartlink_update_dismissed';

/**
 * Smart App Update Banner
 * - Checks /api/app-update/check on mount
 * - Shows non-intrusive banner if update available
 * - Respects dismissal (doesn't spam, waits min_dismiss_hours)
 * - "Update Now" opens Play Store
 * - Tracks analytics: shown, clicked, dismissed
 */
const AppUpdateBanner = () => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [visible, setVisible] = useState(false);

  const getInstalledVersionCode = () => {
    // Capacitor native: window.AppInfo or meta tag
    try {
      const meta = document.querySelector('meta[name="app-version-code"]');
      if (meta) return parseInt(meta.content) || 0;
    } catch {}
    // Fallback: check localStorage for last known version
    return parseInt(localStorage.getItem('heartlink_version_code') || '0');
  };

  const isDismissed = useCallback((latestCode, minHours) => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) return false;
      const { versionCode, dismissedAt } = JSON.parse(raw);
      if (versionCode !== latestCode) return false; // new version, show again
      const elapsed = (Date.now() - dismissedAt) / 3600000; // hours
      return elapsed < (minHours || 24);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const versionCode = getInstalledVersionCode();
        const res = await fetch(`${API}/app-update/check?version_code=${versionCode}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.update_available) return;

        // Check if user already dismissed this version recently
        if (isDismissed(data.latest_version_code, data.min_dismiss_hours)) return;

        setUpdateInfo(data);
        setVisible(true);

        // Track shown
        fetch(`${API}/app-update/analytics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'update_prompt_shown' }),
        }).catch(() => {});
      } catch {
        // Silently fail — app continues normally
      }
    };

    // Small delay so it doesn't block initial render
    const timer = setTimeout(checkUpdate, 3000);
    return () => clearTimeout(timer);
  }, [isDismissed]);

  const handleUpdate = () => {
    // Track click
    fetch(`${API}/app-update/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'update_prompt_clicked' }),
    }).catch(() => {});

    // Open Play Store
    const url = updateInfo?.play_store_url || 'https://play.google.com/store/apps/details?id=com.heartlink.app';
    window.open(url, '_system');
  };

  const handleDismiss = () => {
    // Track dismiss
    fetch(`${API}/app-update/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'update_prompt_dismissed' }),
    }).catch(() => {});

    // Store dismissal
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify({
      versionCode: updateInfo?.latest_version_code,
      dismissedAt: Date.now(),
    }));

    setVisible(false);
  };

  if (!visible || !updateInfo) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] px-3 animate-in"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}
      data-testid="app-update-banner"
    >
      <div
        className="max-w-lg mx-auto rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        <div className="px-4 py-3.5 flex items-start gap-3">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <Rocket className="w-5 h-5 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">
              {updateInfo.title || 'New HeartLink Update Available'}
            </p>
            <p className="text-white/60 text-xs mt-1 leading-snug">
              {updateInfo.message || 'Update now for a smoother experience.'}
            </p>

            {/* Buttons */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleUpdate}
                data-testid="update-now-btn"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 2px 12px rgba(16,185,129,0.4)',
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Update Now
              </button>
              {!updateInfo.force_update && (
                <button
                  onClick={handleDismiss}
                  data-testid="update-later-btn"
                  className="px-4 py-2 rounded-xl text-xs font-medium text-white/50 hover:text-white/80 transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  Later
                </button>
              )}
            </div>
          </div>

          {/* Close (only if not forced) */}
          {!updateInfo.force_update && (
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
              data-testid="update-close-btn"
            >
              <X className="w-4 h-4 text-white/40" />
            </button>
          )}
        </div>

        {/* Version tag */}
        <div className="px-4 pb-2.5 flex items-center gap-2">
          <span className="text-[10px] text-white/30">
            v{updateInfo.latest_version_name || '?'} available
          </span>
        </div>
      </div>
    </div>
  );
};

export default AppUpdateBanner;
