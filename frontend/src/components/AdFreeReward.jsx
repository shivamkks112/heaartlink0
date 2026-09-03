import { useState, useEffect, useRef, useCallback } from 'react';
import { Gift, Check, Clock, Loader2, X, AlertCircle } from 'lucide-react';
import { API } from '@/config/api';
import adsService from '@/services/AdsService';

const ADFREE_STORAGE_KEY = 'heartlink_adfree_until';

/**
 * Ad-Free Reward Widget
 * - Compact, non-intrusive — sits below action buttons or in profile area
 * - "Watch 2 short ads" → 30min ad-free
 * - Shows countdown timer when active
 * - Respects premium (never shown)
 * - Persists across app restarts
 */
const AdFreeReward = ({ user }) => {
  const [config, setConfig] = useState(null);
  const [adFreeUntil, setAdFreeUntil] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [adsCompleted, setAdsCompleted] = useState(0);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState('');
  const [showWidget, setShowWidget] = useState(false);
  const sessionLock = useRef(false);
  const timerRef = useRef(null);

  const isPremium = user?.is_premium || user?.isPremium;
  const isMale = user?.gender?.toLowerCase() === 'male';

  // Load config + check status on mount
  useEffect(() => {
    if (isPremium || !isMale) return;

    const init = async () => {
      try {
        // Fetch config
        const cfgRes = await fetch(`${API}/adfree/config`);
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          setConfig(cfg);
          if (!cfg.enabled) return;
        }

        // Check status from server
        const statusRes = await fetch(`${API}/adfree/status/${user.id}`);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.ad_free && status.reason === 'reward' && status.remaining_seconds > 0) {
            const expires = new Date(Date.now() + status.remaining_seconds * 1000).toISOString();
            setAdFreeUntil(expires);
            localStorage.setItem(ADFREE_STORAGE_KEY, expires);
          }
        }

        // Also check localStorage for persisted state
        const stored = localStorage.getItem(ADFREE_STORAGE_KEY);
        if (stored) {
          const exp = new Date(stored);
          if (exp > new Date()) {
            setAdFreeUntil(stored);
          } else {
            localStorage.removeItem(ADFREE_STORAGE_KEY);
            // Track expiry
            fetch(`${API}/adfree/track`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'ad_free_reward_expired' }),
            }).catch(() => {});
          }
        }

        setShowWidget(true);
      } catch {
        // Silent — don't block app
      }
    };

    init();
    // Initialize ads service for rewarded ads
    adsService.initialize();
  }, [user?.id, isPremium, isMale]);

  // Countdown timer
  useEffect(() => {
    if (!adFreeUntil) { setRemaining(0); return; }

    const update = () => {
      const left = Math.max(0, Math.floor((new Date(adFreeUntil) - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setAdFreeUntil(null);
        localStorage.removeItem(ADFREE_STORAGE_KEY);
      }
    };

    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [adFreeUntil]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleWatchAd = useCallback(async () => {
    if (sessionLock.current || watching) return;
    sessionLock.current = true;
    setWatching(true);
    setError('');

    const required = config?.required_ads || 2;

    try {
      // Track start
      fetch(`${API}/adfree/track`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'rewarded_ad_started' }),
      }).catch(() => {});

      // Show rewarded ad
      const result = await adsService.showRewardedForSwipes(null);

      if (result.success || result.simulated) {
        const newCount = adsCompleted + 1;
        setAdsCompleted(newCount);

        // Track completion
        fetch(`${API}/adfree/track`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'rewarded_ad_completed' }),
        }).catch(() => {});

        if (newCount >= required) {
          // Activate reward via server
          const activateRes = await fetch(`${API}/adfree/activate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, ads_completed: newCount }),
          });

          if (activateRes.ok) {
            const data = await activateRes.json();
            const expires = data.expires_at;
            setAdFreeUntil(expires);
            localStorage.setItem(ADFREE_STORAGE_KEY, expires);
            setAdsCompleted(0);
          }
        }
      } else {
        // Track failure
        fetch(`${API}/adfree/track`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'rewarded_ad_failed' }),
        }).catch(() => {});
        setError(result.error === 'Ad closed early' ? 'Please watch the full ad to earn your reward.' : "Ad isn't available right now. Please try again later.");
      }
    } catch {
      setError("Something went wrong. Try again later.");
    }

    setWatching(false);
    sessionLock.current = false;
  }, [watching, adsCompleted, config, user?.id]);

  // Don't show for premium, female, or if config disabled
  if (isPremium || !isMale || !showWidget || !config?.enabled) return null;

  const required = config?.required_ads || 2;
  const isActive = adFreeUntil && remaining > 0;

  // ── Active state: show timer ──
  if (isActive) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-full mx-auto w-fit"
        style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}
        data-testid="adfree-timer"
      >
        <Check className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-medium text-emerald-600">Ad-Free</span>
        <span className="text-xs font-bold text-emerald-700 tabular-nums">{formatTime(remaining)}</span>
      </div>
    );
  }

  // ── In-progress: watching ads ──
  if (adsCompleted > 0 && adsCompleted < required) {
    return (
      <div
        className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl mx-auto max-w-[280px]"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        data-testid="adfree-progress"
      >
        <p className="text-xs text-white/70 font-medium">{adsCompleted} of {required} ads completed</p>
        <button
          onClick={handleWatchAd}
          disabled={watching}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          data-testid="adfree-continue-btn"
        >
          {watching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
          {watching ? 'Loading...' : 'Watch Next Ad'}
        </button>
      </div>
    );
  }

  // ── Default: CTA to start ──
  return (
    <div
      className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl mx-auto max-w-[280px]"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
      data-testid="adfree-cta"
    >
      <div className="flex items-center gap-1.5">
        <Gift className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-white/80">Get {config?.reward_minutes || 30} min Ad-Free</span>
      </div>
      <p className="text-[10px] text-white/40">Watch {required} short ads</p>
      <button
        onClick={() => {
          fetch(`${API}/adfree/track`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'rewarded_ad_prompt_shown' }),
          }).catch(() => {});
          handleWatchAd();
        }}
        disabled={watching}
        className="mt-1 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
        style={{
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          boxShadow: '0 2px 8px rgba(245,158,11,0.3)',
        }}
        data-testid="adfree-watch-btn"
      >
        {watching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
        {watching ? 'Loading...' : 'Watch Ad'}
      </button>
      {error && (
        <div className="flex items-center gap-1 mt-1">
          <AlertCircle className="w-3 h-3 text-red-400" />
          <p className="text-[10px] text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
};

/**
 * Check if user is currently ad-free (call from anywhere)
 */
export const isUserAdFree = () => {
  const stored = localStorage.getItem(ADFREE_STORAGE_KEY);
  if (!stored) return false;
  return new Date(stored) > new Date();
};

export default AdFreeReward;
