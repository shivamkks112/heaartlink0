import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, Toaster } from 'react-hot-toast';
import { Heart, X, Star, MapPin, Briefcase, GraduationCap, ArrowLeft, MessageCircle } from 'lucide-react';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import { API } from '@/config/api';


const UserProfilePage = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null); // { matched: true, match_id: '...' }

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      checkMatchStatus();
    }
  }, [userId]);

  const checkMatchStatus = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API}/conversations/${user.id}`);
      const convs = Array.isArray(res.data) ? res.data : (res.data.conversations || []);
      const found = convs.find(c => c.user?.id === userId);
      if (found) {
        setMatchInfo({ matched: true, match_id: found.match_id || found.id });
      }
    } catch (e) {
      // Silent — just show action buttons if check fails
    }
  };

  const fetchUserProfile = async () => {
    try {
      console.log('🔍 Fetching user profile:', userId);
      const response = await axios.get(`${API}/profile/${userId}`);
      console.log('✅ Profile data:', response.data);
      setProfileUser(response.data);
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      toast.error('Failed to load profile');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    if (!user || !user.id) {
      toast.error('Please login first');
      return;
    }

    setActionLoading(true);
    try {
      console.log(`💖 Sending ${action} to user:`, userId);
      const response = await axios.post(`${API}/action/${user.id}`, {
        target_user_id: userId,
        action: action
      });
      
      console.log('✅ Action response:', response.data);
      
      if (response.data.action === 'matched') {
        toast.success('🎉 It\'s a Match!');
        setTimeout(() => {
          navigate('/matches');
        }, 1500);
      } else if (action === 'like') {
        toast.success('💖 Like sent!');
      } else if (action === 'superlike') {
        toast.success('⭐ Super Like sent!');
      } else if (action === 'pass') {
        toast.success('Moved to next profile');
        navigate('/discover');
      }
    } catch (error) {
      console.error('❌ Action error:', error);
      toast.error(error.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav">
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-lg mx-auto pb-6">
        {/* Profile Image — full width, taller on mobile */}
        <div className="relative aspect-[3/4] max-h-[65vh] bg-gradient-to-br from-pink-200 to-orange-200">
          {/* Back Button overlay */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center"
            style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {profileUser.profile_picture ? (
            <img src={profileUser.profile_picture} alt={profileUser.name} className="w-full h-full object-cover" />
          ) : profileUser.photos && profileUser.photos.length > 0 ? (
            <img src={profileUser.photos[0]} alt={profileUser.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Heart className="w-24 h-24 text-white opacity-40" />
            </div>
          )}
          
          {profileUser.verified && (
            <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
              Verified
            </div>
          )}

          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
          
          {/* Name overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">{profileUser.name}, {profileUser.age}</h1>
            {profileUser.location && (
              <div className="flex items-center gap-1.5 text-white/90 text-sm mt-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{profileUser.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="px-4 pt-4 pb-2 space-y-4">
          {profileUser.bio && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">About</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{profileUser.bio}</p>
            </div>
          )}

          {profileUser.interests && profileUser.interests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Interests</h3>
              <div className="flex flex-wrap gap-1.5">
                {profileUser.interests.map((interest, index) => (
                  <span key={index} className="px-3 py-1 bg-pink-50 text-pink-700 rounded-full text-xs font-medium border border-pink-100">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Profile Prompts — Conversation Starters */}
          {profileUser.profile_prompts?.length > 0 && (
            <div data-testid="user-profile-prompts">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Conversation Starters</h3>
              <div className="space-y-2">
                {profileUser.profile_prompts.map((prompt, i) => (
                  <div key={i} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-3 py-2.5 border border-blue-100">
                    <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">{prompt.question}</p>
                    <p className="text-sm text-gray-800 mt-0.5 leading-snug">{prompt.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons — compact, rounded */}
        <div className="px-4 pt-2 pb-4">
          {matchInfo?.matched ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-center gap-2 py-2.5 bg-green-50 border border-green-200 rounded-xl">
                <Heart className="w-4 h-4 text-green-600 fill-green-600" />
                <span className="text-green-700 text-sm font-semibold">Already Matched</span>
              </div>
              <button
                onClick={() => navigate(`/chat/${matchInfo.match_id}`)}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
              >
                <MessageCircle className="w-4 h-4" />
                Chat
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleAction('pass')}
                disabled={actionLoading}
                className="w-14 h-14 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
              <button
                onClick={() => handleAction('like')}
                disabled={actionLoading}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                <Heart className="w-7 h-7 text-white fill-white" />
              </button>
              <button
                onClick={() => handleAction('superlike')}
                disabled={actionLoading}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                <Star className="w-6 h-6 text-white fill-white" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
