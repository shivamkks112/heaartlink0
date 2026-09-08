import { useState, useRef } from 'react';
import { Share2, MessageCircle, Download, ArrowLeft, Instagram, Sparkles, Heart, Shield, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { toPng } from 'html-to-image';

const CARD_STYLES = [
  { id: 'fire', bg: 'from-rose-500 via-pink-600 to-purple-700', accent: 'rgba(255,255,255,0.15)', name: 'Fire' },
  { id: 'ocean', bg: 'from-cyan-500 via-blue-600 to-indigo-700', accent: 'rgba(255,255,255,0.12)', name: 'Ocean' },
  { id: 'sunset', bg: 'from-orange-400 via-rose-500 to-purple-600', accent: 'rgba(255,255,255,0.15)', name: 'Sunset' },
  { id: 'midnight', bg: 'from-gray-900 via-purple-900 to-gray-900', accent: 'rgba(255,255,255,0.08)', name: 'Dark' },
  { id: 'nature', bg: 'from-emerald-500 via-teal-600 to-cyan-700', accent: 'rgba(255,255,255,0.12)', name: 'Nature' },
];

const ShareProfilePage = ({ user }) => {
  const navigate = useNavigate();
  const [activeStyle, setActiveStyle] = useState(0);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef(null);

  const style = CARD_STYLES[activeStyle];
  const age = user?.age || '';
  const location = user?.location || '';
  const bio = user?.bio || '';
  const initial = (user?.name || 'H')[0].toUpperCase();
  const interests = user?.interests?.slice(0, 4) || [];

  const shareText = `${user?.name} is on HeartLink - India's Safest Dating App!\n\nJoin now\nhttps://play.google.com/store/apps/details?id=com.heartlink.app`;

  const downloadCard = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#000',
      });
      
      // Try native share with image (Capacitor)
      if (navigator.share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'heartlink-profile.png', { type: 'image/png' });
        try {
          await navigator.share({ files: [file], title: 'HeartLink Profile', text: shareText });
          toast.success('Shared!');
          setSaving(false);
          return;
        } catch {}
      }
      
      // Fallback: download
      const link = document.createElement('a');
      link.download = `heartlink-${user?.name?.toLowerCase().replace(/\s/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Card saved! Share it on Instagram Stories');
    } catch (e) {
      toast.error('Failed to save card');
    }
    setSaving(false);
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareInstagram = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 0.95, pixelRatio: 3, backgroundColor: '#000' });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'heartlink-profile.png', { type: 'image/png' });
      
      if (navigator.share) {
        await navigator.share({ files: [file], title: 'HeartLink Profile' });
      } else {
        const link = document.createElement('a');
        link.download = `heartlink-${user?.name?.toLowerCase().replace(/\s/g, '-')}.png`;
        link.href = dataUrl;
        link.click();
        toast.success('Card saved! Open Instagram → Story → Add from gallery');
      }
    } catch {
      toast.error('Save failed');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-white hover:bg-white/10" data-testid="share-back-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-white">Share Profile</h1>
        <button onClick={downloadCard} disabled={saving} className="p-2 rounded-xl text-white hover:bg-white/10" data-testid="share-download-btn">
          <Download className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-sm mx-auto px-4 py-4 space-y-5">
        {/* Instagram Story Card (9:16 ratio) */}
        <div
          ref={cardRef}
          className={`relative bg-gradient-to-br ${style.bg} rounded-3xl overflow-hidden shadow-2xl`}
          style={{ aspectRatio: '9/16', maxHeight: '520px' }}
          data-testid="share-card"
        >
          {/* Background pattern */}
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, ${style.accent} 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${style.accent} 0%, transparent 50%)`,
          }} />
          
          {/* Floating hearts decoration */}
          <div className="absolute top-6 right-6 opacity-20">
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <div className="absolute bottom-24 left-6 opacity-15">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <div className="absolute top-1/3 right-8 opacity-10">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-center px-6 py-8">
            {/* HeartLink branding top */}
            <div className="absolute top-5 left-0 right-0 flex justify-center">
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <Heart className="w-3.5 h-3.5 text-white fill-white" />
                <span className="text-xs font-bold text-white tracking-wide">HEARTLINK</span>
              </div>
            </div>

            {/* Profile Photo */}
            <div className="w-28 h-28 rounded-full border-4 border-white/40 overflow-hidden bg-white/20 flex items-center justify-center shadow-lg mb-4">
              {user?.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-white/80">{initial}</span>
              )}
            </div>

            {/* Name & Age */}
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {user?.name}{age ? `, ${age}` : ''}
            </h2>

            {/* Location */}
            {location && (
              <div className="flex items-center gap-1 mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-white/70" />
                <span className="text-sm text-white/80">{location}</span>
              </div>
            )}

            {/* Bio */}
            {bio && (
              <p className="text-white/85 text-sm mt-3 text-center italic leading-relaxed max-w-[220px]">
                "{bio.substring(0, 80)}{bio.length > 80 ? '...' : ''}"
              </p>
            )}

            {/* Interests */}
            {interests.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                {interests.map((i, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium text-white">
                    {i}
                  </span>
                ))}
              </div>
            )}

            {/* Safety badge */}
            <div className="flex items-center gap-1.5 mt-5">
              <Shield className="w-3.5 h-3.5 text-white/70" />
              <span className="text-[11px] text-white/60 font-medium">Verified & Safe Profile</span>
            </div>

            {/* CTA at bottom */}
            <div className="absolute bottom-5 left-0 right-0 text-center">
              <div className="bg-white/20 backdrop-blur-sm mx-6 rounded-2xl py-3 px-4">
                <p className="text-white text-sm font-bold">Find me on HeartLink</p>
                <p className="text-white/60 text-[10px] mt-0.5">India's Safest Dating App</p>
              </div>
            </div>
          </div>
        </div>

        {/* Style Switcher */}
        <div className="flex justify-center gap-2" data-testid="style-switcher">
          {CARD_STYLES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveStyle(i)}
              className={`w-9 h-9 rounded-full bg-gradient-to-br ${s.bg} border-2 transition-all ${
                activeStyle === i ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'
              }`}
              data-testid={`style-${s.id}`}
            />
          ))}
        </div>

        {/* Share Buttons */}
        <div className="space-y-2.5">
          <Button
            onClick={shareInstagram}
            disabled={saving}
            data-testid="share-instagram-btn"
            className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            <Instagram className="w-5 h-5" />
            Share on Instagram Story
          </Button>

          <Button
            onClick={shareWhatsApp}
            data-testid="share-whatsapp-btn"
            className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Share on WhatsApp
          </Button>

          <Button
            onClick={downloadCard}
            disabled={saving}
            data-testid="share-save-btn"
            className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 border border-white/20"
          >
            <Download className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Card & Share Anywhere'}
          </Button>
        </div>

        {/* Tip */}
        <p className="text-center text-white/40 text-xs pb-4">
          Card save karke Instagram Story, Snapchat ya kahi bhi share karo
        </p>
      </div>
    </div>
  );
};

export default ShareProfilePage;
