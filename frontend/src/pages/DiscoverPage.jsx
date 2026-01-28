import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, X, Sparkles, MapPin, Award, Zap, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import adsService, { SWIPES_BEFORE_AD, EXTRA_SWIPES_REWARD } from '@/services/AdsService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
if (!BACKEND_URL) {
  console.error('⚠️ REACT_APP_BACKEND_URL is not set!');
}
const API = `${BACKEND_URL}/api`;

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
    
    // Initialize ads service properly
    const initAds = async () => {
      if (shouldShowAds) {
        try {
          const success = await adsService.initialize();
          console.log('Ads initialized:', success);
        } catch (error) {
          console.error('Failed to initialize ads:', error);
        }
      }
    };
    initAds();
    
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
        toast.success(
          `It's a Match! ❤️ Compatibility: ${response.data.compatibility_score.toFixed(0)}%`,
          { duration: 5000 }
        );
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center">
        <div className="text-center animate-bounce-in">
          <div className="w-20 h-20 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-6 shadow-glow"></div>
          <div className="bg-white rounded-2xl p-6 shadow-elevated glass-effect">
            <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4 animate-heart-beat" />
            <p className="text-gray-700 font-semibold text-lg">Finding your perfect matches...</p>
            <p className="text-gray-500 text-sm mt-2">AI is analyzing compatibility</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-24">
        <Navbar user={user} />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="bg-white rounded-3xl p-8 shadow-xl">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No More Profiles</h2>
            <p className="text-gray-600 mb-6">Check back later for new matches!</p>
            <Button
              onClick={() => navigate('/matches')}
              className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-6 py-3 rounded-full"
              data-testid="view-matches-btn"
            >
              View Your Matches
            </Button>
          </div>
          
          {/* Rewarded Ad for Extra Swipes - Only for eligible users */}
          {shouldShowAds && (
            <div className="mt-6 bg-white rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-800 mb-3">🎁 Get Extra Swipes</h3>
              <p className="text-gray-600 text-sm mb-4">
                Watch a short video to get +{EXTRA_SWIPES_REWARD} extra swipes!
              </p>
              <Button
                onClick={handleWatchAdForSwipes}
                disabled={showingAd}
                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full flex items-center gap-2 mx-auto"
                data-testid="watch-ad-btn"
              >
                {showingAd ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                Watch Ad for +{EXTRA_SWIPES_REWARD} Swipes
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const photos = currentProfile.photos || [];
  const hasMultiplePhotos = photos.length > 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-40" style={{ paddingTop: '95px' }}>
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        <div 
          className={`bg-white rounded-[2rem] shadow-2xl overflow-hidden relative transition-all duration-300 ${swipeDirection === 'left' ? 'translate-x-[-30px] rotate-[-3deg] opacity-70' : swipeDirection === 'right' ? 'translate-x-[30px] rotate-[3deg] opacity-70' : ''}`}
          data-testid="profile-card"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Photo Section - Modern Design */}
          <div className="relative h-[420px] bg-gradient-to-br from-pink-300 via-rose-200 to-orange-200 overflow-hidden">
            {currentProfile.profile_picture ? (
              <img
                src={currentProfile.profile_picture}
                alt={currentProfile.name}
                className="w-full h-full object-cover"
              />
            ) : photos.length > 0 ? (
              <img
                src={photos[photoIndex]}
                alt={currentProfile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Heart className="w-16 h-16 text-white/80" />
                </div>
              </div>
            )}

            {/* Bottom gradient for text readability */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 via-black/30 to-transparent"></div>

            {/* Profile Info Overlay on Image */}
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-bold drop-shadow-lg">{currentProfile.name}, {currentProfile.age}</h2>
                {currentProfile.verified && (
                  <div className="bg-blue-500 p-1.5 rounded-full shadow-lg">
                    <Award className="w-4 h-4 text-white" fill="white" />
                  </div>
                )}
                {currentProfile.trust_badge_level && currentProfile.trust_badge_level !== 'low' && (
                  <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    currentProfile.trust_badge_level === 'high' 
                      ? 'bg-green-500' 
                      : 'bg-yellow-500'
                  }`}>
                    {currentProfile.trust_badge_level.toUpperCase()}
                  </div>
                )}
              </div>
              
              {/* Location & Status */}
              <div className="flex items-center gap-3 text-white/90 text-sm">
                {currentProfile.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{currentProfile.location}</span>
                  </div>
                )}
                {currentProfile.is_online ? (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-300 font-medium">Online</span>
                  </div>
                ) : currentProfile.last_active && (
                  <span className="text-white/70">Active {formatLastSeen(currentProfile.last_active)}</span>
                )}
              </div>
            </div>

            {/* Swipe Direction Indicators */}
            {swipeDirection === 'left' && (
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/40 to-transparent flex items-center justify-start pl-8">
                <div className="bg-red-500 text-white px-6 py-3 rounded-2xl text-xl font-bold shadow-2xl rotate-[-12deg] border-4 border-white">
                  NOPE
                </div>
              </div>
            )}
            {swipeDirection === 'right' && (
              <div className="absolute inset-0 bg-gradient-to-l from-green-500/40 to-transparent flex items-center justify-end pr-8">
                <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-3 rounded-2xl text-xl font-bold shadow-2xl rotate-[12deg] border-4 border-white">
                  LIKE
                </div>
              </div>
            )}

            {/* Photo Navigation */}
            {hasMultiplePhotos && (
              <>
                <button
                  onClick={() => setPhotoIndex(Math.max(0, photoIndex - 1))}
                  disabled={photoIndex === 0}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-xl disabled:opacity-0 transition-all backdrop-blur-sm"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  onClick={() => setPhotoIndex(Math.min(photos.length - 1, photoIndex + 1))}
                  disabled={photoIndex === photos.length - 1}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-xl disabled:opacity-0 transition-all backdrop-blur-sm"
                >
                  <ChevronRight className="w-5 h-5 text-gray-700" />
                </button>
                
                {/* Photo indicators - Top */}
                <div className="absolute top-3 left-3 right-3 flex gap-1">
                  {photos.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        idx === photoIndex ? 'bg-white' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Profile Details Section */}
          <div className="p-5 bg-white">
            {/* Relationship Intent */}
            {currentProfile.relationship_intent && (
              <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-pink-50 to-rose-50 text-pink-600 px-3 py-1.5 rounded-full text-sm font-semibold mb-3 border border-pink-100">
                <Heart className="w-3.5 h-3.5" fill="currentColor" />
                {currentProfile.relationship_intent === 'serious' && 'Serious Relationship'}
                {currentProfile.relationship_intent === 'casual' && 'Casual Dating'}
                {currentProfile.relationship_intent === 'friendship' && 'Friendship First'}
                {currentProfile.relationship_intent === 'marriage' && 'Marriage'}
              </div>
            )}

            {currentProfile.bio && (
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{currentProfile.bio}</p>
            )}

            {/* Interests Tags */}
            {currentProfile.interests && currentProfile.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentProfile.interests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="bg-gradient-to-r from-pink-100 to-orange-100 text-gray-700 px-3 py-1.5 rounded-full text-xs font-medium"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Premium Action Buttons - Modern Design */}
          <div className="p-6 pt-4">
            <div className="flex justify-center items-end gap-4">
              {/* Pass Button */}
              <button
                data-testid="pass-btn"
                onClick={() => handleAction('pass')}
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-gray-200 to-gray-300 rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity"></div>
                <div className="relative bg-white hover:bg-gray-50 border-2 border-gray-200 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95 transition-all duration-200">
                  <X className="w-7 h-7 text-gray-400 group-hover:text-red-400 transition-colors" strokeWidth={3} />
                </div>
                <span className="block text-xs text-gray-500 mt-2 text-center font-medium">Pass</span>
              </button>

              {/* Like Button - Main CTA */}
              <button
                data-testid="like-btn"
                onClick={() => handleAction('like')}
                className="group relative -mt-4"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-pink-400 to-rose-500 rounded-full blur-lg opacity-60 group-hover:opacity-90 animate-pulse transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 hover:from-pink-600 hover:via-rose-600 hover:to-red-600 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl hover:shadow-pink-500/50 transform hover:scale-110 active:scale-95 transition-all duration-200 ring-4 ring-white">
                  <Heart className="w-10 h-10 text-white drop-shadow-lg" fill="white" strokeWidth={0} />
                </div>
                <span className="block text-xs text-pink-600 mt-2 text-center font-bold">Like</span>
              </button>

              {/* Super Like Button */}
              <button
                data-testid="superlike-btn"
                onClick={() => handleAction('superlike')}
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-blue-400 to-purple-500 rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-purple-500/30 transform hover:scale-110 active:scale-95 transition-all duration-200">
                  <Sparkles className="w-7 h-7 text-white" fill="white" />
                </div>
                <span className="block text-xs text-purple-600 mt-2 text-center font-medium">Super</span>
              </button>
            </div>
          </div>

          {/* Swipe hint for mobile */}
          <div className="px-6 pb-4 text-center">
            <p className="text-gray-400 text-xs">
              ← Swipe left to pass • Swipe right to like →
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-gray-600">
          <p>{profiles.length - currentIndex} profiles remaining</p>
          {/* Swipe Counter for non-premium */}
          {!user?.is_premium && !user?.isPremium && (
            <div className="mt-2 flex items-center justify-center gap-4 text-sm">
              <span className={`${dailySwipeCount >= DAILY_SWIPE_LIMIT - 10 ? 'text-orange-500 font-semibold' : 'text-gray-500'}`}>
                Daily: {Math.max(0, DAILY_SWIPE_LIMIT - dailySwipeCount)} left
              </span>
              {extraSwipes > 0 && (
                <span className="text-green-600 font-semibold">
                  +{extraSwipes} extra
                </span>
              )}
            </div>
          )}
          
          {/* Ad Counter - Show when ads are enabled */}
          {shouldShowAds && (
            <p className="text-xs text-gray-400 mt-1">
              Ad in {swipesUntilAd} swipes
            </p>
          )}
        </div>
      </div>
      
      {/* Out of Swipes Modal */}
      {showOutOfSwipes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOutOfSwipes(false)} />
          
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <button
              onClick={() => setShowOutOfSwipes(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full z-10"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            <div className="bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 px-6 py-8 text-center text-white">
              <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
                <Heart className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Swipes Khatam! 😅</h2>
              <p className="text-white/90 text-sm">Aapne aaj ke saare swipes use kar liye</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Watch Ad Option */}
              {shouldShowAds && (
                <button
                  onClick={handleWatchAdForSwipes}
                  disabled={showingAd}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white p-4 rounded-2xl flex items-center justify-between transition-all shadow-lg"
                  data-testid="watch-ad-swipes-btn"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                      <Play className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-lg">Free Swipes!</p>
                      <p className="text-sm text-white/80">Watch ad, get +{EXTRA_SWIPES_REWARD} swipes</p>
                    </div>
                  </div>
                  {showingAd ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-6 h-6" />
                  )}
                </button>
              )}

              <div className="text-center pt-2">
                <p className="text-gray-500 text-sm">
                  Ya phir <span className="font-semibold text-pink-600">kal</span> naye swipes milenge
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;
