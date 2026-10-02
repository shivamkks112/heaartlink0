/**
 * HeartLink Premium — Google Play Billing
 * Product: heartlink_premium_monthly | Plan: monthly | Offer: trial3days
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Crown, Check, ArrowLeft, Heart, Eye, Zap, Shield, Star, Ban, Loader2, RotateCcw, X, ExternalLink, Upload, Camera, Clock } from 'lucide-react';
import { API } from '@/config/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import playBillingService from '@/services/PlayBillingService';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';

const BENEFITS = [
  { icon: Heart, text: 'Unlimited Likes', desc: 'Swipe without limits' },
  { icon: Star, text: 'Super Likes', desc: '5 Super Likes every day' },
  { icon: Eye, text: 'See Who Liked You', desc: 'Know who likes you first' },
  { icon: Zap, text: 'Profile Boost', desc: 'Be seen by more people' },
  { icon: Ban, text: 'Ad-Free', desc: 'No interruptions, ever' },
  { icon: Shield, text: 'Advanced Filters', desc: 'Find exactly your type' },
];

const PremiumPage = ({ user, onUpdate }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [billingReady, setBillingReady] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [displayPrice, setDisplayPrice] = useState('₹49');

  useEffect(() => {
    initBilling();
    checkStatus();
  }, []);

  const initBilling = async () => {
    const ready = await playBillingService.initialize();
    setBillingReady(ready);
    if (ready) {
      const product = await playBillingService.getProduct();
      if (product) {
        setDisplayPrice(playBillingService.getDisplayPrice());
      }
    } else if (playBillingService.isNative()) {
      console.warn('[PremiumPage] Billing init failed:', playBillingService.getInitError());
    }
  };

  const checkStatus = async () => {
    if (!user?.id) return;
    const status = await playBillingService.checkStatus(user.id);
    setSubStatus(status);
  };

  const handlePurchase = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      if (!billingReady) {
        if (playBillingService.isNative()) {
          const initErr = playBillingService.getInitError();
          toast.error(`Billing unavailable: ${initErr || 'Please restart the app and try again.'}`);
          // Retry initialization once
          const retryReady = await playBillingService.initialize();
          if (retryReady) {
            setBillingReady(true);
            await playBillingService.getProduct();
          } else {
            return;
          }
        } else {
          toast.info('Premium subscription is available on the HeartLink Android app.');
          return;
        }
      }
      const result = await playBillingService.purchaseSubscription();
      if (result.success) {
        if (result.alreadyOwned) {
          toast.info('Restoring your existing subscription...');
        } else {
          toast.info('Verifying your purchase...');
        }
        const verification = await playBillingService.verifyAndActivate(user.id, result);
        if (verification.success) {
          toast.success(verification.message || 'Premium activated!');
          const updatedUser = { ...user, is_premium: true, subscription_status: verification.subscription_status };
          if (onUpdate) onUpdate(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setSubStatus({ is_premium: true, subscription_status: verification.subscription_status, expires_at: verification.expires_at });
        } else {
          toast.error(verification.error || 'Purchase verification failed. Please try again.');
        }
      } else if (result.error === 'cancelled') {
        // User cancelled — silent
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!user?.id) return;
    setRestoring(true);
    try {
      const result = await playBillingService.restorePurchases();
      if (result.success && result.purchases.length > 0) {
        const purchase = result.purchases[0];
        const verification = await playBillingService.verifyAndActivate(user.id, {
          productId: purchase.productIdentifier || purchase.productId,
          purchaseToken: purchase.purchaseToken || purchase.transactionId,
          transactionId: purchase.transactionId,
        });
        if (verification.success) {
          toast.success('Premium restored successfully!');
          const updatedUser = { ...user, is_premium: true };
          if (onUpdate) onUpdate(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setSubStatus({ is_premium: true });
        } else {
          toast.error('Could not verify restored purchase.');
        }
      } else {
        toast.info('No previous purchases found.');
      }
    } catch (error) {
      toast.error('Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const isPremium = user?.is_premium || subStatus?.is_premium;
  const isGirl = user?.gender?.toLowerCase() === 'female';
  const isExpired = !isPremium && !isGirl && (subStatus?.subscription_status === 'expired' || user?.subscription_status === 'expired');
  const isCancelled = subStatus?.subscription_status === 'cancelled';
  const statusLabel = isGirl ? 'Girls Free Forever' : subStatus?.subscription_status === 'trialing' ? 'Trial' : subStatus?.subscription_status === 'active' ? 'Active' : subStatus?.subscription_status === 'cancelled' ? 'Cancelled (active until expiry)' : subStatus?.subscription_status === 'in_grace_period' ? 'Grace Period' : subStatus?.subscription_status === 'on_hold' ? 'On Hold' : subStatus?.subscription_status === 'paused' ? 'Paused' : '';

  // Girls always see premium as active
  const showAsPremium = isPremium || isGirl;
  
  // New user = joined within 7 days — eligible for trial
  const isNewUser = (() => {
    const created = user?.created_at;
    if (!created) return false;
    const daysSinceJoin = (Date.now() - new Date(created).getTime()) / 86400000;
    return daysSinceJoin <= 7;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 page-with-bottom-nav" style={{ paddingTop: 'var(--safe-top, 24px)' }}>
      <Toaster position="top-center" />
      <Navbar user={user} />

      <div className="max-w-lg mx-auto px-4 py-4 pb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* ── ACTIVE PREMIUM ── */}
        {showAsPremium && (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{isGirl ? 'Premium Free for You!' : "You're Premium!"}</h1>
            {statusLabel && <p className="text-sm text-amber-400 font-medium">{statusLabel}</p>}
            {isGirl && <p className="text-xs text-gray-400">HeartLink pe girls ko sab premium features FREE milte hai</p>}
            {!isGirl && subStatus?.expires_at && (
              <p className="text-xs text-gray-500">
                {isCancelled ? 'Access until' : subStatus?.subscription_status === 'trialing' ? 'Trial ends' : 'Renews'}: {new Date(subStatus.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 mt-6">
              {BENEFITS.map((b, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-gray-300">{b.text}</span>
                </div>
              ))}
            </div>
            {!isGirl && (
              <button
                onClick={() => playBillingService.openManageSubscriptions()}
                className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-200 mx-auto"
                data-testid="manage-subscription-btn"
              >
                <ExternalLink className="w-4 h-4" /> Manage Subscription
              </button>
            )}
          </div>
        )}

        {/* ── EXPIRED ── */}
        {isExpired && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center mb-3">
                <Crown className="w-10 h-10 text-gray-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Premium Expired</h1>
              <p className="text-gray-400 text-sm mt-1">Your HeartLink Premium subscription has ended</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-2">
              <p className="text-sm text-red-300 font-semibold">You've lost access to:</p>
              {BENEFITS.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-500 text-sm">
                  <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
            <Button
              onClick={handlePurchase}
              disabled={loading}
              className="w-full py-4 rounded-2xl text-base font-bold text-white shadow-lg shadow-amber-500/20 active:scale-[0.97] transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EF6C00 100%)' }}
              data-testid="resubscribe-btn"
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</> : `Re-subscribe — ${displayPrice}/month`}
            </Button>
            <button onClick={handleRestore} disabled={restoring} className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500">
              {restoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Restoring...</> : <><RotateCcw className="w-4 h-4" /> Restore Purchases</>}
            </button>
          </div>
        )}

        {/* ── NEW PURCHASE ── */}
        {!showAsPremium && !isExpired && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/20">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">HeartLink Premium</h1>
              <p className="text-gray-400 text-sm mt-1">Find your perfect match faster</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-white">{displayPrice}</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              {isNewUser && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold">
                  <Star className="w-3 h-3" /> 3 days free trial
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-2">
                {isNewUser ? `3 days free, then ${displayPrice}/month. Auto-renews.` : `${displayPrice}/month. Auto-renews.`} Cancel anytime from Google Play Store.
              </p>
            </div>

            <div className="space-y-2">
              {BENEFITS.map((b, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3" data-testid={`benefit-${i}`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <b.icon className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{b.text}</p>
                    <p className="text-[11px] text-gray-500">{b.desc}</p>
                  </div>
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                </div>
              ))}
            </div>

            <Button
              onClick={handlePurchase}
              disabled={loading}
              className="w-full py-4 rounded-2xl text-base font-bold text-white shadow-lg shadow-amber-500/20 active:scale-[0.97] transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EF6C00 100%)' }}
              data-testid="start-trial-btn"
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</> : isNewUser ? 'Start Free Trial' : `Subscribe — ${displayPrice}/month`}
            </Button>

            <p className="text-center text-[10px] text-gray-600 leading-relaxed">
              {isNewUser 
                ? `3 days free, then ${displayPrice}/month. Cancel anytime from Google Play Store. Auto-renews unless cancelled 24 hours before period ends.`
                : `You'll be charged ${displayPrice}/month. Cancel anytime from Google Play Store. Auto-renews unless cancelled 24 hours before period ends.`
              }
            </p>

            <button onClick={handleRestore} disabled={restoring} className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-gray-300 transition-colors" data-testid="restore-purchases-btn">
              {restoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Restoring...</> : <><RotateCcw className="w-4 h-4" /> Restore Purchases</>}
            </button>

            {/* Promo Code Section */}
            <PromoCodeInput userId={user?.id} onSuccess={(data) => {
              toast.success(data.message);
              const updatedUser = { ...user, is_premium: true, subscription_status: 'promo_code' };
              if (onUpdate) onUpdate(updatedUser);
              localStorage.setItem('user', JSON.stringify(updatedUser));
              setSubStatus({ is_premium: true, subscription_status: 'promo_code', expires_at: data.expires_at });
            }} />

            {/* Manual UPI Payment Section */}
            <PaymentScreenshotUpload userId={user?.id} onSuccess={() => {
              toast.success('Screenshot submitted! Premium will be activated after verification.');
            }} />
          </div>
        )}
      </div>
    </div>
  );
};

const PromoCodeInput = ({ userId, onSuccess }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) { toast.error('Enter a promo code'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/promo/redeem`, { user_id: userId, code: code.trim() });
      if (res.data.success) {
        onSuccess(res.data);
        setCode('');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Invalid code');
    }
    setLoading(false);
  };

  return (
    <div className="border border-dashed border-gray-600 rounded-xl p-4 space-y-2" data-testid="promo-code-section">
      <p className="text-xs text-gray-400 text-center">Have a promo code?</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code"
          maxLength={20}
          className="flex-1 bg-white/5 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 uppercase tracking-wider"
          data-testid="promo-code-input"
        />
        <button
          onClick={handleRedeem}
          disabled={loading || !code.trim()}
          className="px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
          data-testid="promo-redeem-btn"
        >
          {loading ? '...' : 'Redeem'}
        </button>
      </div>
    </div>
  );
};

export default PremiumPage;

const UPI_ID = "8409798101-2@ybl";

const PaymentScreenshotUpload = ({ userId, onSuccess }) => {
  const [expanded, setExpanded] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (userId) {
      axios.get(`${API}/payment/status/${userId}`).then(r => {
        if (r.data.has_request) setPaymentStatus(r.data);
      }).catch(() => {});
    }
  }, [userId]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File size max 5MB'); return; }
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!screenshotPreview) { toast.error('Payment screenshot upload karo'); return; }
    if (!utrNumber.trim()) { toast.error('UTR / Transaction ID daalna zaroori hai'); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/payment/submit-screenshot`, {
        user_id: userId,
        screenshot_base64: screenshotPreview,
        utr_number: utrNumber.trim(),
        amount: 49,
        payment_method: 'UPI',
      });
      if (res.data.success) {
        setPaymentStatus({ status: 'pending', has_request: true });
        setScreenshot(null);
        setScreenshotPreview(null);
        setUtrNumber('');
        setExpanded(false);
        onSuccess?.();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Submit failed');
    }
    setSubmitting(false);
  };

  // Show pending status
  if (paymentStatus?.status === 'pending') {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center" data-testid="payment-pending">
        <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-amber-400">Payment Verification Pending</p>
        <p className="text-xs text-gray-400 mt-1">Tumhara screenshot review ho raha hai. Premium jaldi activate hoga!</p>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full border border-dashed border-green-600/50 rounded-xl p-3 text-center hover:bg-green-500/5 transition-colors"
        data-testid="pay-upi-expand-btn"
      >
        <p className="text-sm font-semibold text-green-400">Pay via UPI</p>
        <p className="text-[10px] text-gray-500">GPay / PhonePe / Paytm — ₹49 only</p>
      </button>
    );
  }

  return (
    <div className="border border-green-600/30 rounded-xl p-4 space-y-3 bg-green-500/5" data-testid="payment-upload-section">
      <div className="text-center space-y-2">
        <p className="text-sm font-bold text-green-400">Pay ₹49 via UPI</p>
        
        {/* Step 1: One-tap UPI Deep Link buttons */}
        <p className="text-xs text-gray-400">Step 1: Tap to pay directly</p>
        <div className="grid grid-cols-3 gap-2">
          <a
            href={`upi://pay?pa=${UPI_ID}&pn=HeartLink%20Premium&am=49&cu=INR&tn=HeartLink%20Premium%20Subscription`}
            className="flex flex-col items-center gap-1 bg-white/10 rounded-xl py-3 active:scale-90 transition-transform"
            data-testid="upi-pay-btn"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">UPI</div>
            <span className="text-[10px] text-gray-300">Any UPI App</span>
          </a>
          <a
            href={`tez://upi/pay?pa=${UPI_ID}&pn=HeartLink%20Premium&am=49&cu=INR&tn=HeartLink%20Premium`}
            className="flex flex-col items-center gap-1 bg-white/10 rounded-xl py-3 active:scale-90 transition-transform"
            data-testid="gpay-btn"
          >
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm">G</div>
            <span className="text-[10px] text-gray-300">GPay</span>
          </a>
          <a
            href={`phonepe://pay?pa=${UPI_ID}&pn=HeartLink%20Premium&am=49&cu=INR&tn=HeartLink%20Premium`}
            className="flex flex-col items-center gap-1 bg-white/10 rounded-xl py-3 active:scale-90 transition-transform"
            data-testid="phonepe-btn"
          >
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">Pe</div>
            <span className="text-[10px] text-gray-300">PhonePe</span>
          </a>
        </div>
        
        {/* Fallback: Manual UPI ID */}
        <div className="bg-white/5 rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
          <p className="text-xs font-mono text-gray-400" data-testid="upi-id">{UPI_ID}</p>
          <button onClick={() => { navigator.clipboard?.writeText(UPI_ID); toast.success('UPI ID copied!'); }} className="text-[10px] text-green-400 font-semibold">Copy</button>
        </div>
      </div>

      <div className="border-t border-white/10 pt-3 space-y-2">
        <p className="text-xs text-gray-400 text-center">Step 2: Upload payment screenshot</p>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {screenshotPreview ? (
          <div className="relative">
            <img src={screenshotPreview} alt="Payment" className="w-full h-40 object-contain rounded-lg bg-black/20" />
            <button onClick={() => { setScreenshot(null); setScreenshotPreview(null); }} className="absolute top-1 right-1 bg-red-500 rounded-full p-1">
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-6 border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform"
            data-testid="upload-screenshot-btn"
          >
            <Camera className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Tap to upload screenshot</span>
          </button>
        )}

        <input
          type="text"
          value={utrNumber}
          onChange={e => setUtrNumber(e.target.value)}
          placeholder="UTR / Transaction ID *"
          className="w-full bg-white/5 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500"
          data-testid="utr-input"
          required
        />

        <button
          onClick={handleSubmit}
          disabled={submitting || !screenshotPreview || !utrNumber.trim()}
          className="w-full py-3 bg-green-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
          data-testid="submit-payment-btn"
        >
          {submitting ? 'Submitting...' : 'Submit for Verification'}
        </button>

        <button onClick={() => setExpanded(false)} className="w-full text-center text-xs text-gray-500 py-1">Cancel</button>
      </div>
    </div>
  );
};
