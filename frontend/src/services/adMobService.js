/**
 * AdMob Service — Thin wrapper over AdsService (single source of truth)
 * 
 * This file exists for backward compatibility with AdContext and ad components.
 * All actual ad logic lives in AdsService.js.
 * DO NOT add independent AdMob.initialize() or prepareInterstitial() calls here.
 */

import adsService, { EXTRA_SWIPES_REWARD } from './AdsService';
import { BACKEND_URL as API_URL } from "@/config/api";

class AdMobService {
  constructor() {
    // Delegate to canonical AdsService
    this._ads = adsService;
  }

  async initialize() {
    return this._ads.initialize();
  }

  get isInitialized() { return this._ads.initialized; }
  get isNative() { return this._ads.isNative(); }

  isUserEligibleForAds(user) {
    if (!user) return false;
    if (user.gender?.toLowerCase() !== 'male') return false;
    if (user.is_premium || user.isPremium) return false;
    return true;
  }

  async showInterstitial(user, screenName = 'unknown') {
    if (!this.isUserEligibleForAds(user)) return false;
    const shown = await this._ads.showInterstitial();
    if (shown) {
      this.trackImpression(user.id, 'interstitial', screenName).catch(() => {});
    }
    return shown;
  }

  async showRewarded(user, rewardType = 'extra_swipes') {
    if (!this.isUserEligibleForAds(user)) {
      return { success: false, reason: 'not_eligible' };
    }

    if (!this._ads.isNative()) {
      const reward = this.getRewardForType(rewardType);
      return { success: true, reward, simulated: true };
    }

    const result = await this._ads.showRewardedForSwipes(null);
    if (result.success) {
      const reward = this.getRewardForType(rewardType);
      this.trackImpression(user.id, 'rewarded', rewardType, reward.amount).catch(() => {});
      return { success: true, reward };
    }
    return { success: false, reason: result.error || 'failed' };
  }

  getRewardForType(rewardType) {
    const rewards = {
      extra_swipes: { type: 'extra_swipes', amount: 10, label: '10 Extra Swipes' },
      profile_boost: { type: 'profile_boost', amount: 30, label: '30 Min Profile Boost' },
      priority_message: { type: 'priority_message', amount: 1, label: 'Priority Message' },
      see_who_liked: { type: 'see_who_liked', amount: 1, label: 'See Who Liked You' },
    };
    return rewards[rewardType] || rewards.extra_swipes;
  }

  canShowInterstitial() {
    return this._ads.interstitialState === 'LOADED';
  }

  async trackImpression(userId, adType, rewardType = null, amount = null) {
    try {
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
    } catch (error) { /* silent */ }
  }

  async showBanner() { return false; }
  async hideBanner() { return false; }
}

export const adMobService = new AdMobService();
export default adMobService;
