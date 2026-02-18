import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Sparkles, Users, Zap, Mail, Shield, AlertTriangle, X } from 'lucide-react';
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

// Safety Message Modal Component
const SafetyMessageModal = ({ isOpen, onClose, onProceed }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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

// Online Status Helper Function
const getOnlineStatusInfo = (isOnline, lastActive) => {
  if (!lastActive && !isOnline) {
    return { color: 'bg-gray-400', label: 'Offline', textColor: 'text-gray-500' };
  }
  
  const now = new Date();
  const lastSeenDate = new Date(lastActive);
  const diffMs = now - lastSeenDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  // Online now (within 5 minutes) - Dark Green
  if (isOnline || diffMins < 5) {
    return { color: 'bg-green-600', label: 'Online', textColor: 'text-green-600', pulse: true };
  }
  
  // Active same day (within 24 hours) - Light Green
  if (diffHours < 24) {
    return { color: 'bg-green-400', label: `${diffHours}h ago`, textColor: 'text-green-500', pulse: false };
  }
  
  // Older - Grey
  const diffDays = Math.floor(diffMs / 86400000);
  return { color: 'bg-gray-400', label: `${diffDays}d ago`, textColor: 'text-gray-500', pulse: false };
};

const MatchesPage = ({ user }) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches', 'messages', or 'active'
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [pendingChatId, setPendingChatId] = useState(null);

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
      navigate(`/chat/${matchId}`);
    }
  };

  // Handle safety modal proceed
  const handleSafetyProceed = () => {
    localStorage.setItem('heartlink_safety_message_seen', 'true');
    setShowSafetyModal(false);
    if (pendingChatId) {
      navigate(`/chat/${pendingChatId}`);
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
    setLoading(true);
    try {
      console.log('🔍 Fetching matches for user:', user.id);
      const response = await axios.get(`${API}/matches/${user.id}`);
      console.log('✅ Matches API Response:', response.data);
      setMatches(response.data);
      setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching matches:', error);
      toast.error('Failed to load matches');
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    setLoading(true);
    try {
      // Get all matches first
      const matchesResponse = await axios.get(`${API}/matches/${user.id}`);
      const allMatches = matchesResponse.data;
      
      // For each match, get the last message
      const conversationsWithMessages = await Promise.all(
        allMatches.map(async (match) => {
          try {
            const messagesResponse = await axios.get(`${API}/messages/${match.match_id}?limit=1`);
            const messages = messagesResponse.data;
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            
            // Count unread messages
            const unreadResponse = await axios.get(`${API}/messages/${match.match_id}/unread-count/${user.id}`);
            const unreadCount = unreadResponse.data?.count || 0;
            
            return {
              ...match,
              lastMessage,
              unreadCount,
              hasMessages: messages.length > 0
            };
          } catch (error) {
            return {
              ...match,
              lastMessage: null,
              unreadCount: 0,
              hasMessages: false
            };
          }
        })
      );
      
      // Filter to only show conversations with messages and sort by last message time
      const activeConversations = conversationsWithMessages
        .filter(conv => conv.hasMessages)
        .sort((a, b) => {
          const timeA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at) : new Date(0);
          const timeB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at) : new Date(0);
          return timeB - timeA;
        });
      
      setConversations(activeConversations);
      
      // Store unread counts
      const counts = {};
      activeConversations.forEach(conv => {
        counts[conv.match_id] = conv.unreadCount;
      });
      setUnreadCounts(counts);
      
      setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
      toast.error('Failed to load messages');
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
    } else if (activeTab === 'messages') {
      fetchConversations();
    } else {
      fetchActiveUsers();
    }
    // eslint-disable-next-line
  }, [activeTab]);

  // Refresh conversations when page becomes visible (e.g., coming back from chat)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeTab === 'messages') {
        fetchConversations();
      }
    };
    
    const handleFocus = () => {
      if (activeTab === 'messages') {
        fetchConversations();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
    // eslint-disable-next-line
  }, [activeTab]);

  // Calculate total unread messages
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

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
        <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6 md:mb-8 animate-slide-in-up" style={{animationDelay: '0.2s'}}>
          <Button
            data-testid="tab-matches"
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 ${
              activeTab === 'matches'
                ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
            }`}
          >
            <Heart className={`w-4 h-4 mr-1 inline ${activeTab === 'matches' ? 'animate-heart-beat' : ''}`} />
            Matches ({matches.length})
          </Button>

          <Button
            data-testid="tab-messages"
            onClick={() => setActiveTab('messages')}
            className={`relative flex-1 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 ${
              activeTab === 'messages'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
            }`}
          >
            <Mail className={`w-4 h-4 mr-1 inline ${activeTab === 'messages' ? 'animate-pulse' : ''}`} />
            Messages
            {totalUnread > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </Button>

          <Button
            data-testid="tab-active"
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
            }`}
          >
            <Zap className={`w-4 h-4 mr-1 inline ${activeTab === 'active' ? 'animate-pulse' : ''}`} />
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
                        onClick={() => handleChatClick(match.match_id)}
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

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <>
            {conversations.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-white rounded-3xl p-12 shadow-xl inline-block">
                  <Mail className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">No Messages Yet</h2>
                  <p className="text-gray-600 mb-6">Start chatting with your matches!</p>
                  <button
                    onClick={() => setActiveTab('matches')}
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-8 py-4 rounded-full font-semibold hover:scale-105 transition-all"
                  >
                    View Matches
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map((conv, index) => {
                  const statusInfo = getOnlineStatusInfo(conv.user.is_online, conv.user.last_active);
                  
                  return (
                    <div
                      key={conv.match_id}
                      data-testid="message-card"
                      onClick={() => handleChatClick(conv.match_id)}
                      className={`bg-white rounded-xl sm:rounded-2xl shadow-soft overflow-hidden hover:shadow-elevated transition-all duration-300 cursor-pointer animate-bounce-in ${
                        conv.unreadCount > 0 ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                      }`}
                      style={{animationDelay: `${index * 0.05}s`}}
                    >
                      <div className="flex items-center p-3 sm:p-4">
                        {/* Profile Picture */}
                        <div className="relative flex-shrink-0">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-200 to-indigo-200">
                            {conv.user.profile_picture ? (
                              <img
                                src={conv.user.profile_picture}
                                alt={conv.user.name}
                                className="w-full h-full object-cover"
                              />
                            ) : conv.user.photos && conv.user.photos.length > 0 ? (
                              <img
                                src={conv.user.photos[0]}
                                alt={conv.user.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Heart className="w-8 h-8 text-white" />
                              </div>
                            )}
                          </div>
                          {/* Online indicator with color differentiation */}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${statusInfo.color} rounded-full border-2 border-white ${statusInfo.pulse ? 'animate-pulse' : ''}`}></div>
                        </div>

                        {/* Message Content */}
                        <div className="flex-1 min-w-0 ml-3 sm:ml-4">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900 truncate">
                                {conv.user.name}, {conv.user.age}
                              </h3>
                              <span className={`text-xs ${statusInfo.textColor}`}>
                                • {statusInfo.label}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {formatMessageTime(conv.lastMessage?.created_at)}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <p className={`text-sm truncate ${
                              conv.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-600'
                            }`}>
                              {conv.lastMessage?.sender_id === user.id && (
                                <span className="text-blue-500">You: </span>
                              )}
                              {conv.lastMessage?.content || 'Start chatting...'}
                            </p>
                            
                            {/* Unread badge */}
                            {conv.unreadCount > 0 && (
                              <span className="ml-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="ml-2 text-gray-400">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  <p className="text-gray-600 mb-6">No users active in the last 24 hours. Check back later!</p>
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
                    {/* Online/Active Indicator */}
                    <div className={`absolute top-2 sm:top-3 md:top-4 left-2 sm:left-3 md:left-4 z-10 ${
                      activeUser.is_online 
                        ? 'bg-green-500' 
                        : 'bg-yellow-500'
                    } text-white px-2 sm:px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg`}>
                      <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full ${
                        activeUser.is_online ? 'animate-pulse' : ''
                      }`}></span>
                      {activeUser.is_online ? 'Online Now' : 'Recently Active'}
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

                      {/* Last Active Time */}
                      <p className="text-xs text-gray-500 mb-2">
                        {activeUser.is_online ? '🟢 Online now' : `Active ${formatLastSeen(activeUser.last_active)}`}
                      </p>

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
