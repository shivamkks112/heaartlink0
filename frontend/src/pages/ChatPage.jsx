import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, ArrowLeft, Shield, Flag, BellOff, Bell, MoreVertical, Trash2, AlertTriangle, Camera, Clock, Check, CheckCheck, Heart as HeartIcon, SmilePlus } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { BACKEND_URL, API, WS_URL } from '@/config/api';

const ChatPage = ({ user }) => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromTab = location.state?.fromTab || 'messages';
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [privacySettings, setPrivacySettings] = useState({});
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const wsRetryCount = useRef(0);
  const wsRetryTimer = useRef(null);
  const maxWsRetries = 5;

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // Fetch match first — if not found, don't bother with WS/messages
        const matchRes = await axios.get(`${API}/matches/${user.id}`);
        const match = matchRes.data.find(m => m.match_id === matchId);
        if (!match) {
          if (!cancelled) { toast.error('Match not found'); navigate('/matches'); }
          return;
        }
        if (!cancelled) setOtherUser(match.user);

        // Fetch messages + privacy in parallel
        const [msgRes, privRes] = await Promise.allSettled([
          axios.get(`${API}/messages/${matchId}?user_id=${user.id}&limit=100`),
          axios.get(`${API}/privacy/${user.id}`),
        ]);

        if (!cancelled) {
          if (msgRes.status === 'fulfilled') {
            setMessages(msgRes.value.data || []);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 80);
            // Mark read (fire-and-forget)
            axios.post(`${API}/messages/${matchId}/mark-read/${user.id}`).catch(() => {});
          }
          if (privRes.status === 'fulfilled') setPrivacySettings(privRes.value.data);
          setLoading(false);
          connectWebSocket();
          checkMuteStatus();
        }
      } catch (err) {
        console.error('[ChatPage] init failed:', err);
        if (!cancelled) { setError('Chat load nahi ho paya. Please go back and try again.'); setLoading(false); }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      clearTimeout(wsRetryTimer.current);
    };
  }, [matchId]);

  const sendScreenshotAlert = async () => {
    try {
      await axios.post(`${API}/chat/${matchId}/screenshot-alert`, {
        match_id: matchId,
        screenshot_by: user.id
      });
    } catch (error) { /* silent */ }
  };

  const sendTypingIndicator = async (typing) => {
    if (privacySettings.hide_typing_indicator) return;
    
    try {
      await axios.post(`${API}/chat/${matchId}/typing?user_id=${user.id}&is_typing=${typing}`);
    } catch (error) {
      console.error('Failed to send typing indicator');
    }
  };

  const handleReaction = async (messageId, reaction) => {
    try {
      await axios.post(`${API}/messages/${messageId}/react`, {
        message_id: messageId,
        user_id: user.id,
        reaction: reaction
      });
      // Update local state
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          const reactions = { ...(m.reactions || {}) };
          if (reactions[user.id] === reaction) {
            delete reactions[user.id];
          } else {
            reactions[user.id] = reaction;
          }
          return { ...m, reactions };
        }
        return m;
      }));
    } catch (error) {
      console.error('Reaction failed:', error);
    }
  };


  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 2000);
  };

  const deleteMessage = async (messageId, deleteForAll = false) => {
    try {
      await axios.post(`${API}/messages/${messageId}/delete?user_id=${user.id}`, {
        message_id: messageId,
        delete_for_all: deleteForAll
      });
      
      if (deleteForAll) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? {...msg, content: 'This message was deleted', is_deleted_for_all: true} : msg
        ));
        toast.success('Message deleted for everyone');
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        toast.success('Message deleted');
      }
      setShowDeleteModal(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete message');
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Online Status Helper Function for Chat Header
  const getOnlineStatusInfo = (isOnline, lastActive) => {
    if (!lastActive && !isOnline) {
      return { color: 'bg-gray-400', label: 'Offline', textColor: 'text-white/60', pulse: false };
    }
    
    const now = new Date();
    const lastSeenDate = new Date(lastActive);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    // Online now (within 5 minutes) - Green with pulse
    if (isOnline || diffMins < 5) {
      return { color: 'bg-green-400', label: 'Online', textColor: 'text-green-300', pulse: true };
    }
    
    // Recently Active (5 mins to 24 hours) - Yellow
    if (diffHours < 24) {
      if (diffMins < 60) {
        return { color: 'bg-yellow-400', label: `${diffMins}m ago`, textColor: 'text-yellow-300', pulse: false };
      }
      return { color: 'bg-yellow-400', label: `${diffHours}h ago`, textColor: 'text-yellow-300', pulse: false };
    }
    
    // Offline (more than 24 hours) - Grey
    const diffDays = Math.floor(diffMs / 86400000);
    return { color: 'bg-gray-400', label: `${diffDays}d ago`, textColor: 'text-white/60', pulse: false };
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

  // fetchMatch and fetchMessages are now inline in the useEffect init()

  const connectWebSocket = () => {
    if (wsRetryCount.current >= maxWsRetries) return; // Stop retrying
    try {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      wsRef.current = new WebSocket(`${WS_URL}/api/ws/${user.id}`);

      wsRef.current.onopen = () => { wsRetryCount.current = 0; }; // Reset on success
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message' && data.message.match_id === matchId) {
          setMessages(prev => {
            const withoutTemp = prev.filter(msg => 
              !msg._temp || msg.content !== data.message.content
            );
            const exists = withoutTemp.some(msg => 
              msg.sender_id === data.message.sender_id &&
              msg.content === data.message.content &&
              Math.abs(new Date(msg.timestamp) - new Date(data.message.timestamp)) < 1000
            );
            if (exists) return prev;
            return [...withoutTemp, data.message];
          });
        } else if (data.type === 'status_update') {
          if (otherUser && data.user_id === otherUser.id) {
            setOtherUser(prev => prev ? ({ ...prev, is_online: data.is_online, last_active: data.last_active }) : prev);
          }
        } else if (data.type === 'typing_indicator' && data.match_id === matchId) {
          if (data.user_id !== user.id) setOtherUserTyping(data.is_typing);
        } else if (data.type === 'screenshot_alert' && data.match_id === matchId) {
          toast.warning(`${data.screenshot_by_name} took a screenshot!`, { duration: 5000 });
        } else if (data.type === 'system_warning') {
          toast.warning(data.message, { duration: 5000 });
        } else if (data.type === 'message_deleted' && data.deleted_for_all) {
          setMessages(prev => prev.map(msg => 
            msg.id === data.message_id ? {...msg, content: 'This message was deleted', is_deleted_for_all: true} : msg
          ));
        }
      };

      wsRef.current.onerror = () => {};

      wsRef.current.onclose = () => {
        wsRetryCount.current++;
        if (wsRetryCount.current < maxWsRetries) {
          const delay = Math.min(2000 * Math.pow(2, wsRetryCount.current), 30000);
          wsRetryTimer.current = setTimeout(connectWebSocket, delay);
        }
      };
    } catch (error) {
      console.error('WS connect failed:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !otherUser) return;

    const messageContent = newMessage.trim();
    const tempMessage = {
      match_id: matchId,
      sender_id: user.id,
      receiver_id: otherUser.id,
      content: messageContent,
      timestamp: new Date().toISOString(),
      _temp: true
    };

    // Optimistically add message to UI
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    const messageData = {
      match_id: matchId,
      receiver_id: otherUser.id,
      content: messageContent
    };

    try {
      // Send via WebSocket if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(messageData));
      } else {
        // Fallback to HTTP
        const response = await axios.post(`${API}/messages`, {
          match_id: matchId,
          sender_id: user.id,
          receiver_id: otherUser.id,
          content: messageContent
        });
        // Replace temp message with real one
        setMessages(prev => prev.map(msg => 
          msg._temp && msg.content === messageContent ? response.data : msg
        ));
      }
    } catch (error) {
      toast.error('Failed to send message');
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => !msg._temp || msg.content !== messageContent));
    }
  };

  const handleBlock = async () => {
    if (!otherUser) return;
    
    if (window.confirm(`Block ${otherUser.name}? They will be removed from your matches.`)) {
      try {
        await axios.post(`${API}/user/${user.id}/block`, {
          blocked_user_id: otherUser.id
        });
        toast.success('User blocked successfully');
        navigate('/matches', { state: { tab: fromTab } });
      } catch (error) {
        toast.error('Failed to block user');
        console.error('Block error:', error);
      }
    }
  };

  const handleReport = async () => {
    if (!otherUser) return;
    
    const reason = window.prompt('Reason for reporting:');
    if (reason) {
      try {
        await axios.post(`${API}/report?user_id=${user.id}`, {
          reported_user_id: otherUser.id,
          reason
        });
        toast.success('Report submitted');
      } catch (error) {
        toast.error('Failed to submit report');
      }
    }
  };

  const checkMuteStatus = async () => {
    try {
      const response = await axios.get(`${API}/profile/${user.id}`);
      const userData = response.data;
      const mutedUsers = userData.muted_users || [];
      if (otherUser) {
        setIsMuted(mutedUsers.includes(otherUser.id));
      }
    } catch (error) {
      console.error('Failed to check mute status:', error);
    }
  };

  const handleMute = async () => {
    if (!otherUser) return;
    
    try {
      if (isMuted) {
        await axios.post(`${API}/user/${user.id}/unmute`, {
          muted_user_id: otherUser.id
        });
        setIsMuted(false);
        toast.success('Notifications unmuted');
      } else {
        await axios.post(`${API}/user/${user.id}/mute`, {
          muted_user_id: otherUser.id
        });
        setIsMuted(true);
        toast.success('Notifications muted');
      }
    } catch (error) {
      toast.error('Failed to update mute status');
      console.error('Mute error:', error);
    }
  };

  // Theme-aware fallback (instant bg before CSS variables resolve)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const surfaceLow = isDark ? '#221A1D' : '#FFF0F3';
  const surfaceLowest = isDark ? '#140D0F' : '#FFFFFF';

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: surfaceLow }}>
        <div className="flex flex-col items-center gap-3 m3-animate-in">
          <div className="w-12 h-12 rounded-full m3-skeleton"></div>
          <div className="w-32 h-4 m3-skeleton rounded-full"></div>
          <div className="w-20 h-3 m3-skeleton rounded-full mt-1"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: surfaceLow, padding: '0 32px' }}>
        <div className="text-center">
          <HeartIcon className="w-12 h-12 mx-auto mb-4" style={{ color: '#D6336C' }} />
          <p className="text-base font-semibold mb-6" style={{ color: isDark ? '#F0DEE1' : '#1F1A1C' }}>{error}</p>
          <button
            onClick={() => navigate('/matches')}
            className="text-white px-8 py-3 rounded-full font-semibold"
            style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: surfaceLow }}>
      <Toaster position="top-center" />
      
      {/* Header - fixed height with safe area */}
      <div className="flex-shrink-0 bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 shadow-lg z-[60]" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' }}>
        <div className="max-w-2xl mx-auto px-2 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Back Button - Keep as is */}
            <button
              data-testid="back-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/matches', { state: { tab: fromTab } });
              }}
              className="p-3 hover:bg-white/20 rounded-full transition-all backdrop-blur-sm relative z-10 active:scale-95"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* User Info - Clickable to open profile */}
            {otherUser && (
              <button
                onClick={() => navigate(`/profile/${otherUser.id}`)}
                className="flex-1 flex items-center gap-2 hover:bg-white/10 rounded-xl px-2 py-1.5 transition-all min-w-0"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold border-2 border-white/30 overflow-hidden">
                    {otherUser.profile_picture ? (
                      <img 
                        src={otherUser.profile_picture} 
                        alt={otherUser.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm">{otherUser.name.charAt(0)}</span>
                    )}
                  </div>
                  {/* Online Status Indicator with Color */}
                  {(() => {
                    const statusInfo = getOnlineStatusInfo(otherUser.is_online, otherUser.last_active);
                    return (
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${statusInfo.color} border-2 border-white rounded-full ${statusInfo.pulse ? 'animate-pulse' : ''}`}></div>
                    );
                  })()}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <h1 className="text-sm font-bold text-white truncate">
                    {otherUser.name}
                  </h1>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const statusInfo = getOnlineStatusInfo(otherUser.is_online, otherUser.last_active);
                      return (
                        <span className={`text-xs ${statusInfo.textColor} flex items-center gap-1`}>
                          <div className={`w-1.5 h-1.5 ${statusInfo.color} rounded-full ${statusInfo.pulse ? 'animate-pulse' : ''}`}></div>
                          <span className="truncate">{statusInfo.label}</span>
                        </span>
                      );
                    })()}
                    {otherUser.verified && (
                      <svg className="w-3 h-3 text-white/80 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 hover:bg-white/20 rounded-full transition-all backdrop-blur-sm flex-shrink-0"
                  title="More options"
                >
                  <MoreVertical className="w-5 h-5 text-white" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleMute} className="cursor-pointer">
                  {isMuted ? (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Unmute Notifications
                    </>
                  ) : (
                    <>
                      <BellOff className="w-4 h-4 mr-2" />
                      Mute Notifications
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBlock} className="cursor-pointer text-red-600">
                  <Shield className="w-4 h-4 mr-2" />
                  Block User
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReport} className="cursor-pointer text-orange-600">
                  <Flag className="w-4 h-4 mr-2" />
                  Report User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="overflow-y-auto px-4 py-3 space-y-2.5"
        style={{ flex: '1 1 0%', minHeight: 0, backgroundColor: surfaceLow }}
        data-testid="messages-container"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8 px-4" data-testid="icebreakers-section">
            <p style={{ color: 'var(--m3-on-surface-variant)' }} className="text-sm mb-5 font-medium">Start the conversation!</p>
            <div className="space-y-2.5 max-w-xs mx-auto">
              {[
                "What's your dream travel destination? ✈️",
                "Coffee or tea? ☕",
                "What's your perfect weekend?",
                "What's one thing that always makes you smile?",
                "Beach or mountains?",
                "What's the best show you've binged recently?",
              ].map((icebreaker, i) => (
                <button
                  key={i}
                  data-testid={`icebreaker-${i}`}
                  onClick={() => setNewMessage(icebreaker)}
                  className="w-full text-left px-4 py-3 rounded-2xl text-sm transition-all active:scale-[0.98]"
                  style={{
                    background: 'var(--m3-surface-container)',
                    color: 'var(--m3-on-surface)',
                    border: '1px solid var(--m3-outline-variant)',
                  }}
                >
                  {icebreaker}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.sender_id === user.id;
            const isSystem = msg.sender_id === 'system' || msg.message_type === 'system_warning';
            // Show avatar for first message or when sender changes
            const showAvatar = !isOwn && !isSystem && (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id);

            return (
              <div
                key={msg.id}
                className={`flex ${isSystem ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {/* System/Warning Messages */}
                {isSystem ? (
                  <div className="max-w-[85%] px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-xl text-center">
                    <p className="text-sm text-yellow-800 flex items-center justify-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  /* Regular Messages */
                  <div className={`flex items-end gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`} style={{ maxWidth: '80%' }}>
                    {/* Avatar for incoming messages */}
                    {!isOwn && (
                      <div className="flex-shrink-0 w-7 h-7">
                        {showAvatar && otherUser ? (
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-pink-100 border border-pink-200">
                            {otherUser.profile_picture ? (
                              <img
                                src={otherUser.profile_picture}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-pink-600 text-xs font-bold">
                                {otherUser.name?.charAt(0)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-7 h-7" /> 
                        )}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className="relative group">
                      <div
                        className={`min-w-[60px] px-3.5 py-2 rounded-2xl ${
                          msg.is_deleted_for_all
                            ? 'italic'
                            : isOwn
                            ? 'text-white rounded-br-sm'
                            : 'rounded-bl-sm'
                        }`}
                        style={{
                          wordBreak: 'break-word', overflowWrap: 'break-word',
                          ...(msg.is_deleted_for_all
                            ? { background: 'var(--m3-surface-container-high)', color: 'var(--m3-outline)' }
                            : isOwn
                            ? { background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)' }
                            : { background: 'var(--m3-surface-container)', boxShadow: 'var(--m3-elevation-1)', color: 'var(--m3-on-surface)' }
                          ),
                        }}
                        onDoubleClick={() => !msg.is_deleted_for_all && handleReaction(msg.id, 'heart')}
                      >
                        {msg.personal_info_detected && (
                          <div className="flex items-center gap-1 text-xs mb-1" style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--m3-outline)' }}>
                            <Shield className="w-3 h-3" />
                            <span>Protected</span>
                          </div>
                        )}
                        
                        <p className="text-sm whitespace-pre-wrap" style={{ wordBreak: 'break-word' }}>{msg.content}</p>
                        
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <p className="text-[10px]" style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--m3-outline)' }}>
                            {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {msg.expires_at && (
                            <Clock className={`w-3 h-3 ${isOwn ? 'text-white/60' : 'text-gray-400'}`} />
                          )}
                          {/* Read receipts for own messages */}
                          {isOwn && !msg.is_deleted_for_all && (
                            msg.read ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-white/50" />
                            )
                          )}
                        </div>
                      </div>

                      {/* Reactions display */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} -mt-2 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                          <div className="shadow-sm rounded-full px-1.5 py-0.5 flex gap-0.5" style={{ background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)' }}>
                            {Object.values(msg.reactions).map((r, i) => (
                              <span key={i} className="text-xs">
                                {r === 'heart' ? '❤️' : r === 'laugh' ? '😂' : r === 'thumbsup' ? '👍' : r === 'sad' ? '😢' : '😠'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Delete button for own messages */}
                      {isOwn && !msg.is_deleted_for_all && (
                        <button
                          onClick={() => setShowDeleteModal(msg.id)}
                          className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full shadow-md hover:bg-red-50"
                          style={{ background: 'var(--m3-surface-container-lowest)' }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        
        {/* Typing indicator */}
        {otherUserTyping && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-3xl" style={{ background: 'var(--m3-surface-container)', boxShadow: 'var(--m3-elevation-1)' }}>
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--m3-outline)', animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--m3-outline)', animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--m3-outline)', animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Delete Message Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Delete Message</h3>
            <div className="space-y-3">
              <button
                onClick={() => deleteMessage(showDeleteModal, false)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-left transition-colors"
              >
                <p className="font-medium text-gray-900">Delete for me</p>
                <p className="text-sm text-gray-500">This message will be removed from your chat</p>
              </button>
              <button
                onClick={() => deleteMessage(showDeleteModal, true)}
                className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 rounded-xl text-left transition-colors"
              >
                <p className="font-medium text-red-600">Delete for everyone</p>
                <p className="text-sm text-red-400">This message will be removed for both of you</p>
              </button>
              <button
                onClick={() => setShowDeleteModal(null)}
                className="w-full py-3 px-4 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input area - flex-shrink-0 stays at bottom */}
      <div className="flex-shrink-0 z-50" style={{ paddingBottom: 'max(var(--safe-bottom, 8px), env(safe-area-inset-bottom, 0px), 8px)', backgroundColor: surfaceLowest, borderTop: '1px solid var(--m3-outline-variant)' }}>
        <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2.5">
          <Input
            data-testid="message-input"
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message..."
            className="flex-1 h-11 px-4 rounded-full border-1.5 border-[#D6C2C5] focus:border-[#D6336C] bg-[#FAEAED] text-sm"
          />
          <Button
            data-testid="send-btn"
            type="submit"
            disabled={!newMessage.trim()}
            className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-50 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)' }}
          >
            <Send className="w-5 h-5 text-white" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;
