/**
 * AdRewardCard - Card showing ad reward options
 * Used in discover page and profile page
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAds } from '../../context/AdContext';
import { Play, Zap, Gift, MessageCircle, Clock, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

const AdRewardCard = ({ onClose, showCloseButton = false }) => {
  const { 
    isEligible, 
    isLoading, 
    boostActive, 
    getBoostTimeRemaining,
    watchAdForSwipes, 
    watchAdForBoost, 
    watchAdForPriorityMessage,
    dailySwipes 
  } = useAds();
  
  const [selectedReward, setSelectedReward] = useState(null);

  // Don't render for non-eligible users
  if (!isEligible) {
    return null;
  }

  const handleWatchAd = async (rewardType) => {
    setSelectedReward(rewardType);
    
    let result;
    switch (rewardType) {
      case 'swipes':
        result = await watchAdForSwipes();
        if (result.success) {
          toast.success('🎉 +10 Extra Swipes Added!', {
            description: 'Use them wisely to find your match!'
          });
        }
        break;
      case 'boost':
        result = await watchAdForBoost();
        if (result.success) {
          toast.success('🚀 Profile Boosted!', {
            description: 'Your profile will be shown to more people for 30 minutes!'
          });
        }
        break;
      case 'priority':
        result = await watchAdForPriorityMessage();
        if (result.success) {
          toast.success('💬 Priority Message Unlocked!', {
            description: 'Your next message will appear at the top!'
          });
        }
        break;
    }

    if (!result.success && result.reason !== 'not_eligible') {
      toast.error('Ad not available', {
        description: 'Please try again in a few moments'
      });
    }
    
    setSelectedReward(null);
  };

  const boostTimeRemaining = getBoostTimeRemaining();

  return (
    <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200 shadow-lg" data-testid="ad-reward-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            <CardTitle className="text-lg text-gray-800">Earn Free Rewards</CardTitle>
          </div>
          {showCloseButton && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <CardDescription className="text-gray-600">
          Watch a short ad to unlock premium features
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Extra Swipes */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-pink-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-100 rounded-full">
              <Gift className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Extra Swipes</p>
              <p className="text-xs text-gray-500">Get 10 more swipes</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleWatchAd('swipes')}
            disabled={isLoading}
            className="bg-pink-500 hover:bg-pink-600"
            data-testid="watch-ad-swipes-btn"
          >
            {selectedReward === 'swipes' && isLoading ? (
              <span className="animate-pulse">Loading...</span>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Watch
              </>
            )}
          </Button>
        </div>

        {/* Profile Boost */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-full">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Profile Boost</p>
              <p className="text-xs text-gray-500">30 min visibility boost</p>
            </div>
            {boostActive && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                <Clock className="w-3 h-3 mr-1" />
                {boostTimeRemaining}m left
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => handleWatchAd('boost')}
            disabled={isLoading || boostActive}
            className="bg-amber-500 hover:bg-amber-600"
            data-testid="watch-ad-boost-btn"
          >
            {selectedReward === 'boost' && isLoading ? (
              <span className="animate-pulse">Loading...</span>
            ) : boostActive ? (
              'Active'
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Watch
              </>
            )}
          </Button>
        </div>

        {/* Priority Message */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <MessageCircle className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Priority Message</p>
              <p className="text-xs text-gray-500">Stand out in their inbox</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleWatchAd('priority')}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600"
            data-testid="watch-ad-priority-btn"
          >
            {selectedReward === 'priority' && isLoading ? (
              <span className="animate-pulse">Loading...</span>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Watch
              </>
            )}
          </Button>
        </div>

        {/* Current Rewards Status */}
        {dailySwipes > 0 && (
          <div className="text-center text-sm text-gray-600 pt-2 border-t border-pink-100">
            You have <span className="font-semibold text-pink-600">{dailySwipes}</span> extra swipes available
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdRewardCard;
