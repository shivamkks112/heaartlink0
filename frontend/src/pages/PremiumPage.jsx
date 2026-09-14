/**
 * HeartLink Premium — Google Play Billing
 * ₹49/month, 3-day free trial
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Check, ArrowLeft, Heart, Eye, Zap, Shield, Star, Ban, Loader2, RotateCcw, X } from 'lucide-react';
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

  useEffect(() => {
    initBilling();
    checkStatus();
  }, []);

  const initBilling = async () => {
    const ready = await playBillingService.initialize();
    setBillingReady(ready);
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
        toast.error('Google Play billing is currently unavailable. Please try again.');
        return;
      }

      const result = await playBillingService.purchaseSubscription();
      
      if (result.success) {
        toast.info('Verifying your purchase...');
        const verification = await playBillingService.verifyAndActivate(user.id, result);
        
        if (verification.success) {
          toast.success(verification.message || 'Premium activated!');
          const updatedUser = { ...user, is_premium: true, isPremium: true, subscription_status: verification.subscription_status };
          if (onUpdate) onUpdate(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setSubStatus({ is_premium: true, subscription_status: verification.subscription_status });
        } else {
          toast.error(verification.error || 'Purchase verification failed. Please try again.');
        }
      } else if (result.error === 'cancelled') {
        // User cancelled — do nothing
      } else {
        toast.error(result.error || 'Purchase could not be completed. Please try again.');
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
          const updatedUser = { ...user, is_premium: true, isPremium: true };
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

  const isPremium = user?.is_premium || user?.isPremium || subStatus?.is_premium;
  const isExpired = !isPremium && (subStatus?.subscription_status === 'expired' || user?.subscription_status === 'expired');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 page-with-bottom-nav" style={{ paddingTop: 'var(--safe-top, 24px)' }}>
      <Toaster position="top-center" />
      <Navbar user={user} />

      <div className="max-w-lg mx-auto px-4 py-4 pb-8">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Premium Already Active */}
        {isPremium && (
          <div className="text-center py-10 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">You're Premium!</h1>
            <p className="text-gray-400 text-sm">All premium features are unlocked</p>
            {subStatus?.expires_at && (
              <p className="text-xs text-gray-500">
                {subStatus.subscription_status === 'trialing' ? 'Trial ends' : 'Renews'}: {new Date(subStatus.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
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
            <button onClick={() => navigate(-1)} className="mt-6 text-sm text-gray-500 underline">Go Back</button>
          </div>
        )}

        {/* Expired Premium */}
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
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
              ) : (
                'Re-subscribe — ₹49/month'
              )}
            </Button>

            <button onClick={handleRestore} disabled={restoring} className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500">
              {restoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Restoring...</> : <><RotateCcw className="w-4 h-4" /> Restore Purchases</>}
            </button>
          </div>
        )}

        {/* Purchase Screen */}
        {!isPremium && !isExpired && (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/20">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">HeartLink Premium</h1>
              <p className="text-gray-400 text-sm mt-1">Find your perfect match faster</p>
            </div>

            {/* Price Card */}
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-white">₹49</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold">
                <Star className="w-3 h-3" /> 3-day free trial
              </div>
              <p className="text-[10px] text-gray-500 mt-2">After trial: ₹49/month. Cancel anytime.</p>
            </div>

            {/* Benefits */}
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

            {/* CTA */}
            <Button
              onClick={handlePurchase}
              disabled={loading}
              className="w-full py-4 rounded-2xl text-base font-bold text-white shadow-lg shadow-amber-500/20 active:scale-[0.97] transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EF6C00 100%)' }}
              data-testid="start-trial-btn"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
              ) : (
                'Start 3-Day Free Trial'
              )}
            </Button>

            <p className="text-center text-[10px] text-gray-600 leading-relaxed">
              After your free trial, you'll be charged ₹49/month. Cancel anytime from Google Play Store. 
              By subscribing, you agree to our Terms of Service and Privacy Policy.
            </p>

            {/* Restore */}
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              data-testid="restore-purchases-btn"
            >
              {restoring ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Restoring...</>
              ) : (
                <><RotateCcw className="w-4 h-4" /> Restore Purchases</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PremiumPage;
