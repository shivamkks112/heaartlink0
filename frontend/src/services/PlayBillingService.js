/**
 * Google Play Billing Service for HeartLink Premium
 * Uses @capgo/native-purchases for Capacitor Android
 * 
 * Product: heartlink_premium_monthly
 * Base Plan: monthly
 * Offer: trial3days (3-day free trial)
 */

import { API } from '@/config/api';
import axios from 'axios';

const PRODUCT_ID = 'heartlink_premium_monthly';
const PLAN_ID = 'monthly';
const OFFER_ID = 'trial3days';

class PlayBillingService {
  constructor() {
    this.initialized = false;
    this.NativePurchases = null;
    this.products = [];
    this.productDetails = null;
    this._initError = null;
  }

  isNative() {
    return typeof window !== 'undefined' &&
      window.Capacitor &&
      window.Capacitor.isNativePlatform &&
      window.Capacitor.isNativePlatform();
  }

  async initialize() {
    if (this.initialized) return true;
    if (!this.isNative()) {
      console.log('[Billing] Not native platform, skipping');
      return false;
    }

    try {
      const mod = await import('@capgo/native-purchases');
      this.NativePurchases = mod.NativePurchases;
      console.log('[Billing] Plugin loaded');

      const result = await this.NativePurchases.isBillingSupported();
      console.log('[Billing] isBillingSupported result:', JSON.stringify(result));

      if (!result.isBillingSupported) {
        this._initError = 'BillingClient not supported on this device';
        console.warn('[Billing]', this._initError);
        return false;
      }

      this.initialized = true;
      console.log('[Billing] Initialized successfully');
      return true;
    } catch (error) {
      this._initError = error?.message || String(error);
      console.error('[Billing] Init failed:', this._initError);
      return false;
    }
  }

  async getProduct() {
    if (!this.initialized || !this.NativePurchases) return null;

    try {
      console.log('[Billing] Querying product:', PRODUCT_ID);
      const result = await this.NativePurchases.getProducts({
        productIdentifiers: [PRODUCT_ID],
        productType: 'SUBS',
      });

      console.log('[Billing] getProducts result:', JSON.stringify(result));

      if (result.products && result.products.length > 0) {
        this.products = result.products;
        // Find the offer with trial (trial3days) or fall back to first product
        const trialOffer = result.products.find(p => p.offerId === OFFER_ID);
        this.productDetails = trialOffer || result.products[0];
        console.log('[Billing] Selected product:', JSON.stringify({
          identifier: this.productDetails.identifier,
          planIdentifier: this.productDetails.planIdentifier,
          offerId: this.productDetails.offerId,
          offerToken: this.productDetails.offerToken ? 'present' : 'missing',
          priceString: this.productDetails.priceString,
          price: this.productDetails.price,
        }));
        return this.productDetails;
      }
      console.warn('[Billing] No products returned for:', PRODUCT_ID);
      return null;
    } catch (error) {
      console.error('[Billing] getProducts failed:', error?.message || error);
      return null;
    }
  }

  getDisplayPrice() {
    if (this.productDetails) {
      return this.productDetails.priceString || `₹${this.productDetails.price}` || '₹49';
    }
    return '₹49';
  }

  getTrialInfo() {
    if (this.productDetails?.offerId === OFFER_ID) {
      return { hasTrial: true, trialDuration: '3 days', trialPrice: 'Free' };
    }
    if (this.productDetails?.introductoryPrice) {
      return {
        hasTrial: true,
        trialDuration: this.productDetails.introductoryPrice.period || '3 days',
        trialPrice: this.productDetails.introductoryPrice.price || 'Free',
      };
    }
    return { hasTrial: true, trialDuration: '3 days', trialPrice: 'Free' };
  }

  getInitError() {
    return this._initError;
  }

  async purchaseSubscription() {
    if (!this.initialized || !this.NativePurchases) {
      return { success: false, error: `Google Play billing unavailable: ${this._initError || 'not initialized'}` };
    }

    try {
      // Build purchase options
      const purchaseOptions = {
        productIdentifier: PRODUCT_ID,
        productType: 'SUBS',
        quantity: 1,
      };

      // Use offerToken from getProducts if available (required for subscriptions with offers)
      if (this.productDetails?.offerToken) {
        purchaseOptions.offerToken = this.productDetails.offerToken;
        console.log('[Billing] Using offerToken from product details');
      }

      // Pass planIdentifier if available
      if (this.productDetails?.identifier) {
        purchaseOptions.planIdentifier = this.productDetails.identifier;
      }

      console.log('[Billing] Purchasing with options:', JSON.stringify({
        ...purchaseOptions,
        offerToken: purchaseOptions.offerToken ? 'present' : 'missing'
      }));

      const result = await this.NativePurchases.purchaseProduct(purchaseOptions);
      console.log('[Billing] Purchase result:', JSON.stringify({
        transactionId: result.transactionId,
        purchaseToken: result.purchaseToken ? 'present' : 'missing',
        orderId: result.orderId,
      }));

      if (result.transactionId) {
        return {
          success: true,
          transactionId: result.transactionId,
          productId: PRODUCT_ID,
          purchaseToken: result.purchaseToken || result.transactionId,
          orderId: result.orderId,
          basePlanId: PLAN_ID,
          offerId: OFFER_ID,
        };
      }

      return { success: false, error: 'Purchase incomplete — no transaction ID received' };
    } catch (error) {
      const msg = error?.message || String(error);
      if (msg.includes('cancelled') || msg.includes('CANCELLED') || error?.code === 'USER_CANCELLED') {
        return { success: false, error: 'cancelled' };
      }
      console.error('[Billing] Purchase failed:', msg);
      return { success: false, error: msg || 'Purchase could not be completed. Please try again.' };
    }
  }

  async restorePurchases() {
    if (!this.initialized || !this.NativePurchases) {
      return { success: false, purchases: [] };
    }

    try {
      // Use getPurchases instead of restorePurchases (which returns void)
      const result = await this.NativePurchases.getPurchases({
        productType: 'SUBS',
      });
      console.log('[Billing] getPurchases result:', JSON.stringify(result));

      const purchases = result.purchases || [];
      const premiumPurchases = purchases.filter(p =>
        p.productIdentifier === PRODUCT_ID ||
        p.planIdentifier === PRODUCT_ID
      );

      return { success: true, purchases: premiumPurchases };
    } catch (error) {
      console.error('[Billing] getPurchases failed:', error?.message || error);
      // Fallback: try restorePurchases (triggers re-sync with store)
      try {
        await this.NativePurchases.restorePurchases();
        // After restore, try getPurchases again
        const result = await this.NativePurchases.getPurchases({ productType: 'SUBS' });
        const purchases = (result.purchases || []).filter(p =>
          p.productIdentifier === PRODUCT_ID || p.planIdentifier === PRODUCT_ID
        );
        return { success: true, purchases };
      } catch (e2) {
        console.error('[Billing] Restore fallback failed:', e2?.message || e2);
        return { success: false, purchases: [] };
      }
    }
  }

  async verifyAndActivate(userId, purchaseData) {
    try {
      const response = await axios.post(`${API}/subscription/google-play/verify`, {
        user_id: userId,
        product_id: purchaseData.productId || PRODUCT_ID,
        purchase_token: purchaseData.purchaseToken || purchaseData.transactionId,
        transaction_id: purchaseData.transactionId,
        base_plan_id: purchaseData.basePlanId || PLAN_ID,
        offer_id: purchaseData.offerId || OFFER_ID,
      });
      return response.data;
    } catch (error) {
      console.error('[Billing] Server verification failed:', error?.message);
      return { success: false, error: error.response?.data?.detail || 'Your Premium purchase is being verified. Please restart the app.' };
    }
  }

  async checkStatus(userId) {
    try {
      const response = await axios.get(`${API}/subscription/status/${userId}`);
      return response.data;
    } catch (error) {
      return { is_premium: false, subscription_status: 'none' };
    }
  }

  openManageSubscriptions() {
    if (this.isNative() && this.NativePurchases) {
      // Prefer native method
      try {
        this.NativePurchases.manageSubscriptions();
      } catch {
        window.open(`https://play.google.com/store/account/subscriptions?sku=${PRODUCT_ID}&package=com.heartlink.app`, '_system');
      }
    }
  }
}

const playBillingService = new PlayBillingService();
export default playBillingService;
export { PRODUCT_ID, PLAN_ID, OFFER_ID };
