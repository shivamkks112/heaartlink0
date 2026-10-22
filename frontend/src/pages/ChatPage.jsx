import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Send, ArrowLeft, Shield, Flag, BellOff, Bell, MoreVertical, Trash2, AlertTriangle, Camera, Clock, Check, CheckCheck, Heart as HeartIcon, SmilePlus, Gamepad2, Sparkles, Brain, X } from 'lucide-react';
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
import adsService from '@/services/AdsService';
import AiChatLimitModal from '@/components/AiChatLimitModal';
import { getCachedChatMessages, cacheChatMessages } from '@/utils/cacheManager';
import { getPageData, setPageData } from '@/utils/pageCache';
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
  const _routeUser = location.state?.otherUser || null;
  const _cc = getPageData('chat', matchId);
  const _cachedMsgs = _cc?.messages || getCachedChatMessages(matchId) || [];
  const [messages, setMessages] = useState(_cachedMsgs);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(_routeUser || _cc?.otherUser || null);
  // Show chat UI instantly — header from route/cache, messages from cache
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(_cachedMsgs.length === 0);
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
  const [aiMemory, setAiMemory] = useState(null);
  const [showMemory, setShowMemory] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem('heartlink_nudge_dismissed') || '{}');
      const ts = d[matchId];
      return ts && (Date.now() - ts) < 172800000;
    } catch { return false; }
  });
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingHideTimerRef = useRef(null);
  const pendingWsMessages = useRef(new Map());
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);

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

  // Acks can arrive before the REST response replaces the temp message — remember them
  const ackRef = useRef({ delivered: new Set(), readAt: 0 });
  const withAcks = (m) => ({
    ...m,
    delivered: m.delivered || ackRef.current.delivered.has(m.id) || ackRef.current.readAt > 0 && new Date(m.created_at || m.timestamp).getTime() <= ackRef.current.readAt,
    read: m.read || (ackRef.current.readAt > 0 && new Date(m.created_at || m.timestamp).getTime() <= ackRef.current.readAt),
  });

  const handleWsMessagesRead = useCallback((data) => {
    if (data.match_id !== matchId) return;
    ackRef.current.readAt = Date.now();
    setMessages(prev => prev.map(msg =>
      msg.sender_id === user.id && !msg.read ? { ...msg, read: true, delivered: true } : msg
    ));
  }, [matchId, user.id]);

  const handleWsMessageDelivered = useCallback((data) => {
    if (data.match_id !== matchId) return;
    if (data.message_id) ackRef.current.delivered.add(data.message_id);
    setMessages(prev => prev.map(msg =>
      (data.all ? msg.sender_id === user.id : msg.id === data.message_id) ? { ...msg, delivered: true } : msg
    ));
  }, [matchId, user.id]);

  // ── Initialize chat ──
  useEffect(() => {
    let cancelled = false;

    // Ensure WS is connected when entering chat
    if (user?.id && !wsService.isConnected) {
      wsService.connect(user.id);
    }

    const init = async () => {
      try {
        // Fire messages + privacy immediately (parallel with user info)
        const dataPromise = Promise.allSettled([
          axios.get(`${API}/messages/${matchId}?user_id=${user.id}&limit=30&order=desc`),
          axios.get(`${API}/privacy/${user.id}`),
        ]);
        let matchUser = otherUser;
        
        if (!matchUser) {
          // Fast: fetch match info directly by match_id (1 call instead of listing all conversations)
          try {
            const infoRes = await axios.get(`${API}/chat/${matchId}/info?user_id=${user.id}`);
            matchUser = infoRes.data.other_user;
          } catch {}
          
          if (!matchUser) {
            if (!cancelled) { setError('Chat load nahi ho paya. Please go back and try again.'); setLoading(false); }
            return;
          }
          if (!cancelled) setOtherUser(matchUser);
        }

        // Show cached messages instantly (already in state from init)
        const cachedMsgs = getCachedChatMessages(matchId);
        if (cachedMsgs && cachedMsgs.length > 0 && messages.length === 0) {
          setMessages(cachedMsgs);
          setMessagesLoading(false);
        }
        // Drop full-page loading if we have user
        if (!cancelled) setLoading(false);

        // Fetch fresh messages + privacy in parallel (background update)
        const [msgRes, privRes] = await dataPromise;

        if (!cancelled) {
          if (msgRes.status === 'fulfilled') {
            const msgs = msgRes.value.data || [];
            // Only update if messages actually changed (avoid flash)
            const hasNewMessages = !cachedMsgs || msgs.length !== cachedMsgs.length || 
              (msgs.length > 0 && cachedMsgs.length > 0 && msgs[msgs.length - 1]?.id !== cachedMsgs[cachedMsgs.length - 1]?.id);
            if (hasNewMessages) {
              setMessages(msgs);
              requestAnimationFrame(() => { if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight; });
            }
            cacheChatMessages(matchId, msgs);
            setPageData('chat', { messages: msgs, otherUser: matchUser || otherUser }, matchId);
            axios.post(`${API}/messages/${matchId}/mark-read/${user.id}`).catch(() => {});
          }
          if (privRes.status === 'fulfilled') setPrivacySettings(privRes.value.data);
          setLoading(false);
          setMessagesLoading(false);
          checkMuteStatus();
        }
      } catch (err) {
        console.error('[ChatPage] init failed:', err);
        if (!cancelled) {
          // Only show error if we have NO data at all (no cached messages, no user)
          if (!otherUser && messages.length === 0) {
            setError('Chat load nahi ho paya. Please go back and try again.');
          }
          setLoading(false);
        }
      }
    };

    init();

    return () => { cancelled = true; };
  }, [matchId]); // eslint-disable-line

  // ── Free AI chat limit (extend via rewarded video) ──
  const [showAiLimit, setShowAiLimit] = useState(false);
  const handleAiLimit = useCallback((content) => {
    const t = pendingWsMessages.current.get(content);
    if (t) { clearTimeout(t); pendingWsMessages.current.delete(content); }
    setMessages(prev => prev.filter(m => !(m._temp && m.content === content)));
    if (content) setNewMessage(content);
    setShowAiLimit(true);
  }, []);
  const handleWsAiLimit = useCallback((data) => {
    if (data.match_id === matchId) handleAiLimit(data.content);
  }, [matchId, handleAiLimit]);

  // ── Interstitial on chat exit (free male users; AdsService enforces frequency caps) ──
  useEffect(() => {
    const adUser = user?.gender?.toLowerCase() === 'male' && !user?.is_premium && !user?.isPremium;
    if (!adUser) return undefined;
    adsService.initialize();
    return () => { adsService.showInterstitial().catch(() => {}); };
  }, []); // eslint-disable-line

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
      wsService.on('ai_chat_limit', handleWsAiLimit),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
      clearTimeout(typingHideTimerRef.current);
      // Clear all pending WS fallback timers
      pendingWsMessages.current.forEach(timer => clearTimeout(timer));
      pendingWsMessages.current.clear();
    };
  }, [handleWsNewMessage, handleWsTyping, handleWsStatusUpdate, handleWsScreenshot, handleWsSystemWarning, handleWsMessageDeleted, handleWsMessagesRead, handleWsMessageDelivered, handleWsAiLimit]);

  // Tick every 30s to keep "last seen" label fresh (e.g. "5m ago" → "6m ago")
  useEffect(() => {
    const interval = setInterval(() => setTimeTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch AI memory (non-blocking, background)
  useEffect(() => {
    if (matchId && otherUser?.is_ai_profile) {
      axios.get(`${API}/ai-memory/${matchId}`).then(r => {
        if (r.data?.has_memory) setAiMemory(r.data.facts);
      }).catch(() => {});
    }
  }, [matchId, otherUser?.is_ai_profile]);

  // Refresh messages when app comes back to foreground (Android background → foreground)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && matchId && user?.id) {
        // Quick fetch to catch any missed messages
        axios.get(`${API}/messages/${matchId}?user_id=${user.id}&limit=50&order=desc`)
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

  // Load older messages when user scrolls to top
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasOlderMessages || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const res = await axios.get(`${API}/messages/${matchId}?user_id=${user.id}&limit=30&order=desc&before=${oldest.timestamp || oldest.created_at}`);
      const olderMsgs = res.data?.messages || res.data || [];
      if (olderMsgs.length === 0) { setHasOlderMessages(false); }
      else {
        const container = messagesContainerRef.current;
        const prevHeight = container?.scrollHeight || 0;
        setMessages(prev => [...olderMsgs, ...prev]);
        // Maintain scroll position after prepending
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevHeight;
        });
      }
    } catch { setHasOlderMessages(false); }
    setLoadingOlder(false);
  }, [loadingOlder, hasOlderMessages, messages, matchId, user.id]);

  // Scroll-to-top detector for pagination
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      if (container.scrollTop < 50 && hasOlderMessages && !loadingOlder) {
        loadOlderMessages();
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [loadOlderMessages, hasOlderMessages, loadingOlder]);


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

  // Auto-scroll the message list (the only scroller) to the newest message
  const hasScrolledInitial = useRef(false);
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (!hasScrolledInitial.current || nearBottom) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      if (messages.length > 0) hasScrolledInitial.current = true;
    }
    // Cache messages on every update for instant re-open
    if (messages.length > 0 && otherUser) {
      cacheChatMessages(matchId, messages);
      setPageData('chat', { messages, otherUser }, matchId);
    }
  }, [messages.length, loading]);

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
              msg._temp && msg.content === messageContent ? withAcks(response.data) : msg
            );
          });
        } catch (err) {
          if (err.response?.status === 429) { handleAiLimit(messageContent); return; }
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
          msg._temp && msg.content === messageContent ? withAcks(response.data) : msg
        ));
      } catch (error) {
        if (error.response?.status === 429) { handleAiLimit(messageContent); return; }
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

  // Use window.innerHeight instead of CSS viewport units (100dvh/100vh may not work in all WebViews)
  const [viewportH, setViewportH] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    // Also listen for Capacitor keyboard show/hide which changes viewport
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const surfaceLow = isDark ? '#221A1D' : '#FFF0F3';
  const surfaceLowest = isDark ? '#140D0F' : '#FFFFFF';

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: surfaceLow }}>
        <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 shadow-lg" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' }}>
          <div className="max-w-2xl mx-auto px-2 py-2.5">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/matches')} className="p-3 rounded-full" style={{ minWidth: '44px', minHeight: '44px' }}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-9 h-9 rounded-full bg-white/20" />
                <div><div className="w-24 h-3 bg-white/20 rounded-full" /><div className="w-14 h-2 bg-white/10 rounded-full mt-1.5" /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8" style={{ backgroundColor: surfaceLow }}>
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
    <div id="chat-root" className="flex flex-col" style={{ height: `${viewportH}px`, overflow: 'hidden', backgroundColor: surfaceLow }}>
      {/* Header with profile pic */}
      <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 shadow-lg flex-shrink-0 z-40" style={{ paddingTop: 'var(--safe-top, 0px)' }}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => navigate('/matches', { state: { tab: fromTab } })} className="p-2 rounded-full active:bg-white/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => otherUser?.id && navigate(`/profile/${otherUser.id}`)} className="flex items-center gap-2.5 flex-1 min-w-0 active:opacity-80">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 bg-white/20">
                {otherUser?.profile_picture ? (
                  <img src={otherUser.profile_picture} alt={otherUser?.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : otherUser?.photos?.[0] ? (
                  <img src={otherUser.photos[0]} alt={otherUser?.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">{otherUser?.name?.[0] || '?'}</div>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-sm truncate">{otherUser?.name || 'User'}{otherUser?.age ? `, ${otherUser.age}` : ''}</h2>
              <p className="text-[11px] truncate flex items-center gap-1">
                {otherUserTyping ? (
                  <><span className="w-2 h-2 rounded-full bg-green-300 animate-pulse inline-block" /><span className="text-green-200 animate-pulse">typing...</span></>
                ) : otherUser?.is_online ? (
                  <><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /><span className="text-green-200 font-medium">Online</span></>
                ) : otherUser?.last_active ? (
                  <><span className="w-2 h-2 rounded-full bg-yellow-300 inline-block" /><span className="text-white/70">Active {(() => {
                    const diff = Date.now() - new Date(otherUser.last_active).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 1) return 'just now';
                    if (mins < 60) return `${mins}m ago`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return `${hrs}h ago`;
                    return `${Math.floor(hrs / 24)}d ago`;
                  })()}</span></>
                ) : (
                  <span className="text-white/60">Tap to view profile</span>
                )}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Messages — the only scrollable element */}
      <div
        ref={messagesContainerRef}
        className="px-4 py-3 space-y-3 flex flex-col justify-end"
        style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'scroll', WebkitOverflowScrolling: 'touch', backgroundColor: surfaceLow }}
        data-testid="messages-container"
      >
        {loadingOlder && (
          <div className="text-center py-3">
            <div className="inline-block w-5 h-5 border-2 border-pink-300 border-t-pink-500 rounded-full animate-spin" />
          </div>
        )}
        <div className="flex-1" />{/* Spacer pushes messages to bottom when few messages */}
        {messagesLoading && messages.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-pink-300 border-t-pink-500 rounded-full animate-spin mb-2" />
            <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant, #888)' }}>Loading messages...</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === user.id;
          const showAvatar = !isOwn && (i === 0 || messages[i - 1]?.sender_id === user.id);
          return (
            <div key={msg.id || i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} gap-2`}>
              {!isOwn && (
                <div className="w-7 flex-shrink-0 self-end">
                  {showAvatar && (
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-pink-100 border border-pink-200">
                      {otherUser?.profile_picture ? (
                        <img src={otherUser.profile_picture} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-pink-600">{otherUser?.name?.[0]}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${isOwn ? 'text-white' : ''}`} style={{ 
                wordBreak: 'break-word',
                ...(isOwn 
                  ? { background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)' } 
                  : { background: 'var(--m3-surface-container-high, #fff)', color: 'var(--m3-on-surface, #1a1a1a)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' })
              }}>
                {msg.is_deleted_for_all ? <i className="opacity-50">Message deleted</i> : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                <div className={`text-[10px] mt-1 flex items-center gap-1 ${isOwn ? 'justify-end text-white/60' : ''}`} style={!isOwn ? { color: 'var(--m3-on-surface-variant, #666)' } : {}}>
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                  {isOwn && !msg.is_deleted_for_all && (
                    <span data-testid={`msg-status-${msg.id || i}`} className="inline-flex items-center">
                      {msg._temp ? <Clock className="w-3 h-3" />
                        : msg.read ? <CheckCheck className="w-3.5 h-3.5" style={{ color: '#4FC3F7' }} />
                        : msg.delivered ? <CheckCheck className="w-3.5 h-3.5" />
                        : <Check className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p style={{ color: 'var(--m3-on-surface-variant)' }} className="text-sm">Say hi to start the conversation!</p>
          </div>
        )}
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
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" data-testid="game-overlay">
          <PlayWithMatch matchId={matchId} userId={user.id} otherUserName={otherUser?.name || 'Match'} onClose={() => setShowGameMenu(false)} />
        </div>
      )}

      {/* Input area — last row of the flex column (not position: fixed) */}
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
                {'\u2715'}
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
            className="flex-1 h-11 px-4 rounded-full border text-sm"
            style={{ borderColor: 'var(--m3-outline-variant)', background: 'var(--m3-surface-container)', color: 'var(--m3-on-surface)' }}
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
      <Toaster position="top-center" />
      {showAiLimit && <AiChatLimitModal user={user} onClose={() => setShowAiLimit(false)} onExtended={() => setShowAiLimit(false)} />}
    </div>
  );
};

export default ChatPage;
