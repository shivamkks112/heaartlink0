/**
 * OutOfSwipesModal - Shows when user runs out of swipes
 * Offers rewarded ad option to get more swipes
 */

import React, { useState } from 'react';
import { X, Play, Heart, Crown, Gift, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { useAds } from '../../context/AdContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const OutOfSwipesModal = ({ isOpen, onClose, onSwipesAdded }) => {
  const navigate = useNavigate();
  const { isEligible, isLoading, watchAdForSwipes } = useAds();
  const [watchingAd, setWatchingAd] = useState(false);

  if (!isOpen) return null;

  const handleWatchAd = async () => {
    setWatchingAd(true);
    try {
      const result = await watchAdForSwipes();
      
      if (result.success) {
        toast.success('🎉 +10 Extra Swipes Added!', {
          description: 'Keep swiping to find your perfect match!'
        });
        if (onSwipesAdded) onSwipesAdded(10);
        onClose();
      } else if (result.simulated) {
        // For web testing
        toast.success('🎉 +10 Extra Swipes Added! (Test Mode)', {
          description: 'In app, you would watch an ad first.'
        });
        if (onSwipesAdded) onSwipesAdded(10);
        onClose();
      } else {
        toast.error('Ad not available right now', {
          description: 'Please try again in a moment'
        });
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setWatchingAd(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="out-of-swipes-modal">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
          data-testid="close-modal-btn"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 px-6 py-8 text-center text-white">
          <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Swipes Khatam Ho Gaye! 😅</h2>
          <p className="text-white/90 text-sm">
            Aapne aaj ke saare swipes use kar liye
          </p>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4">
          {/* Watch Ad Option - Only for eligible users */}
          {isEligible && (
            <button
              onClick={handleWatchAd}
              disabled={isLoading || watchingAd}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white p-4 rounded-2xl flex items-center justify-between transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              data-testid="watch-ad-for-swipes-btn"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Gift className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-lg">Free Swipes Pao!</p>
                  <p className="text-sm text-white/80">Ad dekho, +10 swipes lo</p>
                </div>
              </div>
              {watchingAd ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </button>
          )}

          {/* Premium Option */}
          <button
            onClick={() => {
              onClose();
              navigate('/premium');
            }}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white p-4 rounded-2xl flex items-center justify-between transition-all shadow-lg hover:shadow-xl"
            data-testid="go-premium-btn"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Crown className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-lg">Premium Upgrade</p>
                <p className="text-sm text-white/80">Unlimited swipes, no ads!</p>
              </div>
            </div>
            <Sparkles className="w-6 h-6" />
          </button>

          {/* Wait Option */}
          <div className="text-center pt-2">
            <p className="text-gray-500 text-sm">
              Ya phir <span className="font-semibold text-pink-600">12 baje</span> ke baad free swipes mil jayenge
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutOfSwipesModal;
