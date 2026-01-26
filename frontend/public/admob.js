// HeartLink AdMob Integration - Complete
// Banner, Interstitial, Rewarded Ads

(function() {
  'use strict';

  const AdMobService = {
    // Real Ad IDs
    ADS: {
      banner: 'ca-app-pub-3735972538807236/9418160097',
      interstitial: 'ca-app-pub-3735972538807236/8105078421',
      rewarded: 'ca-app-pub-3735972538807236/8182111801',
    },

    isInitialized: false,
    bannerVisible: false,
    interstitialReady: false,
    rewardedReady: false,

    // Check if running on native platform
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

    // Initialize AdMob
    initialize: async function() {
      if (!this.isNative()) {
        console.log('AdMob: Not native platform, skipping');
        return false;
      }

      if (this.isInitialized) {
        console.log('AdMob: Already initialized');
        return true;
      }

      const admob = this.getAdMob();
      if (!admob) {
        console.error('AdMob: Plugin not found');
        return false;
      }

      try {
        await admob.initialize({
          requestTrackingAuthorization: true,
          initializeForTesting: false
        });
        
        this.isInitialized = true;
        console.log('AdMob: ✅ Initialized successfully');
        
        // Setup listeners
        this.setupListeners();
        
        // Pre-load ads
        this.prepareInterstitial();
        this.prepareRewarded();
        
        return true;
      } catch (error) {
        console.error('AdMob: Initialization failed', error);
        return false;
      }
    },

    // Setup event listeners
    setupListeners: function() {
      const admob = this.getAdMob();
      if (!admob) return;

      // Banner events
      admob.addListener('bannerAdLoaded', function() {
        console.log('AdMob: ✅ Banner loaded');
      });

      admob.addListener('bannerAdFailedToLoad', function(error) {
        console.error('AdMob: ❌ Banner failed to load', error);
      });

      // Interstitial events
      admob.addListener('interstitialAdLoaded', function() {
        AdMobService.interstitialReady = true;
        console.log('AdMob: ✅ Interstitial ready');
      });

      admob.addListener('interstitialAdFailedToLoad', function(error) {
        AdMobService.interstitialReady = false;
        console.error('AdMob: ❌ Interstitial failed', error);
      });

      admob.addListener('interstitialAdDismissed', function() {
        AdMobService.interstitialReady = false;
        AdMobService.prepareInterstitial();
      });

      // Rewarded events
      admob.addListener('rewardVideoAdLoaded', function() {
        AdMobService.rewardedReady = true;
        console.log('AdMob: ✅ Rewarded ready');
      });

      admob.addListener('rewardVideoAdFailedToLoad', function(error) {
        AdMobService.rewardedReady = false;
        console.error('AdMob: ❌ Rewarded failed', error);
      });

      admob.addListener('rewardVideoAdDismissed', function() {
        AdMobService.rewardedReady = false;
        AdMobService.prepareRewarded();
      });
    },

    // ==================== BANNER ADS ====================
    showBanner: async function() {
      if (!this.isNative()) {
        console.log('AdMob: Banner skipped (not native)');
        return false;
      }

      await this.initialize();
      
      const admob = this.getAdMob();
      if (!admob) return false;

      try {
        await admob.showBanner({
          adId: this.ADS.banner,
          adSize: 'ADAPTIVE_BANNER',
          position: 'BOTTOM_CENTER',
          margin: 80  // Space for navigation bar (64px height + safe area)
        });
        
        this.bannerVisible = true;
        console.log('AdMob: ✅ Banner shown');
        return true;
      } catch (error) {
        console.error('AdMob: ❌ Banner error', error);
        return false;
      }
    },

    hideBanner: async function() {
      if (!this.bannerVisible) return;
      
      const admob = this.getAdMob();
      if (!admob) return;

      try {
        await admob.hideBanner();
        this.bannerVisible = false;
        console.log('AdMob: Banner hidden');
      } catch (error) {
        console.error('AdMob: Hide banner error', error);
      }
    },

    removeBanner: async function() {
      const admob = this.getAdMob();
      if (!admob) return;

      try {
        await admob.removeBanner();
        this.bannerVisible = false;
      } catch (error) {
        console.error('AdMob: Remove banner error', error);
      }
    },

    // ==================== INTERSTITIAL ADS ====================
    prepareInterstitial: async function() {
      if (!this.isNative()) return;
      
      const admob = this.getAdMob();
      if (!admob) return;

      try {
        await admob.prepareInterstitial({
          adId: this.ADS.interstitial
        });
        console.log('AdMob: Interstitial preparing...');
      } catch (error) {
        console.error('AdMob: Prepare interstitial error', error);
      }
    },

    showInterstitial: async function() {
      if (!this.isNative()) return false;

      await this.initialize();
      
      const admob = this.getAdMob();
      if (!admob) return false;

      try {
        if (!this.interstitialReady) {
          await this.prepareInterstitial();
          await new Promise(function(resolve) { setTimeout(resolve, 2000); });
        }

        await admob.showInterstitial();
        console.log('AdMob: ✅ Interstitial shown');
        return true;
      } catch (error) {
        console.error('AdMob: ❌ Interstitial error', error);
        this.prepareInterstitial();
        return false;
      }
    },

    // ==================== REWARDED ADS ====================
    prepareRewarded: async function() {
      if (!this.isNative()) return;
      
      const admob = this.getAdMob();
      if (!admob) return;

      try {
        await admob.prepareRewardVideoAd({
          adId: this.ADS.rewarded
        });
        console.log('AdMob: Rewarded preparing...');
      } catch (error) {
        console.error('AdMob: Prepare rewarded error', error);
      }
    },

    showRewarded: async function(onReward) {
      if (!this.isNative()) return false;

      await this.initialize();
      
      const admob = this.getAdMob();
      if (!admob) return false;

      try {
        if (!this.rewardedReady) {
          await this.prepareRewarded();
          await new Promise(function(resolve) { setTimeout(resolve, 2000); });
        }

        // Listen for reward
        admob.addListener('rewardVideoAdRewarded', function(reward) {
          console.log('AdMob: ✅ User earned reward!', reward);
          if (onReward) onReward(reward);
        });

        await admob.showRewardVideoAd();
        console.log('AdMob: ✅ Rewarded shown');
        return true;
      } catch (error) {
        console.error('AdMob: ❌ Rewarded error', error);
        this.prepareRewarded();
        return false;
      }
    }
  };

  // ==================== AUTO START ====================
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('AdMob: DOM Ready, initializing...');
    
    // Wait a bit for Capacitor to be ready
    setTimeout(function() {
      AdMobService.initialize().then(function(success) {
        if (success) {
          // Show banner after initialization
          setTimeout(function() {
            AdMobService.showBanner();
          }, 1000);
        }
      });
    }, 1500);
  });

  // Also try on device ready (for Capacitor)
  document.addEventListener('deviceready', function() {
    console.log('AdMob: Device ready');
    AdMobService.initialize().then(function(success) {
      if (success) {
        AdMobService.showBanner();
      }
    });
  }, false);

  // Show interstitial every 90 seconds
  setInterval(function() {
    if (AdMobService.isInitialized) {
      AdMobService.showInterstitial();
    }
  }, 90000);

  // Create Reward Button
  setTimeout(function() {
    if (AdMobService.isNative()) {
      var btn = document.createElement('button');
      btn.id = 'rewardAdBtn';
      btn.innerHTML = '🎁 Free Rewards';
      btn.style.cssText = 'position:fixed; bottom:70px; right:10px; z-index:99999; padding:12px 18px; background:linear-gradient(135deg,#ec4899,#f59e0b); color:white; border:none; border-radius:25px; font-size:14px; font-weight:bold; box-shadow:0 4px 20px rgba(236,72,153,0.5); cursor:pointer;';
      btn.onclick = function() {
        AdMobService.showRewarded(function(reward) {
          alert('🎉 Congratulations! You earned a reward!');
        });
      };
      document.body.appendChild(btn);
    }
  }, 3000);

  // Make available globally
  window.AdMobService = AdMobService;
  
  console.log('AdMob: Service loaded');
})();
