/**
 * SeeWhoLikedYouCard - Blurred profile card that reveals after watching ad
 * Shows who liked you with blur effect until ad is watched
 */

import React, { useState } from 'react';
import { Play, Heart, Eye, Lock, Crown, User, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { useAds } from '../../context/AdContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const SeeWhoLikedYouCard = ({ likedUser, onReveal, isRevealed = false }) => {
  const navigate = useNavigate();
  const { isEligible, isLoading } = useAds();
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(isRevealed);

  const handleWatchAdToReveal = async () => {
    setRevealing(true);
    
    try {
      // Use global AdMobService for rewarded ads
      if (window.AdMobService && window.AdMobService.isNative()) {
        const shown = await window.AdMobService.showRewarded((reward) => {
          console.log('Reward earned:', reward);
          setRevealed(true);
          if (onReveal) onReveal(likedUser.id);
          toast.success('🎉 Profile Revealed!', {
            description: `${likedUser.name} ne aapko like kiya hai!`
          });
        });
        
        if (!shown) {
          toast.error('Ad not available', {
            description: 'Please try again later'
          });
        }
      } else {
        // Web testing simulation
        setTimeout(() => {
          setRevealed(true);
          if (onReveal) onReveal(likedUser.id);
          toast.success('🎉 Profile Revealed! (Test Mode)', {
            description: `${likedUser.name} ne aapko like kiya hai!`
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Error showing rewarded ad:', error);
      toast.error('Something went wrong');
    } finally {
      setRevealing(false);
    }
  };

  // If revealed, show normal card
  if (revealed) {
    return (
      <div className="relative bg-white rounded-3xl shadow-lg overflow-hidden" data-testid="revealed-like-card">
        <div className="relative h-64 overflow-hidden">
          {likedUser.profile_picture ? (
            <img
              src={likedUser.profile_picture}
              alt={likedUser.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-200 via-rose-200 to-orange-200 flex items-center justify-center">
              <User className="w-20 h-20 text-white/50" />
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Revealed Badge */}
          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
            <Eye className="w-3 h-3" />
            Revealed
          </div>
          
          {/* User Info */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h3 className="text-2xl font-bold mb-1">
              {likedUser.name}, {likedUser.age}
            </h3>
            {likedUser.location && (
              <p className="text-sm text-white/90">📍 {likedUser.location}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Blurred card with unlock option
  return (
    <div className="relative bg-white rounded-3xl shadow-lg overflow-hidden" data-testid="blurred-like-card">
      <div className="relative h-64 overflow-hidden">
        {/* Blurred Image */}
        {likedUser.profile_picture ? (
          <img
            src={likedUser.profile_picture}
            alt="Hidden profile"
            className="w-full h-full object-cover blur-xl scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-pink-200 via-rose-200 to-orange-200 blur-xl" />
        )}
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/40" />
        
        {/* Lock Icon & Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-1">Someone Liked You!</h3>
          <p className="text-sm text-white/80 text-center mb-4">
            {likedUser.age} years • {likedUser.location || 'Near you'}
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {isEligible && (
              <Button
                onClick={handleWatchAdToReveal}
                disabled={isLoading || revealing}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                data-testid="watch-ad-reveal-btn"
              >
                {revealing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Ad Dekho, Profile Dekho
                  </>
                )}
              </Button>
            )}
            
            {/* Premium Button - HIDDEN FOR NOW */}
            {/* <Button
              onClick={() => navigate('/premium')}
              variant="outline"
              className="w-full bg-white/10 hover:bg-white/20 border-white/30 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              data-testid="premium-reveal-btn"
            >
              <Crown className="w-4 h-4" />
              Premium se Sab Dekho
            </Button> */}
          </div>
        </div>
      </div>
      
      {/* Heart animation at bottom */}
      <div className="absolute bottom-2 right-2">
        <Heart className="w-8 h-8 text-pink-500 animate-pulse" fill="currentColor" />
      </div>
    </div>
  );
};

export default SeeWhoLikedYouCard;
