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

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      console.log('🔍 Fetching user profile:', userId);
      const response = await axios.get(`${API}/api/profile/${userId}`);
      console.log('✅ Profile data:', response.data);
      setProfileUser(response.data);
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      toast.error('Failed to load profile');
      navigate('/matches');
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
      const response = await axios.post(`${API}/api/action/${user.id}`, {
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
      
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold">Back</span>
        </button>

        {/* Profile Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Profile Image */}
          <div className="relative h-96 bg-gradient-to-br from-pink-200 to-orange-200">
            {profileUser.profile_picture ? (
              <img
                src={profileUser.profile_picture}
                alt={profileUser.name}
                className="w-full h-full object-cover"
              />
            ) : profileUser.photos && profileUser.photos.length > 0 ? (
              <img
                src={profileUser.photos[0]}
                alt={profileUser.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Heart className="w-32 h-32 text-white opacity-50" />
              </div>
            )}
            
            {profileUser.verified && (
              <div className="absolute top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                ✓ Verified
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {profileUser.name}, {profileUser.age}
                </h1>
                
                {profileUser.location && (
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <MapPin className="w-5 h-5" />
                    <span>{profileUser.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {profileUser.bio && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">About</h3>
                <p className="text-gray-700 leading-relaxed">{profileUser.bio}</p>
              </div>
            )}

            {/* Interests */}
            {profileUser.interests && profileUser.interests.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {profileUser.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="px-4 py-2 bg-gradient-to-r from-pink-100 to-orange-100 text-pink-700 rounded-full text-sm font-medium"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => handleAction('pass')}
                disabled={actionLoading}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <X className="w-6 h-6" />
                Pass
              </button>

              <button
                onClick={() => handleAction('like')}
                disabled={actionLoading}
                className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Heart className="w-6 h-6" />
                Like
              </button>

              <button
                onClick={() => handleAction('superlike')}
                disabled={actionLoading}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Star className="w-6 h-6" />
                Super Like
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
