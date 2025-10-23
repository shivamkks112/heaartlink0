import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, X, Sparkles, MapPin, Award, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://heartlink-app-4.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

const DiscoverPage = ({ user }) => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    fetchProfiles();
  }, []);

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

  const handleAction = async (action) => {
    if (profiles.length === 0) return;
    
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
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
        <Navbar user={user} />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="bg-white rounded-3xl p-12 shadow-xl">
            <Heart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-4">No More Profiles</h2>
            <p className="text-gray-600 mb-6">Check back later for new matches!</p>
            <Button
              onClick={() => navigate('/matches')}
              className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-4 rounded-full"
            >
              View Your Matches
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const photos = currentProfile.photos || [];
  const hasMultiplePhotos = photos.length > 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav">
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <div className="bg-white rounded-3xl shadow-elevated overflow-hidden relative hover-lift transition-all duration-300" data-testid="profile-card">
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
            </div>
            
            {currentProfile.location && (
              <div className="flex items-center gap-2 text-gray-600 mb-4">
                <MapPin className="w-4 h-4" />
                <span>{currentProfile.location}</span>
              </div>
            )}

            {currentProfile.bio && (
              <p className="text-gray-700 mb-4 leading-relaxed">{currentProfile.bio}</p>
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
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage;
