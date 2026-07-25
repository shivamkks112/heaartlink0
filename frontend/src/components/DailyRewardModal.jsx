import { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, Zap, Flame, Gift, X, Check } from 'lucide-react';
import { toast } from 'sonner';

import { BACKEND_URL, API } from '@/config/api';

const rewardIcons = {
  superlikes: Star,
  superlikes_badge: Gift,
  profile_boost: Zap,
};

const rewardColors = {
  superlikes: 'from-pink-500 to-rose-500',
  superlikes_badge: 'from-yellow-500 to-orange-500',
  profile_boost: 'from-blue-500 to-indigo-500',
};

const DailyRewardModal = ({ user, onClose }) => {
  const [rewardData, setRewardData] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewardStatus();
  }, []);

  const fetchRewardStatus = async () => {
    try {
      const res = await axios.get(`${API}/daily-reward/${user.id}`);
      setRewardData(res.data);
      if (res.data.already_claimed_today) {
        setClaimed(true);
      }
    } catch (error) {
      // If feature is paused (403), silently close modal
      if (error.response?.status === 403) {
        onClose();
        return;
      }
      console.error('Error fetching reward:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async () => {
    if (claiming || claimed) return;
    setClaiming(true);
    try {
      const res = await axios.post(`${API}/daily-reward/${user.id}/claim`);
      setClaimed(true);
      toast.success(res.data.message);
      // Update rewardData with new streak
      setRewardData(prev => ({
        ...prev,
        current_streak: res.data.new_streak,
        already_claimed_today: true,
        today_reward: res.data.reward
      }));
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to claim reward';
      toast.error(detail);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return null;
  if (!rewardData) return null;

  const todayReward = claimed ? rewardData.today_reward : rewardData.today_reward;
  const Icon = todayReward ? (rewardIcons[todayReward.type] || Star) : Star;
  const gradientClass = todayReward ? (rewardColors[todayReward.type] || 'from-pink-500 to-rose-500') : 'from-pink-500 to-rose-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" data-testid="daily-reward-modal">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className={`bg-gradient-to-r ${gradientClass} p-5 text-white text-center relative`}>
          <button
            onClick={onClose}
            data-testid="close-daily-reward"
            className="absolute top-3 right-3 p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            {claimed ? <Check className="w-8 h-8" /> : <Icon className="w-8 h-8" />}
          </div>
          
          <h2 className="text-xl font-bold">
            {claimed ? 'Reward Claimed!' : 'Daily Reward'}
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {claimed ? 'Come back tomorrow for more!' : 'Claim your daily login reward'}
          </p>
        </div>

        {/* Streak Info */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-gray-900" data-testid="streak-count">
              {rewardData.current_streak} Day Streak
            </span>
          </div>

          {/* 7-Day Reward Track */}
          <div className="flex justify-between mb-5" data-testid="reward-track">
            {rewardData.all_rewards.map((reward, idx) => {
              const dayNum = idx + 1;
              const streakDay = rewardData.current_streak % 7;
              const isCompleted = claimed 
                ? dayNum <= (streakDay === 0 ? 7 : streakDay)
                : dayNum <= (streakDay === 0 && rewardData.current_streak > 0 ? 7 : streakDay);
              const isToday = dayNum === rewardData.next_day;
              const DayIcon = rewardIcons[reward.type] || Star;
              
              return (
                <div key={dayNum} className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md'
                      : isToday && !claimed
                      ? `bg-gradient-to-r ${rewardColors[reward.type] || 'from-pink-500 to-rose-500'} text-white shadow-md animate-pulse`
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : <DayIcon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] font-medium ${
                    isToday ? 'text-pink-600 font-bold' : 'text-gray-500'
                  }`}>
                    D{dayNum}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Today's Reward */}
          {todayReward && (
            <div className={`rounded-xl p-4 mb-4 text-center ${
              claimed ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
            }`} data-testid="today-reward">
              <p className="text-sm text-gray-600 mb-1">
                {claimed ? 'You received' : "Today's Reward"}
              </p>
              <p className="text-lg font-bold text-gray-900">{todayReward.label}</p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="px-5 pb-5">
          {claimed ? (
            <button
              onClick={onClose}
              data-testid="daily-reward-done-btn"
              className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Done
            </button>
          ) : (
            <button
              onClick={claimReward}
              disabled={claiming}
              data-testid="claim-reward-btn"
              className={`w-full py-3 bg-gradient-to-r ${gradientClass} text-white font-semibold rounded-xl hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50`}
            >
              {claiming ? 'Claiming...' : 'Claim Reward'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyRewardModal;
