import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Sparkles, X, Check, User, Crown, Eye, Lock, Play, ArrowDownUp, Clock, TrendingUp } from 'lucide-react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import wsService from '@/services/WebSocketService';
import { API } from '@/config/api';
import { getPageData, setPageData } from '@/utils/pageCache';
import adsService from '@/services/AdsService';
import { toast } from 'sonner';


const LikesYouPage = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const _lc = getPageData('likes', user?.id);
  const [likes, setLikes] = useState(_lc?.likes || { regular_likes: [], super_likes: [], total_count: 0 });
  const [loading, setLoading] = useState(!_lc);
  const [processingId, setProcessingId] = useState(null);
  const [revealedProfiles, setRevealedProfiles] = useState([]);
  const [crushes, setCrushes] = useState(_lc?.crushes || { crushes: [], total: 0 });
  const [viewers, setViewers] = useState(_lc?.viewers || { viewers: [], total_views: 0, today_views: 0 });
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'name'
  
  // Check if user is premium (girls always premium)
  const isGirl = user?.gender?.toLowerCase() === 'female';
  const isPremium = user?.is_premium || user?.isPremium || isGirl;

  useEffect(() => {
    // Fetch all data in parallel
    Promise.allSettled([fetchLikes(), fetchCrushes(), fetchViewers()]).then(([l, c, v]) => {
      setLoading(false);
      const prev = getPageData('likes', user.id) || {};
      setPageData('likes', { likes: l.value || prev.likes, crushes: c.value || prev.crushes, viewers: v.value || prev.viewers }, user.id);
    });
    fetch(`${API}/likes/${user.id}/mark-seen`, { method: 'POST' }).catch(() => {});
    const revealed = JSON.parse(localStorage.getItem('heartlink_revealed_likes') || '[]');
    setRevealedProfiles(revealed);
    const unsubLike = wsService.on('new_like', () => { fetchLikes(); });
    return () => unsubLike();
  }, [user.id]);

  const fetchLikes = async () => {
    try {
      const response = await fetch(`${API}/likes/${user.id}`);
      const data = await response.json();
      setLikes(data);
      return data;
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  };

  const fetchCrushes = async () => {
    try {
      const res = await axios.get(`${API}/crushes/${user.id}`);
      setCrushes(res.data);
      return res.data;
    } catch (e) {
      console.error('Error fetching crushes:', e);
    }
  };

  const fetchViewers = async () => {
    try {
      const res = await axios.get(`${API}/profile-viewers/${user.id}`);
      setViewers(res.data);
      return res.data;
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
    // Optimistic UI — remove card INSTANTLY, don't wait for API
    setLikes(prev => ({
      ...prev,
      regular_likes: prev.regular_likes.filter(u => u.id !== targetUserId),
      super_likes: prev.super_likes.filter(u => u.id !== targetUserId),
      total_count: Math.max(0, prev.total_count - 1)
    }));

    try {
      const response = await fetch(`${API}/action/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId, action })
      });
      const result = await response.json();
      
      if (result.action === 'matched') {
        navigate('/matches', { replace: true });
      }
    } catch (error) {
      console.error('Like action failed:', error);
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

  const displayedLikes = useMemo(() => {
    const list = getDisplayedLikes();
    if (sortBy === 'recent') {
      return [...list].sort((a, b) => {
        const tA = a.liked_at || a.last_active || a.created_at || '';
        const tB = b.liked_at || b.last_active || b.created_at || '';
        return tB.localeCompare(tA);
      });
    }
    return list;
  }, [likes, activeTab, sortBy]); // eslint-disable-line
  
  const [revealingId, setRevealingId] = useState(null);
  const revealWithAd = async (likerId) => {
    setRevealingId(likerId);
    const result = await adsService.showRewardedForSwipes(async (reward) => {
      if (!reward.success) return;
      try {
        await axios.post(`${API}/likes/${user.id}/reveal`, { liker_id: likerId });
        await fetchLikes();
        toast.success('Profile reveal ho gaya!');
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Reveal nahi hua, try again');
      }
    });
    if (!result.success && result.error) toast.error(result.error);
    setRevealingId(null);
  };

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
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
      {/* Compact Header */}
      <div className="z-40" style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)', paddingTop: 'calc(var(--safe-top, 24px) + 8px)' }}>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          {/* Title Row */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/discover')}
              className="p-2 -ml-1 rounded-full active:bg-white/20 transition-colors"
              data-testid="likes-back-btn"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Likes You
            </h1>
            {likes.total_count > 0 && (
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{likes.total_count}</span>
            )}
          </div>

          {/* Filter Chips — fit to screen width */}
          <div className="flex gap-1.5 pb-1">
            {[
              { key: 'all', label: 'All', count: likes.total_count, icon: null },
              { key: 'super', label: 'Super', count: likes.super_likes.length, icon: Sparkles },
              { key: 'regular', label: 'Regular', count: likes.regular_likes.length, icon: Heart },
              { key: 'crushes', label: 'Crush', count: crushes.total, icon: null },
              { key: 'viewers', label: 'Views', count: viewers.total_views, icon: Eye },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`tab-${tab.key}`}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-white text-[#D6336C] shadow-md'
                    : 'bg-white/15 text-white/90 active:bg-white/25'
                }`}
              >
                {tab.icon && <tab.icon className="w-3 h-3" />}
                {tab.label}
                {tab.count > 0 && <span className={`text-[9px] font-bold ${activeTab === tab.key ? 'text-[#D6336C]/70' : 'text-white/60'}`}>{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sort Bar — only on likes tabs */}
      {(activeTab === 'all' || activeTab === 'super' || activeTab === 'regular') && displayedLikes.length > 1 && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="flex items-center justify-end gap-2" data-testid="sort-bar">
            <ArrowDownUp className="w-3.5 h-3.5 text-gray-400" />
            <button
              onClick={() => setSortBy('recent')}
              data-testid="sort-recent"
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                sortBy === 'recent'
                  ? 'bg-pink-100 text-pink-700 shadow-sm'
                  : 'bg-white/80 text-gray-500'
              }`}
            >
              <Clock className="w-3 h-3" /> Recent
            </button>
            <button
              onClick={() => setSortBy('default')}
              data-testid="sort-default"
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                sortBy === 'default'
                  ? 'bg-pink-100 text-pink-700 shadow-sm'
                  : 'bg-white/80 text-gray-500'
              }`}
            >
              <TrendingUp className="w-3 h-3" /> Default
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
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
                      <img src={crush.user.profile_picture} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
                    <button onClick={() => navigate('/premium')} className="px-3 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl text-xs font-bold" data-testid="reveal-crush-btn">
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
                        <img src={v.user.profile_picture} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
                <button onClick={() => navigate('/premium')} className="mt-3 px-6 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl font-bold text-sm" data-testid="premium-viewers-btn">
                  Get Premium — ₹49/mo
                </button>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-3" data-testid="likes-skeleton">
            {[0, 1, 2, 3].map(k => (
              <div key={k} className="aspect-[3/4] rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : displayedLikes.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)' }}>
              <Heart className="w-9 h-9 text-pink-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1.5">No likes yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-[240px] mx-auto">Keep swiping to find your match!</p>
            <button
              onClick={() => navigate('/discover')}
              data-testid="start-discovering-btn"
              className="px-6 py-3 text-white rounded-full font-semibold text-sm active:scale-95 transition-transform shadow-lg shadow-pink-200"
              style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)' }}
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
            
            <div className="grid grid-cols-2 gap-3">
              {displayedLikes.map((likedUser, index) => {
                const isLocked = !isPremium && !likedUser.revealed;
                return (
                  <div
                    key={likedUser.id}
                    className="relative bg-white rounded-2xl shadow-md overflow-hidden"
                    style={{ animation: `slideIn 0.2s ease-out ${index * 0.05}s both` }}
                  >
                    {/* Photo */}
                    <div className="relative aspect-[3/4] overflow-hidden">
                      {likedUser.profile_picture ? (
                        <img
                          src={likedUser.profile_picture}
                          alt={isLocked ? "Someone" : likedUser.name}
                          className="w-full h-full object-cover"
                          style={isLocked ? { filter: 'blur(20px)', transform: 'scale(1.1)' } : {}}
                          loading="lazy" decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-pink-200 via-rose-200 to-orange-200 flex items-center justify-center">
                          <User className="w-12 h-12 text-white/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
                            <Lock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                            <p className="text-white font-bold text-[10px]">Premium</p>
                          </div>
                        </div>
                      )}

                      {!isLocked && likedUser.verified && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full">
                          <Check className="w-3 h-3" />
                        </div>
                      )}

                      {/* Name + Status overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="text-white font-bold text-sm truncate">
                          {isLocked ? '???' : `${likedUser.name}, ${likedUser.age}`}
                        </h3>
                        {!isLocked && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${likedUser.is_online ? 'bg-green-400' : 'bg-white/50'}`} />
                            <span className="text-[10px] text-white/80">
                              {likedUser.is_online ? 'Online' : 'Active recently'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons — compact */}
                    {isLocked ? (
                      <div className="flex">
                        <button
                          onClick={() => revealWithAd(likedUser.id)}
                          disabled={revealingId === likedUser.id}
                          className="flex-1 py-2.5 text-[11px] font-bold text-pink-600 bg-pink-50 flex items-center justify-center gap-1 border-r border-white disabled:opacity-60"
                          data-testid={`reveal-ad-${likedUser.id}`}
                        >
                          <Play className="w-3.5 h-3.5" /> {revealingId === likedUser.id ? '...' : 'Watch Ad'}
                        </button>
                        <button
                          onClick={() => navigate('/premium')}
                          className="flex-1 py-2.5 text-[11px] font-bold text-amber-700 bg-amber-50 flex items-center justify-center gap-1"
                          data-testid={`unlock-like-${likedUser.id}`}
                        >
                          <Crown className="w-3.5 h-3.5" /> Unlock
                        </button>
                      </div>
                    ) : (
                      <div className="flex">
                        <button
                          onClick={() => handleAction(likedUser.id, 'pass')}
                          disabled={processingId === likedUser.id}
                          data-testid={`pass-btn-${likedUser.id}`}
                          className="flex-1 py-2.5 text-xs font-medium text-gray-400 flex items-center justify-center gap-1 border-r border-gray-100 active:bg-gray-50"
                        >
                          <X className="w-3.5 h-3.5" /> Pass
                        </button>
                        <button
                          onClick={() => (isPremium ? handleAction(likedUser.id, 'like_back') : navigate('/premium'))}
                          disabled={processingId === likedUser.id}
                          data-testid={`like-back-btn-${likedUser.id}`}
                          className="flex-1 py-2.5 text-xs font-bold text-emerald-600 flex items-center justify-center gap-1 active:bg-emerald-50"
                        >
                          <Heart className="w-3.5 h-3.5 fill-emerald-500" /> Like
                        </button>
                      </div>
                    )}
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
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Bottom Navigation */}
      <Navbar user={user} />
    </div>
  );
};

export default LikesYouPage;
