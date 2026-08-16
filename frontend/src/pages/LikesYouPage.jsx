import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Sparkles, X, Check, User, Crown, Eye, Lock, Play } from 'lucide-react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import SeeWhoLikedYouCard from '@/components/ads/SeeWhoLikedYouCard';
import { useAds } from '@/context/AdContext';
import { Button } from '@/components/ui/button';
import wsService from '@/services/WebSocketService';
import { API } from '@/config/api';


const LikesYouPage = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [likes, setLikes] = useState({ regular_likes: [], super_likes: [], total_count: 0 });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [revealedProfiles, setRevealedProfiles] = useState([]);
  const [crushes, setCrushes] = useState({ crushes: [], total: 0 });
  const [viewers, setViewers] = useState({ viewers: [], total_views: 0, today_views: 0 });
  
  // Ad context
  const { isEligible } = useAds();
  
  // Check if user is premium
  const isPremium = user?.is_premium || user?.isPremium;

  useEffect(() => {
    fetchLikes();
    fetchCrushes();
    fetchViewers();
    // Load revealed profiles from localStorage
    const revealed = JSON.parse(localStorage.getItem('heartlink_revealed_likes') || '[]');
    setRevealedProfiles(revealed);
    
    // Listen for new likes in real-time
    const unsubLike = wsService.on('new_like', () => {
      fetchLikes(); // Refresh likes list
    });
    
    return () => unsubLike();
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

  const fetchCrushes = async () => {
    try {
      const res = await axios.get(`${API}/crushes/${user.id}`);
      setCrushes(res.data);
    } catch (e) {
      console.error('Error fetching crushes:', e);
    }
  };

  const fetchViewers = async () => {
    try {
      const res = await axios.get(`${API}/profile-viewers/${user.id}`);
      setViewers(res.data);
    } catch (e) {
      console.error('Error fetching viewers:', e);
    }
  };

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

  const handleAction = async (targetUserId, action) => {
    try {
      setProcessingId(targetUserId);
      const response = await fetch(`${API}/action/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId, action })
      });
      
      const result = await response.json();
      
      // Always remove from list after action (like or pass)
      setLikes(prev => ({
        ...prev,
        regular_likes: prev.regular_likes.filter(u => u.id !== targetUserId),
        super_likes: prev.super_likes.filter(u => u.id !== targetUserId),
        total_count: prev.total_count - 1
      }));
      
      if (result.action === 'matched') {
        // Show match celebration
        alert(`🎉 It's a Match! Compatibility: ${result.compatibility_score}%`);
        navigate('/matches');
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
  
  // Handle profile reveal after watching ad
  const handleProfileReveal = (profileId) => {
    const newRevealed = [...revealedProfiles, profileId];
    setRevealedProfiles(newRevealed);
    localStorage.setItem('heartlink_revealed_likes', JSON.stringify(newRevealed));
  };
  
  // Check if profile is revealed
  const isProfileRevealed = (profileId) => {
    return isPremium || revealedProfiles.includes(profileId);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingTop: 'calc(var(--safe-top, 24px) + 60px)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
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
            
            <button
              onClick={() => setActiveTab('crushes')}
              data-testid="crushes-tab"
              className={`flex-1 py-3 px-4 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                activeTab === 'crushes'
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-300'
                  : 'bg-white/70 text-gray-600 hover:bg-white'
              }`}
            >
              Crush
              {crushes.total > 0 && <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-white/30">{crushes.total}</span>}
            </button>
            
            <button
              onClick={() => setActiveTab('viewers')}
              data-testid="viewers-tab"
              className={`flex-1 py-3 px-4 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                activeTab === 'viewers'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-300'
                  : 'bg-white/70 text-gray-600 hover:bg-white'
              }`}
            >
              <Eye className="inline w-4 h-4 mr-1" />
              Views
              {viewers.total_views > 0 && <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-white/30">{viewers.total_views}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Crushes Tab */}
        {activeTab === 'crushes' ? (
          <div className="space-y-4" data-testid="crushes-content">
            {crushes.crushes.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center">
                  <Heart className="w-12 h-12 text-orange-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No crushes yet</h3>
                <p className="text-gray-600">Jab koi tumhe Crush karega, yahan dikhega!</p>
              </div>
            ) : (
              crushes.crushes.map((crush) => (
                <div key={crush.crush_id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4" data-testid={`crush-card-${crush.crush_id}`}>
                  <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-200 to-red-200 flex-shrink-0">
                    {crush.is_mutual ? (
                      <img src={crush.user.profile_picture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {crush.user.profile_picture ? (
                          <img src={crush.user.profile_picture} alt="" className="w-full h-full object-cover" style={{ filter: 'blur(12px)' }} />
                        ) : (
                          <User className="w-8 h-8 text-orange-400" />
                        )}
                        {!crush.is_mutual && <Lock className="absolute bottom-0 right-0 w-5 h-5 text-white bg-orange-500 rounded-full p-0.5" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">
                        {crush.is_mutual ? crush.user.name : `${crush.user.name[0]}***`}
                      </p>
                      {crush.is_mutual && (
                        <span className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs rounded-full font-bold">Mutual!</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {crush.is_mutual ? `${crush.user.age}, ${crush.user.location}` : 'Upgrade to Premium to reveal'}
                    </p>
                  </div>
                  {!crush.is_mutual && (
                    <button className="px-3 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-xs font-bold" data-testid="reveal-crush-btn">
                      <Crown className="w-3 h-3 inline mr-1" /> Reveal
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'viewers' ? (
          /* Viewers Tab */
          <div className="space-y-4" data-testid="viewers-content">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-blue-600">{viewers.total_views}</p>
                <p className="text-xs text-gray-500">Total Views</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-green-600">{viewers.today_views}</p>
                <p className="text-xs text-gray-500">Today</p>
              </div>
            </div>
            {viewers.viewers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                  <Eye className="w-12 h-12 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No profile views yet</h3>
                <p className="text-gray-600">Jaise hi koi tumhari profile dekhega, yahan dikhega!</p>
              </div>
            ) : (
              viewers.viewers.map((v, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4" data-testid={`viewer-card-${i}`}>
                  <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-blue-200 to-indigo-200 flex-shrink-0">
                    {v.locked ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-7 h-7 text-blue-400" />
                        <Lock className="absolute bottom-0 right-0 w-4 h-4 text-white bg-blue-500 rounded-full p-0.5" />
                      </div>
                    ) : (
                      v.user.profile_picture ? (
                        <img src={v.user.profile_picture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-7 h-7 text-blue-400" />
                        </div>
                      )
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{v.user.name}{v.user.age ? `, ${v.user.age}` : ''}</p>
                    <p className="text-xs text-gray-500">{v.user.location || ''}</p>
                  </div>
                  {v.locked && (
                    <button className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-xs font-bold" data-testid="unlock-viewer-btn">
                      <Crown className="w-3 h-3 inline mr-1" /> Unlock
                    </button>
                  )}
                </div>
              ))
            )}
            {viewers.viewers.some(v => v.locked) && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 text-center">
                <Crown className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="font-bold text-gray-900">Upgrade to Premium</p>
                <p className="text-sm text-gray-600 mt-1">Dekho kisne tumhari profile dekhi — full names, photos & more!</p>
                <button className="mt-3 px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-bold text-sm" data-testid="premium-viewers-btn">
                  Coming Soon
                </button>
              </div>
            )}
          </div>
        ) : loading ? (
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
          <>
            {/* Premium Banner - HIDDEN FOR NOW */}
            {/* {!isPremium && isEligible && displayedLikes.length > 0 && (
              <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-2 rounded-full">
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Sab dekho bina ad ke!</p>
                      <p className="text-sm text-gray-600">Premium me unlimited access</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate('/premium')}
                    className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-semibold"
                    data-testid="premium-banner-btn"
                  >
                    Upgrade
                  </Button>
                </div>
              </div>
            )} */}
            
            <div className="grid gap-4">
              {displayedLikes.map((likedUser, index) => {
                // Show normal card for all users - no premium restriction
                return (
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
                        
                        {/* Online Status */}
                        {likedUser.is_online ? (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
                            <span className="text-xs text-green-300 font-semibold">Online now</span>
                          </div>
                        ) : likedUser.last_active && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                            <span className="text-xs text-white/80">
                              Active {formatLastSeen(likedUser.last_active)}
                            </span>
                          </div>
                        )}
                        
                        {likedUser.location && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-orange-400">📍</span>
                            <span className="text-sm text-white/90 font-medium">{likedUser.location}</span>
                          </div>
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
                        data-testid={`pass-btn-${likedUser.id}`}
                      >
                        <X className="w-6 h-6" />
                        Pass
                      </button>
                      
                      <button
                        onClick={() => handleAction(likedUser.id, 'like')}
                        disabled={processingId === likedUser.id}
                        className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-2xl font-semibold text-lg transition-all shadow-lg shadow-pink-300 disabled:opacity-50 flex items-center justify-center gap-2 group-hover:scale-105"
                        data-testid={`like-btn-${likedUser.id}`}
                      >
                        <Heart className="w-6 h-6 fill-current" />
                        Like Back
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
