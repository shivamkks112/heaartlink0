import { openUnlock } from '@/components/UnlockSheet';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Heart, Eye, Zap, Shield, Star, Ban, Check, X } from 'lucide-react';
import { haptic } from '@/utils/haptics';

const BENEFITS = [
  { icon: Heart, text: 'Unlimited Likes' },
  { icon: Star, text: 'Super Likes' },
  { icon: Eye, text: 'See Who Liked You' },
  { icon: Zap, text: 'Profile Boost' },
  { icon: Ban, text: 'Ad-Free' },
  { icon: Shield, text: 'Advanced Filters' },
];

/**
 * PremiumBottomSheet — Slides up from bottom with subscribe CTA
 * Usage: <PremiumBottomSheet isOpen={show} onClose={() => setShow(false)} />
 */
const PremiumBottomSheet = ({ isOpen, onClose, title = 'Premium chahiye!' }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[200] transition-opacity duration-300"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={() => { haptic.light(); onClose(); }}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '70vh',
          paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        <div className="px-5 pb-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="text-xs text-gray-400">Unlock all premium features</p>
              </div>
            </div>
            <button onClick={() => { haptic.light(); onClose(); }} className="p-2 rounded-full bg-white/10">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Benefits grid */}
          <div className="grid grid-cols-2 gap-2">
            {BENEFITS.map((b, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5">
                <b.icon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-300">{b.text}</span>
              </div>
            ))}
          </div>

          {/* Subscribe CTA */}
          <button
            onClick={() => { haptic.heavy(); onClose(); openUnlock(); }}
            className="w-full py-4 rounded-2xl text-base font-bold text-white active:scale-[0.97] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #EF6C00 100%)',
              boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
            }}
            data-testid="bottomsheet-subscribe-btn"
          >
            Subscribe — ₹49/month
          </button>

          <p className="text-center text-[10px] text-gray-500">Cancel anytime from Google Play Store</p>
        </div>
      </div>
    </>
  );
};

export default PremiumBottomSheet;
