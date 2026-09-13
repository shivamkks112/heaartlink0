/**
 * HeartLink Ads Service — SINGLE SOURCE OF TRUTH
 * 
 * Proper state machine: IDLE → LOADING → LOADED → SHOWING → DISMISSED → IDLE
 * Uses @capacitor-community/admob v7 event listeners for reliable state tracking.
 * 
 * Rules:
 * - Only male, non-premium users see ads
 * - Interstitial after every 6 swipes
 * - Rewarded ad is user-initiated (extra swipes)
 * - No ads in chat or profile pages
 * - No duplicate requests while loading
 * - Only show when LOADED confirmed via event listener
 */

// Production Ad Unit IDs
const AD_CONFIG = {
  APP_ID: 'ca-app-pub-3735972538807236~9004238866',
  INTERSTITIAL_ID: 'ca-app-pub-3735972538807236/8105078421',
  REWARDED_ID: 'ca-app-pub-3735972538807236/8182111801',
  BANNER_ID: 'ca-app-pub-3735972538807236/9418160097',
};

const SWIPES_BEFORE_AD = 3;
const EXTRA_SWIPES_REWARD = 10;

// Ad states
const AdState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  LOADED: 'LOADED',
  SHOWING: 'SHOWING',
  FAILED: 'FAILED',
};

class AdsService {
  constructor() {
    this.initialized = false;
    this.swipeCount = 0;
    this.admob = null;
    this._listeners = [];

    // State machines for each ad type
    this.interstitialState = AdState.IDLE;
    this.rewardedState = AdState.IDLE;
    this.bannerState = AdState.IDLE;

    // Resolve callback when waiting for a load
    this._interstitialLoadResolve = null;
    this._rewardedLoadResolve = null;

    // Debug log (kept in memory, not shown to users)
    this._debugLog = [];
  }

  _log(msg) {
    const entry = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    this._debugLog.push(entry);
    if (this._debugLog.length > 50) this._debugLog.shift();
    console.log(`AdsService: ${msg}`);
  }

  isNative() {
    return typeof window !== 'undefined' &&
      window.Capacitor &&
      window.Capacitor.isNativePlatform &&
      window.Capacitor.isNativePlatform();
  }

  /**
   * Initialize AdMob SDK — call ONCE on app start
   */
  async initialize() {
    if (this.initialized) return true;
    if (!this.isNative()) {
      this._log('Not native, ads disabled');
      return false;
    }

    try {
      const mod = await import('@capacitor-community/admob');
      const AdMob = mod.AdMob;
      this.admob = AdMob;

      // Store event enums for proper listener names
      this._InterstitialEvents = mod.InterstitialAdPluginEvents;
      this._RewardEvents = mod.RewardAdPluginEvents;
      this._BannerEvents = mod.BannerAdPluginEvents;
      this._BannerAdSize = mod.BannerAdSize;
      this._BannerAdPosition = mod.BannerAdPosition;

      await AdMob.initialize({
        requestTrackingAuthorization: true,
        initializeForTesting: false,
      });

      this.initialized = true;
      this._log('SDK initialized');

      // Setup event listeners BEFORE any ad load
      this._setupListeners();

      // Preload interstitial (user will swipe soon)
      this._prepareInterstitial();

      return true;
    } catch (error) {
      this._log(`Init FAILED: ${error.message}`);
      return false;
    }
  }

  /**
   * Register all event listeners once
   */
  _setupListeners() {
    if (!this.admob || !this._InterstitialEvents) return;

    const IE = this._InterstitialEvents;
    const RE = this._RewardEvents;

    // ── Interstitial events ──
    this._addListener(IE.Loaded, () => {
      this._log('Interstitial LOADED');
      this.interstitialState = AdState.LOADED;
      if (this._interstitialLoadResolve) {
        this._interstitialLoadResolve(true);
        this._interstitialLoadResolve = null;
      }
    });

    this._addListener(IE.FailedToLoad, (err) => {
      this._log(`Interstitial FAILED to load: ${JSON.stringify(err)}`);
      this.interstitialState = AdState.FAILED;
      if (this._interstitialLoadResolve) {
        this._interstitialLoadResolve(false);
        this._interstitialLoadResolve = null;
      }
    });

    this._addListener(IE.Showed, () => {
      this._log('Interstitial SHOWED (impression)');
      this.interstitialState = AdState.SHOWING;
    });

    this._addListener(IE.FailedToShow, (err) => {
      this._log(`Interstitial FAILED to show: ${JSON.stringify(err)}`);
      this.interstitialState = AdState.IDLE;
      // Re-prepare for next opportunity
      setTimeout(() => this._prepareInterstitial(), 3000);
    });

    this._addListener(IE.Dismissed, () => {
      this._log('Interstitial DISMISSED');
      this.interstitialState = AdState.IDLE;
      // Prepare next ad after dismissal
      setTimeout(() => this._prepareInterstitial(), 2000);
    });

    // ── Rewarded events ──
    this._addListener(RE.Loaded, () => {
      this._log('Rewarded LOADED');
      this.rewardedState = AdState.LOADED;
      if (this._rewardedLoadResolve) {
        this._rewardedLoadResolve(true);
        this._rewardedLoadResolve = null;
      }
    });

    this._addListener(RE.FailedToLoad, (err) => {
      this._log(`Rewarded FAILED to load: ${JSON.stringify(err)}`);
      this.rewardedState = AdState.FAILED;
      if (this._rewardedLoadResolve) {
        this._rewardedLoadResolve(false);
        this._rewardedLoadResolve = null;
      }
    });

    this._addListener(RE.Showed, () => {
      this._log('Rewarded SHOWED');
      this.rewardedState = AdState.SHOWING;
    });

    this._addListener(RE.Dismissed, () => {
      this._log('Rewarded DISMISSED');
      this.rewardedState = AdState.IDLE;
    });

    this._addListener(RE.FailedToShow, (err) => {
      this._log(`Rewarded FAILED to show: ${JSON.stringify(err)}`);
      this.rewardedState = AdState.IDLE;
    });

    // Rewarded callback — this is where reward is confirmed
    this._addListener(RE.Rewarded, (reward) => {
      this._log(`Rewarded REWARD earned: ${JSON.stringify(reward)}`);
      this._lastRewardEarned = true;
    });

    // ── Banner events ──
    if (this._BannerEvents) {
      const BE = this._BannerEvents;

      this._addListener(BE.Loaded, () => {
        this._log('Banner LOADED');
        this.bannerState = AdState.LOADED;
      });

      this._addListener(BE.FailedToLoad, (err) => {
        this._log(`Banner FAILED to load: ${JSON.stringify(err)}`);
        this.bannerState = AdState.FAILED;
      });

      this._addListener(BE.Opened, () => {
        this._log('Banner OPENED (impression)');
      });

      this._addListener(BE.AdImpression, () => {
        this._log('Banner AD IMPRESSION recorded');
      });
    }
  }

  _addListener(event, handler) {
    if (!this.admob) return;
    const sub = this.admob.addListener(event, handler);
    this._listeners.push(sub);
  }

  /**
   * Prepare interstitial — only if IDLE or FAILED
   */
  _prepareInterstitial() {
    if (!this.admob) return;
    if (this.interstitialState === AdState.LOADING || this.interstitialState === AdState.LOADED) {
      this._log(`Interstitial skip prepare (state: ${this.interstitialState})`);
      return;
    }
    this.interstitialState = AdState.LOADING;
    this._log('Interstitial LOADING...');
    this.admob.prepareInterstitial({
      adId: AD_CONFIG.INTERSTITIAL_ID,
      isTesting: false,
    }).catch(err => {
      this._log(`Interstitial prepare error: ${err.message}`);
      this.interstitialState = AdState.FAILED;
    });
  }

  /**
   * Prepare rewarded — only if IDLE or FAILED
   */
  _prepareRewarded() {
    if (!this.admob) return;
    if (this.rewardedState === AdState.LOADING || this.rewardedState === AdState.LOADED) {
      this._log(`Rewarded skip prepare (state: ${this.rewardedState})`);
      return;
    }
    this.rewardedState = AdState.LOADING;
    this._log('Rewarded LOADING...');
    this.admob.prepareRewardVideoAd({
      adId: AD_CONFIG.REWARDED_ID,
      isTesting: false,
    }).catch(err => {
      this._log(`Rewarded prepare error: ${err.message}`);
      this.rewardedState = AdState.FAILED;
    });
  }

  /**
   * Wait for an ad to finish loading (max timeout)
   */
  _waitForInterstitialLoad(timeoutMs = 8000) {
    if (this.interstitialState === AdState.LOADED) return Promise.resolve(true);
    if (this.interstitialState !== AdState.LOADING) return Promise.resolve(false);
    return new Promise(resolve => {
      this._interstitialLoadResolve = resolve;
      setTimeout(() => {
        if (this._interstitialLoadResolve === resolve) {
          this._interstitialLoadResolve = null;
          resolve(false);
        }
      }, timeoutMs);
    });
  }

  _waitForRewardedLoad(timeoutMs = 10000) {
    if (this.rewardedState === AdState.LOADED) return Promise.resolve(true);
    if (this.rewardedState !== AdState.LOADING) return Promise.resolve(false);
    return new Promise(resolve => {
      this._rewardedLoadResolve = resolve;
      setTimeout(() => {
        if (this._rewardedLoadResolve === resolve) {
          this._rewardedLoadResolve = null;
          resolve(false);
        }
      }, timeoutMs);
    });
  }

  // ═══════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════

  /**
   * Track swipe and show interstitial after SWIPES_BEFORE_AD swipes
   * Respects ad-free reward period
   */
  async trackSwipe() {
    // Skip if user is in ad-free period
    if (this._isAdFree()) return false;
    this.swipeCount++;
    if (this.swipeCount >= SWIPES_BEFORE_AD) {
      this.swipeCount = 0;
      return await this.showInterstitial();
    }
    return false;
  }

  /** Check if user is in ad-free reward period */
  _isAdFree() {
    try {
      const stored = localStorage.getItem('heartlink_adfree_until');
      if (!stored) return false;
      return new Date(stored) > new Date();
    } catch { return false; }
  }

  /**
   * Show interstitial — only when LOADED
   */
  async showInterstitial() {
    if (!this.isNative() || !this.admob) return false;

    // If currently loading, wait for it
    if (this.interstitialState === AdState.LOADING) {
      this._log('Interstitial waiting for load...');
      const loaded = await this._waitForInterstitialLoad();
      if (!loaded) {
        this._log('Interstitial wait timed out — skipping');
        this._prepareInterstitial(); // try again for next time
        return false;
      }
    }

    // If not loaded, prepare for next time (don't request AND show in same cycle)
    if (this.interstitialState !== AdState.LOADED) {
      this._log(`Interstitial not ready (state: ${this.interstitialState}), preparing for next time`);
      this._prepareInterstitial();
      return false;
    }

    try {
      this.interstitialState = AdState.SHOWING;
      this._log('Interstitial SHOW attempt...');
      await this.admob.showInterstitial();
      // State transitions happen via event listeners (Showed → Dismissed)
      return true;
    } catch (error) {
      this._log(`Interstitial show error: ${error.message}`);
      this.interstitialState = AdState.IDLE;
      setTimeout(() => this._prepareInterstitial(), 3000);
      return false;
    }
  }

  /**
   * Show rewarded ad for extra swipes
   * @param {function} onReward - Called when user earns reward
   */
  async showRewardedForSwipes(onReward) {
    if (!this.isNative() || !this.admob) {
      // Web simulation
      const result = { success: true, swipes: EXTRA_SWIPES_REWARD, simulated: true };
      if (onReward) onReward(result);
      return result;
    }

    this._lastRewardEarned = false;

    // If not loaded, prepare and wait
    if (this.rewardedState !== AdState.LOADED) {
      this._log(`Rewarded not ready (state: ${this.rewardedState}), preparing...`);
      this._prepareRewarded();
      const loaded = await this._waitForRewardedLoad();
      if (!loaded) {
        this._log('Rewarded load timed out');
        return { success: false, swipes: 0, error: 'Ad not ready, try again' };
      }
    }

    try {
      this.rewardedState = AdState.SHOWING;
      this._log('Rewarded SHOW attempt...');
      await this.admob.showRewardVideoAd();

      // Wait for dismiss (with timeout)
      const result = await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.rewardedState !== AdState.SHOWING) {
            clearInterval(checkInterval);
            if (this._lastRewardEarned) {
              resolve({ success: true, swipes: EXTRA_SWIPES_REWARD });
            } else {
              resolve({ success: false, swipes: 0, error: 'Ad closed early' });
            }
          }
        }, 200);
        // Max wait 60s
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve({ success: false, swipes: 0, error: 'timeout' });
        }, 60000);
      });

      if (result.success && onReward) {
        onReward(result);
      }

      // Prepare next rewarded ad
      setTimeout(() => this._prepareRewarded(), 2000);
      return result;
    } catch (error) {
      this._log(`Rewarded show error: ${error.message}`);
      this.rewardedState = AdState.IDLE;
      this._prepareRewarded();
      return { success: false, swipes: 0, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════
  // BANNER ADS
  // ═══════════════════════════════════════════════════

  /**
   * Show banner ad at bottom of screen
   * Call when entering a screen that should show banner (e.g., Discover)
   */
  async showBanner() {
    if (!this.isNative() || !this.admob) return false;
    if (this.bannerState === AdState.SHOWING) {
      this._log('Banner already showing');
      return true;
    }

    try {
      this.bannerState = AdState.LOADING;
      this._log('Banner SHOW...');

      const options = {
        adId: AD_CONFIG.BANNER_ID,
        adSize: this._BannerAdSize?.ADAPTIVE_BANNER || 'ADAPTIVE_BANNER',
        position: this._BannerAdPosition?.BOTTOM_CENTER || 'BOTTOM_CENTER',
        margin: 0,
        isTesting: false,
      };

      await this.admob.showBanner(options);
      this.bannerState = AdState.SHOWING;
      this._log('Banner SHOWING');
      return true;
    } catch (error) {
      this._log(`Banner show error: ${error.message}`);
      this.bannerState = AdState.FAILED;
      return false;
    }
  }

  /**
   * Hide banner ad
   * Call when leaving the screen or entering chat
   */
  async hideBanner() {
    if (!this.isNative() || !this.admob) return false;
    if (this.bannerState !== AdState.SHOWING) return false;

    try {
      await this.admob.hideBanner();
      this.bannerState = AdState.IDLE;
      this._log('Banner HIDDEN');
      return true;
    } catch (error) {
      this._log(`Banner hide error: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove banner completely (cleanup)
   */
  async removeBanner() {
    if (!this.isNative() || !this.admob) return false;
    try {
      await this.admob.removeBanner();
      this.bannerState = AdState.IDLE;
      this._log('Banner REMOVED');
      return true;
    } catch (error) {
      this._log(`Banner remove error: ${error.message}`);
      return false;
    }
  }

  getSwipeCount() { return this.swipeCount; }
  getSwipesUntilAd() { return SWIPES_BEFORE_AD - this.swipeCount; }
  resetSwipeCount() { this.swipeCount = 0; }

  isAdAvailable() {
    return {
      interstitial: this.interstitialState === AdState.LOADED,
      rewarded: this.rewardedState === AdState.LOADED,
      banner: this.bannerState === AdState.SHOWING,
      isNative: this.isNative(),
      states: {
        interstitial: this.interstitialState,
        rewarded: this.rewardedState,
        banner: this.bannerState,
      }
    };
  }

  /** Get debug log (for dev diagnostics only) */
  getDebugLog() { return [...this._debugLog]; }

  /** Cleanup listeners */
  destroy() {
    this._listeners.forEach(sub => {
      try { sub.remove(); } catch(e) {}
    });
    this._listeners = [];
  }
}

const adsService = new AdsService();
export default adsService;
export { AD_CONFIG, SWIPES_BEFORE_AD, EXTRA_SWIPES_REWARD };
