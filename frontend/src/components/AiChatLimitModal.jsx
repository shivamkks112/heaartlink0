import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Crown, PlayCircle, X } from 'lucide-react';
import adsService from '@/services/AdsService';
import { API } from '@/config/api';

export const AiChatLimitModal = ({ user, onClose, onExtended }) => {
  const navigate = useNavigate();
  const [watching, setWatching] = useState(false);

  const watchVideo = async () => {
    setWatching(true);
    const result = await adsService.showRewardedForSwipes(async (reward) => {
      if (!reward.success) return;
      try {
        const r = await axios.post(`${API}/ai-chat/extend/${user.id}`);
        toast.success(`+${r.data.added} messages unlock ho gaye`);
        onExtended();
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Reward add nahi hua, try again');
      }
    });
    if (!result.success && result.error) toast.error(result.error);
    setWatching(false);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4" data-testid="ai-chat-limit-modal">
      <div className="w-full max-w-sm rounded-3xl p-6 text-center relative" style={{ background: 'var(--md-surface, #fff)' }}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1 text-gray-400" data-testid="ai-chat-limit-close"><X className="w-5 h-5" /></button>
        <p className="text-lg font-bold" style={{ color: 'var(--md-on-surface, #111)' }}>Aaj ke free messages khatam</p>
        <p className="text-sm text-gray-500 mt-1">Ek chhota video dekho aur 10 messages aur bhejo, ya Premium lo unlimited chat ke liye</p>
        <button onClick={watchVideo} disabled={watching} className="mt-5 w-full py-3 rounded-2xl bg-pink-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60" data-testid="ai-chat-watch-video-btn">
          <PlayCircle className="w-5 h-5" /> {watching ? 'Loading...' : 'Watch Video (+10 msgs)'}
        </button>
        <button onClick={() => navigate('/premium')} className="mt-3 w-full py-3 rounded-2xl bg-amber-50 text-amber-700 font-bold flex items-center justify-center gap-2" data-testid="ai-chat-premium-btn">
          <Crown className="w-5 h-5" /> Premium — Unlimited
        </button>
      </div>
    </div>
  );
};

export default AiChatLimitModal;
