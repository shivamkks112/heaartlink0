/**
 * AdMob Service for HeartLink
 * Handles all ad-related functionality with gender-based targeting
 * 
 * Business Rules:
 * - Only male users see ads
 * - Premium users see NO ads
 * - Max 1 interstitial per day
 * - Never show ads in chat screens
 * - Rewarded ads are user-initiated only
 */

import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Ad Unit IDs from environment
const AD_CONFIG = {
  appId: process.env.REACT_APP_ADMOB_APP_ID || 'ca-app-pub-3735972538807236~9004238866',
  interstitialId: process.env.REACT_APP_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-3735972538807236/8105078421',
  rewardedId: process.env.REACT_APP_ADMOB_REWARDED_ID || 'ca-app-pub-3735972538807236/8182111801',
  bannerId: process.env.REACT_APP_ADMOB_BANNER_ID || 'ca-app-pub-3735972538807236/9418160097',
};

// Test Ad IDs (for development)
const TEST_AD_CONFIG = {
  interstitialId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedId: 'ca-app-pub-3940256099942544/5224354917',
  bannerId: 'ca-app-pub-3940256099942544/6300978111',
};

// Storage keys
const STORAGE_KEYS = {
  lastInterstitial: 'heartlink_last_interstitial',
  interstitialCount: 'heartlink_interstitial_count_today',
  lastCountReset: 'heartlink_count_reset_date',
};

// One day in milliseconds
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class AdMobService {
  constructor() {
    this.isInitialized = false;
    this.isNative = Capacitor.isNativePlatform();
    this.interstitialLoaded = false;
    this.rewardedLoaded = false;
    this.bannerVisible = false;
  }

  /**
   * Initialize AdMob SDK
   */
  async initialize() {
    if (this.isInitialized || !this.isNative) {
      console.log('AdMob: Skipping init (already initialized or not native)');
      return false;
    }

    try {
      await AdMob.initialize({
        requestTrackingAuthorization: true,
        initializeForTesting: process.env.NODE_ENV === 'development',
      });
      
      this.isInitialized = true;
      console.log('AdMob: Initialized successfully');
      
      // Setup event listeners
      this.setupListeners();
      
      return true;
    } catch (error) {
      console.error('AdMob: Initialization failed', error);
      return false;
    }
  }

  /**
   * Setup AdMob event listeners
   */
  setupListeners() {
    // Interstitial events
    AdMob.addListener('interstitialAdLoaded', () => {
      this.interstitialLoaded = true;
      console.log('AdMob: Interstitial loaded');
    });

    AdMob.addListener('interstitialAdFailedToLoad', (error) => {
      this.interstitialLoaded = false;
      console.error('AdMob: Interstitial failed to load', error);
    });

    AdMob.addListener('interstitialAdDismissed', () => {
      this.interstitialLoaded = false;
      console.log('AdMob: Interstitial dismissed');
    });

    // Rewarded events
    AdMob.addListener('rewardVideoAdLoaded', () => {
      this.rewardedLoaded = true;
      console.log('AdMob: Rewarded ad loaded');
    });

    AdMob.addListener('rewardVideoAdFailedToLoad', (error) => {
      this.rewardedLoaded = false;
      console.error('AdMob: Rewarded ad failed to load', error);
    });
  }

  /**
   * Get current ad unit ID (test or production)
   */
  getAdId(type) {
    const isDev = process.env.NODE_ENV === 'development';
    const config = isDev ? TEST_AD_CONFIG : AD_CONFIG;
    
    switch (type) {
      case 'interstitial':
        return config.interstitialId;
      case 'rewarded':
        return config.rewardedId;
      case 'banner':
        return config.bannerId;
      default:
        return null;
    }
  }

  /**
   * Check if user is eligible to see ads
   * Rules: Male + Not Premium = Show ads
   */
  isUserEligibleForAds(user) {
    if (!user) return false;
    
    // Only male users see ads
    if (user.gender?.toLowerCase() !== 'male') {
      return false;
    }
    
    // Premium users don't see ads
    if (user.is_premium || user.isPremium) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if we can show interstitial (1 per day limit)
   */
  canShowInterstitial() {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem(STORAGE_KEYS.lastCountReset);
    
    // Reset counter if new day
    if (lastReset !== today) {
      localStorage.setItem(STORAGE_KEYS.interstitialCount, '0');
      localStorage.setItem(STORAGE_KEYS.lastCountReset, today);
    }
    
    const count = parseInt(localStorage.getItem(STORAGE_KEYS.interstitialCount) || '0');
    return count < 1; // Max 1 per day
  }

  /**
   * Record interstitial shown
   */
  recordInterstitialShown() {
    const count = parseInt(localStorage.getItem(STORAGE_KEYS.interstitialCount) || '0');
    localStorage.setItem(STORAGE_KEYS.interstitialCount, String(count + 1));
    localStorage.setItem(STORAGE_KEYS.lastInterstitial, Date.now().toString());
  }

  /**
   * Prepare and show interstitial ad
   * @param {Object} user - Current user object
   * @param {string} screenName - Current screen name for tracking
   * @returns {Promise<boolean>} - Whether ad was shown
   */
  async showInterstitial(user, screenName = 'unknown') {
    // Check eligibility
    if (!this.isUserEligibleForAds(user)) {
      console.log('AdMob: User not eligible for ads');
      return false;
    }

    // Check frequency cap
    if (!this.canShowInterstitial()) {
      console.log('AdMob: Interstitial frequency cap reached');
      return false;
    }

    // Check if running on native platform
    if (!this.isNative) {
      console.log('AdMob: Not on native platform, skipping ad');
      return false;
    }

    try {
      // Prepare interstitial
      await AdMob.prepareInterstitial({
        adId: this.getAdId('interstitial'),
      });

      // Wait for ad to load
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Ad load timeout'));
        }, 10000);

        const loadHandler = AdMob.addListener('interstitialAdLoaded', () => {
          clearTimeout(timeout);
          loadHandler.remove();
          resolve();
        });

        const failHandler = AdMob.addListener('interstitialAdFailedToLoad', (error) => {
          clearTimeout(timeout);
          failHandler.remove();
          reject(error);
        });
      });

      // Show the ad
      await AdMob.showInterstitial();
      
      // Record that we showed an ad
      this.recordInterstitialShown();
      
      // Track impression on backend
      await this.trackImpression(user.id, 'interstitial', screenName);
      
      return true;
    } catch (error) {
      console.error('AdMob: Error showing interstitial', error);
      return false;
    }
  }

  /**
   * Show rewarded ad and return reward info
   * @param {Object} user - Current user object
   * @param {string} rewardType - Type of reward (extra_swipes, profile_boost, priority_message)
   * @returns {Promise<{success: boolean, reward?: {type: string, amount: number}}>}
   */
  async showRewarded(user, rewardType = 'extra_swipes') {
    // Check eligibility
    if (!this.isUserEligibleForAds(user)) {
      console.log('AdMob: User not eligible for rewarded ads');
      return { success: false, reason: 'not_eligible' };
    }

    // Check if running on native platform
    if (!this.isNative) {
      console.log('AdMob: Not on native platform, simulating reward for testing');
      // For web testing, simulate reward
      const reward = this.getRewardForType(rewardType);
      return { success: true, reward, simulated: true };
    }

    try {
      // Prepare rewarded ad
      await AdMob.prepareRewardVideoAd({
        adId: this.getAdId('rewarded'),
      });

      // Wait for ad and track reward
      return new Promise((resolve) => {
        let rewardEarned = false;
        let rewardData = null;

        const loadHandler = AdMob.addListener('rewardVideoAdLoaded', async () => {
          loadHandler.remove();
          await AdMob.showRewardVideoAd();
        });

        const rewardHandler = AdMob.addListener('rewardVideoAdRewarded', (result) => {
          rewardEarned = true;
          rewardData = this.getRewardForType(rewardType);
          console.log('AdMob: User earned reward', result);
        });

        const dismissHandler = AdMob.addListener('rewardVideoAdDismissed', async () => {
          rewardHandler.remove();
          dismissHandler.remove();
          
          if (rewardEarned) {
            // Track on backend
            await this.trackImpression(user.id, 'rewarded', rewardType, rewardData.amount);
            resolve({ success: true, reward: rewardData });
          } else {
            resolve({ success: false, reason: 'not_completed' });
          }
        });

        const failHandler = AdMob.addListener('rewardVideoAdFailedToLoad', (error) => {
          loadHandler.remove();
          failHandler.remove();
          console.error('AdMob: Rewarded ad failed to load', error);
          resolve({ success: false, reason: 'load_failed' });
        });

        // Timeout after 15 seconds
        setTimeout(() => {
          resolve({ success: false, reason: 'timeout' });
        }, 15000);
      });
    } catch (error) {
      console.error('AdMob: Error showing rewarded ad', error);
      return { success: false, reason: 'error' };
    }
  }

  /**
   * Get reward configuration for reward type
   */
  getRewardForType(rewardType) {
    const rewards = {
      extra_swipes: { type: 'extra_swipes', amount: 10, label: '10 Extra Swipes' },
      profile_boost: { type: 'profile_boost', amount: 30, label: '30 Min Profile Boost' },
      priority_message: { type: 'priority_message', amount: 1, label: 'Priority Message' },
      see_who_liked: { type: 'see_who_liked', amount: 1, label: 'See Who Liked You' },
    };
    return rewards[rewardType] || rewards.extra_swipes;
  }

  /**
   * Show banner ad
   * @param {Object} user - Current user
   * @param {string} position - 'top' or 'bottom'
   */
  async showBanner(user, position = 'bottom') {
    if (!this.isUserEligibleForAds(user) || !this.isNative) {
      return false;
    }

    try {
      const bannerPosition = position === 'top' 
        ? BannerAdPosition.TOP_CENTER 
        : BannerAdPosition.BOTTOM_CENTER;

      await AdMob.showBanner({
        adId: this.getAdId('banner'),
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: bannerPosition,
        margin: 0,
      });

      this.bannerVisible = true;
      return true;
    } catch (error) {
      console.error('AdMob: Error showing banner', error);
      return false;
    }
  }

  /**
   * Hide banner ad
   */
  async hideBanner() {
    if (!this.isNative || !this.bannerVisible) {
      return false;
    }

    try {
      await AdMob.hideBanner();
      this.bannerVisible = false;
      return true;
    } catch (error) {
      console.error('AdMob: Error hiding banner', error);
      return false;
    }
  }

  /**
   * Track ad impression on backend
   */
  async trackImpression(userId, adType, rewardType = null, amount = null) {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      await fetch(`${API_URL}/api/ads/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ad_type: adType,
          reward_type: rewardType,
          amount: amount,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('AdMob: Failed to track impression', error);
    }
  }

  /**
   * Get ad stats for user
   */
  async getAdStats(userId) {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${API_URL}/api/ads/stats/${userId}`);
      return await response.json();
    } catch (error) {
      console.error('AdMob: Failed to get stats', error);
      return null;
    }
  }
}

// Export singleton instance
export const adMobService = new AdMobService();
export default adMobService;
