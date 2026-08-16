import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, X, MapPin, Play, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import adsService, { SWIPES_BEFORE_AD, EXTRA_SWIPES_REWARD } from '@/services/AdsService';
import wsService from '@/services/WebSocketService';
import { VerifiedBadge, OnlineStatus } from '@/components/badges/VerifiedBadge';
import MatchAnimation from '@/components/MatchAnimation';

import { BACKEND_URL, API } from '@/config/api';
import { cacheDiscoverProfiles, getCachedDiscoverProfiles } from '@/utils/cacheManager';
if (!BACKEND_URL) {
  console.error('REACT_APP_BACKEND_URL is not set!');
}

const DiscoverPage = ({ user }) => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [showOutOfSwipes, setShowOutOfSwipes] = useState(false);
  const [dailySwipeCount, setDailySwipeCount] = useState(0);
  const [extraSwipes, setExtraSwipes] = useState(0);
  const [swipesUntilAd, setSwipesUntilAd] = useState(SWIPES_BEFORE_AD);
  const [showingAd, setShowingAd] = useState(false);

  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const [matchedUserData, setMatchedUserData] = useState(null);
  const [matchCompatibilityScore, setMatchCompatibilityScore] = useState(null);

  const DAILY_SWIPE_LIMIT = 50;
  const shouldShowAds = user?.gender === 'male' && !user?.is_premium && !user?.isPremium;
  const minSwipeDistance = 50;

  const fetchProfiles = async () => {
    try {
      // Show cached profiles instantly while fetching fresh
      const cached = getCachedDiscoverProfiles(user.id);
      if (cached && cached.length > 0) {
        setProfiles(cached);
        setLoading(false);
      }
      const response = await axios.get(`${API}/discover/${user.id}`);
      setProfiles(response.data);
      cacheDiscoverProfiles(user.id, response.data);
      setLoading(false);
    } catch (error) {
      const cached = getCachedDiscoverProfiles(user.id);
      if (cached && cached.length > 0) {
        setProfiles(cached);
        toast.info('Showing cached profiles (offline)');
      } else {
        toast.error('Failed to load profiles');
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    if (shouldShowAds) adsService.initialize();

    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('heartlink_swipe_date');
    if (storedDate !== today) {
      localStorage.setItem('heartlink_swipe_date', today);
      localStorage.setItem('heartlink_swipe_count', '0');
      setDailySwipeCount(0);
    } else {
      setDailySwipeCount(parseInt(localStorage.getItem('heartlink_swipe_count') || '0'));
    }
    setExtraSwipes(parseInt(localStorage.getItem('heartlink_extra_swipes') || '0'));

    if (user?.id) {
      wsService.connect(user.id);
      const unsub = wsService.on('status_update', (data) => {
        setProfiles(prev => prev.map(p =>
          p.id === data.user_id ? { ...p, is_online: data.is_online, last_active: data.last_active } : p
        ));
      });
      return () => unsub();
    }
  }, []);

  const handleAction = async (action) => {
    if (profiles.length === 0) return;

    // Handle crush separately
    if (action === 'crush') {
      try {
        const res = await axios.post(`${API}/crush/${user.id}?target_user_id=${profiles[currentIndex].id}`);
        if (res.data.mutual) {
          toast.success('Mutual Crush! Tum dono ne ek dusre ko crush kiya!');
        } else {
          toast.success('Secret Crush sent! Unhe pata chalega kisi ne crush kiya hai.');
        }
      } catch (err) {
        if (err.response?.status === 400) {
          toast.info('Already crushed!');
        } else {
          toast.error('Crush failed');
        }
      }
      return;
    }

    if (!user?.is_premium && !user?.isPremium && (action === 'like' || action === 'pass')) {
      const currentExtra = parseInt(localStorage.getItem('heartlink_extra_swipes') || '0');
      if (dailySwipeCount >= DAILY_SWIPE_LIMIT && currentExtra <= 0) {
        setShowOutOfSwipes(true);
        return;
      }
      if (dailySwipeCount >= DAILY_SWIPE_LIMIT && currentExtra > 0) {
        const newExtra = currentExtra - 1;
        localStorage.setItem('heartlink_extra_swipes', String(newExtra));
        setExtraSwipes(newExtra);
        toast.info(`Extra swipe used! ${newExtra} remaining`);
      } else {
        const newCount = dailySwipeCount + 1;
        localStorage.setItem('heartlink_swipe_count', String(newCount));
        setDailySwipeCount(newCount);
        if (newCount === DAILY_SWIPE_LIMIT - 5) toast.warning('Sirf 5 swipes bache hain!');
      }
      if (shouldShowAds) {
        const adShown = await adsService.trackSwipe();
        setSwipesUntilAd(adsService.getSwipesUntilAd());
        if (adShown) { setShowingAd(true); setTimeout(() => setShowingAd(false), 500); }
      }
    }

    try {
      const response = await axios.post(`${API}/action/${user.id}`, {
        target_user_id: profiles[currentIndex].id,
        action
      });
      if (response.data.action === 'matched') {
        setMatchedUserData(profiles[currentIndex]);
        setMatchCompatibilityScore(response.data.compatibility_score);
        setShowMatchAnimation(true);
      } else if (action === 'superlike') {
        toast.success('Super Like sent!');
      }
      if (currentIndex < profiles.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setPhotoIndex(0);
      } else {
        setCurrentIndex(0);
        setPhotoIndex(0);
        fetchProfiles();
      }
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleMatchAnimationClose = () => { setShowMatchAnimation(false); setMatchedUserData(null); setMatchCompatibilityScore(null); };
  const handleStartChatFromMatch = () => { setShowMatchAnimation(false); if (matchedUserData) navigate('/matches'); };

  const handleWatchAdForSwipes = async () => {
    setShowingAd(true);
    const result = await adsService.showRewardedForSwipes((reward) => {
      if (reward.success) {
        const cur = parseInt(localStorage.getItem('heartlink_extra_swipes') || '0');
        const nv = cur + reward.swipes;
        localStorage.setItem('heartlink_extra_swipes', String(nv));
        setExtraSwipes(nv);
        toast.success(`+${reward.swipes} Extra Swipes Added!`);
        setShowOutOfSwipes(false);
      }
    });
    setShowingAd(false);
    if (!result.success && result.error) toast.error(result.error);
    return result;
  };

  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
    const d = touchStart - e.targetTouches[0].clientX;
    if (Math.abs(d) > 20) setSwipeDirection(d > 0 ? 'left' : 'right');
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const d = touchStart - touchEnd;
    if (d > minSwipeDistance) handleAction('pass');
    else if (d < -minSwipeDistance) handleAction('like');
    setSwipeDirection(null); setTouchStart(null); setTouchEnd(null);
  };

  const [imgError, setImgError] = useState(false);

  // Reset img error when profile changes
  useEffect(() => { setImgError(false); }, [currentIndex, photoIndex]);

  const currentProfile = profiles[currentIndex];
  const photos = currentProfile?.photos || [];
  const allPhotos = currentProfile?.profile_picture
    ? [currentProfile.profile_picture, ...photos.filter(p => p !== currentProfile.profile_picture)]
    : photos;
  const hasMultiplePhotos = allPhotos.length > 1;

  // Shared wrapper elements for all states
  const shellTop = (
    <>
      <Toaster position="top-center" />
      <Navbar user={user} />
      <MatchAnimation isOpen={showMatchAnimation} onClose={handleMatchAnimationClose} currentUser={user} matchedUser={matchedUserData} compatibilityScore={matchCompatibilityScore?.toFixed(0)} onStartChat={handleStartChatFromMatch} />
    </>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col overflow-hidden">
        {shellTop}
        <div className="discover-card-area flex items-center justify-center p-2">
          <div className="w-full h-full max-w-md rounded-xl overflow-hidden bg-gray-800/60 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col overflow-hidden">
        {shellTop}
        <div className="discover-card-area flex items-center justify-center px-8">
          <div className="text-center m3-animate-in" data-testid="no-profiles">
            <div className="w-24 h-24 mx-auto mb-6 rounded-[28px] flex items-center justify-center" style={{ background: 'var(--m3-surface-container-high)' }}>
              <Heart className="w-10 h-10" style={{ color: 'var(--m3-outline)' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No More Profiles</h2>
            <p className="text-gray-400 text-sm mb-2">Everyone nearby has been shown</p>
            <p className="text-gray-500 text-xs mb-8">Try expanding your distance or check back later</p>
            <div className="flex flex-col gap-3 items-center">
              <Button
                onClick={() => { setLoading(true); fetchProfiles(); }}
                className="text-white px-10 py-3 rounded-full text-base font-semibold active:scale-[0.97] transition-all"
                style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)', boxShadow: '0 4px 16px rgba(214,51,108,0.35)' }}
                data-testid="refresh-profiles-btn"
              >
                Refresh Profiles
              </Button>
              <Button
                onClick={() => navigate('/matches')}
                className="text-gray-300 px-8 py-2.5 rounded-full text-sm font-medium border border-gray-700 hover:bg-gray-800/50 transition-all"
                data-testid="view-matches-btn"
              >
                View Matches
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col overflow-hidden">
      {shellTop}
      {/* Card area — dynamically sized between top edge and navbar+gap */}
      <div className="discover-card-area p-1.5 pb-0">
        <div
          className={`relative w-full h-full max-w-md mx-auto rounded-xl overflow-hidden transition-transform duration-200 ease-out ${
            swipeDirection === 'left' ? '-translate-x-6 -rotate-3 opacity-70' :
            swipeDirection === 'right' ? 'translate-x-6 rotate-3 opacity-70' : ''
          }`}
          data-testid="profile-card"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Photo fills entire card */}
          <div className="absolute inset-0 bg-gray-900">
            {(allPhotos[photoIndex] || currentProfile.profile_picture) && !imgError ? (
              <img
                src={allPhotos[photoIndex] || currentProfile.profile_picture}
                alt={currentProfile.name}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
                draggable={false}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-500/80 to-rose-600/80">
                <span className="text-8xl font-bold text-white/30">{currentProfile.name?.charAt(0)}</span>
              </div>
            )}
          </div>

          {/* Top gradient */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent z-[3]" />

          {/* Photo indicators */}
          {hasMultiplePhotos && (
            <div className="absolute top-2 left-3 right-3 flex gap-1 z-10">
              {allPhotos.map((_, i) => (
                <div key={i} className={`h-[3px] flex-1 rounded-full transition-colors ${i === photoIndex ? 'bg-white' : 'bg-white/30'}`} />
              ))}
            </div>
          )}

          {/* Photo tap zones */}
          {hasMultiplePhotos && (
            <>
              <button className="absolute left-0 top-0 w-1/3 h-[60%] z-[5]" onClick={() => setPhotoIndex(Math.max(0, photoIndex - 1))} aria-label="Previous photo" />
              <button className="absolute right-0 top-0 w-1/3 h-[60%] z-[5]" onClick={() => setPhotoIndex(Math.min(allPhotos.length - 1, photoIndex + 1))} aria-label="Next photo" />
            </>
          )}

          {/* Swipe counter */}
          {!user?.is_premium && !user?.isPremium && (
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[11px] px-2.5 py-1 rounded-full z-10 font-medium" data-testid="swipe-counter">
              {Math.max(0, DAILY_SWIPE_LIMIT - dailySwipeCount)}{extraSwipes > 0 && <span className="text-emerald-400"> +{extraSwipes}</span>}
            </div>
          )}

          {/* Verified badge */}
          {currentProfile.verified && (
            <div className="absolute top-3 left-3 z-10"><VerifiedBadge size="md" showText={false} /></div>
          )}

          {/* Swipe labels */}
          {swipeDirection === 'left' && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <span className="border-4 border-red-500 text-red-500 text-4xl font-black px-8 py-3 rounded-xl rotate-[-20deg] tracking-wider">NOPE</span>
            </div>
          )}
          {swipeDirection === 'right' && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <span className="border-4 border-emerald-400 text-emerald-400 text-4xl font-black px-8 py-3 rounded-xl rotate-[20deg] tracking-wider">LIKE</span>
            </div>
          )}

          {/* Bottom gradient */}
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/95 via-black/60 to-transparent z-[6]" />

          {/* ─── Bottom content: info + action buttons ─── */}
          {/* This uses a flex column pinned to the card bottom.
              Action buttons are flex children at the end,
              NOT positioned with absolute bottom-Xpx */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col">
            {/* Profile info */}
            <div className="px-5">
              <div className="flex items-center gap-2">
                <h2 className="text-[28px] font-bold text-white leading-none tracking-tight">{currentProfile.name}</h2>
                <span className="text-[22px] text-white/70 font-light">{currentProfile.age}</span>
                <OnlineStatus isOnline={currentProfile.is_online} lastActive={currentProfile.last_active} size="sm" showText={false} />
              </div>
              {currentProfile.location && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-white/60 text-sm">{currentProfile.location}</span>
                </div>
              )}
              {currentProfile.bio && (
                <p className="text-white/70 text-sm mt-2 line-clamp-2 leading-relaxed">{currentProfile.bio}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {currentProfile.shared_interests_count > 0 && (
                  <span className="bg-pink-500/25 backdrop-blur-md text-pink-200 text-[12px] font-bold px-3 py-1 rounded-lg border border-pink-400/30" data-testid="shared-interests-badge">
                    {currentProfile.shared_interests_count} Shared Interest{currentProfile.shared_interests_count > 1 ? 's' : ''}
                  </span>
                )}
                {currentProfile.relationship_intent && (
                  <span className="bg-white/15 backdrop-blur-md text-white text-[12px] font-medium px-3 py-1 rounded-lg border border-white/20">
                    {currentProfile.relationship_intent === 'serious' ? 'Serious' : currentProfile.relationship_intent === 'marriage' ? 'Marriage' : currentProfile.relationship_intent === 'casual' ? 'Casual' : 'Friends'}
                  </span>
                )}
                {currentProfile.interests?.slice(0, 3).map((tag, i) => (
                  <span key={i} className="bg-white/12 backdrop-blur-md text-white/90 text-[12px] font-medium px-3 py-1 rounded-lg border border-white/15">{tag}</span>
                ))}
              </div>
            </div>

            {/* Action buttons — flow naturally after info, with dynamic padding */}
            <div
              className="flex justify-center items-center gap-5 z-20"
              style={{
                paddingTop: 'clamp(12px, 2.5vh, 24px)',
                paddingBottom: 'var(--action-offset, 16px)',
              }}
              data-testid="action-buttons"
            >
              <button
                data-testid="pass-btn"
                onClick={() => handleAction('pass')}
                className="rounded-full flex items-center justify-center active:scale-90 transition-all duration-200"
                style={{
                  width: 'var(--btn-md, 52px)', height: 'var(--btn-md, 52px)',
                  background: 'rgba(255,255,255,0.95)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.2)',
                }}
              >
                <X className="w-6 h-6 text-[#D6336C]" strokeWidth={2.8} />
              </button>
              <button
                data-testid="crush-btn"
                onClick={() => handleAction('crush')}
                className="rounded-full flex items-center justify-center active:scale-90 transition-all duration-200"
                style={{
                  width: 'var(--btn-sm, 44px)', height: 'var(--btn-sm, 44px)',
                  background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.4), 0 0 0 1px rgba(255,255,255,0.15)',
                }}
                title="Secret Crush"
              >
                <Heart className="w-5 h-5 text-white" strokeWidth={2.5} />
              </button>
              <button
                data-testid="superlike-btn"
                onClick={() => handleAction('superlike')}
                className="rounded-full flex items-center justify-center active:scale-90 transition-all duration-200"
                style={{
                  width: 'var(--btn-sm, 44px)', height: 'var(--btn-sm, 44px)',
                  background: 'rgba(255,255,255,0.95)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.2)',
                }}
              >
                <Star className="w-5 h-5 text-[#3B82F6]" fill="currentColor" />
              </button>
              <button
                data-testid="like-btn"
                onClick={() => handleAction('like')}
                className="rounded-full flex items-center justify-center active:scale-90 transition-all duration-200"
                style={{
                  width: 'var(--btn-lg, 60px)', height: 'var(--btn-lg, 60px)',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  boxShadow: '0 4px 20px rgba(16,185,129,0.4), 0 0 0 2px rgba(255,255,255,0.15)',
                }}
              >
                <Heart className="w-7 h-7 text-white" fill="white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Out of Swipes Modal */}
      {showOutOfSwipes && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowOutOfSwipes(false)} />
          <div className="relative bg-gray-900 rounded-3xl max-w-sm w-full overflow-hidden border border-white/10">
            <button onClick={() => setShowOutOfSwipes(false)} className="absolute top-3 right-3 p-2 hover:bg-white/10 rounded-full z-10"><X className="w-5 h-5 text-gray-400" /></button>
            <div className="bg-gradient-to-br from-pink-500 to-rose-600 px-6 py-8 text-center text-white">
              <Heart className="w-12 h-12 mx-auto mb-3" />
              <h2 className="text-xl font-bold">Swipes Khatam!</h2>
              <p className="text-white/80 text-sm mt-1.5">Kal naye swipes milenge</p>
            </div>
            <div className="p-5">
              {shouldShowAds && (
                <button onClick={handleWatchAdForSwipes} disabled={showingAd} className="w-full bg-emerald-500 text-white p-3.5 rounded-2xl flex items-center justify-center gap-2 font-semibold active:scale-[0.98] transition-transform" data-testid="watch-ad-swipes-btn">
                  <Play className="w-5 h-5" /> Watch Ad for +{EXTRA_SWIPES_REWARD} Swipes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;
