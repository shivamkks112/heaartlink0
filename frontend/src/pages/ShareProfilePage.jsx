import { useState } from 'react';
import { Share2, MessageCircle, Download, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const ShareProfilePage = ({ user }) => {
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);

  const shareText = `Meet ${user?.name} on HeartLink - India's #1 Safe Dating App!\n\nJoin now and find your perfect match.\n👉 https://play.google.com/store/apps/details?id=com.heartlink.app`;

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${user?.name} on HeartLink`, text: shareText });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success('Link copied!');
      } catch {}
    }
  };

  const age = user?.age || '';
  const location = user?.location || '';
  const bio = user?.bio || '';
  const initial = (user?.name || 'H')[0].toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Share Profile</h1>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
        {/* Share Card Preview */}
        <div className="bg-gradient-to-br from-rose-500 via-pink-500 to-orange-400 rounded-3xl p-6 text-white shadow-xl" data-testid="share-card">
          <div className="text-center">
            {/* Profile Picture or Initial */}
            <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white/30 overflow-hidden bg-white/20 flex items-center justify-center">
              {user?.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  style={{ filter: 'blur(8px)' }}
                />
              ) : (
                <span className="text-3xl font-bold text-white/80">{initial}</span>
              )}
            </div>

            <h2 className="text-2xl font-bold">{user?.name}, {age}</h2>
            <p className="text-white/80 text-sm mt-1">{location}</p>

            {bio && (
              <p className="text-white/90 text-sm mt-3 italic">"{bio.substring(0, 60)}{bio.length > 60 ? '...' : ''}"</p>
            )}

            <div className="mt-5 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-3">
              <p className="text-sm font-medium">Match with me on</p>
              <p className="text-xl font-bold mt-1">HeartLink</p>
              <p className="text-xs text-white/70 mt-1">India's #1 Safe Dating App</p>
            </div>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="space-y-3">
          <Button
            onClick={shareWhatsApp}
            data-testid="share-whatsapp-btn"
            className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Share on WhatsApp
          </Button>

          <Button
            onClick={shareNative}
            data-testid="share-other-btn"
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            <Share2 className="w-5 h-5" />
            Share via Other Apps
          </Button>
        </div>

        {/* Why Share */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-2">Why Share?</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-pink-500 mt-0.5">1.</span>
              Dosto ko bhi matches milenge
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-500 mt-0.5">2.</span>
              Zyada users = Better matches for you
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-500 mt-0.5">3.</span>
              Referral code se FREE Superlikes earn karo
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ShareProfilePage;
