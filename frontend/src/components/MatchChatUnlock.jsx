import React, { useState } from 'react';
import { Play, Crown, X } from 'lucide-react';
import adsService from '@/services/AdsService';
import { toast } from 'sonner';

const KEY = 'heartlink_chat_unlocks';
const NEEDED = 2;
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

export const isChatUnlocked = (matchId) => (read()[matchId] || 0) >= NEEDED;

// Friendly bottom sheet: watch 2 short videos or go Premium to start chatting with a new match.
export const MatchChatUnlock = ({ match, onUnlocked, onClose, onPremium }) => {
  const [watched, setWatched] = useState(read()[match?.matchId] || 0);
  const [busy, setBusy] = useState(false);
  if (!match) return null;
  const name = match.user?.name?.split(' ')[0] || 'them';
  const photo = match.user?.profile_picture || (match.user?.photos || []).find(Boolean);

  const watch = async () => {
    setBusy(true);
    const res = await adsService.showRewardedForSwipes();
    setBusy(false);
    if (!res.success) { toast.error(res.error === 'Ad closed early' ? 'Video poora dekhna hoga' : 'Video abhi ready nahi, thodi der mein try karo'); return; }
    const next = watched + 1;
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [match.matchId]: next }));
    setWatched(next);
    if (next >= NEEDED) onUnlocked();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/50" onClick={onClose} data-testid="chat-unlock-sheet">
      <div className="w-full rounded-t-3xl bg-white dark:bg-gray-900 p-6 pb-8" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="float-right p-1 text-gray-400" data-testid="chat-unlock-close"><X className="w-5 h-5" /></button>
        <div className="flex flex-col items-center text-center">
          {photo && <img src={photo} alt="" className="w-20 h-20 rounded-full object-cover mb-3" />}
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{name} se baat shuru karo</h3>
          <p className="text-sm text-gray-500 mt-1">2 chhote videos dekho, chat hamesha ke liye khul jayegi</p>
          <div className="flex gap-2 my-4" data-testid="chat-unlock-progress">
            {[0, 1].map(i => <span key={i} className={`h-2 w-10 rounded-full ${i < watched ? 'bg-pink-500' : 'bg-gray-200'}`} />)}
          </div>
          <button onClick={watch} disabled={busy} className="w-full py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60" data-testid="chat-unlock-watch-btn">
            <Play className="w-4 h-4" /> {busy ? 'Loading...' : `Video dekho (${watched}/${NEEDED})`}
          </button>
          <button onClick={onPremium} className="w-full mt-3 py-3 rounded-full border border-amber-400 text-amber-600 font-bold flex items-center justify-center gap-2" data-testid="chat-unlock-premium-btn">
            <Crown className="w-4 h-4" /> Premium se turant chat karo
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchChatUnlock;
