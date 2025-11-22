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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://heartlink-dating-1.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

const MatchesPage = ({ user }) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' or 'active'

  useEffect(() => {
    if (activeTab === 'matches') {
      fetchMatches();
    } else {
      fetchActiveUsers();
    }
  }, [activeTab]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav">
        <TopBar />
        <Navbar user={user} />
        <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
          <div className="mb-8 animate-slide-in-down">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Connections</h1>
            <p className="text-gray-600">Your matches and active users</p>
          </div>

          {/* Tabs skeleton */}
          <div className="flex gap-4 mb-8 animate-slide-in-up">
            <div className="flex-1 h-16 bg-gray-200 rounded-xl animate-shimmer"></div>
            <div className="flex-1 h-16 bg-gray-200 rounded-xl animate-shimmer"></div>
          </div>

          {/* Cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav">
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Connections</h1>
          <p className="text-gray-600">Your matches and active users</p>
        </div>

        {/* Enhanced Tabs */}
        <div className="flex gap-4 mb-8 animate-slide-in-up" style={{animationDelay: '0.2s'}}>
          <Button
            data-testid="tab-matches"
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-6 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'matches'
                ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow animate-glow'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-pink-300 hover-lift'
            }`}
          >
            <Heart className={`w-5 h-5 mr-2 inline ${activeTab === 'matches' ? 'animate-heart-beat' : ''}`} />
            My Matches ({matches.length})
          </Button>

          <Button
            data-testid="tab-active"
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-6 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-glow animate-glow'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-green-300 hover-lift'
            }`}
          >
            <Zap className={`w-5 h-5 mr-2 inline ${activeTab === 'active' ? 'animate-pulse' : ''}`} />
            Active Users ({activeUsers.length})
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map((match, index) => (
                  <div
                    key={match.match_id}
                    data-testid="match-card"
                    className="bg-white rounded-2xl shadow-soft overflow-hidden hover:shadow-elevated transition-all duration-500 transform hover:-translate-y-4 hover:scale-105 group hover-lift animate-bounce-in"
                    style={{animationDelay: `${index * 0.1}s`}}
                  >
                    <div className="relative h-64 bg-gradient-to-br from-pink-200 to-orange-200">
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

                    <div className="p-5">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {match.user.name}, {match.user.age}
                      </h3>
                      
                      {match.compatibility_score && (
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-pink-500" />
                          <span className="text-sm font-semibold text-pink-600">
                            {match.compatibility_score.toFixed(0)}% Compatible
                          </span>
                        </div>
                      )}

                      {match.ai_analysis && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {match.ai_analysis}
                        </p>
                      )}

                      <button
                        data-testid="chat-btn"
                        onClick={() => navigate(`/chat/${match.match_id}`)}
                        className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                      >
                        <MessageCircle className="w-5 h-5" />
                        Start Chat
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeUsers.map((activeUser) => (
                  <div
                    key={activeUser.id}
                    data-testid="active-user-card"
                    className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-2 relative"
                  >
                    {/* Online Indicator */}
                    <div className="absolute top-4 left-4 z-10 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      Online
                    </div>

                    <div className="relative h-64 bg-gradient-to-br from-green-200 to-emerald-200">
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

                    <div className="p-5">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {activeUser.name}, {activeUser.age}
                      </h3>
                      
                      <p className="text-sm text-gray-600 mb-3">{activeUser.location}</p>

                      {activeUser.bio && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {activeUser.bio}
                        </p>
                      )}

                      <button
                        onClick={() => navigate(`/profile/${activeUser.id}`)}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                      >
                        <Heart className="w-5 h-5" />
                        View Profile
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
