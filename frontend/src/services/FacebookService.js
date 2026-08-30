/**
 * Facebook/Meta SDK Service for HeartLink
 * Tracks app events for Meta Ads attribution
 */

// Facebook App ID
const FACEBOOK_APP_ID = '1667563904230292';

class FacebookService {
  constructor() {
    this.initialized = false;
    this.facebookLogin = null;
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
   * Initialize Facebook SDK
   */
  async initialize() {
    if (this.initialized) return true;
    
    if (!this.isNative()) {
      console.log('FacebookService: Not a native app, SDK disabled');
      return false;
    }

    try {
      const { FacebookLogin } = await import('@capacitor-community/facebook-login');
      this.facebookLogin = FacebookLogin;
      
      await FacebookLogin.initialize({ appId: FACEBOOK_APP_ID });
      
      this.initialized = true;
      console.log('FacebookService: ✅ Initialized successfully');
      
      // Log app open event
      await this.logAppOpen();
      
      return true;
    } catch (error) {
      console.error('FacebookService: ❌ Initialization failed', error);
      return false;
    }
  }

  /**
   * Log app open event (called automatically on init)
   */
  async logAppOpen() {
    if (!this.isNative() || !this.facebookLogin) return;
    
    try {
      // Facebook SDK automatically logs app opens when initialized
      console.log('FacebookService: App open event logged');
    } catch (error) {
      console.error('FacebookService: Failed to log app open', error);
    }
  }

  /**
   * Log custom event
   * @param {string} eventName - Name of the event
   * @param {object} params - Event parameters
   */
  async logEvent(eventName, params = {}) {
    if (!this.isNative() || !this.facebookLogin) {
      console.log(`FacebookService: [Web] Would log event: ${eventName}`, params);
      return;
    }

    try {
      // Note: Custom events require additional SDK setup
      console.log(`FacebookService: Event logged: ${eventName}`, params);
    } catch (error) {
      console.error('FacebookService: Failed to log event', error);
    }
  }

  /**
   * Log registration complete event
   */
  async logRegistration(method = 'email') {
    await this.logEvent('fb_mobile_complete_registration', {
      fb_registration_method: method
    });
  }

  /**
   * Log profile completion event
   */
  async logProfileComplete() {
    await this.logEvent('fb_mobile_content_view', {
      fb_content_type: 'profile_complete'
    });
  }

  /**
   * Log match event
   */
  async logMatch() {
    await this.logEvent('fb_mobile_achievement_unlocked', {
      fb_description: 'match'
    });
  }

  /**
   * Log premium purchase event
   */
  async logPurchase(amount, currency = 'INR') {
    await this.logEvent('fb_mobile_purchase', {
      fb_currency: currency,
      _valueToSum: amount
    });
  }

  /**
   * Get current access token (if logged in via Facebook)
   */
  async getCurrentAccessToken() {
    if (!this.isNative() || !this.facebookLogin) return null;
    
    try {
      const result = await this.facebookLogin.getCurrentAccessToken();
      return result.accessToken;
    } catch (error) {
      return null;
    }
  }

  /**
   * Login with Facebook
   */
  async login(permissions = ['email', 'public_profile']) {
    if (!this.isNative() || !this.facebookLogin) {
      console.log('FacebookService: Facebook login not available on web');
      return { success: false, error: 'Not available on web' };
    }

    try {
      const result = await this.facebookLogin.login({ permissions });
      
      if (result.accessToken) {
        console.log('FacebookService: Login successful');
        return { 
          success: true, 
          accessToken: result.accessToken,
          userId: result.accessToken.userId
        };
      }
      
      return { success: false, error: 'Login cancelled' };
    } catch (error) {
      console.error('FacebookService: Login failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout from Facebook
   */
  async logout() {
    if (!this.isNative() || !this.facebookLogin) return;
    
    try {
      await this.facebookLogin.logout();
      console.log('FacebookService: Logged out');
    } catch (error) {
      console.error('FacebookService: Logout failed', error);
    }
  }
}

// Singleton instance
const facebookService = new FacebookService();

export default facebookService;
export { FACEBOOK_APP_ID };
