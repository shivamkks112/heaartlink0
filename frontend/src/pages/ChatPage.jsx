import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Send, ArrowLeft, Shield, Flag, BellOff, Bell, MoreVertical, Trash2, AlertTriangle, Camera, Clock, Check, CheckCheck, Heart as HeartIcon, SmilePlus, Gamepad2, Sparkles } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import PlayWithMatch, { GameInviteBubble } from '@/components/PlayWithMatch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { BACKEND_URL, API } from '@/config/api';
import { getCachedChatMessages, cacheChatMessages } from '@/utils/cacheManager';
import wsService from '@/services/WebSocketService';

const NUDGE_ICEBREAKERS = [
  "What's the best thing that happened to you this week? \u{1F60A}",
  "If we could go on a date right now, where would you pick?",
  "What song are you obsessed with lately? \u{1F3B5}",
  "Tell me your top 3 comfort foods!",
  "What's something random that made you smile today?",
  "If you could learn any skill instantly, what would it be?",
];

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
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [privacySettings, setPrivacySettings] = useState({});
  const [, setTimeTick] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null); // Forces re-render for "last seen" label
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem('heartlink_nudge_dismissed') || '{}');
      const ts = d[matchId];
      return ts && (Date.now() - ts) < 172800000;
    } catch { return false; }
  });
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingHideTimerRef = useRef(null);
  const pendingWsMessages = useRef(new Map()); // Track WS messages awaiting echo

  // Smart Nudge
  const nudgeData = useMemo(() => {
    if (nudgeDismissed || messages.length === 0) return null;
    const realMsgs = messages.filter(m => m.sender_id !== 'system' && m.message_type !== 'system_warning');
    if (realMsgs.length === 0) return null;
    const lastMsg = realMsgs[realMsgs.length - 1];
    if (lastMsg.sender_id !== user.id) return null;
    const sentAt = new Date(lastMsg.created_at || lastMsg.timestamp);
    const hoursSince = (Date.now() - sentAt.getTime()) / 3600000;
    if (hoursSince < 24) return null;
    let hash = 0;
    for (let i = 0; i < matchId.length; i++) hash = ((hash << 5) - hash + matchId.charCodeAt(i)) | 0;
    const suggestion = NUDGE_ICEBREAKERS[Math.abs(hash) % NUDGE_ICEBREAKERS.length];
    return { hoursSince: Math.floor(hoursSince), suggestion };
  }, [messages, nudgeDismissed, user.id, matchId]);

  // ── WebSocket event handlers using GLOBAL wsService ──
  const handleWsNewMessage = useCallback((msg) => {
    if (msg?.match_id !== matchId) return;
    setMessages(prev => {
      // Remove optimistic temp message with same content
      const withoutTemp = prev.filter(m => !m._temp || m.content !== msg.content);
      // Deduplicate: check by id or by content+sender+timestamp proximity
      const exists = withoutTemp.some(m =>
        (m.id && m.id === msg.id) ||
        (m.sender_id === msg.sender_id && m.content === msg.content &&
          Math.abs(new Date(m.timestamp || m.created_at) - new Date(msg.timestamp || msg.created_at)) < 2000)
      );
      if (exists) return withoutTemp;
      return [...withoutTemp, msg];
    });
    // Clear pending WS timeout if this is our own echo
    if (msg.sender_id === user.id && pendingWsMessages.current.has(msg.content)) {
      clearTimeout(pendingWsMessages.current.get(msg.content));
      pendingWsMessages.current.delete(msg.content);
    }
    // Auto-mark as read if this is someone else's message
    if (msg.sender_id !== user.id) {
      axios.post(`${API}/messages/${matchId}/mark-read/${user.id}`).catch(() => {});
    }
  }, [matchId, user.id]);

  const handleWsTyping = useCallback((data) => {
    if (data.match_id !== matchId || data.user_id === user.id) return;
    setOtherUserTyping(data.is_typing !== false);
    if (data.is_typing !== false) {
      clearTimeout(typingHideTimerRef.current);
      typingHideTimerRef.current = setTimeout(() => setOtherUserTyping(false), 4000);
    }
  }, [matchId, user.id]);

  const handleWsStatusUpdate = useCallback((data) => {
    setOtherUser(prev => {
      if (!prev || data.user_id !== prev.id) return prev;
      return { ...prev, is_online: data.is_online, last_active: data.last_active };
    });
  }, []);

  const handleWsScreenshot = useCallback((data) => {
    if (data.match_id === matchId) {
      toast.warning(`${data.screenshot_by_name} took a screenshot!`, { duration: 5000 });
    }
  }, [matchId]);

  const handleWsSystemWarning = useCallback((data) => {
    // Social media blocks are silent — just remove temp message
    if (data.message && (data.message.includes('Social media') || data.message.includes('social media'))) {
      setMessages(prev => prev.filter(msg => !msg._temp));
      pendingWsMessages.current.forEach(timer => clearTimeout(timer));
      pendingWsMessages.current.clear();
      return;
    }
    toast.warning(data.message, { duration: 5000 });
  }, []);

  const handleWsMessageDeleted = useCallback((data) => {
    if (data.deleted_for_all) {
      setMessages(prev => prev.map(msg =>
        msg.id === data.message_id ? { ...msg, content: 'This message was deleted', is_deleted_for_all: true } : msg
      ));
    }
  }, []);

  const handleWsMessagesRead = useCallback((data) => {
    if (data.match_id !== matchId) return;
    setMessages(prev => prev.map(msg =>
      msg.sender_id === user.id && !msg.read ? { ...msg, read: true } : msg
    ));
  }, [matchId, user.id]);

  const handleWsMessageDelivered = useCallback((data) => {
    if (data.match_id !== matchId) return;
    setMessages(prev => prev.map(msg =>
      msg.id === data.message_id ? { ...msg, delivered: true } : msg
    ));
  }, [matchId]);

  // ── Initialize chat ──
  useEffect(() => {
    let cancelled = false;

    // Ensure WS is connected when entering chat
    if (user?.id && !wsService.isConnected) {
      wsService.connect(user.id);
    }

    const init = async () => {
      try {
        // Try conversations first (has lastMessage data), fallback to matches for new chats
        let match = null;
        try {
          const convRes = await axios.get(`${API}/conversations/${user.id}`);
          match = convRes.data.find(m => m.match_id === matchId);
        } catch {}
        
        if (!match) {
          // Fallback: fetch from matches (for new matches without messages)
          try {
            const matchRes = await axios.get(`${API}/matches/${user.id}`);
            match = matchRes.data.find(m => m.match_id === matchId);
          } catch {}
        }
        
        if (!match) {
          if (!cancelled) { toast.error('Match not found'); navigate('/matches'); }
          return;
        }
        if (!cancelled) setOtherUser(match.user);

        // Show cached messages instantly
        const cachedMsgs = getCachedChatMessages(matchId);
        if (cachedMsgs && cachedMsgs.length > 0) {
          setMessages(cachedMsgs);
          setLoading(false);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
        }

        const [msgRes, privRes] = await Promise.allSettled([
          axios.get(`${API}/messages/${matchId}?user_id=${user.id}&limit=100`),
          axios.get(`${API}/privacy/${user.id}`),
        ]);

        if (!cancelled) {
          if (msgRes.status === 'fulfilled') {
            const msgs = msgRes.value.data || [];
            // Only update if messages actually changed (avoid flash)
            const hasNewMessages = !cachedMsgs || msgs.length !== cachedMsgs.length || 
              (msgs.length > 0 && cachedMsgs.length > 0 && msgs[msgs.length - 1]?.id !== cachedMsgs[cachedMsgs.length - 1]?.id);
            if (hasNewMessages) {
              setMessages(msgs);
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 80);
            }
            cacheChatMessages(matchId, msgs);
            axios.post(`${API}/messages/${matchId}/mark-read/${user.id}`).catch(() => {});
          }
          if (privRes.status === 'fulfilled') setPrivacySettings(privRes.value.data);
          setLoading(false);
          checkMuteStatus();
        }
      } catch (err) {
        console.error('[ChatPage] init failed:', err);
        if (!cancelled) { setError('Chat load nahi ho paya. Please go back and try again.'); setLoading(false); }
      }
    };

    init();

    return () => { cancelled = true; };
  }, [matchId]); // eslint-disable-line

  // ── Subscribe to global wsService events ──
  useEffect(() => {
    const unsubs = [
      wsService.on('new_message', handleWsNewMessage),
      wsService.on('typing_indicator', handleWsTyping),
      wsService.on('status_update', handleWsStatusUpdate),
      wsService.on('screenshot_alert', handleWsScreenshot),
      wsService.on('system_warning', handleWsSystemWarning),
      wsService.on('message_deleted', handleWsMessageDeleted),
      wsService.on('messages_read', handleWsMessagesRead),
      wsService.on('message_delivered', handleWsMessageDelivered),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
      clearTimeout(typingHideTimerRef.current);
      // Clear all pending WS fallback timers
      pendingWsMessages.current.forEach(timer => clearTimeout(timer));
      pendingWsMessages.current.clear();
    };
  }, [handleWsNewMessage, handleWsTyping, handleWsStatusUpdate, handleWsScreenshot, handleWsSystemWarning, handleWsMessageDeleted, handleWsMessagesRead, handleWsMessageDelivered]);

  // Tick every 30s to keep "last seen" label fresh (e.g. "5m ago" → "6m ago")
  useEffect(() => {
    const interval = setInterval(() => setTimeTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Refresh messages when app comes back to foreground (Android background → foreground)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && matchId && user?.id) {
        // Quick fetch to catch any missed messages
        axios.get(`${API}/messages/${matchId}?user_id=${user.id}&limit=50`)
          .then(res => {
            const freshMsgs = res.data || [];
            if (freshMsgs.length > 0) {
              setMessages(prev => {
                const lastPrevId = prev[prev.length - 1]?.id;
                const lastFreshId = freshMsgs[freshMsgs.length - 1]?.id;
                if (lastPrevId !== lastFreshId) {
                  return freshMsgs; // New messages found, replace
                }
                return prev;
              });
            }
          }).catch(() => {});
        // Mark as read
        axios.post(`${API}/messages/${matchId}/mark-read/${user.id}`).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [matchId, user?.id]);

  const sendScreenshotAlert = async () => {
    try {
      await axios.post(`${API}/chat/${matchId}/screenshot-alert`, {
        match_id: matchId,
        screenshot_by: user.id
      });
    } catch (error) { /* silent */ }
  };

  const sendTypingIndicator = (typing) => {
    if (privacySettings.hide_typing_indicator) return;
    // Use global WS for typing
    if (otherUser) {
      wsService.sendTyping(matchId, otherUser.id, typing);
    }
  };

  const handleReaction = async (messageId, reaction) => {
    try {
      await axios.post(`${API}/messages/${messageId}/react`, {
        message_id: messageId,
        user_id: user.id,
        reaction: reaction
      });
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
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Online Status Helper
  const getOnlineStatusInfo = (isOnline, lastActive) => {
    if (!lastActive && !isOnline) {
      return { color: 'bg-gray-400', label: 'Offline', textColor: 'text-white/60', pulse: false };
    }
    const now = new Date();
    const lastSeenDate = new Date(lastActive);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (isOnline || diffMins < 5) {
      return { color: 'bg-green-400', label: 'Online', textColor: 'text-green-300', pulse: true };
    }
    if (diffHours < 24) {
      if (diffMins < 60) return { color: 'bg-yellow-400', label: `${diffMins}m ago`, textColor: 'text-yellow-300', pulse: false };
      return { color: 'bg-yellow-400', label: `${diffHours}h ago`, textColor: 'text-yellow-300', pulse: false };
    }
    const diffDays = Math.floor(diffMs / 86400000);
    return { color: 'bg-gray-400', label: `${diffDays}d ago`, textColor: 'text-white/60', pulse: false };
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
      created_at: new Date().toISOString(),
      _temp: true
    };

    // Optimistically add message to UI
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    // Send via global WebSocket — if not connected, fall back to HTTP
    const wsSent = wsService.sendMessage(matchId, otherUser.id, messageContent);
    
    if (wsSent) {
      // WS.send() succeeded locally, but the connection might be dead (zombie WS).
      // Set a 3s timeout — if no echo arrives, retry via HTTP to guarantee delivery.
      const fallbackTimer = setTimeout(async () => {
        pendingWsMessages.current.delete(messageContent);
        try {
          const response = await axios.post(`${API}/messages`, {
            match_id: matchId,
            sender_id: user.id,
            receiver_id: otherUser.id,
            content: messageContent
          });
          setMessages(prev => {
            const hasReal = prev.some(m => !m._temp && m.id && m.content === messageContent && m.sender_id === user.id);
            if (hasReal) return prev; // Echo already arrived, skip
            return prev.map(msg =>
              msg._temp && msg.content === messageContent ? response.data : msg
            );
          });
        } catch (err) {
          // HTTP also failed — remove temp message
          setMessages(prev => prev.filter(msg => !msg._temp || msg.content !== messageContent));
          toast.error('Message send failed');
        }
      }, 3000);
      pendingWsMessages.current.set(messageContent, fallbackTimer);
    } else {
      // WS not connected — immediate HTTP fallback
      try {
        const response = await axios.post(`${API}/messages`, {
          match_id: matchId,
          sender_id: user.id,
          receiver_id: otherUser.id,
          content: messageContent
        });
        // Replace temp message with server response
        setMessages(prev => prev.map(msg =>
          msg._temp && msg.content === messageContent ? response.data : msg
        ));
      } catch (error) {
        toast.error('Failed to send message');
        setMessages(prev => prev.filter(msg => !msg._temp || msg.content !== messageContent));
      }
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !otherUser) return;
    if (!file.type.startsWith('image/')) { toast.error('Sirf images bhej sakte ho'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image 5MB se chhoti honi chahiye'); return; }
    
    setImageUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        // Upload + AI moderation
        const uploadRes = await axios.post(`${API}/chat/upload-image`, {
          sender_id: user.id, match_id: matchId, image_base64: base64,
        });
        if (uploadRes.data.blocked) {
          toast.error(uploadRes.data.message || 'Image blocked');
          setImageUploading(false);
          return;
        }
        if (uploadRes.data.success) {
          // Send as image message
          const imgMsg = {
            match_id: matchId, sender_id: user.id, receiver_id: otherUser.id,
            content: `[image:${uploadRes.data.image_path}]`,
            message_type: 'image',
          };
          const tempMsg = { ...imgMsg, created_at: new Date().toISOString(), _temp: true };
          setMessages(prev => [...prev, tempMsg]);
          try {
            await axios.post(`${API}/messages`, imgMsg);
          } catch { toast.error('Image send failed'); }
        }
        setImageUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Image upload failed');
      setImageUploading(false);
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleBlock = async () => {
    if (!otherUser) return;
    if (window.confirm(`Block ${otherUser.name}? They will be removed from your matches.`)) {
      try {
        await axios.post(`${API}/user/${user.id}/block`, { blocked_user_id: otherUser.id });
        toast.success('User blocked successfully');
        navigate('/matches', { state: { tab: fromTab } });
      } catch (error) {
        toast.error('Failed to block user');
      }
    }
  };

  const handleReport = async () => {
    if (!otherUser) return;
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportReason) { toast.error('Reason select karo'); return; }
    setReportSubmitting(true);
    try {
      const fullReason = reportDetails ? `${reportReason}: ${reportDetails}` : reportReason;
      await axios.post(`${API}/report?user_id=${user.id}`, {
        reported_user_id: otherUser.id,
        reason: fullReason,
        match_id: matchId,
      });
      toast.success('Report submitted! Humari team review karegi.');
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
    } catch {
      toast.error('Report submit failed');
    }
    setReportSubmitting(false);
  };

  const checkMuteStatus = async () => {
    try {
      const response = await axios.get(`${API}/profile/${user.id}`);
      const userData = response.data;
      const mutedUsers = userData.muted_users || [];
      if (otherUser) setIsMuted(mutedUsers.includes(otherUser.id));
    } catch (error) {
      console.error('Failed to check mute status:', error);
    }
  };

  const handleMute = async () => {
    if (!otherUser) return;
    try {
      if (isMuted) {
        await axios.post(`${API}/user/${user.id}/unmute`, { muted_user_id: otherUser.id });
        setIsMuted(false);
        toast.success('Notifications unmuted');
      } else {
        await axios.post(`${API}/user/${user.id}/mute`, { muted_user_id: otherUser.id });
        setIsMuted(true);
        toast.success('Notifications muted');
      }
    } catch (error) {
      toast.error('Failed to update mute status');
    }
  };

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
      
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 shadow-lg z-[60]" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' }}>
        <div className="max-w-2xl mx-auto px-2 py-2.5">
          <div className="flex items-center justify-between gap-2">
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
            
            {otherUser && (
              <button
                onClick={() => navigate(`/profile/${otherUser.id}`)}
                className="flex-1 flex items-center gap-2 hover:bg-white/10 rounded-xl px-2 py-1.5 transition-all min-w-0"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold border-2 border-white/30 overflow-hidden">
                    {otherUser.profile_picture ? (
                      <img src={otherUser.profile_picture} alt={otherUser.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm">{otherUser.name.charAt(0)}</span>
                    )}
                  </div>
                  {(() => {
                    const statusInfo = getOnlineStatusInfo(otherUser.is_online, otherUser.last_active);
                    return <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${statusInfo.color} border-2 border-white rounded-full ${statusInfo.pulse ? 'animate-pulse' : ''}`}></div>;
                  })()}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <h1 className="text-sm font-bold text-white truncate">{otherUser.name}</h1>
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
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      </span>
                    )}
                    {otherUser.is_premium && (
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/></svg>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 hover:bg-white/20 rounded-full transition-all backdrop-blur-sm flex-shrink-0" title="More options">
                  <MoreVertical className="w-5 h-5 text-white" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleMute} className="cursor-pointer">
                  {isMuted ? (<><Bell className="w-4 h-4 mr-2" />Unmute Notifications</>) : (<><BellOff className="w-4 h-4 mr-2" />Mute Notifications</>)}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBlock} className="cursor-pointer text-red-600">
                  <Shield className="w-4 h-4 mr-2" />Block User
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReport} className="cursor-pointer text-orange-600">
                  <Flag className="w-4 h-4 mr-2" />Report User
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
                "What's your dream travel destination? \u2708\uFE0F",
                "Coffee or tea? \u2615",
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
            const showAvatar = !isOwn && !isSystem && (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id);

            return (
              <div
                key={msg.id || `temp-${idx}`}
                className={`flex ${isSystem ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {isSystem ? (
                  msg.message_type === 'system_warning' ? (
                    <div className="max-w-[90%] px-4 py-3 bg-red-50 border-2 border-red-300 rounded-xl text-center" data-testid="chat-warning-bubble">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-bold text-red-700 uppercase">Safety Warning {msg.warning_level ? `${msg.warning_level}/3` : ''}</span>
                      </div>
                      <p className="text-sm text-red-800 font-medium">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[85%] px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-xl text-center">
                      <p className="text-sm text-yellow-800 flex items-center justify-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {msg.content}
                      </p>
                    </div>
                  )
                ) : msg.message_type === 'game_invite' ? (
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <GameInviteBubble
                      gameId={msg.content?.match(/__GAME_INVITE__(.+?)__/)?.[1] || ''}
                      gameType={msg.content?.match(/__GAME_INVITE__.+?__(.+?)__/)?.[1] || 'match_quiz'}
                      isOwn={isOwn}
                      userId={user.id}
                      otherUserName={otherUser?.name || 'Match'}
                      onAccept={(gId, questions) => { setShowGameMenu(true); }}
                    />
                  </div>
                ) : (
                  <div className={`flex items-end gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`} style={{ maxWidth: '80%' }}>
                    {!isOwn && (
                      <div className="flex-shrink-0 w-7 h-7">
                        {showAvatar && otherUser ? (
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-pink-100 border border-pink-200">
                            {otherUser.profile_picture ? (
                              <img src={otherUser.profile_picture} alt="" className="w-full h-full object-cover" loading="lazy" />
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

                    <div className="relative group">
                      <div
                        className={`min-w-[60px] px-3.5 py-2 rounded-2xl ${
                          msg.is_deleted_for_all ? 'italic' : isOwn ? 'text-white rounded-br-sm' : 'rounded-bl-sm'
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
                        onContextMenu={(e) => {
                          if (isOwn && !msg.is_deleted_for_all && !msg._temp) {
                            e.preventDefault();
                            setShowDeleteModal(msg.id);
                          }
                        }}
                        onTouchStart={(e) => {
                          if (!isOwn || msg.is_deleted_for_all || msg._temp) return;
                          const timer = setTimeout(() => setShowDeleteModal(msg.id), 500);
                          e.currentTarget._longPressTimer = timer;
                        }}
                        onTouchEnd={(e) => clearTimeout(e.currentTarget._longPressTimer)}
                        onTouchMove={(e) => clearTimeout(e.currentTarget._longPressTimer)}
                      >
                        {msg.personal_info_detected && (
                          <div className="flex items-center gap-1 text-xs mb-1" style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--m3-outline)' }}>
                            <Shield className="w-3 h-3" /><span>Protected</span>
                          </div>
                        )}
                        
                        <p className="text-sm whitespace-pre-wrap" style={{ wordBreak: 'break-word' }}>
                          {msg.message_type === 'image' || msg.content?.startsWith('[image:') ? (
                            <img
                              src={`${API}/chat/image/${msg.content.replace('[image:', '').replace(']', '')}`}
                              alt="Photo"
                              className="rounded-xl max-w-[240px] max-h-[300px] object-cover cursor-pointer"
                              loading="lazy"
                              onClick={() => window.open(`${API}/chat/image/${msg.content.replace('[image:', '').replace(']', '')}`, '_blank')}
                              data-testid="chat-image"
                            />
                          ) : msg.content}
                        </p>
                        
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <p className="text-[10px]" style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--m3-outline)' }}>
                            {new Date(msg.created_at || msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {msg.expires_at && <Clock className={`w-3 h-3 ${isOwn ? 'text-white/60' : 'text-gray-400'}`} />}
                          {isOwn && !msg.is_deleted_for_all && !msg._temp && (
                            msg.read ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                            ) : msg.delivered ? (
                              <CheckCheck className="w-3.5 h-3.5 text-white/50" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-white/50" />
                            )
                          )}
                          {isOwn && msg._temp && (
                            <Clock className="w-3 h-3 text-white/40" />
                          )}
                        </div>
                      </div>

                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} -mt-2 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                          <div className="shadow-sm rounded-full px-1.5 py-0.5 flex gap-0.5" style={{ background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)' }}>
                            {Object.values(msg.reactions).map((r, i) => (
                              <span key={i} className="text-xs">
                                {r === 'heart' ? '\u2764\uFE0F' : r === 'laugh' ? '\uD83D\uDE02' : r === 'thumbsup' ? '\uD83D\uDC4D' : r === 'sad' ? '\uD83D\uDE22' : '\uD83D\uDE20'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {isOwn && !msg.is_deleted_for_all && (
                        <button
                          onClick={() => setShowDeleteModal(msg.id)}
                          className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity p-1.5 rounded-full shadow-md hover:bg-red-50 active:bg-red-50 touch-manipulation"
                          style={{ background: 'var(--m3-surface-container-lowest)' }}
                          data-testid={`delete-msg-${msg.id}`}
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
              <button onClick={() => deleteMessage(showDeleteModal, false)} className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-left transition-colors">
                <p className="font-medium text-gray-900">Delete for me</p>
                <p className="text-sm text-gray-500">This message will be removed from your chat</p>
              </button>
              <button onClick={() => deleteMessage(showDeleteModal, true)} className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 rounded-xl text-left transition-colors">
                <p className="font-medium text-red-600">Delete for everyone</p>
                <p className="text-sm text-red-400">This message will be removed for both of you</p>
              </button>
              <button onClick={() => setShowDeleteModal(null)} className="w-full py-3 px-4 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Overlay */}
      {showGameMenu && (
        <div className="absolute inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" data-testid="game-overlay">
          <PlayWithMatch matchId={matchId} userId={user.id} otherUserName={otherUser?.name || 'Match'} onClose={() => setShowGameMenu(false)} />
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 z-50" style={{ paddingBottom: 'max(var(--safe-bottom, 8px), env(safe-area-inset-bottom, 0px), 8px)', backgroundColor: surfaceLowest, borderTop: '1px solid var(--m3-outline-variant)' }}>
        {nudgeData && (
          <div className="px-3 pt-2.5 pb-1" data-testid="smart-nudge-banner">
            <div className="rounded-2xl p-3 relative" style={{ background: 'linear-gradient(135deg, rgba(214,51,108,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(214,51,108,0.15)' }}>
              <button
                onClick={() => {
                  setNudgeDismissed(true);
                  try {
                    const d = JSON.parse(localStorage.getItem('heartlink_nudge_dismissed') || '{}');
                    d[matchId] = Date.now();
                    localStorage.setItem('heartlink_nudge_dismissed', JSON.stringify(d));
                  } catch {}
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                style={{ color: 'var(--m3-outline)', background: 'var(--m3-surface-container)' }}
                data-testid="nudge-dismiss"
                aria-label="Dismiss nudge"
              >
                \u2715
              </button>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: '#D6336C' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#D6336C' }}>
                  {nudgeData.hoursSince < 48 ? 'No reply yet' : `${Math.floor(nudgeData.hoursSince / 24)}d since last reply`} — try this!
                </span>
              </div>
              <button
                onClick={() => setNewMessage(nudgeData.suggestion)}
                className="w-full text-left text-xs px-3 py-2 rounded-xl transition-all active:scale-[0.98]"
                style={{ background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-on-surface)', border: '1px solid var(--m3-outline-variant)' }}
                data-testid="nudge-suggestion"
              >
                {nudgeData.suggestion}
              </button>
            </div>
          </div>
        )}
        <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2.5">
          <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageSelect} data-testid="image-input" />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={imageUploading}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform bg-gradient-to-br from-blue-500 to-cyan-500 disabled:opacity-50"
            data-testid="send-photo-btn"
            title="Send Photo"
          >
            {imageUploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
          </button>
          <button
            type="button"
            onClick={() => setShowGameMenu(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}
            data-testid="play-together-btn"
            title="Play Together"
          >
            <Gamepad2 className="w-5 h-5 text-white" />
          </button>
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

      {/* Report Modal */}
      {showReportModal && (
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" data-testid="report-modal">
        <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-in-up">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold text-white">Report {otherUser?.name?.split(' ')[0]}</h3>
              </div>
              <button onClick={() => { setShowReportModal(false); setReportReason(''); setReportDetails(''); }} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-sm">&times;</button>
            </div>
          </div>
          
          <div className="p-5 space-y-3">
            <p className="text-xs text-gray-500">Kya problem hai? Reason select karo:</p>
            
            {[
              { id: 'vulgar', label: 'Vulgar / Sexual Messages', emoji: '🔞' },
              { id: 'abuse', label: 'Abusive / Gaali-Galoch', emoji: '🤬' },
              { id: 'fake', label: 'Fake Profile / Catfish', emoji: '🎭' },
              { id: 'harassment', label: 'Harassment / Stalking', emoji: '😰' },
              { id: 'spam', label: 'Spam / Scam', emoji: '🚫' },
              { id: 'underage', label: 'Underage User', emoji: '👶' },
              { id: 'other', label: 'Other', emoji: '📋' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setReportReason(r.label)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                  reportReason === r.label
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
                data-testid={`report-reason-${r.id}`}
              >
                <span className="text-lg">{r.emoji}</span>
                <span className="text-sm font-medium">{r.label}</span>
              </button>
            ))}

            {reportReason && (
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Details likhna chahein toh likho (optional)..."
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={2}
                data-testid="report-details-input"
              />
            )}

            <button
              onClick={submitReport}
              disabled={!reportReason || reportSubmitting}
              className="w-full py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-red-500 to-orange-500 disabled:opacity-50 transition-all active:scale-[0.98]"
              data-testid="report-submit-btn"
            >
              {reportSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
            
            <p className="text-[10px] text-gray-400 text-center">Humari team 24 ghante mein review karegi. Fake reports pe action liya jayega.</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default ChatPage;
