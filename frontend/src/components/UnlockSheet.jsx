import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PlayCircle, Crown, X, Check } from 'lucide-react';
import adsService from '@/services/AdsService';
import { API } from '@/config/api';

export const openUnlock = (feature = '') => window.dispatchEvent(new CustomEvent('hl-unlock', { detail: feature }));

const ADS_NEEDED = 3;

export const UnlockSheet = ({ user }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [watched, setWatched] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('hl-unlock', h);
    return () => window.removeEventListener('hl-unlock', h);
  }, []);

  if (!open || !user) return null;
  const close = () => setOpen(false);

  const watchAd = async () => {
    if (!adsService.isNative()) { toast.info('Video ads sirf HeartLink Android app mein chalte hain'); return; }
    setBusy(true);
    try {
      const res = await adsService.showRewardedForSwipes(null);
      if (!res.success) { toast.error('Ad abhi available nahi, thodi der baad try karein'); return; }
      const { data } = await axios.post(`${API}/ads/reward`, { user_id: user.id, reward_type: 'premium_pass', amount: 1, timestamp: new Date().toISOString() });
      setWatched(data.ads_watched);
      if (data.pass_until) {
        const u = { ...JSON.parse(localStorage.getItem('user') || '{}'), is_premium: true, pass_active: true, premium_pass_until: data.pass_until };
        localStorage.setItem('user', JSON.stringify(u));
        toast.success('30 min ka Full Access Pass active!');
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Try again');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={close} data-testid="unlock-sheet">
      <div className="w-full max-w-md rounded-t-3xl bg-gray-900 border-t border-white/10 p-6 pb-8 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">Ye feature unlock karein</h3>
            <p className="text-sm text-gray-400 mt-1">Apni pasand ka tareeka chuniye</p>
          </div>
          <button onClick={close} className="p-2 rounded-full bg-white/10" data-testid="unlock-sheet-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="font-semibold">Free: {ADS_NEEDED} short videos = 30 min Full Access</p>
          <div className="flex gap-2 mt-3" data-testid="unlock-progress">
            {Array.from({ length: ADS_NEEDED }).map((_, i) => (
              <div key={i} className={`flex-1 h-2 rounded-full ${i < watched ? 'bg-emerald-400' : 'bg-white/15'}`} />
            ))}
          </div>
          <button onClick={watchAd} disabled={busy} data-testid="unlock-watch-ad-btn"
            className="mt-4 w-full py-3 rounded-full font-semibold bg-emerald-500 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
            {watched >= ADS_NEEDED ? <Check className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
            {busy ? 'Ad load ho raha hai...' : `Video dekho (${watched}/${ADS_NEEDED})`}
          </button>
        </div>

        <button onClick={() => { close(); navigate('/premium'); }} data-testid="unlock-premium-btn"
          className="mt-3 w-full py-3 rounded-full text-sm font-semibold text-amber-300 border border-amber-400/30 flex items-center justify-center gap-2">
          <Crown className="w-4 h-4" /> Hamesha ke liye unlock: Premium plans
        </button>
      </div>
    </div>
  );
};
