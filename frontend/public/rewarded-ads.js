// HeartLink Rewarded Ads Integration
// This file handles all rewarded ad functionality

(function() {
  'use strict';

  const RewardedAds = {
    // Ad Unit ID
    REWARDED_AD_ID: 'ca-app-pub-3735972538807236/8182111801',
    
    isReady: false,
    isLoading: false,

    // Check if native platform
    isNative: function() {
      return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    },

    // Get AdMob plugin
    getAdMob: function() {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
        return window.Capacitor.Plugins.AdMob;
      }
      return null;
    },

    // Initialize and prepare rewarded ad
    prepare: async function() {
      if (!this.isNative() || this.isLoading) return;
      
      const admob = this.getAdMob();
      if (!admob) return;

      this.isLoading = true;
      
      try {
        await admob.prepareRewardVideoAd({
          adId: this.REWARDED_AD_ID
        });
        this.isReady = true;
        this.isLoading = false;
        console.log('RewardedAds: ✅ Ready');
      } catch (e) {
        this.isReady = false;
        this.isLoading = false;
        console.error('RewardedAds: Prepare error', e);
      }
    },

    // Show rewarded ad with callback
    show: async function(onSuccess, onFailure, onClose) {
      if (!this.isNative()) {
        console.log('RewardedAds: Not native platform');
        if (onFailure) onFailure('Not on native platform');
        return false;
      }

      const admob = this.getAdMob();
      if (!admob) {
        if (onFailure) onFailure('AdMob not available');
        return false;
      }

      // Prepare if not ready
      if (!this.isReady) {
        await this.prepare();
        // Wait a bit for ad to load
        await new Promise(r => setTimeout(r, 2000));
      }

      try {
        let rewarded = false;

        // Remove old listeners
        admob.removeAllListeners();

        // Reward listener
        admob.addListener('rewardVideoAdRewarded', function(reward) {
          console.log('RewardedAds: ✅ User earned reward!', reward);
          rewarded = true;
        });

        // Close listener
        admob.addListener('rewardVideoAdDismissed', function() {
          console.log('RewardedAds: Ad closed, rewarded:', rewarded);
          RewardedAds.isReady = false;
          RewardedAds.prepare(); // Prepare next ad
          
          if (rewarded && onSuccess) {
            onSuccess();
          } else if (!rewarded && onClose) {
            onClose();
          }
        });

        // Show the ad
        await admob.showRewardVideoAd();
        console.log('RewardedAds: ✅ Showing ad');
        return true;

      } catch (e) {
        console.error('RewardedAds: Show error', e);
        this.isReady = false;
        this.prepare();
        if (onFailure) onFailure(e.message || 'Ad not available');
        return false;
      }
    }
  };

  // Reward Types and Values
  const RewardTypes = {
    EXTRA_SWIPES: {
      id: 'extra_swipes',
      title: '🔥 Extra Swipes',
      description: 'Get 10 more swipes',
      amount: 10,
      icon: '👆'
    },
    PROFILE_BOOST: {
      id: 'profile_boost',
      title: '🚀 Profile Boost',
      description: '30 min visibility boost',
      amount: 30,
      icon: '⚡'
    },
    SUPER_LIKE: {
      id: 'super_like',
      title: '⭐ Super Like',
      description: 'Send a super like',
      amount: 1,
      icon: '⭐'
    },
    SEE_WHO_LIKED: {
      id: 'see_who_liked',
      title: '👀 See Who Liked',
      description: 'See 1 person who liked you',
      amount: 1,
      icon: '👀'
    },
    REWIND: {
      id: 'rewind',
      title: '↩️ Rewind',
      description: 'Undo last swipe',
      amount: 1,
      icon: '↩️'
    }
  };

  // Create Rewarded Ads UI
  function createRewardedAdsUI() {
    // Only create on native platform
    if (!RewardedAds.isNative()) return;

    // Main floating button
    const mainBtn = document.createElement('button');
    mainBtn.id = 'rewardMainBtn';
    mainBtn.innerHTML = '🎁';
    mainBtn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 15px;
      z-index: 99998;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ec4899, #f59e0b);
      color: white;
      border: none;
      font-size: 24px;
      box-shadow: 0 4px 20px rgba(236, 72, 153, 0.5);
      cursor: pointer;
      transition: transform 0.2s;
    `;
    mainBtn.onclick = toggleRewardMenu;
    document.body.appendChild(mainBtn);

    // Reward Menu
    const menu = document.createElement('div');
    menu.id = 'rewardMenu';
    menu.style.cssText = `
      position: fixed;
      bottom: 150px;
      right: 15px;
      z-index: 99997;
      background: white;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      display: none;
      width: 280px;
      max-height: 400px;
      overflow-y: auto;
    `;

    menu.innerHTML = `
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">
        🎁 Free Rewards
      </div>
      <p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">
        Watch a short ad to earn rewards!
      </p>
      <div id="rewardOptions"></div>
    `;
    document.body.appendChild(menu);

    // Add reward options
    const optionsContainer = document.getElementById('rewardOptions');
    Object.values(RewardTypes).forEach(reward => {
      const option = createRewardOption(reward);
      optionsContainer.appendChild(option);
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      const menu = document.getElementById('rewardMenu');
      const mainBtn = document.getElementById('rewardMainBtn');
      if (menu && !menu.contains(e.target) && e.target !== mainBtn) {
        menu.style.display = 'none';
      }
    });
  }

  function createRewardOption(reward) {
    const div = document.createElement('div');
    div.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: #f9fafb;
      border-radius: 12px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    div.onmouseenter = () => div.style.background = '#f3f4f6';
    div.onmouseleave = () => div.style.background = '#f9fafb';

    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">${reward.icon}</span>
        <div>
          <div style="font-weight: 600; color: #1f2937; font-size: 14px;">${reward.title}</div>
          <div style="font-size: 12px; color: #6b7280;">${reward.description}</div>
        </div>
      </div>
      <button class="watchAdBtn" data-reward="${reward.id}" style="
        background: linear-gradient(135deg, #ec4899, #f59e0b);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
      ">
        ▶ Watch
      </button>
    `;

    const watchBtn = div.querySelector('.watchAdBtn');
    watchBtn.onclick = function(e) {
      e.stopPropagation();
      watchAdForReward(reward);
    };

    return div;
  }

  function toggleRewardMenu() {
    const menu = document.getElementById('rewardMenu');
    if (menu) {
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
  }

  function watchAdForReward(reward) {
    // Close menu
    const menu = document.getElementById('rewardMenu');
    if (menu) menu.style.display = 'none';

    // Show loading
    showToast('Loading ad...', 'info');

    // Show rewarded ad
    RewardedAds.show(
      // On Success
      function() {
        applyReward(reward);
        showToast(`🎉 ${reward.title} earned!`, 'success');
        
        // Save to backend
        saveRewardToBackend(reward);
      },
      // On Failure
      function(error) {
        showToast('Ad not available. Try again later.', 'error');
      },
      // On Close without watching
      function() {
        showToast('Watch the full ad to earn rewards', 'warning');
      }
    );
  }

  function applyReward(reward) {
    // Get current rewards from localStorage
    let rewards = JSON.parse(localStorage.getItem('heartlink_rewards') || '{}');
    
    switch(reward.id) {
      case 'extra_swipes':
        rewards.extra_swipes = (rewards.extra_swipes || 0) + reward.amount;
        break;
      case 'profile_boost':
        rewards.profile_boost_end = Date.now() + (reward.amount * 60 * 1000);
        break;
      case 'super_like':
        rewards.super_likes = (rewards.super_likes || 0) + reward.amount;
        break;
      case 'see_who_liked':
        rewards.see_who_liked = (rewards.see_who_liked || 0) + reward.amount;
        break;
      case 'rewind':
        rewards.rewinds = (rewards.rewinds || 0) + reward.amount;
        break;
    }
    
    localStorage.setItem('heartlink_rewards', JSON.stringify(rewards));
    console.log('Rewards updated:', rewards);
  }

  async function saveRewardToBackend(reward) {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) return;

      const API_URL = window.REACT_APP_BACKEND_URL || '';
      
      await fetch(`${API_URL}/api/ads/reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          reward_type: reward.id,
          amount: reward.amount,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('Failed to save reward to backend', e);
    }
  }

  function showToast(message, type) {
    // Remove existing toast
    const existing = document.getElementById('adToast');
    if (existing) existing.remove();

    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    const toast = document.createElement('div');
    toast.id = 'adToast';
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      animation: slideDown 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Remove after 3 seconds
    setTimeout(() => toast.remove(), 3000);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      // Prepare rewarded ad
      RewardedAds.prepare();
      
      // Create UI
      createRewardedAdsUI();
    }, 2000);
  });

  // Export globally
  window.RewardedAds = RewardedAds;
  window.RewardTypes = RewardTypes;

  console.log('RewardedAds: Module loaded');
})();
