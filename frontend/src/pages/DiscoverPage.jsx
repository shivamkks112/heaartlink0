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
if (!BACKEND_URL) {
  console.error('⚠️ REACT_APP_BACKEND_URL is not set!');
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
  
  // Match Animation State
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const [matchedUserData, setMatchedUserData] = useState(null);
  const [matchCompatibilityScore, setMatchCompatibilityScore] = useState(null);
  
  // Daily swipe limit (50 for free users)
  const DAILY_SWIPE_LIMIT = 50;
  
  // Check if user should see ads (male, non-premium)
  const shouldShowAds = user?.gender === 'male' && !user?.is_premium && !user?.isPremium;

  const minSwipeDistance = 50;

  const fetchProfiles = async () => {
    try {
      const response = await axios.get(`${API}/discover/${user.id}`);
      setProfiles(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load profiles');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    
    // Initialize ads service
    if (shouldShowAds) {
      adsService.initialize();
    }
    
    // Connect to WebSocket for real-time updates
    if (user?.id) {
      wsService.connect(user.id);
      
      // Listen for status updates
      const unsubscribe = wsService.on('status_update', (data) => {
        // Update profile status if it's currently displayed
        setProfiles(prev => prev.map(p => 
          p.id === data.user_id 
            ? { ...p, is_online: data.is_online, last_active: data.last_active }
            : p
        ));
      });
      
      return () => unsubscribe();
    }
    
    // Load daily swipe count from localStorage
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('heartlink_swipe_date');
    if (storedDate !== today) {
      localStorage.setItem('heartlink_swipe_date', today);
      localStorage.setItem('heartlink_swipe_count', '0');
      setDailySwipeCount(0);
    } else {
      const count = parseInt(localStorage.getItem('heartlink_swipe_count') || '0');
      setDailySwipeCount(count);
    }
    
    // Load extra swipes
    const extra = parseInt(localStorage.getItem('heartlink_extra_swipes') || '0');
    setExtraSwipes(extra);
    
    // eslint-disable-next-line
  }, []);

  const handleAction = async (action) => {
    if (profiles.length === 0) return;
    
    // Check swipe limit for non-premium users (only for like/pass actions)
    if (!user?.is_premium && !user?.isPremium && (action === 'like' || action === 'pass')) {
      const currentExtra = parseInt(localStorage.getItem('heartlink_extra_swipes') || '0');
      
      if (dailySwipeCount >= DAILY_SWIPE_LIMIT && currentExtra <= 0) {
        // Out of swipes - show modal
        setShowOutOfSwipes(true);
        return;
      }
      
      // Use extra swipe if daily limit reached
      if (dailySwipeCount >= DAILY_SWIPE_LIMIT && currentExtra > 0) {
        const newExtra = currentExtra - 1;
        localStorage.setItem('heartlink_extra_swipes', String(newExtra));
        setExtraSwipes(newExtra);
        toast.info(`Extra swipe used! ${newExtra} remaining`);
      } else {
        // Increment daily swipe count
        const newCount = dailySwipeCount + 1;
        localStorage.setItem('heartlink_swipe_count', String(newCount));
        setDailySwipeCount(newCount);
        
        // Show warning when approaching limit
        if (newCount === DAILY_SWIPE_LIMIT - 5) {
          toast.warning('⚠️ Sirf 5 swipes bache hain!');
        }
      }
      
      // Track swipe for interstitial ads (after every 6 swipes)
      if (shouldShowAds) {
        const adShown = await adsService.trackSwipe();
        setSwipesUntilAd(adsService.getSwipesUntilAd());
        if (adShown) {
          setShowingAd(true);
          setTimeout(() => setShowingAd(false), 500);
        }
      }
    }
    
    try {
      const response = await axios.post(`${API}/action/${user.id}`, {
        target_user_id: profiles[currentIndex].id,
        action
      });

      if (response.data.action === 'matched') {
        // Show match animation instead of just toast
        setMatchedUserData(profiles[currentIndex]);
        setMatchCompatibilityScore(response.data.compatibility_score);
        setShowMatchAnimation(true);
      } else if (action === 'superlike') {
        toast.success('⭐ Super Like sent!');
      }

      // Move to next profile
      if (currentIndex < profiles.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setPhotoIndex(0);
      } else {
        // Load more profiles
        setCurrentIndex(0);
        setPhotoIndex(0);
        fetchProfiles();
      }
    } catch (error) {
      toast.error('Action failed');
    }
  };
  
  // Handle match animation close
  const handleMatchAnimationClose = () => {
    setShowMatchAnimation(false);
    setMatchedUserData(null);
    setMatchCompatibilityScore(null);
  };
  
  // Handle start chat from match animation
  const handleStartChatFromMatch = () => {
    setShowMatchAnimation(false);
    if (matchedUserData) {
      navigate('/matches');
    }
  };
  
  // Watch rewarded ad for +10 extra swipes
  const handleWatchAdForSwipes = async () => {
    setShowingAd(true);
    
    const result = await adsService.showRewardedForSwipes((reward) => {
      if (reward.success) {
        handleSwipesAdded(reward.swipes);
        toast.success(`🎉 +${reward.swipes} Extra Swipes Added!`);
        setShowOutOfSwipes(false);
      }
    });
    
    setShowingAd(false);
    
    if (!result.success && result.error) {
      toast.error(result.error);
    }
    
    return result;
  };
  
  const handleSwipesAdded = (count) => {
    const currentExtra = parseInt(localStorage.getItem('heartlink_extra_swipes') || '0');
    const newExtra = currentExtra + count;
    localStorage.setItem('heartlink_extra_swipes', String(newExtra));
    setExtraSwipes(newExtra);
  };

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
    const distance = touchStart - e.targetTouches[0].clientX;
    if (Math.abs(distance) > 20) {
      setSwipeDirection(distance > 0 ? 'left' : 'right');
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      handleAction('pass');
    } else if (isRightSwipe) {
      handleAction('like');
    }
    
    setSwipeDirection(null);
    setTouchStart(null);
    setTouchEnd(null);
  };

  const currentProfile = profiles[currentIndex];
  const photos = currentProfile?.photos || [];
  const allPhotos = currentProfile?.profile_picture
    ? [currentProfile.profile_picture, ...photos.filter(p => p !== currentProfile.profile_picture)]
    : photos;
  const hasMultiplePhotos = allPhotos.length > 1;

  // Skeleton loading
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col overflow-hidden">
        <Navbar user={user} />
        <div className="flex-1 flex items-center justify-center p-2" style={{ paddingBottom: 'var(--nav-height, 64px)' }}>
          <div className="w-full h-full max-w-md rounded-xl overflow-hidden bg-gray-800/60 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col overflow-hidden">
        <Navbar user={user} />
        <div className="flex-1 flex items-center justify-center px-8" style={{ paddingBottom: 'var(--nav-height, 64px)' }}>
          <div className="text-center" data-testid="no-profiles">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-800/60 rounded-full flex items-center justify-center">
              <Heart className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No More Profiles</h2>
            <p className="text-gray-500 text-sm mb-8">Come back later for new people!</p>
            <Button onClick={() => navigate('/matches')} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-10 py-3 rounded-full text-base font-semibold" data-testid="view-matches-btn">View Matches</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col overflow-hidden">
      <Toaster position="top-center" />
      <Navbar user={user} />
      <MatchAnimation isOpen={showMatchAnimation} onClose={handleMatchAnimationClose} currentUser={user} matchedUser={matchedUserData} compatibilityScore={matchCompatibilityScore?.toFixed(0)} onStartChat={handleStartChatFromMatch} />

      {/* Full-bleed card area */}
      <div
        className="flex-1 min-h-0 flex flex-col p-1.5 pb-0"
        style={{ marginBottom: 'var(--nav-height, 64px)' }}
      >
        <div
          className={`relative flex-1 w-full max-w-md mx-auto rounded-xl overflow-hidden transition-transform duration-200 ease-out ${
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
            {(allPhotos[photoIndex] || currentProfile.profile_picture) ? (
              <img
                src={allPhotos[photoIndex] || currentProfile.profile_picture}
                alt={currentProfile.name}
                className="w-full h-full object-cover"
                loading="eager"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-500/80 to-rose-600/80">
                <span className="text-8xl font-bold text-white/30">{currentProfile.name?.charAt(0)}</span>
              </div>
            )}
          </div>

          {/* Top gradient for indicators */}
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
              <button className="absolute left-0 top-0 w-1/3 h-[65%] z-[5]" onClick={() => setPhotoIndex(Math.max(0, photoIndex - 1))} aria-label="Previous photo" />
              <button className="absolute right-0 top-0 w-1/3 h-[65%] z-[5]" onClick={() => setPhotoIndex(Math.min(allPhotos.length - 1, photoIndex + 1))} aria-label="Next photo" />
            </>
          )}

          {/* Swipe counter pill - top right */}
          {!user?.is_premium && !user?.isPremium && (
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[11px] px-2.5 py-1 rounded-full z-10 font-medium">
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

          {/* Bottom gradient for info + buttons */}
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/95 via-black/60 to-transparent z-[6]" />

          {/* Profile info overlay */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-24">
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

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {currentProfile.relationship_intent && (
                <span className="bg-white/10 backdrop-blur-sm text-white/90 text-xs px-3 py-1 rounded-full border border-white/10">
                  {currentProfile.relationship_intent === 'serious' ? 'Serious' : currentProfile.relationship_intent === 'marriage' ? 'Marriage' : currentProfile.relationship_intent === 'casual' ? 'Casual' : 'Friends'}
                </span>
              )}
              {currentProfile.interests?.slice(0, 3).map((tag, i) => (
                <span key={i} className="bg-white/10 backdrop-blur-sm text-white/90 text-xs px-3 py-1 rounded-full border border-white/10">{tag}</span>
              ))}
            </div>
          </div>

          {/* Action buttons — floating at bottom of card */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-5 z-20">
            <button
              data-testid="pass-btn"
              onClick={() => handleAction('pass')}
              className="w-[52px] h-[52px] rounded-full bg-white/95 shadow-xl flex items-center justify-center active:scale-90 transition-all duration-150 hover:bg-white"
            >
              <X className="w-6 h-6 text-rose-500" strokeWidth={3} />
            </button>
            <button
              data-testid="superlike-btn"
              onClick={() => handleAction('superlike')}
              className="w-11 h-11 rounded-full bg-white/95 shadow-xl flex items-center justify-center active:scale-90 transition-all duration-150 hover:bg-white"
            >
              <Star className="w-5 h-5 text-blue-500" fill="currentColor" />
            </button>
            <button
              data-testid="like-btn"
              onClick={() => handleAction('like')}
              className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-xl shadow-emerald-500/30 flex items-center justify-center active:scale-90 transition-all duration-150"
            >
              <Heart className="w-7 h-7 text-white" fill="white" />
            </button>
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
