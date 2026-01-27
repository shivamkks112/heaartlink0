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
    
    // Initialize ads service
    if (shouldShowAds) {
      adsService.initialize();
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
      
      <div className="max-w-2xl mx-auto px-4 py-8 pb-32">
        <div 
          className={`bg-white rounded-3xl shadow-elevated overflow-hidden relative hover-lift transition-all duration-300 ${swipeDirection === 'left' ? 'translate-x-[-20px] opacity-80' : swipeDirection === 'right' ? 'translate-x-[20px] opacity-80' : ''}`}
          data-testid="profile-card"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Photo Section with enhanced animations */}
          <div className="relative h-96 bg-gradient-to-br from-pink-200 to-orange-200 overflow-hidden group">
            {currentProfile.profile_picture ? (
              <img
                src={currentProfile.profile_picture}
                alt={currentProfile.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : photos.length > 0 ? (
              <img
                src={photos[photoIndex]}
                alt={currentProfile.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Heart className="w-24 h-24 text-white animate-heart-beat" />
              </div>
            )}

            {/* Gradient overlay for better text visibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Swipe Direction Indicators */}
            {swipeDirection === 'left' && (
              <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                <div className="bg-red-500 text-white px-6 py-3 rounded-full text-2xl font-bold shadow-lg rotate-[-15deg]">
                  <X className="w-12 h-12" />
                </div>
              </div>
            )}
            {swipeDirection === 'right' && (
              <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                <div className="bg-green-500 text-white px-6 py-3 rounded-full text-2xl font-bold shadow-lg rotate-[15deg]">
                  <Heart className="w-12 h-12" fill="white" />
                </div>
              </div>
            )}

            {/* Photo Navigation */}
            {hasMultiplePhotos && (
              <>
                <button
                  onClick={() => setPhotoIndex(Math.max(0, photoIndex - 1))}
                  disabled={photoIndex === 0}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg disabled:opacity-0 transition-all"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setPhotoIndex(Math.min(photos.length - 1, photoIndex + 1))}
                  disabled={photoIndex === photos.length - 1}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg disabled:opacity-0 transition-all"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                
                {/* Photo indicators */}
                <div className="absolute top-4 left-0 right-0 flex justify-center gap-2">
                  {photos.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 rounded-full transition-all ${
                        idx === photoIndex ? 'w-8 bg-white' : 'w-4 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {currentProfile.verified && (
              <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                <Award className="w-4 h-4" />
                <span className="text-sm font-semibold">Verified</span>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-3xl font-bold text-gray-900">{currentProfile.name}, {currentProfile.age}</h2>
              {/* Trust Badge */}
              {currentProfile.trust_badge_level && currentProfile.trust_badge_level !== 'low' && (
                <div className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                  currentProfile.trust_badge_level === 'high' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  <Award className="w-3 h-3" />
                  {currentProfile.trust_badge_level.toUpperCase()}
                </div>
              )}
            </div>
            
            {/* Online Status */}
            {currentProfile.is_online ? (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 font-semibold">Online now</span>
              </div>
            ) : currentProfile.last_active && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-500">
                  Active {formatLastSeen(currentProfile.last_active)}
                </span>
              </div>
            )}
            
            {currentProfile.location && (
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <MapPin className="w-4 h-4" />
                <span>{currentProfile.location}</span>
              </div>
            )}

            {/* Relationship Intent */}
            {currentProfile.relationship_intent && (
              <div className="inline-flex items-center gap-1 bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm font-medium mb-3">
                <Heart className="w-3 h-3" />
                {currentProfile.relationship_intent === 'serious' && 'Serious Relationship'}
                {currentProfile.relationship_intent === 'casual' && 'Casual Dating'}
                {currentProfile.relationship_intent === 'friendship' && 'Friendship First'}
                {currentProfile.relationship_intent === 'marriage' && 'Marriage'}
              </div>
            )}

            {currentProfile.bio && (
              <p className="text-gray-700 mb-4 leading-relaxed">{currentProfile.bio}</p>
            )}

            {/* Values */}
            {currentProfile.values && currentProfile.values.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {currentProfile.values.map((value, idx) => (
                  <span
                    key={idx}
                    className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-full text-sm"
                  >
                    {value === 'respect' && '🤝 Respect'}
                    {value === 'family' && '👨‍👩‍👧‍👦 Family'}
                    {value === 'ambition' && '🚀 Ambition'}
                    {value === 'spirituality' && '🙏 Spirituality'}
                    {value === 'freedom' && '🦅 Freedom'}
                  </span>
                ))}
              </div>
            )}

            {/* Lifestyle Tags */}
            {currentProfile.lifestyle_tags && currentProfile.lifestyle_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {currentProfile.lifestyle_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full text-sm"
                  >
                    {tag === 'non-smoker' && '🚭 Non-Smoker'}
                    {tag === 'vegetarian' && '🥗 Vegetarian'}
                    {tag === 'fitness' && '💪 Fitness'}
                    {tag === 'travel' && '✈️ Travel'}
                    {tag === 'night-owl' && '🦉 Night Owl'}
                    {tag === 'early-bird' && '🐦 Early Bird'}
                    {tag === 'pet-lover' && '🐶 Pet Lover'}
                    {tag === 'foodie' && '🍕 Foodie'}
                  </span>
                ))}
              </div>
            )}

            {currentProfile.interests && currentProfile.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentProfile.interests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="bg-gradient-to-r from-pink-100 to-orange-100 text-gray-800 px-4 py-2 rounded-full text-sm font-medium"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Enhanced Action Buttons */}
          <div className="p-6 flex justify-center items-center gap-8">
            <button
              data-testid="pass-btn"
              onClick={() => handleAction('pass')}
              className="bg-white hover:bg-gray-50 border-4 border-gray-300 hover:border-gray-400 w-16 h-16 rounded-full flex items-center justify-center shadow-soft hover:shadow-elevated transform hover:scale-125 transition-all duration-300 group"
            >
              <X className="w-8 h-8 text-gray-500 group-hover:text-gray-700 transition-colors" />
            </button>

            <button
              data-testid="superlike-btn"
              onClick={() => handleAction('superlike')}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 w-16 h-16 rounded-full flex items-center justify-center shadow-soft hover:shadow-glow transform hover:scale-125 transition-all duration-300 group animate-glow"
            >
              <Sparkles className="w-8 h-8 text-white group-hover:animate-pulse" />
            </button>

            <button
              data-testid="like-btn"
              onClick={() => handleAction('like')}
              className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 w-20 h-20 rounded-full flex items-center justify-center shadow-glow hover:shadow-elevated transform hover:scale-125 transition-all duration-300 group animate-glow"
            >
              <Heart className="w-10 h-10 text-white group-hover:animate-heart-beat" fill="white" />
            </button>
          </div>

          {/* Swipe hint for mobile */}
          <div className="px-6 pb-4 text-center">
            <p className="text-gray-400 text-sm animate-pulse">
              ← Swipe or use buttons to choose →
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
        onClose={() => setShowOutOfSwipes(false)}
        onSwipesAdded={handleSwipesAdded}
      />
    </div>
  );
};

export default DiscoverPage;
