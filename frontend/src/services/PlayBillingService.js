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
      console.log('PlayBilling: Not native platform');
      return false;
    }

    try {
      const mod = await import('@capgo/native-purchases');
      this.NativePurchases = mod.NativePurchases;
      
      const { supported } = await this.NativePurchases.isBillingSupported();
      if (!supported) {
        console.log('PlayBilling: Billing not supported');
        return false;
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('PlayBilling: Init failed:', error);
      return false;
    }
  }

  async getProduct() {
    if (!this.initialized || !this.NativePurchases) return null;

    try {
      const result = await this.NativePurchases.getProducts({
        productIdentifiers: [PRODUCT_ID],
        productType: 'SUBS',
      });
      
      if (result.products && result.products.length > 0) {
        this.products = result.products;
        this.productDetails = result.products[0];
        return result.products[0];
      }
      return null;
    } catch (error) {
      console.error('PlayBilling: getProducts failed:', error);
      return null;
    }
  }

  // Get display price from Play Store (source of truth)
  getDisplayPrice() {
    if (this.productDetails) {
      return this.productDetails.price || this.productDetails.localizedPrice || '₹49';
    }
    return '₹49'; // Fallback only if product query hasn't run
  }

  getTrialInfo() {
    if (this.productDetails?.introductoryPrice) {
      return {
        hasTrial: true,
        trialDuration: this.productDetails.introductoryPrice.period || '3 days',
        trialPrice: this.productDetails.introductoryPrice.price || 'Free',
      };
    }
    return { hasTrial: true, trialDuration: '3 days', trialPrice: 'Free' };
  }

  async purchaseSubscription() {
    if (!this.initialized || !this.NativePurchases) {
      return { success: false, error: 'Google Play billing is currently unavailable. Please try again.' };
    }

    try {
      const result = await this.NativePurchases.purchaseProduct({
        productIdentifier: PRODUCT_ID,
        productType: 'SUBS',
        planIdentifier: PLAN_ID,
        offerIdentifier: OFFER_ID,
        quantity: 1,
      });

      if (result.transactionId) {
        return {
          success: true,
          transactionId: result.transactionId,
          productId: PRODUCT_ID,
          purchaseToken: result.purchaseToken || result.transactionId,
          basePlanId: PLAN_ID,
          offerId: OFFER_ID,
        };
      }

      return { success: false, error: 'Purchase incomplete' };
    } catch (error) {
      if (error.message?.includes('cancelled') || error.code === 'USER_CANCELLED') {
        return { success: false, error: 'cancelled' };
      }
      console.error('PlayBilling: Purchase failed:', error);
      return { success: false, error: error.message || 'Purchase could not be completed. Please try again.' };
    }
  }

  async restorePurchases() {
    if (!this.initialized || !this.NativePurchases) {
      return { success: false, purchases: [] };
    }

    try {
      const result = await this.NativePurchases.restorePurchases();
      const purchases = result.purchases || [];
      
      const premiumPurchases = purchases.filter(p => 
        p.productIdentifier === PRODUCT_ID || p.productId === PRODUCT_ID
      );
      
      return { success: true, purchases: premiumPurchases };
    } catch (error) {
      console.error('PlayBilling: Restore failed:', error);
      return { success: false, purchases: [] };
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
      console.error('PlayBilling: Server verification failed:', error);
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

  // Open Google Play subscription management
  openManageSubscriptions() {
    if (this.isNative()) {
      window.open(`https://play.google.com/store/account/subscriptions?sku=${PRODUCT_ID}&package=com.heartlink.app`, '_system');
    }
  }
}

const playBillingService = new PlayBillingService();
export default playBillingService;
export { PRODUCT_ID, PLAN_ID, OFFER_ID };
