import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Sparkles, X, Check, User } from 'lucide-react';
import Navbar from '@/components/Navbar';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const LikesYouPage = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [likes, setLikes] = useState({ regular_likes: [], super_likes: [], total_count: 0 });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchLikes();
  }, [user.id]);

  const fetchLikes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/likes/${user.id}`);
      const data = await response.json();
      setLikes(data);
    } catch (error) {
      console.error('Error fetching likes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (targetUserId, action) => {
    try {
      setProcessingId(targetUserId);
      const response = await fetch(`${API}/action/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId, action })
      });
      
      const result = await response.json();
      
      if (result.action === 'matched') {
        // Show match celebration
        alert(`🎉 It's a Match! Compatibility: ${result.compatibility_score}%`);
        navigate('/matches');
      } else {
        // Remove from list
        setLikes(prev => ({
          ...prev,
          regular_likes: prev.regular_likes.filter(u => u.id !== targetUserId),
          super_likes: prev.super_likes.filter(u => u.id !== targetUserId),
          total_count: prev.total_count - 1
        }));
      }
    } catch (error) {
      console.error('Error handling action:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getDisplayedLikes = () => {
    if (activeTab === 'all') {
      return [...likes.super_likes, ...likes.regular_likes];
    } else if (activeTab === 'super') {
      return likes.super_likes;
    } else {
      return likes.regular_likes;
    }
  };

  const displayedLikes = getDisplayedLikes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-20 sm:pb-24 pt-16">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-pink-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/discover')}
              className="p-2 hover:bg-pink-100 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
              Likes You
            </h1>
            
            <div className="w-10" /> {/* Spacer */}
          </div>

          {/* Modern Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-3 px-4 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                activeTab === 'all'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-300'
                  : 'bg-white/70 text-gray-600 hover:bg-white'
              }`}
            >
              All
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/30">
                {likes.total_count}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('super')}
              className={`flex-1 py-3 px-4 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                activeTab === 'super'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-300'
                  : 'bg-white/70 text-gray-600 hover:bg-white'
              }`}
            >
              <Sparkles className="inline w-4 h-4 mr-1" />
              Super
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/30">
                {likes.super_likes.length}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('regular')}
              className={`flex-1 py-3 px-4 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                activeTab === 'regular'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-300'
                  : 'bg-white/70 text-gray-600 hover:bg-white'
              }`}
            >
              <Heart className="inline w-4 h-4 mr-1" />
              Regular
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/30">
                {likes.regular_likes.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 sm:pb-28">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
          </div>
        ) : displayedLikes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-pink-100 to-rose-100 rounded-full flex items-center justify-center">
              <Heart className="w-12 h-12 text-pink-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No likes yet</h3>
            <p className="text-gray-600">Keep swiping to find your match!</p>
            <button
              onClick={() => navigate('/discover')}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-semibold hover:shadow-lg transition-all"
            >
              Start Discovering
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedLikes.map((likedUser, index) => (
              <div
                key={likedUser.id}
                className="group relative bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                style={{
                  animation: `slideIn 0.3s ease-out ${index * 0.1}s both`
                }}
              >
                {/* Background Image with Gradient Overlay */}
                <div className="relative h-64 overflow-hidden">
                  {likedUser.profile_picture ? (
                    <img
                      src={likedUser.profile_picture}
                      alt={likedUser.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-200 via-rose-200 to-orange-200 flex items-center justify-center">
                      <User className="w-20 h-20 text-white/50" />
                    </div>
                  )}
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  {/* Verified Badge */}
                  {likedUser.verified && (
                    <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                      <Check className="w-3 h-3" />
                      Verified
                    </div>
                  )}
                  
                  {/* User Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="text-2xl font-bold mb-1">
                      {likedUser.name}, {likedUser.age}
                    </h3>
                    {likedUser.location && (
                      <p className="text-sm text-white/90 mb-2">📍 {likedUser.location}</p>
                    )}
                    {likedUser.bio && (
                      <p className="text-sm text-white/80 line-clamp-2">{likedUser.bio}</p>
                    )}
                  </div>
                </div>

                {/* Interests */}
                {likedUser.interests && likedUser.interests.length > 0 && (
                  <div className="px-6 py-3 border-b border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {likedUser.interests.slice(0, 5).map((interest, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-pink-50 text-pink-600 rounded-full text-xs font-medium"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="p-6 flex gap-4">
                  <button
                    onClick={() => handleAction(likedUser.id, 'pass')}
                    disabled={processingId === likedUser.id}
                    className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-semibold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 group-hover:scale-105"
                  >
                    <X className="w-6 h-6" />
                    Pass
                  </button>
                  
                  <button
                    onClick={() => handleAction(likedUser.id, 'like')}
                    disabled={processingId === likedUser.id}
                    className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-2xl font-semibold text-lg transition-all shadow-lg shadow-pink-300 disabled:opacity-50 flex items-center justify-center gap-2 group-hover:scale-105"
                  >
                    <Heart className="w-6 h-6 fill-current" />
                    Like Back
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Bottom Navigation */}
      <Navbar user={user} />
    </div>
  );
};

export default LikesYouPage;
