import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Sparkles, Users, Zap, Mail, Shield, AlertTriangle, X, CheckCircle, Share2, ArrowUpDown, Clock, Filter, Crown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { MatchCardSkeleton } from '@/components/SkeletonLoader';
import wsService from '@/services/WebSocketService';

import { BACKEND_URL, API } from '@/config/api';
if (!BACKEND_URL) {
  console.error('⚠️ REACT_APP_BACKEND_URL is not set!');
}

// Safety Message Modal Component
const SafetyMessageModal = ({ isOpen, onClose, onProceed }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" data-testid="safety-modal">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-bounce-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Safety First! 🛡️</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="space-y-4 mb-6">
          <p className="text-gray-700">
            Welcome to HeartLink messaging! Before you start chatting, please keep these safety tips in mind:
          </p>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                <strong>Never share</strong> personal info like phone number, address, or financial details until you trust someone.
              </p>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                <strong>Meet in public places</strong> for first dates and inform a friend or family member about your plans.
              </p>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">
                <strong>Report suspicious behavior</strong> immediately. If someone asks for money or seems fake, block and report them.
              </p>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onProceed}
            data-testid="safety-modal-proceed-btn"
            className="flex-1 bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all"
          >
            I Understand, Continue
          </button>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          Your safety is our priority. Chat responsibly! 💕
        </p>
      </div>
    </div>
  );
};

// Online Status Helper Function with 3 distinct colors
// 🟢 Dark Green = Online Now (within 5 minutes)
// 🟡 Yellow/Amber = Recently Active (5 mins to 24 hours)  
// ⚪ Gray = Offline (more than 24 hours or no data)
const getOnlineStatusInfo = (isOnline, lastActive) => {
  if (!lastActive && !isOnline) {
    return { color: 'bg-gray-400', label: 'Offline', textColor: 'text-gray-500', pulse: false };
  }
  
  const now = new Date();
  const lastSeenDate = new Date(lastActive);
  const diffMs = now - lastSeenDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  // Online now (within 5 minutes) - Dark Green with pulse
  if (isOnline || diffMins < 5) {
    return { color: 'bg-green-600', label: 'Online', textColor: 'text-green-600', pulse: true };
  }
  
  // Recently Active (5 mins to 24 hours) - Yellow/Amber
  if (diffHours < 24) {
    if (diffMins < 60) {
      return { color: 'bg-yellow-500', label: `${diffMins}m ago`, textColor: 'text-yellow-600', pulse: false };
    }
    return { color: 'bg-yellow-500', label: `${diffHours}h ago`, textColor: 'text-yellow-600', pulse: false };
  }
  
  // Offline (more than 24 hours) - Grey
  const diffDays = Math.floor(diffMs / 86400000);
  return { color: 'bg-gray-400', label: `${diffDays}d ago`, textColor: 'text-gray-500', pulse: false };
};

const MatchesPage = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [matches, setMatches] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [chatFilter, setChatFilter] = useState('recent');
  const [matchFilter, setMatchFilter] = useState('recent');
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  // Auto-switch to messages tab if navigated back from chat
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'matches');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [pendingChatId, setPendingChatId] = useState(null);

  // Filtered & sorted conversations based on chatFilter
  const filteredConversations = useMemo(() => {
    let list = [...conversations];
    switch (chatFilter) {
      case 'oldest':
        list.sort((a, b) => {
          const tA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at) : new Date(0);
          const tB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at) : new Date(0);
          return tA - tB;
        });
        break;
      case 'unread':
        list.sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0));
        break;
      case 'recent':
      default:
        // Already sorted newest-first from fetch
        break;
    }
    return list;
  }, [conversations, chatFilter]);

  // Filtered & sorted matches based on matchFilter
  const filteredMatches = useMemo(() => {
    let list = [...matches];
    switch (matchFilter) {
      case 'oldest':
        list.sort((a, b) => {
          const tA = a.created_at ? new Date(a.created_at) : new Date(0);
          const tB = b.created_at ? new Date(b.created_at) : new Date(0);
          return tA - tB;
        });
        break;
      case 'compatible':
        list.sort((a, b) => (b.compatibility_score || 0) - (a.compatibility_score || 0));
        break;
      case 'online':
        list.sort((a, b) => {
          const aOnline = a.user?.is_online ? 1 : 0;
          const bOnline = b.user?.is_online ? 1 : 0;
          return bOnline - aOnline;
        });
        break;
      case 'recent':
      default:
        list.sort((a, b) => {
          const tA = a.created_at ? new Date(a.created_at) : new Date(0);
          const tB = b.created_at ? new Date(b.created_at) : new Date(0);
          return tB - tA;
        });
        break;
    }
    return list;
  }, [matches, matchFilter]);

  // Check if user has seen safety message
  const hasSeenSafetyMessage = () => {
    return localStorage.getItem('heartlink_safety_message_seen') === 'true';
  };

  // Handle chat navigation with safety check
  const handleChatClick = (matchId) => {
    if (!hasSeenSafetyMessage()) {
      setPendingChatId(matchId);
      setShowSafetyModal(true);
    } else {
      navigate(`/chat/${matchId}`, { state: { fromTab: activeTab } });
    }
  };

  // Handle safety modal proceed
  const handleSafetyProceed = () => {
    localStorage.setItem('heartlink_safety_message_seen', 'true');
    setShowSafetyModal(false);
    if (pendingChatId) {
      navigate(`/chat/${pendingChatId}`, { state: { fromTab: activeTab } });
      setPendingChatId(null);
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

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const fetchMatches = async () => {
    try {
      const response = await axios.get(`${API}/matches/${user.id}`);
      setMatches(response.data);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API}/conversations/${user.id}`);
      const activeConversations = response.data || [];
      setConversations(activeConversations);
      const counts = {};
      activeConversations.forEach(conv => {
        counts[conv.match_id] = conv.unreadCount || 0;
      });
      setUnreadCounts(counts);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchActiveUsers = async () => {
    try {
      const response = await axios.get(`${API}/active-users/${user.id}`);
      setActiveUsers(response.data || []);
    } catch (error) {
      console.error('Failed to load active users:', error);
      setActiveUsers([]);
    }
  };

  // ── INITIAL LOAD: Fetch ALL data at once — no reload on tab switch ──
  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      try {
        const [matchRes, convRes, activeRes] = await Promise.allSettled([
          axios.get(`${API}/matches/${user.id}`),
          axios.get(`${API}/conversations/${user.id}`),
          axios.get(`${API}/active-users/${user.id}`),
        ]);
        if (cancelled) return;
        if (matchRes.status === 'fulfilled') setMatches(matchRes.value.data || []);
        if (convRes.status === 'fulfilled') {
          const convs = convRes.value.data || [];
          setConversations(convs);
          const counts = {};
          convs.forEach(c => { counts[c.match_id] = c.unreadCount || 0; });
          setUnreadCounts(counts);
        }
        if (activeRes.status === 'fulfilled') setActiveUsers(activeRes.value.data || []);
      } catch (e) {
        console.error('Load all failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [user.id]); // Only on mount / user change

  // ── REAL-TIME LISTENERS: WebSocket updates — no API refetch ──
  useEffect(() => {
    const unsubMatch = wsService.on('new_match', () => {
      fetchMatches();
      toast.success('New match! Check your matches tab');
    });
    
    const unsubMsg = wsService.on('new_message', (msg) => {
      if (!msg) return;
      setConversations(prev => {
        const idx = prev.findIndex(c => c.match_id === msg.match_id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            lastMessage: msg,
            unreadCount: msg.sender_id !== user.id ? (updated[idx].unreadCount || 0) + 1 : updated[idx].unreadCount,
            hasMessages: true,
          };
          updated.sort((a, b) => {
            const tA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at) : new Date(0);
            const tB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at) : new Date(0);
            return tB - tA;
          });
          return updated;
        }
        setTimeout(() => fetchConversations(), 200);
        return prev;
      });
      if (msg.sender_id !== user.id && msg.match_id) {
        setUnreadCounts(prev => ({
          ...prev,
          [msg.match_id]: (prev[msg.match_id] || 0) + 1
        }));
      }
    });
    
    const unsubStatus = wsService.on('status_update', (data) => {
      setMatches(prev => prev.map(m => 
        m.user?.id === data.user_id 
          ? { ...m, user: { ...m.user, is_online: data.is_online, last_active: data.last_active } }
          : m
      ));
      setConversations(prev => prev.map(c => 
        c.user?.id === data.user_id 
          ? { ...c, user: { ...c.user, is_online: data.is_online, last_active: data.last_active } }
          : c
      ));
      setActiveUsers(prev => prev.map(u =>
        u.id === data.user_id ? { ...u, is_online: data.is_online, last_active: data.last_active } : u
      ));
    });
    
    return () => {
      unsubMatch();
      unsubMsg();
      unsubStatus();
    };
    // eslint-disable-next-line
  }, [user.id]);

  // ── BACKGROUND SILENT REFRESH: every 30s, no loading indicator ──
  useEffect(() => {
    const silentRefresh = async () => {
      try {
        const [matchRes, convRes, activeRes] = await Promise.allSettled([
          axios.get(`${API}/matches/${user.id}`),
          axios.get(`${API}/conversations/${user.id}`),
          axios.get(`${API}/active-users/${user.id}`),
        ]);
        if (matchRes.status === 'fulfilled') setMatches(matchRes.value.data || []);
        if (convRes.status === 'fulfilled') {
          const convs = convRes.value.data || [];
          setConversations(convs);
          const counts = {};
          convs.forEach(c => { counts[c.match_id] = c.unreadCount || 0; });
          setUnreadCounts(counts);
        }
        if (activeRes.status === 'fulfilled') setActiveUsers(activeRes.value.data || []);
      } catch (e) { /* silent */ }
    };
    const interval = setInterval(silentRefresh, 30000);
    return () => clearInterval(interval);
  }, [user.id]); // eslint-disable-line

  // Refresh conversations when page becomes visible (coming back from chat)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchConversations();
        fetchMatches();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
    // eslint-disable-next-line
  }, []);

  // Calculate total unread messages
  const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((sum, count) => sum + count, 0), [unreadCounts]);

  if (loading && matches.length === 0 && conversations.length === 0 && activeUsers.length === 0) {
    // Only show full skeleton on FIRST load (no data yet)
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav">
        <TopBar />
        <Navbar user={user} />
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
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
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingTop: 'calc(var(--safe-top, 24px) + 60px)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 m3-animate-in">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--m3-on-surface)' }}>Connections</h1>
          <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>Your matches and active users</p>
        </div>

        {/* M3 Segmented Button Tabs */}
        <div className="flex gap-0 mb-4 sm:mb-6 rounded-full overflow-hidden" style={{ border: '1px solid var(--m3-outline-variant)' }}>
          <Button
            data-testid="tab-matches"
            onClick={() => setActiveTab('matches')}
            className="flex-1 py-2.5 sm:py-3.5 rounded-l-full rounded-r-none font-medium text-[11px] sm:text-sm transition-colors duration-100 px-1 sm:px-3"
            style={{
              background: activeTab === 'matches' ? 'var(--m3-primary-container)' : 'transparent',
              color: activeTab === 'matches' ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
              borderRight: '1px solid var(--m3-outline-variant)',
            }}
          >
            <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 inline" />
            <span className="hidden sm:inline">Matches</span>
            <span className="sm:hidden">Match</span>
            <span className="ml-0.5">({matches.length})</span>
          </Button>

          <Button
            data-testid="tab-messages"
            onClick={() => setActiveTab('messages')}
            className="relative flex-1 py-2.5 sm:py-3.5 rounded-none font-medium text-[11px] sm:text-sm transition-colors duration-100 px-1 sm:px-3"
            style={{
              background: activeTab === 'messages' ? 'var(--m3-primary-container)' : 'transparent',
              color: activeTab === 'messages' ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
              borderRight: '1px solid var(--m3-outline-variant)',
            }}
          >
            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 inline" />
            <span className="hidden sm:inline">Messages</span>
            <span className="sm:hidden">Chat</span>
            {totalUnread > 0 && (
              <span className="ml-0.5 bg-[#E53935] text-white text-[9px] sm:text-[10px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </Button>

          <Button
            data-testid="tab-active"
            onClick={() => setActiveTab('active')}
            className="flex-1 py-2.5 sm:py-3.5 rounded-r-full rounded-l-none font-medium text-[11px] sm:text-sm transition-colors duration-100 px-1 sm:px-3"
            style={{
              background: activeTab === 'active' ? 'var(--m3-primary-container)' : 'transparent',
              color: activeTab === 'active' ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
            }}
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 inline" />
            Active ({activeUsers.length})
          </Button>
        </div>

        {/* Matches Tab */}
        {activeTab === 'matches' && (
          <>
            {matches.length === 0 ? (
              <div className="text-center py-20 m3-animate-in">
                <div className="rounded-[28px] p-10 inline-block" style={{ background: 'var(--m3-surface-container-lowest)', boxShadow: 'var(--m3-elevation-2)' }}>
                  <Heart className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--m3-outline-variant)' }} />
                  <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--m3-on-surface)' }}>No Matches Yet</h2>
                  <p className="text-sm mb-6" style={{ color: 'var(--m3-on-surface-variant)' }}>Start swiping to find your match!</p>
                  <button onClick={() => navigate('/discover')}
                    className="text-white px-8 py-3 rounded-full font-semibold active:scale-[0.97] transition-all"
                    style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)', boxShadow: '0 2px 8px rgba(214,51,108,0.3)' }}>
                    Discover Profiles
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Match Filter Strip */}
                <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar" data-testid="match-filter-strip">
                  {[
                    { key: 'recent', label: 'Recent', icon: <Clock className="w-3.5 h-3.5" /> },
                    { key: 'oldest', label: 'Oldest', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                    { key: 'compatible', label: 'Best Match', icon: <Sparkles className="w-3.5 h-3.5" /> },
                    { key: 'online', label: 'Online', icon: <Zap className="w-3.5 h-3.5" /> },
                  ].map((f) => (
                    <button
                      key={f.key}
                      data-testid={`match-filter-${f.key}`}
                      onClick={() => setMatchFilter(f.key)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95"
                      style={{
                        background: matchFilter === f.key ? 'var(--m3-primary)' : 'var(--m3-surface-container-highest)',
                        color: matchFilter === f.key ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
                      }}
                    >
                      {f.icon}
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 m3-stagger">
                  {filteredMatches.map((match, index) => (
                  <div
                    key={match.match_id}
                    data-testid="match-card"
                    className="overflow-hidden transition-colors duration-100 transform hover:-translate-y-1 group"
                    style={{
                      background: 'var(--m3-surface-container-lowest)',
                      borderRadius: 'var(--m3-shape-lg)',
                      boxShadow: 'var(--m3-elevation-1)',
                    }}
                  >
                    <div className="relative h-48 sm:h-56 md:h-64" style={{ background: 'var(--m3-surface-container-high)' }}>
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
                          <Heart className="w-16 h-16" style={{ color: 'var(--m3-outline-variant)' }} />
                        </div>
                      )}
                      
                      {match.user.verified && (
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1"
                          style={{ background: 'rgba(59,130,246,0.9)', color: 'white', backdropFilter: 'blur(8px)' }}>
                          <CheckCircle className="w-3 h-3" /> Verified
                        </div>
                      )}
                      {match.user.is_premium && (
                        <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                          <Crown className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="text-base font-bold mb-1 truncate" style={{ color: 'var(--m3-on-surface)' }}>
                        {match.user.name}, {match.user.age}
                      </h3>
                      
                      {(() => {
                        const statusInfo = getOnlineStatusInfo(match.user.is_online, match.user.last_active);
                        return (
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className={`w-2 h-2 ${statusInfo.color} rounded-full ${statusInfo.pulse ? 'animate-pulse' : ''}`}></div>
                            <span className="text-[11px] font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
                              {statusInfo.label}
                            </span>
                          </div>
                        );
                      })()}
                      
                      {match.compatibility_score && (
                        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full w-fit"
                          style={{ background: 'var(--m3-primary-container)' }}>
                          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--m3-primary)' }} />
                          <span className="text-xs font-semibold" style={{ color: 'var(--m3-on-primary-container)' }}>
                            {match.compatibility_score.toFixed(0)}% Compatible
                          </span>
                        </div>
                      )}

                      {match.ai_analysis && (
                        <p className="text-xs mb-3 line-clamp-2 leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
                          {match.ai_analysis}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          data-testid="chat-btn"
                          onClick={() => handleChatClick(match.match_id)}
                          className="flex-1 text-white py-2.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                          style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)', boxShadow: '0 2px 8px rgba(214,51,108,0.3)' }}
                        >
                          <MessageCircle className="w-4 h-4" />
                          Chat
                        </button>
                        <button
                          data-testid="share-match-btn"
                          onClick={() => navigate('/share-match', { state: { matchData: match.user } })}
                          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                          style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}
                          title="Share Match"
                        >
                          <Share2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}
          </>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <>
            {conversations.length === 0 ? (
              <div className="text-center py-20 m3-animate-in">
                <div className="rounded-[28px] p-10 inline-block" style={{ background: 'var(--m3-surface-container-lowest)', boxShadow: 'var(--m3-elevation-2)' }}>
                  <Mail className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--m3-outline-variant)' }} />
                  <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--m3-on-surface)' }}>No Messages Yet</h2>
                  <p className="text-sm mb-6" style={{ color: 'var(--m3-on-surface-variant)' }}>Start chatting with your matches!</p>
                  <button onClick={() => setActiveTab('matches')}
                    className="text-white px-8 py-3 rounded-full font-semibold active:scale-[0.97] transition-all"
                    style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)', boxShadow: '0 2px 8px rgba(214,51,108,0.3)' }}>
                    View Matches
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Filter Strip */}
                <div className="flex items-center gap-2 mb-3" data-testid="chat-filter-strip">
                  {[
                    { key: 'recent', label: 'Recent', icon: <Clock className="w-3.5 h-3.5" /> },
                    { key: 'oldest', label: 'Oldest', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                    { key: 'unread', label: 'Unread', icon: <Filter className="w-3.5 h-3.5" /> },
                  ].map((f) => (
                    <button
                      key={f.key}
                      data-testid={`chat-filter-${f.key}`}
                      onClick={() => setChatFilter(f.key)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95"
                      style={{
                        background: chatFilter === f.key ? 'var(--m3-primary)' : 'var(--m3-surface-container-highest)',
                        color: chatFilter === f.key ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
                      }}
                    >
                      {f.icon}
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 m3-stagger">
                  {filteredConversations.map((conv, index) => {
                  const statusInfo = getOnlineStatusInfo(conv.user.is_online, conv.user.last_active);
                  
                  return (
                    <div
                      key={conv.match_id}
                      data-testid="message-card"
                      onClick={() => handleChatClick(conv.match_id)}
                      className={`overflow-hidden transition-all duration-200 cursor-pointer active:scale-[0.99] ${
                        conv.unreadCount > 0 ? 'ring-1.5 ring-offset-1' : ''
                      }`}
                      style={{
                        background: 'var(--m3-surface-container-lowest)',
                        borderRadius: 'var(--m3-shape-lg)',
                        boxShadow: conv.unreadCount > 0 ? 'var(--m3-elevation-2)' : 'var(--m3-elevation-1)',
                        ...(conv.unreadCount > 0 ? { ringColor: 'var(--m3-primary)' } : {}),
                      }}
                    >
                      <div className="flex items-center p-3.5">
                        {/* Profile Picture */}
                        <div className="relative flex-shrink-0">
                          <div className="w-14 h-14 rounded-full overflow-hidden" style={{ background: 'var(--m3-surface-container-high)' }}>
                            {conv.user.profile_picture ? (
                              <img src={conv.user.profile_picture} alt={conv.user.name} className="w-full h-full object-cover" />
                            ) : conv.user.photos && conv.user.photos.length > 0 ? (
                              <img src={conv.user.photos[0]} alt={conv.user.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Heart className="w-7 h-7" style={{ color: 'var(--m3-outline)' }} />
                              </div>
                            )}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusInfo.color} rounded-full ${statusInfo.pulse ? 'animate-pulse' : ''}`}
                            style={{ border: '2px solid var(--m3-surface-container-lowest)' }}></div>
                        </div>

                        {/* Message Content */}
                        <div className="flex-1 min-w-0 ml-3">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h3 className="font-bold text-sm truncate" style={{ color: 'var(--m3-on-surface)' }}>
                                {conv.user.name}, {conv.user.age}
                              </h3>
                              {conv.user.verified && (
                                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center" title="Verified">
                                  <CheckCircle className="w-3 h-3 text-white" />
                                </span>
                              )}
                              {conv.user.is_premium && (
                                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center" title="Premium">
                                  <Crown className="w-2.5 h-2.5 text-white" />
                                </span>
                              )}
                              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--m3-outline)' }}>
                                {statusInfo.label}
                              </span>
                            </div>
                            <span className="text-[11px] flex-shrink-0 ml-2 font-medium" style={{ color: 'var(--m3-outline)' }}>
                              {formatMessageTime(conv.lastMessage?.created_at)}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <p className="text-[13px] truncate" style={{ color: conv.unreadCount > 0 ? 'var(--m3-on-surface)' : 'var(--m3-on-surface-variant)', fontWeight: conv.unreadCount > 0 ? 600 : 400 }}>
                              {conv.lastMessage?.sender_id === user.id && (
                                <span style={{ color: 'var(--m3-primary)' }}>You: </span>
                              )}
                              {conv.lastMessage?.content || 'Start chatting...'}
                            </p>
                            
                            {conv.unreadCount > 0 ? (
                              <span className="ml-2 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center flex-shrink-0 px-1.5"
                                style={{ background: 'var(--m3-primary)' }}>
                                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                              </span>
                            ) : conv.lastMessage?.sender_id === user.id && conv.lastMessage?.created_at && (Date.now() - new Date(conv.lastMessage.created_at).getTime()) > 86400000 ? (
                              <span className="ml-2 text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                                data-testid="nudge-indicator"
                                style={{ background: 'linear-gradient(135deg, rgba(214,51,108,0.12), rgba(139,92,246,0.12))', color: '#D6336C' }}>
                                Nudge
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="ml-2" style={{ color: 'var(--m3-outline)' }}>
                          <MessageCircle className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </>
        )}

        {/* Active Users Tab */}
        {activeTab === 'active' && (
          <>
            {loading && activeUsers.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx}><MatchCardSkeleton /></div>
                ))}
              </div>
            ) : activeUsers.length === 0 ? (
              <div className="text-center py-20 m3-animate-in">
                <div className="rounded-[28px] p-10 inline-block" style={{ background: 'var(--m3-surface-container-lowest)', boxShadow: 'var(--m3-elevation-2)' }}>
                  <Users className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--m3-outline-variant)' }} />
                  <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--m3-on-surface)' }}>No Active Users</h2>
                  <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>No users active in the last 24 hours</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 m3-stagger">
                {activeUsers.map((activeUser) => (
                  <div
                    key={activeUser.id}
                    data-testid="active-user-card"
                    className="overflow-hidden transition-all duration-200 transform hover:-translate-y-1 relative active:scale-[0.98]"
                    style={{ background: 'var(--m3-surface-container-lowest)', borderRadius: 'var(--m3-shape-lg)', boxShadow: 'var(--m3-elevation-1)' }}
                  >
                    {/* Online/Active Indicator with Color Differentiation */}
                    {(() => {
                      const statusInfo = getOnlineStatusInfo(activeUser.is_online, activeUser.last_active);
                      const bgColor = statusInfo.color.replace('bg-', '');
                      return (
                        <div className={`absolute top-2 sm:top-3 md:top-4 left-2 sm:left-3 md:left-4 z-10 ${statusInfo.color} text-white px-2 sm:px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg`}>
                          <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full ${statusInfo.pulse ? 'animate-pulse' : ''}`}></span>
                          {statusInfo.label}
                        </div>
                      );
                    })()}

                    <div className="relative h-48 sm:h-56 md:h-64" style={{ background: 'var(--m3-surface-container-high)' }}>
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

                    <div className="p-4">
                      <h3 className="text-base font-bold mb-1 truncate" style={{ color: 'var(--m3-on-surface)' }}>
                        {activeUser.name}, {activeUser.age}
                      </h3>
                      
                      <p className="text-xs mb-2 truncate" style={{ color: 'var(--m3-on-surface-variant)' }}>{activeUser.location}</p>

                      {/* Last Active Time with color indicator */}
                      {(() => {
                        const statusInfo = getOnlineStatusInfo(activeUser.is_online, activeUser.last_active);
                        const emoji = statusInfo.color.includes('green') ? '🟢' : statusInfo.color.includes('yellow') ? '🟡' : '⚪';
                        return (
                          <p className={`text-xs ${statusInfo.textColor} mb-2 font-medium`}>
                            {emoji} {statusInfo.label}
                          </p>
                        );
                      })()}

                      {activeUser.bio && (
                        <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--m3-on-surface-variant)' }}>
                          {activeUser.bio}
                        </p>
                      )}

                      <button
                        onClick={() => navigate(`/profile/${activeUser.id}`)}
                        className="w-full text-white py-2.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
                        style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}
                      >
                        <Heart className="w-4 h-4" />
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
      
      {/* Safety Message Modal */}
      <SafetyMessageModal 
        isOpen={showSafetyModal} 
        onClose={() => setShowSafetyModal(false)} 
        onProceed={handleSafetyProceed} 
      />
    </div>
  );
};

export default MatchesPage;
