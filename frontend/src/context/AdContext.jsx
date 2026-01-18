/**
 * AdContext - React Context for AdMob functionality
 * Provides ad-related state and methods to all components
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import adMobService from '../services/adMobService';

const AdContext = createContext(null);

export const useAds = () => {
  const context = useContext(AdContext);
  if (!context) {
    throw new Error('useAds must be used within AdProvider');
  }
  return context;
};

export const AdProvider = ({ children, user }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rewardedAdReady, setRewardedAdReady] = useState(false);
  const [dailySwipes, setDailySwipes] = useState(0);
  const [boostActive, setBoostActive] = useState(false);
  const [boostEndTime, setBoostEndTime] = useState(null);

  // Initialize AdMob on mount
  useEffect(() => {
    const init = async () => {
      const success = await adMobService.initialize();
      setIsInitialized(success);
    };
    init();
  }, []);

  // Check user eligibility when user changes
  useEffect(() => {
    if (user) {
      const eligible = adMobService.isUserEligibleForAds(user);
      setIsEligible(eligible);
    } else {
      setIsEligible(false);
    }
  }, [user]);

  // Check boost status
  useEffect(() => {
    const storedBoostEnd = localStorage.getItem('heartlink_boost_end');
    if (storedBoostEnd) {
      const endTime = parseInt(storedBoostEnd);
      if (Date.now() < endTime) {
        setBoostActive(true);
        setBoostEndTime(endTime);
      } else {
        localStorage.removeItem('heartlink_boost_end');
      }
    }
  }, []);

  /**
   * Show interstitial ad if eligible
   * Only call this at natural break points (after match, app open)
   */
  const showInterstitialIfEligible = useCallback(async (screenName = 'unknown') => {
    if (!isEligible || !user) return false;
    
    setIsLoading(true);
    try {
      const shown = await adMobService.showInterstitial(user, screenName);
      return shown;
    } finally {
      setIsLoading(false);
    }
  }, [isEligible, user]);

  /**
   * Watch rewarded ad for extra swipes
   */
  const watchAdForSwipes = useCallback(async () => {
    if (!isEligible || !user) {
      return { success: false, reason: 'not_eligible' };
    }

    setIsLoading(true);
    try {
      const result = await adMobService.showRewarded(user, 'extra_swipes');
      
      if (result.success && result.reward) {
        // Add swipes to user's daily count
        const newSwipes = dailySwipes + result.reward.amount;
        setDailySwipes(newSwipes);
        localStorage.setItem('heartlink_extra_swipes', String(newSwipes));
        
        // Track reward on backend
        await trackReward('extra_swipes', result.reward.amount);
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [isEligible, user, dailySwipes]);

  /**
   * Watch rewarded ad for profile boost
   */
  const watchAdForBoost = useCallback(async () => {
    if (!isEligible || !user) {
      return { success: false, reason: 'not_eligible' };
    }

    setIsLoading(true);
    try {
      const result = await adMobService.showRewarded(user, 'profile_boost');
      
      if (result.success && result.reward) {
        // Activate 30-minute boost
        const endTime = Date.now() + (30 * 60 * 1000); // 30 minutes
        setBoostActive(true);
        setBoostEndTime(endTime);
        localStorage.setItem('heartlink_boost_end', String(endTime));
        
        // Track reward on backend
        await trackReward('profile_boost', 30);
        
        // Auto deactivate after 30 mins
        setTimeout(() => {
          setBoostActive(false);
          setBoostEndTime(null);
          localStorage.removeItem('heartlink_boost_end');
        }, 30 * 60 * 1000);
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [isEligible, user]);

  /**
   * Watch rewarded ad for priority message
   */
  const watchAdForPriorityMessage = useCallback(async () => {
    if (!isEligible || !user) {
      return { success: false, reason: 'not_eligible' };
    }

    setIsLoading(true);
    try {
      const result = await adMobService.showRewarded(user, 'priority_message');
      
      if (result.success && result.reward) {
        await trackReward('priority_message', 1);
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [isEligible, user]);

  /**
   * Track reward on backend
   */
  const trackReward = async (rewardType, amount) => {
    if (!user) return;
    
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      await fetch(`${API_URL}/api/ads/reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          reward_type: rewardType,
          amount: amount,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to track reward:', error);
    }
  };

  /**
   * Get remaining boost time in minutes
   */
  const getBoostTimeRemaining = useCallback(() => {
    if (!boostActive || !boostEndTime) return 0;
    const remaining = boostEndTime - Date.now();
    return Math.max(0, Math.ceil(remaining / 60000));
  }, [boostActive, boostEndTime]);

  /**
   * Check if user has extra swipes available
   */
  const hasExtraSwipes = useCallback(() => {
    const stored = localStorage.getItem('heartlink_extra_swipes');
    return stored ? parseInt(stored) > 0 : false;
  }, []);

  /**
   * Use one extra swipe
   */
  const useExtraSwipe = useCallback(() => {
    const stored = localStorage.getItem('heartlink_extra_swipes');
    const current = stored ? parseInt(stored) : 0;
    if (current > 0) {
      const newCount = current - 1;
      localStorage.setItem('heartlink_extra_swipes', String(newCount));
      setDailySwipes(newCount);
      return true;
    }
    return false;
  }, []);

  const value = {
    // State
    isInitialized,
    isEligible,
    isLoading,
    rewardedAdReady,
    boostActive,
    boostEndTime,
    dailySwipes,
    
    // Methods
    showInterstitialIfEligible,
    watchAdForSwipes,
    watchAdForBoost,
    watchAdForPriorityMessage,
    getBoostTimeRemaining,
    hasExtraSwipes,
    useExtraSwipe,
    
    // Direct service access for advanced use
    adService: adMobService,
  };

  return (
    <AdContext.Provider value={value}>
      {children}
    </AdContext.Provider>
  );
};

export default AdContext;
