import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Sparkles, Users, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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
      const response = await axios.get(`${API}/matches/${user.id}`);
      setMatches(response.data);
      setLoading(false);
    } catch (error) {
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
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Matches</h1>
          <p className="text-gray-600">Connect with people who liked you back!</p>
        </div>

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
            {matches.map((match) => (
              <div
                key={match.match_id}
                data-testid="match-card"
                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-2 cursor-pointer"
                onClick={() => navigate(`/chat/${match.match_id}`)}
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
      </div>
    </div>
  );
};

export default MatchesPage;
