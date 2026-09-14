/**
 * Google Play Billing Service for HeartLink Premium
 * Uses @capgo/native-purchases for Capacitor Android
 * 
 * Product: heartlink_premium_monthly (₹49/month, 3-day trial)
 */

import { API } from '@/config/api';
import axios from 'axios';

const PRODUCT_ID = 'heartlink_premium_monthly';
const PLAN_ID = 'heartlink-premium-base'; // Base plan ID in Play Console

class PlayBillingService {
  constructor() {
    this.initialized = false;
    this.NativePurchases = null;
    this.products = [];
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
      console.log('PlayBilling: Not native platform, billing disabled');
      return false;
    }

    try {
      const mod = await import('@capgo/native-purchases');
      this.NativePurchases = mod.NativePurchases;
      
      // Check if billing is supported
      const { supported } = await this.NativePurchases.isBillingSupported();
      if (!supported) {
        console.log('PlayBilling: Billing not supported on this device');
        return false;
      }

      this.initialized = true;
      console.log('PlayBilling: Initialized successfully');
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
        return result.products[0];
      }
      return null;
    } catch (error) {
      console.error('PlayBilling: getProducts failed:', error);
      return null;
    }
  }

  async purchaseSubscription() {
    if (!this.initialized || !this.NativePurchases) {
      return { success: false, error: 'Billing not initialized' };
    }

    try {
      const result = await this.NativePurchases.purchaseProduct({
        productIdentifier: PRODUCT_ID,
        productType: 'SUBS',
        planIdentifier: PLAN_ID,
        quantity: 1,
      });

      if (result.transactionId) {
        return {
          success: true,
          transactionId: result.transactionId,
          productId: PRODUCT_ID,
          purchaseToken: result.purchaseToken || result.transactionId,
        };
      }

      return { success: false, error: 'Purchase incomplete' };
    } catch (error) {
      if (error.message?.includes('cancelled') || error.code === 'USER_CANCELLED') {
        return { success: false, error: 'cancelled' };
      }
      console.error('PlayBilling: Purchase failed:', error);
      return { success: false, error: error.message || 'Purchase failed' };
    }
  }

  async restorePurchases() {
    if (!this.initialized || !this.NativePurchases) {
      return { success: false, purchases: [] };
    }

    try {
      const result = await this.NativePurchases.restorePurchases();
      const purchases = result.purchases || [];
      
      // Filter for our subscription
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
      });
      return response.data;
    } catch (error) {
      console.error('PlayBilling: Server verification failed:', error);
      return { success: false, error: error.response?.data?.detail || 'Verification failed' };
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
}

const playBillingService = new PlayBillingService();
export default playBillingService;
export { PRODUCT_ID, PLAN_ID };
