import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Heart, X, MapPin, Play, Star, SlidersHorizontal, Flame, Crown, Undo2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import AdFreeReward from '@/components/AdFreeReward';
import adsService, { SWIPES_BEFORE_AD, EXTRA_SWIPES_REWARD } from '@/services/AdsService';
import wsService from '@/services/WebSocketService';
import { VerifiedBadge, OnlineStatus } from '@/components/badges/VerifiedBadge';
import MatchAnimation from '@/components/MatchAnimation';
import PremiumBottomSheet from '@/components/PremiumBottomSheet';
import OptimizedImage from '@/components/OptimizedImage';
import { haptic } from '@/utils/haptics';

const SafetyScoreBadge = ({ profile }) => {
  let score = 0;
  let factors = [];

  if (profile.verified) { score += 35; factors.push('Verified'); }
  if (profile.selfie_verification_status === 'verified') { score += 30; factors.push('Selfie Verified'); }
  if (profile.trust_badge_level === 'high') { score += 20; factors.push('High Trust'); }
  else if (profile.trust_badge_level === 'medium') { score += 10; }
  if (profile.profile_prompts?.length > 0) { score += 10; factors.push('Prompts'); }
  if (profile.bio && profile.bio.length > 20) { score += 5; }

  score = Math.min(score, 100);

  if (score < 20) return null;

  const color = score >= 70 ? 'from-green-500/30 to-emerald-500/30 border-green-400/40 text-green-300'
    : score >= 40 ? 'from-yellow-500/30 to-amber-500/30 border-yellow-400/40 text-yellow-300'
    : 'from-gray-500/20 to-gray-500/20 border-gray-400/30 text-gray-400';

  const label = score >= 70 ? 'High Safety' : score >= 40 ? 'Moderate' : 'Basic';
  const icon = score >= 70 ? '🛡' : score >= 40 ? '🔰' : '';

  return (
    <div className={`inline-flex items-center gap-1 bg-gradient-to-r ${color} backdrop-blur-md px-2 py-0.5 rounded-full border text-[10px] font-semibold mt-1`} data-testid="safety-score-badge">
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      {factors.length > 0 && <span className="opacity-60">· {factors[0]}</span>}
    </div>
  );
};

import { BACKEND_URL, API } from '@/config/api';
import { cacheDiscoverProfiles, getCachedDiscoverProfiles } from '@/utils/cacheManager';
import { getPageData, setPageData } from '@/utils/pageCache';
import { POPULAR_CITIES } from '@/data/indianCities';
if (!BACKEND_URL) {
  console.error('REACT_APP_BACKEND_URL is not set!');
}

const DiscoverPage = ({ user }) => {
  const navigate = useNavigate();
  const _cached = getCachedDiscoverProfiles(user?.id) || getPageData('discover', user?.id);
  const [profiles, setProfiles] = useState(_cached || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(!_cached || _cached.length === 0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [touchStart] = useState(null); // kept for compatibility
  const [touchEnd] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(null);
  // Drag state for swipe physics
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const isDraggingCard = useRef(false);
  const [showOutOfSwipes, setShowOutOfSwipes] = useState(false);
  const [dailySwipeCount, setDailySwipeCount] = useState(0);
  const [extraSwipes, setExtraSwipes] = useState(0);
  const [swipesUntilAd, setSwipesUntilAd] = useState(SWIPES_BEFORE_AD);
  const [showingAd, setShowingAd] = useState(false);
  // Undo swipe state
  const [lastSwipedProfile, setLastSwipedProfile] = useState(null);
  const [lastSwipeAction, setLastSwipeAction] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const [matchedUserData, setMatchedUserData] = useState(null);
  const [matchCompatibilityScore, setMatchCompatibilityScore] = useState(null);
  const [matchIdForChat, setMatchIdForChat] = useState(null);
  const [crushEnabled, setCrushEnabled] = useState(false);
  const [pendingLikes, setPendingLikes] = useState(0);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);
  const actionInFlight = useRef(false);

  const isPremiumUser = user?.is_premium || user?.isPremium || user?.gender?.toLowerCase() === 'female';
  const swipeAnimation = useRef(null);

  const DAILY_SWIPE_LIMIT = 50;
  const shouldShowAds = user?.gender?.toLowerCase() === 'male' && !user?.is_premium && !user?.isPremium;
  const minSwipeDistance = 50;

  const fetchProfiles = async () => {
    try {
      const cached = getCachedDiscoverProfiles(user.id);
      if (cached && cached.length > 0) {
        setProfiles(cached);
        setLoading(false);
      }
      const response = await axios.get(`${API}/discover/${user.id}${cityFilter ? `?city=${encodeURIComponent(cityFilter)}` : ''}`);
      setProfiles(response.data);
      cacheDiscoverProfiles(user.id, response.data);
      setPageData('discover', response.data, user.id);
      setLoading(false);
      
      // Preload first 5 profile images for instant display
      (response.data || []).slice(0, 5).forEach(p => {
        const imgUrl = p.profile_picture || p.photos?.[0];
        if (imgUrl) { const img = new Image(); img.src = imgUrl; }
      });
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

  const updateGPSLocation = async () => {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      // Request permission first
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'denied') return;
      
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
      await axios.post(`${API}/user/${user.id}/update-location`, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        location: user.location || ''
      });
    } catch (e) {
      // Fallback to browser API for web
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              await axios.post(`${API}/user/${user.id}/update-location`, {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                location: user.location || ''
              });
            } catch (_) {}
          },
          () => {},
          { enableHighAccuracy: false, timeout: 5000 }
        );
      }
    }
  };

  // NO banner ads on Discover — user experience is priority
  // Ads strategy: interstitial after 6 swipes (natural break), rewarded (user-initiated only)

  useEffect(() => {
    fetchProfiles();
  }, [cityFilter]); // eslint-disable-line

  // Fetch feature flags once on mount
  useEffect(() => {
    axios.get(`${API}/admin/feature-flags`).then(res => {
      setCrushEnabled(!!res.data?.crush_feature);
    }).catch(() => {});
    
    // Fetch pending likes count for smart nudge (non-premium only)
    if (!isPremiumUser && user?.id) {
      axios.get(`${API}/init/${user.id}`).then(res => {
        setPendingLikes(res.data?.likes_count || 0);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    updateGPSLocation();
    if (shouldShowAds) {
      adsService.initialize();
      // Banner will be shown/hidden based on profile availability (see below)
    }

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
      const unsub1 = wsService.on('status_update', (data) => {
        setProfiles(prev => prev.map(p =>
          p.id === data.user_id ? { ...p, is_online: data.is_online, last_active: data.last_active } : p
        ));
      });
      const unsub2 = wsService.on('new_match', (data) => {
        if (data.user && data.match_id) {
          setMatchedUserData(data.user);
          setMatchIdForChat(data.match_id);
          setShowMatchAnimation(true);
        }
      });
      return () => {
        unsub1();
        unsub2();
      };
    }

    return () => {};
  }, []); // eslint-disable-line

  const advanceCard = useCallback(() => {
    setSwipeDirection(null); // Reset tilt immediately
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex(i => i + 1);
      setPhotoIndex(0);
      setImgError(false);
      // Preload next 2 profile images for instant display
      for (let offset = 2; offset <= 3; offset++) {
        const nextIdx = currentIndex + offset;
        if (nextIdx < profiles.length) {
          const nextImg = profiles[nextIdx].profile_picture || profiles[nextIdx].photos?.[0];
          if (nextImg) { const img = new Image(); img.src = nextImg; }
        }
      }
    } else {
      setCurrentIndex(0);
      setPhotoIndex(0);
      setImgError(false);
      fetchProfiles();
    }
  }, [currentIndex, profiles.length]); // eslint-disable-line

  const handleAction = async (action) => {
    if (profiles.length === 0 || actionInFlight.current) return;

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

    // Swipe limit check FIRST (only blocking check)
    const isPremiumUser = user?.is_premium || user?.isPremium || user?.gender?.toLowerCase() === 'female';
    
    // Non-premium users cannot like — must subscribe first
    if (!isPremiumUser && action === 'like') {
      haptic.error();
      setShowPremiumSheet(true);
      return;
    }
    
    if (!isPremiumUser && action === 'superlike') {
      haptic.error();
      setShowPremiumSheet(true);
      return;
    }

    if (!isPremiumUser && (action === 'like' || action === 'pass')) {
      const currentExtra = parseInt(localStorage.getItem('heartlink_extra_swipes') || '0');
      if (dailySwipeCount >= DAILY_SWIPE_LIMIT && currentExtra <= 0) {
        setShowOutOfSwipes(true);
        return;
      }
    }

    // INSTANT: advance card immediately — native feel
    const targetProfile = profiles[currentIndex];
    const prevIndex = currentIndex;
    actionInFlight.current = true;
    
    // Save for undo (only like/pass, not superlike/crush)
    if (action === 'like' || action === 'pass') {
      setLastSwipedProfile({ profile: targetProfile, index: prevIndex, action });
      setLastSwipeAction(action);
    }
    
    advanceCard();

    // Haptic feedback for native feel
    haptic.medium();

    // ALL background work — non-blocking
    (async () => {
      // Update swipe counts in background
      if (!isPremiumUser && (action === 'like' || action === 'pass')) {
        const currentExtra = parseInt(localStorage.getItem('heartlink_extra_swipes') || '0');
        if (dailySwipeCount >= DAILY_SWIPE_LIMIT && currentExtra > 0) {
          const newExtra = currentExtra - 1;
          localStorage.setItem('heartlink_extra_swipes', String(newExtra));
          setExtraSwipes(newExtra);
          toast.info(`Extra swipe used! ${newExtra} remaining`);
        } else {
          const newCount = dailySwipeCount + 1;
          localStorage.setItem('heartlink_swipe_count', String(newCount));
          setDailySwipeCount(newCount);
          if (newCount === DAILY_SWIPE_LIMIT - 5) toast.warning('Sirf 5 swipes bache hain! Go Premium for unlimited', { action: { label: 'Premium', onClick: () => navigate('/premium') }, duration: 5000 });
        }
        // Ad tracking — fully async
        if (shouldShowAds) {
          adsService.trackSwipe().then(adShown => {
            setSwipesUntilAd(adsService.getSwipesUntilAd());
            if (adShown) { setShowingAd(true); setTimeout(() => setShowingAd(false), 500); }
          }).catch(() => {});
        }
      }

      // Fire API in background
      try {
        const response = await axios.post(`${API}/action/${user.id}`, {
          target_user_id: targetProfile.id,
          action
        });
        if (response.data.action === 'matched') {
          setMatchedUserData(targetProfile);
          setMatchIdForChat(response.data.match_id);
          setMatchCompatibilityScore(response.data.compatibility_score);
          setShowMatchAnimation(true);
        } else if (action === 'superlike') {
          toast.success('Super Like sent!');
        }
      } catch (error) {
        if (error.response?.status !== 400) {
          toast.error('Action failed, please try again');
        }
      } finally {
        actionInFlight.current = false;
      }
    })();
  };

  // ── UNDO SWIPE (Premium Only) ──
  const handleUndo = async () => {
    if (!lastSwipedProfile || undoing) return;
    const isPremiumUser = user?.is_premium || user?.isPremium || user?.gender?.toLowerCase() === 'female';
    if (!isPremiumUser) {
      toast.error('Undo is a Premium feature. Upgrade to use it!', { action: { label: 'Premium', onClick: () => navigate('/premium') } });
      return;
    }

    setUndoing(true);
    try {
      // Call backend to undo the action
      await axios.post(`${API}/action/${user.id}/undo`, {
        target_user_id: lastSwipedProfile.profile.id,
      });

      // Reinsert profile back at current position
      setProfiles(prev => {
        const updated = [...prev];
        updated.splice(currentIndex, 0, lastSwipedProfile.profile);
        return updated;
      });
      setCurrentIndex(prev => prev); // Stay at current (which now has the restored profile)
      setPhotoIndex(0);
      setLastSwipedProfile(null);
      setLastSwipeAction(null);
      try { navigator?.vibrate?.(10); } catch(e) {}
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Undo failed');
    }
    setUndoing(false);
  };


  const handleMatchAnimationClose = () => { setShowMatchAnimation(false); setMatchedUserData(null); setMatchCompatibilityScore(null); setMatchIdForChat(null); };
  const handleStartChatFromMatch = () => { setShowMatchAnimation(false); if (matchIdForChat) navigate(`/chat/${matchIdForChat}`); else if (matchedUserData) navigate('/matches'); };

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

  // ── SWIPE GESTURE PHYSICS ──
  const onCardTouchStart = (e) => {
    const touch = e.touches[0];
    dragStartX.current = touch.clientX;
    dragStartY.current = touch.clientY;
    isDraggingCard.current = false;
    setDragging(true);
  };

  const onCardTouchMove = (e) => {
    if (!dragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartX.current;
    const dy = touch.clientY - dragStartY.current;
    if (!isDraggingCard.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      isDraggingCard.current = true;
    }
    if (isDraggingCard.current) {
      e.preventDefault();
      setDragX(dx);
      setSwipeDirection(dx > 20 ? 'right' : dx < -20 ? 'left' : null);
    }
  };

  const onCardTouchEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = 80;
    if (isDraggingCard.current) {
      if (dragX > threshold) {
        setDragX(500);
        setTimeout(() => { setDragX(0); setSwipeDirection(null); handleAction('like'); }, 100);
        return;
      } else if (dragX < -threshold) {
        setDragX(-500);
        setTimeout(() => { setDragX(0); setSwipeDirection(null); handleAction('pass'); }, 100);
        return;
      }
    } else {
      // Small touch = photo navigation
      const dx = dragX;
      if (Math.abs(dx) > 30) {
        const maxPhotos = (profiles[currentIndex]?.photos?.length || 1);
        if (dx < -30) setPhotoIndex(i => Math.min(maxPhotos - 1, i + 1));
        else if (dx > 30) setPhotoIndex(i => Math.max(0, i - 1));
      }
    }
    setDragX(0);
    setSwipeDirection(null);
    isDraggingCard.current = false;
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
      <PremiumBottomSheet isOpen={showPremiumSheet} onClose={() => setShowPremiumSheet(false)} title="Like karne ke liye Premium lo!" />
    </>
  );

  if (loading) {
    return (
      <div className="h-[100%] bg-[#0a0a0a] flex flex-col" style={{ height: 'calc(100vh - var(--nav-total, 86px))', paddingTop: 'var(--safe-top, 24px)' }}>
        {shellTop}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 gap-4">
          <div className="w-full h-[75%] max-w-md rounded-3xl overflow-hidden bg-gray-800/60 animate-pulse relative">
            <div className="absolute bottom-6 left-5 right-5 space-y-2">
              <div className="h-6 w-40 bg-gray-700/60 rounded-lg" />
              <div className="h-4 w-28 bg-gray-700/40 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-gray-800/60 animate-pulse" />
            <div className="w-16 h-16 rounded-full bg-gray-800/60 animate-pulse" />
            <div className="w-14 h-14 rounded-full bg-gray-800/60 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="h-[100%] bg-[#0a0a0a] flex flex-col" style={{ height: 'calc(100vh - var(--nav-total, 86px))', paddingTop: 'var(--safe-top, 24px)' }}>
        {shellTop}
        {/* Smart Nudge on empty state */}
        {!isPremiumUser && pendingLikes > 0 && !nudgeDismissed && (
          <div
            className="mx-4 mt-2 flex items-center justify-between px-4 py-2.5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.95), rgba(239,108,0,0.95))',
              boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
            }}
            data-testid="smart-nudge-banner"
          >
            <button onClick={() => navigate('/premium')} className="flex items-center gap-2 flex-1">
              <Heart className="w-5 h-5 text-white" fill="white" />
              <span className="text-white text-sm font-bold">{pendingLikes} {pendingLikes === 1 ? 'person' : 'log'} ne tumhe like kiya!</span>
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/premium')} className="bg-white text-amber-600 text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform">Dekho</button>
              <button onClick={() => setNudgeDismissed(true)} className="text-white/70 p-1"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 flex items-center justify-center px-8">
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
    <div className="h-[100%] bg-[#0a0a0a] flex flex-col" style={{ height: 'calc(100vh - var(--nav-total, 86px))', paddingTop: 'var(--safe-top, 24px)' }}>
      {shellTop}
      

      {/* City Filter Bottom Sheet */}
      {showFilter && (
        <div className="fixed inset-0 z-[80]" data-testid="city-filter-sheet">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilter(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-300" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-base mb-4">Filter by City</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setCityFilter(''); setCurrentIndex(0); setShowFilter(false); }}
                data-testid="filter-all"
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  !cityFilter ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' : 'bg-white/8 text-white/60 border border-white/10'
                }`}
              >All Cities</button>
              {POPULAR_CITIES.map(c => (
                <button
                  key={c}
                  onClick={() => { setCityFilter(c); setCurrentIndex(0); setShowFilter(false); }}
                  data-testid={`filter-${c.toLowerCase()}`}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    cityFilter === c ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' : 'bg-white/8 text-white/60 border border-white/10'
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Card area */}
      <div className="flex-1 min-h-0 p-1.5 pb-0">
        <div
          className="relative w-full h-full max-w-md mx-auto rounded-xl overflow-hidden"
          style={{
            willChange: 'transform, opacity',
            transform: `translateZ(0) translateX(${dragX}px) rotate(${dragX * 0.06}deg)`,
            transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
            opacity: Math.abs(dragX) > 350 ? 0 : 1,
            boxShadow: currentProfile.is_premium ? '0 0 20px 4px rgba(245,158,11,0.25), 0 0 40px 8px rgba(245,158,11,0.1)' : undefined,
            border: currentProfile.is_premium ? '2px solid rgba(245,158,11,0.4)' : undefined,
          }}
          data-testid="profile-card"
          onTouchStart={onCardTouchStart}
          onTouchMove={onCardTouchMove}
          onTouchEnd={onCardTouchEnd}
        >
          {/* LIKE / NOPE stamp overlay during drag */}
          {Math.abs(dragX) > 30 && (
            <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
              {dragX > 30 && (
                <div className="absolute top-20 left-6 border-4 border-green-400 rounded-xl px-4 py-2 -rotate-12" style={{ opacity: Math.min(Math.abs(dragX) / 100, 1) }}>
                  <span className="text-green-400 font-black text-3xl tracking-wider">LIKE</span>
                </div>
              )}
              {dragX < -30 && (
                <div className="absolute top-20 right-6 border-4 border-red-400 rounded-xl px-4 py-2 rotate-12" style={{ opacity: Math.min(Math.abs(dragX) / 100, 1) }}>
                  <span className="text-red-400 font-black text-3xl tracking-wider">NOPE</span>
                </div>
              )}
            </div>
          )}
          {/* Photo fills entire card */}
          <div className="absolute inset-0 bg-gray-900">
            {(allPhotos[photoIndex] || currentProfile.profile_picture) && !imgError ? (
              <OptimizedImage
                src={allPhotos[photoIndex] || currentProfile.profile_picture}
                alt={currentProfile.name}
                className="w-full h-full"
                draggable={false}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center mb-3">
                  <span className="text-5xl font-bold text-gray-400">{currentProfile.name?.charAt(0)}</span>
                </div>
                <span className="text-xs text-gray-400 bg-black/40 px-3 py-1 rounded-full">No profile photo added</span>
              </div>
            )}
          </div>

          {/* Top gradient */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent z-[3]" />

          {/* Filter button — top right, below safe area */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowFilter(true); }}
            data-testid="city-filter-btn"
            className="absolute right-3 z-[15] w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90"
            style={{ 
              top: '8px',
              background: cityFilter ? 'rgba(236,72,153,0.9)' : 'rgba(0,0,0,0.4)',
              border: '1.5px solid rgba(255,255,255,0.2)',
            }}
          >
            <SlidersHorizontal className="w-4.5 h-4.5 text-white" />
          </button>
          {cityFilter && (
            <div className="absolute right-14 z-[15] px-2.5 py-1 rounded-full text-[11px] font-bold text-white backdrop-blur-md" 
              style={{ top: '12px', background: 'rgba(236,72,153,0.8)' }}>
              {cityFilter}
            </div>
          )}

          {/* Photo indicators */}
          {hasMultiplePhotos && (
            <div className="absolute left-3 right-3 flex gap-1 z-[15]" style={{ top: '2px' }}>
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
            <div className="absolute left-3 bg-black/50 backdrop-blur-sm text-white text-[11px] px-2.5 py-1 rounded-full z-[15] font-medium" 
              data-testid="swipe-counter"
              style={{ top: '8px' }}>
              {Math.max(0, DAILY_SWIPE_LIMIT - dailySwipeCount)}{extraSwipes > 0 && <span className="text-emerald-400"> +{extraSwipes}</span>}
            </div>
          )}

          {/* Verified badge */}
          {currentProfile.verified && (
            <div className="absolute left-3 z-[15]" style={{ top: '36px' }}><VerifiedBadge size="md" showText={false} /></div>
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
                {currentProfile.is_premium && (
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-amber-400/50 animate-pulse" title="Premium" style={{ animationDuration: '3s' }}>
                    <Crown className="w-3 h-3 text-white" />
                  </span>
                )}
                <OnlineStatus isOnline={currentProfile.is_online} lastActive={currentProfile.last_active} size="sm" showText={false} />
              </div>
              {/* Safety Score Badge */}
              <SafetyScoreBadge profile={currentProfile} />
              {currentProfile.location && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-white/60 text-sm">
                    {currentProfile.location.split(',')[0]}
                    {currentProfile.distance_km != null && (
                      <span className="ml-1 text-white/80 font-medium">
                        · {currentProfile.distance_km < 1 ? '<1' : Math.round(currentProfile.distance_km)} km
                      </span>
                    )}
                  </span>
                </div>
              )}
              {currentProfile.bio && (
                <p className="text-white/70 text-sm mt-2 line-clamp-2 leading-relaxed">{currentProfile.bio}</p>
              )}
              {/* Profile Prompts — Hinge-style conversation starters */}
              {currentProfile.profile_prompts?.length > 0 && (
                <div className="mt-2.5 space-y-1.5" data-testid="profile-prompts">
                  {currentProfile.profile_prompts.slice(0, 2).map((prompt, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-2 border border-white/15">
                      <p className="text-white/50 text-[10px] font-medium uppercase tracking-wider">{prompt.question}</p>
                      <p className="text-white text-sm leading-snug mt-0.5">{prompt.answer}</p>
                    </div>
                  ))}
                </div>
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

            {/* Smart Nudge — "X people liked you!" for non-premium */}
            {!isPremiumUser && pendingLikes > 0 && !nudgeDismissed && (
              <div
                className="flex items-center justify-between mx-4 mb-2 px-4 py-2.5 rounded-2xl animate-bounce-in"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.9), rgba(239,108,0,0.9))',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
                }}
                data-testid="smart-nudge-banner"
              >
                <button
                  onClick={() => navigate('/premium')}
                  className="flex items-center gap-2 flex-1"
                >
                  <Heart className="w-5 h-5 text-white" fill="white" />
                  <span className="text-white text-sm font-bold">{pendingLikes} {pendingLikes === 1 ? 'person' : 'log'} ne tumhe like kiya!</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/premium')}
                    className="bg-white text-amber-600 text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                  >
                    Dekho
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setNudgeDismissed(true); }}
                    className="text-white/70 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons — floating glass dock */}
            <div
              className="flex justify-center items-center z-20"
              style={{
                paddingTop: 'clamp(12px, 2.5vh, 24px)',
                paddingBottom: 'var(--action-offset, 16px)',
              }}
              data-testid="action-buttons"
            >
              <div className="flex items-center gap-4 px-6 py-3 rounded-full"
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  backdropFilter: 'blur(20px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                {/* UNDO Button (Premium Only — shows only when last swipe exists) */}
                {lastSwipedProfile && (
                  <button
                    data-testid="undo-btn"
                    onClick={handleUndo}
                    disabled={undoing}
                    className="group relative rounded-full flex items-center justify-center active:scale-[0.75] transition-transform duration-75"
                    style={{
                      width: '40px', height: '40px',
                      background: 'linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                      border: '1.5px solid rgba(255,200,50,0.4)',
                    }}
                  >
                    <Undo2 className="w-4 h-4 text-amber-400" />
                  </button>
                )}

                {/* PASS Button */}
                <button
                  data-testid="pass-btn"
                  onClick={() => handleAction('pass')}
                  className="group relative rounded-full flex items-center justify-center active:scale-[0.75] transition-transform duration-75"
                  style={{
                    width: '56px', height: '56px',
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                    border: '1.5px solid rgba(255,100,100,0.3)',
                    boxShadow: '0 0 0 0 rgba(255,100,100,0), 0 4px 12px rgba(0,0,0,0.2)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 20px 4px rgba(255,100,100,0.25), 0 4px 12px rgba(0,0,0,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 0 rgba(255,100,100,0), 0 4px 12px rgba(0,0,0,0.2)'}
                >
                  <X className="w-6 h-6 text-rose-400 group-active:text-rose-300 transition-colors" strokeWidth={3} />
                </button>

                {/* SUPERLIKE Button */}
                <button
                  data-testid="superlike-btn"
                  onClick={() => handleAction('superlike')}
                  className="group relative rounded-full flex items-center justify-center active:scale-[0.75] transition-transform duration-75"
                  style={{
                    width: '46px', height: '46px',
                    background: 'linear-gradient(145deg, rgba(59,130,246,0.25), rgba(59,130,246,0.08))',
                    border: '1.5px solid rgba(59,130,246,0.35)',
                    boxShadow: '0 0 0 0 rgba(59,130,246,0), 0 4px 12px rgba(0,0,0,0.2)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px 3px rgba(59,130,246,0.3), 0 4px 12px rgba(0,0,0,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 0 rgba(59,130,246,0), 0 4px 12px rgba(0,0,0,0.2)'}
                >
                  <Star className="w-5 h-5 text-blue-400 group-active:text-blue-300 transition-colors" fill="currentColor" />
                </button>

                {/* LIKE Button — Hero/Primary */}
                <button
                  data-testid="like-btn"
                  onClick={() => handleAction('like')}
                  className="group relative rounded-full flex items-center justify-center active:scale-[0.75] transition-transform duration-75"
                  style={{
                    width: '66px', height: '66px',
                    background: (user?.is_premium || user?.isPremium || user?.gender?.toLowerCase() === 'female')
                      ? 'linear-gradient(145deg, #34d399, #059669)'
                      : 'linear-gradient(145deg, rgba(120,120,120,0.4), rgba(80,80,80,0.3))',
                    border: (user?.is_premium || user?.isPremium || user?.gender?.toLowerCase() === 'female')
                      ? '2px solid rgba(255,255,255,0.2)'
                      : '2px solid rgba(245,158,11,0.5)',
                    boxShadow: (user?.is_premium || user?.isPremium || user?.gender?.toLowerCase() === 'female')
                      ? '0 0 24px 4px rgba(16,185,129,0.35), 0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)'
                      : '0 0 16px 2px rgba(245,158,11,0.2), 0 4px 12px rgba(0,0,0,0.2)',
                  }}
                >
                  {(user?.is_premium || user?.isPremium || user?.gender?.toLowerCase() === 'female') ? (
                    <Heart className="w-8 h-8 text-white drop-shadow-sm" fill="white" strokeWidth={0} />
                  ) : (
                    <div className="flex flex-col items-center">
                      <Lock className="w-6 h-6 text-amber-400" />
                      <span className="text-[8px] text-amber-400 font-bold mt-0.5">PRO</span>
                    </div>
                  )}
                  {/* Pulse ring — only for premium */}
                  {(user?.is_premium || user?.isPremium || user?.gender?.toLowerCase() === 'female') && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: 'rgba(16,185,129,0.5)', animationDuration: '2s' }} />
                  )}
                </button>

                {/* CRUSH Button — only if admin-enabled */}
                {crushEnabled && (
                  <button
                    data-testid="crush-btn"
                    onClick={() => handleAction('crush')}
                    className="group relative rounded-full flex items-center justify-center transition-all duration-300 active:scale-[0.8]"
                    style={{
                      width: '46px', height: '46px',
                      background: 'linear-gradient(145deg, rgba(245,158,11,0.25), rgba(239,68,68,0.15))',
                      border: '1.5px solid rgba(245,158,11,0.35)',
                      boxShadow: '0 0 0 0 rgba(245,158,11,0), 0 4px 12px rgba(0,0,0,0.2)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px 3px rgba(245,158,11,0.3), 0 4px 12px rgba(0,0,0,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 0 rgba(245,158,11,0), 0 4px 12px rgba(0,0,0,0.2)'}
                    title="Secret Crush"
                  >
                    <Flame className="w-5 h-5 text-amber-400 group-active:text-amber-300 transition-colors" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ad-Free Reward — subtle, below the card area */}
      {shouldShowAds && (
        <div className="py-2 px-4">
          <AdFreeReward user={user} />
        </div>
      )}

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
