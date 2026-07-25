import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, X, Sparkles, MapPin, Award, Zap, ChevronLeft, ChevronRight, Play, Shield, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import adsService, { SWIPES_BEFORE_AD, EXTRA_SWIPES_REWARD } from '@/services/AdsService';
import wsService from '@/services/WebSocketService';
import { VerifiedBadge, TrustBadge, OnlineStatus, BadgeStyles } from '@/components/badges/VerifiedBadge';
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

  const formatLastSeen = (lastActive) => {
    if (!lastActive) return 'recently';
    
    const now = new Date();
    const lastSeenDate = new Date(lastActive);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return 'recently';
  };

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

  // Skeleton loading state
  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-gray-950">
        <TopBar />
        <Navbar user={user} />
        <div className="flex-1 flex items-center justify-center px-4" style={{ paddingTop: '60px', paddingBottom: '84px' }}>
          <div className="w-full max-w-sm">
            <div className="rounded-3xl overflow-hidden bg-gray-800 animate-pulse">
              <div className="h-[65vh] bg-gray-700" />
              <div className="p-5 space-y-3">
                <div className="h-6 bg-gray-700 rounded-lg w-2/3" />
                <div className="h-4 bg-gray-700 rounded-lg w-1/2" />
                <div className="flex gap-2">
                  <div className="h-8 bg-gray-700 rounded-full w-20" />
                  <div className="h-8 bg-gray-700 rounded-full w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="h-screen flex flex-col bg-gray-950">
        <Navbar user={user} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-800 rounded-full flex items-center justify-center">
              <Heart className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No More Profiles</h2>
            <p className="text-gray-400 mb-8">Come back later for new people!</p>
            <Button
              onClick={() => navigate('/matches')}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-8 py-3 rounded-full text-base"
              data-testid="view-matches-btn"
            >
              View Your Matches
            </Button>
            {shouldShowAds && (
              <Button
                onClick={handleWatchAdForSwipes}
                disabled={showingAd}
                className="mt-4 bg-gray-800 text-white px-6 py-3 rounded-full flex items-center gap-2 mx-auto"
                data-testid="watch-ad-btn"
              >
                <Play className="w-4 h-4" /> Get +{EXTRA_SWIPES_REWARD} Swipes
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const photos = currentProfile.photos || [];
  const mainPhoto = currentProfile.profile_picture || (photos.length > 0 ? photos[photoIndex] : null);
  const allPhotos = currentProfile.profile_picture 
    ? [currentProfile.profile_picture, ...photos.filter(p => p !== currentProfile.profile_picture)]
    : photos;
  const hasMultiplePhotos = allPhotos.length > 1;

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <MatchAnimation
        isOpen={showMatchAnimation}
        onClose={handleMatchAnimationClose}
        currentUser={user}
        matchedUser={matchedUserData}
        compatibilityScore={matchCompatibilityScore?.toFixed(0)}
        onStartChat={handleStartChatFromMatch}
      />

      {/* Full-screen card */}
      <div className="flex-1 flex items-center justify-center px-3 pt-2 pb-20">
        <div
          className={`relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl transition-transform duration-200 ${
            swipeDirection === 'left' ? '-translate-x-6 -rotate-3 opacity-80' :
            swipeDirection === 'right' ? 'translate-x-6 rotate-3 opacity-80' : ''
          }`}
          data-testid="profile-card"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Photo */}
          <div className="relative h-[62vh] bg-gray-800">
            {mainPhoto ? (
              <img
                src={allPhotos[photoIndex] || mainPhoto}
                alt={currentProfile.name}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-400 to-rose-500">
                <span className="text-7xl font-bold text-white/60">{currentProfile.name?.charAt(0)}</span>
              </div>
            )}

            {/* Dark gradient overlay at bottom for text */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            {/* Photo indicators */}
            {hasMultiplePhotos && (
              <div className="absolute top-3 left-3 right-3 flex gap-1">
                {allPhotos.map((_, idx) => (
                  <div key={idx} className={`h-0.5 flex-1 rounded-full ${idx === photoIndex ? 'bg-white' : 'bg-white/30'}`} />
                ))}
              </div>
            )}

            {/* Photo tap zones */}
            {hasMultiplePhotos && (
              <>
                <div className="absolute left-0 top-0 w-1/3 h-full" onClick={() => setPhotoIndex(Math.max(0, photoIndex - 1))} />
                <div className="absolute right-0 top-0 w-1/3 h-full" onClick={() => setPhotoIndex(Math.min(allPhotos.length - 1, photoIndex + 1))} />
              </>
            )}

            {/* Swipe overlay */}
            {swipeDirection === 'left' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-4 border-red-500 text-red-500 px-8 py-3 rounded-xl text-3xl font-black rotate-[-20deg]">NOPE</div>
              </div>
            )}
            {swipeDirection === 'right' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-4 border-green-400 text-green-400 px-8 py-3 rounded-xl text-3xl font-black rotate-[20deg]">LIKE</div>
              </div>
            )}

            {/* Verified badge */}
            {currentProfile.verified && (
              <div className="absolute top-4 right-4">
                <VerifiedBadge size="md" showText={false} />
              </div>
            )}

            {/* Profile info overlay on photo */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex items-end gap-2">
                <h2 className="text-3xl font-bold text-white leading-tight">
                  {currentProfile.name}<span className="font-light ml-1">{currentProfile.age}</span>
                </h2>
                <OnlineStatus isOnline={currentProfile.is_online} lastActive={currentProfile.last_active} size="sm" showText={false} />
              </div>

              {currentProfile.location && (
                <div className="flex items-center gap-1 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-white/80 text-sm">{currentProfile.location}</span>
                </div>
              )}

              {currentProfile.bio && (
                <p className="text-white/80 text-sm mt-2 line-clamp-2">{currentProfile.bio}</p>
              )}

              {/* Chips */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {currentProfile.relationship_intent && (
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
                    {currentProfile.relationship_intent === 'serious' ? 'Serious' : currentProfile.relationship_intent === 'marriage' ? 'Marriage' : currentProfile.relationship_intent === 'casual' ? 'Casual' : 'Friends'}
                  </span>
                )}
                {currentProfile.interests?.slice(0, 3).map((interest, idx) => (
                  <span key={idx} className="bg-white/20 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">{interest}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons — floating over card bottom */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-5 z-10">
            <button
              data-testid="pass-btn"
              onClick={() => handleAction('pass')}
              className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-7 h-7 text-red-400" />
            </button>

            <button
              data-testid="superlike-btn"
              onClick={() => handleAction('superlike')}
              className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-90 transition-transform"
            >
              <Star className="w-6 h-6 text-blue-500" fill="currentColor" />
            </button>

            <button
              data-testid="like-btn"
              onClick={() => handleAction('like')}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Heart className="w-8 h-8 text-white" fill="white" />
            </button>
          </div>
        </div>
      </div>

      {/* Swipe counter */}
      {!user?.is_premium && !user?.isPremium && (
        <div className="fixed top-16 right-3 bg-gray-800/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full z-40">
          {Math.max(0, DAILY_SWIPE_LIMIT - dailySwipeCount)} swipes left
          {extraSwipes > 0 && <span className="text-green-400 ml-1">+{extraSwipes}</span>}
        </div>
      )}

      {/* Out of Swipes Modal */}
      {showOutOfSwipes && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowOutOfSwipes(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
            <button onClick={() => setShowOutOfSwipes(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full z-10">
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div className="bg-gradient-to-br from-pink-500 to-rose-500 px-6 py-8 text-center text-white">
              <Heart className="w-12 h-12 mx-auto mb-3" />
              <h2 className="text-xl font-bold">Swipes Khatam!</h2>
              <p className="text-white/80 text-sm mt-1">Kal naye swipes milenge</p>
            </div>
            <div className="p-5">
              {shouldShowAds && (
                <button
                  onClick={handleWatchAdForSwipes}
                  disabled={showingAd}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-2"
                  data-testid="watch-ad-swipes-btn"
                >
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
