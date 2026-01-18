/**
 * RewardedAdButton - Button component to watch rewarded ads
 * Shows different reward options based on type
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { useAds } from '../../context/AdContext';
import { Play, Zap, Gift, MessageCircle, Loader2 } from 'lucide-react';

const REWARD_CONFIG = {
  extra_swipes: {
    icon: Gift,
    label: 'Watch Ad for 10 Extra Swipes',
    shortLabel: '+10 Swipes',
    color: 'bg-gradient-to-r from-pink-500 to-rose-500',
  },
  profile_boost: {
    icon: Zap,
    label: 'Watch Ad for 30 Min Profile Boost',
    shortLabel: 'Boost Profile',
    color: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
  priority_message: {
    icon: MessageCircle,
    label: 'Watch Ad for Priority Message',
    shortLabel: 'Priority Msg',
    color: 'bg-gradient-to-r from-blue-500 to-indigo-500',
  },
};

const RewardedAdButton = ({ 
  rewardType = 'extra_swipes', 
  onRewardEarned,
  variant = 'default',
  size = 'default',
  className = '',
  showIcon = true,
  compact = false,
}) => {
  const { isEligible, isLoading, watchAdForSwipes, watchAdForBoost, watchAdForPriorityMessage } = useAds();
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState(null);

  const config = REWARD_CONFIG[rewardType] || REWARD_CONFIG.extra_swipes;
  const Icon = config.icon;

  const handleClick = async () => {
    if (!isEligible || isLoading || localLoading) return;

    setLocalLoading(true);
    setError(null);

    try {
      let result;
      
      switch (rewardType) {
        case 'extra_swipes':
          result = await watchAdForSwipes();
          break;
        case 'profile_boost':
          result = await watchAdForBoost();
          break;
        case 'priority_message':
          result = await watchAdForPriorityMessage();
          break;
        default:
          result = await watchAdForSwipes();
      }

      if (result.success && result.reward) {
        onRewardEarned?.(result.reward);
      } else if (!result.success) {
        setError(result.reason === 'not_completed' 
          ? 'Watch the full ad to earn reward' 
          : 'Ad not available, try again later');
      }
    } catch (err) {
      setError('Something went wrong');
      console.error('Rewarded ad error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  // Don't render if user is not eligible (female or premium)
  if (!isEligible) {
    return null;
  }

  const buttonLoading = isLoading || localLoading;

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        onClick={handleClick}
        disabled={buttonLoading}
        variant={variant}
        size={size}
        className={`${config.color} text-white hover:opacity-90 transition-all ${className}`}
        data-testid={`reward-ad-btn-${rewardType}`}
      >
        {buttonLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : showIcon ? (
          <Icon className="w-4 h-4 mr-2" />
        ) : (
          <Play className="w-4 h-4 mr-2" />
        )}
        {compact ? config.shortLabel : config.label}
      </Button>
      
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};

export default RewardedAdButton;
