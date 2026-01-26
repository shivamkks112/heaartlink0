import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Sparkles, Users, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { MatchCardSkeleton } from '@/components/SkeletonLoader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
if (!BACKEND_URL) {
  console.error('⚠️ REACT_APP_BACKEND_URL is not set!');
}
const API = `${BACKEND_URL}/api`;

const MatchesPage = ({ user }) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' or 'active'

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

  const fetchMatches = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching matches for user:', user.id);
      console.log('🔗 API URL:', `${API}/matches/${user.id}`);
      
      const response = await axios.get(`${API}/matches/${user.id}`);
      
      console.log('✅ Matches API Response:', response.data);
      console.log('📊 Total matches received:', response.data.length);
      
      setMatches(response.data);
      setLoading(false);
      
      if (response.data.length === 0) {
        console.log('⚠️ No matches found for this user');
      } else {
        console.log('🎉 Matches loaded successfully:', response.data);
      }
    } catch (error) {
      console.error('❌ Error fetching matches:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Failed to load matches');
      setLoading(false);
    }
  };

  const fetchActiveUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/active-users/${user.id}`);
      setActiveUsers(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load active users');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'matches') {
      fetchMatches();
    } else {
      fetchActiveUsers();
    }
    // eslint-disable-next-line
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav">
        <TopBar />
        <Navbar user={user} />
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pb-24">
          <div className="mb-4 sm:mb-6 md:mb-8 animate-slide-in-down">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Connections</h1>
            <p className="text-sm sm:text-base text-gray-600">Your matches and active users</p>
          </div>

          {/* Tabs skeleton */}
          <div className="flex gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8 animate-slide-in-up">
            <div className="flex-1 h-12 sm:h-14 md:h-16 bg-gray-200 rounded-lg sm:rounded-xl animate-shimmer"></div>
            <div className="flex-1 h-12 sm:h-14 md:h-16 bg-gray-200 rounded-lg sm:rounded-xl animate-shimmer"></div>
          </div>

          {/* Cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="animate-bounce-in" style={{animationDelay: `${idx * 0.1}s`}}>
                <MatchCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-40" style={{ paddingTop: '95px' }}>
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pb-32">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Connections</h1>
          <p className="text-sm sm:text-base text-gray-600">Your matches and active users</p>
        </div>

        {/* Enhanced Tabs - Responsive */}
        <div className="flex gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8 animate-slide-in-up" style={{animationDelay: '0.2s'}}>
          <Button
            data-testid="tab-matches"
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-3 sm:py-4 md:py-6 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base md:text-lg transition-all duration-300 ${
              activeTab === 'matches'
                ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
            }`}
          >
            <Heart className={`w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 inline ${activeTab === 'matches' ? 'animate-heart-beat' : ''}`} />
            <span className="hidden xs:inline">My </span>Matches ({matches.length})
          </Button>

          <Button
            data-testid="tab-active"
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 sm:py-4 md:py-6 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base md:text-lg transition-all duration-300 ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
            }`}
          >
            <Zap className={`w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 inline ${activeTab === 'active' ? 'animate-pulse' : ''}`} />
            Active ({activeUsers.length})
          </Button>
        </div>

        {/* Matches Tab */}
        {activeTab === 'matches' && (
          <>
            {matches.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-white rounded-3xl p-12 shadow-xl inline-block">
                  <Heart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">No Matches Yet</h2>
                  <p className="text-gray-600 mb-6">Start swiping to find your match!</p>
                  <button
                    onClick={() => navigate('/discover')}
                    className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-4 rounded-full font-semibold hover:scale-105 transition-all"
                  >
                    Discover Profiles
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {matches.map((match, index) => (
                  <div
                    key={match.match_id}
                    data-testid="match-card"
                    className="bg-white rounded-xl sm:rounded-2xl shadow-soft overflow-hidden hover:shadow-elevated transition-all duration-300 transform hover:-translate-y-2 group animate-bounce-in"
                    style={{animationDelay: `${index * 0.1}s`}}
                  >
                    <div className="relative h-48 sm:h-56 md:h-64 bg-gradient-to-br from-pink-200 to-orange-200">
                      {match.user.profile_picture ? (
                        <img
                          src={match.user.profile_picture}
                          alt={match.user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : match.user.photos && match.user.photos.length > 0 ? (
                        <img
                          src={match.user.photos[0]}
                          alt={match.user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Heart className="w-20 h-20 text-white" />
                        </div>
                      )}
                      
                      {match.user.verified && (
                        <div className="absolute top-3 right-3 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                          ✓ Verified
                        </div>
                      )}
                    </div>

                    <div className="p-3 sm:p-4 md:p-5">
                      <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-1 truncate">
                        {match.user.name}, {match.user.age}
                      </h3>
                      
                      {/* Online Status */}
                      {match.user.is_online ? (
                        <div className="flex items-center gap-1 mb-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-600 font-medium">Online now</span>
                        </div>
                      ) : match.user.last_active && (
                        <div className="flex items-center gap-1 mb-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-xs text-gray-500">
                            {formatLastSeen(match.user.last_active)}
                          </span>
                        </div>
                      )}
                      
                      {match.compatibility_score && (
                        <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-3">
                          <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-pink-500 flex-shrink-0" />
                          <span className="text-xs sm:text-sm font-semibold text-pink-600">
                            {match.compatibility_score.toFixed(0)}% Compatible
                          </span>
                        </div>
                      )}

                      {match.ai_analysis && (
                        <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4 line-clamp-2">
                          {match.ai_analysis}
                        </p>
                      )}

                      <button
                        data-testid="chat-btn"
                        onClick={() => navigate(`/chat/${match.match_id}`)}
                        className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-2 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-1 sm:gap-2 transition-all"
                      >
                        <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden xs:inline">Start </span>Chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Active Users Tab */}
        {activeTab === 'active' && (
          <>
            {activeUsers.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-white rounded-3xl p-12 shadow-xl inline-block">
                  <Users className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">No Active Users</h2>
                  <p className="text-gray-600 mb-6">Check back later for active users!</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {activeUsers.map((activeUser) => (
                  <div
                    key={activeUser.id}
                    data-testid="active-user-card"
                    className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-2 relative"
                  >
                    {/* Online Indicator */}
                    <div className="absolute top-2 sm:top-3 md:top-4 left-2 sm:left-3 md:left-4 z-10 bg-green-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></span>
                      Online
                    </div>

                    <div className="relative h-48 sm:h-56 md:h-64 bg-gradient-to-br from-green-200 to-emerald-200">
                      {activeUser.profile_picture ? (
                        <img
                          src={activeUser.profile_picture}
                          alt={activeUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : activeUser.photos && activeUser.photos.length > 0 ? (
                        <img
                          src={activeUser.photos[0]}
                          alt={activeUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="w-20 h-20 text-white" />
                        </div>
                      )}
                      
                      {activeUser.verified && (
                        <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                          ✓ Verified
                        </div>
                      )}
                    </div>

                    <div className="p-3 sm:p-4 md:p-5">
                      <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-1 truncate">
                        {activeUser.name}, {activeUser.age}
                      </h3>
                      
                      <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 truncate">{activeUser.location}</p>

                      {activeUser.bio && (
                        <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4 line-clamp-2">
                          {activeUser.bio}
                        </p>
                      )}

                      <button
                        onClick={() => navigate(`/profile/${activeUser.id}`)}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-2 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-1 sm:gap-2 transition-all"
                      >
                        <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden xs:inline">View </span>Profile
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MatchesPage;
