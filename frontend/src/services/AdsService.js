/**
 * HeartLink Ads Service
 * Clean, centralized ad management using AdMob
 * 
 * Features:
 * - Interstitial ads after every 6 swipes
 * - Rewarded ads for +10 extra swipes
 * - No ads in chat or profile pages
 */

// AdMob Ad Unit IDs
const AD_CONFIG = {
  APP_ID: 'ca-app-pub-3735972538807236~9004238866',
  INTERSTITIAL_ID: 'ca-app-pub-3735972538807236/8105078421',
  REWARDED_ID: 'ca-app-pub-3735972538807236/8182111801',
};

// Swipe counter for interstitial ads
const SWIPES_BEFORE_AD = 6;
const EXTRA_SWIPES_REWARD = 10;

class AdsService {
  constructor() {
    this.initialized = false;
    this.swipeCount = 0;
    this.interstitialReady = false;
    this.rewardedReady = false;
    this.isNativeApp = false;
    this.admob = null;
  }

  /**
   * Check if running in native Capacitor app
   */
  isNative() {
    return typeof window !== 'undefined' && 
           window.Capacitor && 
           window.Capacitor.isNativePlatform && 
           window.Capacitor.isNativePlatform();
  }

  /**
   * Initialize AdMob SDK
   */
  async initialize() {
    if (this.initialized) return true;
    
    if (!this.isNative()) {
      console.log('AdsService: Not a native app, ads disabled');
      return false;
    }

    try {
      // Dynamic import for Capacitor AdMob
      const { AdMob } = await import('@capacitor-community/admob');
      this.admob = AdMob;
      
      await AdMob.initialize({
        requestTrackingAuthorization: true,
        initializeForTesting: false,
      });
      
      this.initialized = true;
      this.isNativeApp = true;
      console.log('AdsService: ✅ Initialized successfully');
      
      // Pre-load ads
      await this.prepareInterstitial();
      await this.prepareRewarded();
      
      return true;
    } catch (error) {
      console.error('AdsService: ❌ Initialization failed', error);
      return false;
    }
  }

  /**
   * Prepare interstitial ad
   */
  async prepareInterstitial() {
    if (!this.isNative() || !this.admob) return;
    
    try {
      await this.admob.prepareInterstitial({
        adId: AD_CONFIG.INTERSTITIAL_ID,
        isTesting: false,
      });
      this.interstitialReady = true;
      console.log('AdsService: Interstitial ad ready');
    } catch (error) {
      console.error('AdsService: Failed to prepare interstitial', error);
      this.interstitialReady = false;
    }
  }

  /**
   * Prepare rewarded ad
   */
  async prepareRewarded() {
    if (!this.isNative() || !this.admob) return;
    
    try {
      await this.admob.prepareRewardVideoAd({
        adId: AD_CONFIG.REWARDED_ID,
        isTesting: false,
      });
      this.rewardedReady = true;
      console.log('AdsService: Rewarded ad ready');
    } catch (error) {
      console.error('AdsService: Failed to prepare rewarded', error);
      this.rewardedReady = false;
    }
  }

  /**
   * Track swipe and show interstitial after 6 swipes
   * @returns {boolean} Whether an ad was shown
   */
  async trackSwipe() {
    this.swipeCount++;
    console.log(`AdsService: Swipe count: ${this.swipeCount}/${SWIPES_BEFORE_AD}`);
    
    if (this.swipeCount >= SWIPES_BEFORE_AD) {
      this.swipeCount = 0;
      return await this.showInterstitial();
    }
    
    return false;
  }

  /**
   * Show interstitial ad
   */
  async showInterstitial() {
    if (!this.isNative()) {
      console.log('AdsService: [Web] Interstitial would show here');
      return false;
    }
    
    if (!this.admob || !this.interstitialReady) {
      console.log('AdsService: Interstitial not ready, preparing...');
      await this.prepareInterstitial();
      return false;
    }

    try {
      await this.admob.showInterstitial();
      console.log('AdsService: ✅ Interstitial shown');
      
      // Prepare next ad
      this.interstitialReady = false;
      setTimeout(() => this.prepareInterstitial(), 1000);
      
      return true;
    } catch (error) {
      console.error('AdsService: Failed to show interstitial', error);
      this.prepareInterstitial();
      return false;
    }
  }

  /**
   * Show rewarded ad for extra swipes
   * @param {function} onReward - Callback when user earns reward
   * @returns {Promise<{success: boolean, swipes: number}>}
   */
  async showRewardedForSwipes(onReward) {
    // For web/testing - simulate reward
    if (!this.isNative()) {
      console.log('AdsService: [Web] Simulating rewarded ad');
      const result = { success: true, swipes: EXTRA_SWIPES_REWARD, simulated: true };
      if (onReward) onReward(result);
      return result;
    }
    
    if (!this.admob) {
      return { success: false, swipes: 0, error: 'AdMob not initialized' };
    }

    if (!this.rewardedReady) {
      console.log('AdsService: Rewarded ad not ready, preparing...');
      await this.prepareRewarded();
      return { success: false, swipes: 0, error: 'Ad not ready, try again' };
    }

    try {
      // Set up reward listener
      const rewardPromise = new Promise((resolve) => {
        this.admob.addListener('onRewardedVideoAdReward', (reward) => {
          console.log('AdsService: ✅ Reward earned', reward);
          resolve({ success: true, swipes: EXTRA_SWIPES_REWARD });
        });
        
        this.admob.addListener('onRewardedVideoAdDismissed', () => {
          console.log('AdsService: Rewarded ad dismissed without reward');
          resolve({ success: false, swipes: 0, error: 'Ad closed early' });
        });
      });

      await this.admob.showRewardVideoAd();
      
      const result = await rewardPromise;
      
      // Prepare next ad
      this.rewardedReady = false;
      setTimeout(() => this.prepareRewarded(), 1000);
      
      if (result.success && onReward) {
        onReward(result);
      }
      
      return result;
    } catch (error) {
      console.error('AdsService: Failed to show rewarded', error);
      this.prepareRewarded();
      return { success: false, swipes: 0, error: error.message };
    }
  }

  /**
   * Get current swipe count
   */
  getSwipeCount() {
    return this.swipeCount;
  }

  /**
   * Get swipes until next ad
   */
  getSwipesUntilAd() {
    return SWIPES_BEFORE_AD - this.swipeCount;
  }

  /**
   * Reset swipe counter (e.g., after watching rewarded ad)
   */
  resetSwipeCount() {
    this.swipeCount = 0;
  }

  /**
   * Check if ads are available
   */
  isAdAvailable() {
    return {
      interstitial: this.interstitialReady,
      rewarded: this.rewardedReady,
      isNative: this.isNativeApp,
    };
  }
}

// Singleton instance
const adsService = new AdsService();

export default adsService;
export { AD_CONFIG, SWIPES_BEFORE_AD, EXTRA_SWIPES_REWARD };
