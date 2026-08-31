import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Send, ArrowLeft, Shield, Flag, BellOff, Bell, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
if (!BACKEND_URL) console.error('⚠️ REACT_APP_BACKEND_URL is not set!');
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

const ChatPage = ({ user }) => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isTyping, setIsTyping] = useState(false);  // Other user typing
  const [typingTimeout, setTypingTimeout] = useState(null);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    fetchMatch();
    fetchMessages();
    connectWebSocket();
    checkMuteStatus();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Clear typing timeout on unmount
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [matchId]);

  useEffect(() => {
    scrollToBottom();
    // Mark messages as read when new messages arrive
    if (messages.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      markMessagesAsRead();
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const fetchMatch = async () => {
    try {
      const response = await axios.get(`${API}/matches/${user.id}`);
      const match = response.data.find(m => m.match_id === matchId);
      if (match) {
        setOtherUser(match.user);
      }
    } catch (error) {
      toast.error('Failed to load match');
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API}/messages/${matchId}`);
      setMessages(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load messages');
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    try {
      wsRef.current = new WebSocket(`${WS_URL}/api/ws/${user.id}`);
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message' && data.message.match_id === matchId) {
          setMessages(prev => {
            // Remove temp message if exists
            const withoutTemp = prev.filter(msg => 
              !msg._temp || msg.content !== data.message.content
            );
            
            // Check if message already exists (prevent duplicates)
            const exists = withoutTemp.some(msg => 
              msg.sender_id === data.message.sender_id &&
              msg.content === data.message.content &&
              Math.abs(new Date(msg.timestamp) - new Date(data.message.timestamp)) < 1000
            );
            
            if (exists) return prev;
            return [...withoutTemp, data.message];
          });
          
          // Auto mark as read if message is from other user
          if (data.message.sender_id !== user.id) {
            markMessagesAsRead();
          }
        } else if (data.type === 'status_update') {
          // Update other user's online status in real-time
          if (otherUser && data.user_id === otherUser.id) {
            setOtherUser(prev => ({
              ...prev,
              is_online: data.is_online,
              last_active: data.last_active
            }));
          }
        } else if (data.type === 'typing' && data.match_id === matchId) {
          // Handle typing indicator from other user
          if (data.user_id !== user.id) {
            setIsTyping(data.is_typing);
            
            // Auto-hide typing indicator after 3 seconds
            if (data.is_typing) {
              if (typingTimeout) clearTimeout(typingTimeout);
              const timeout = setTimeout(() => setIsTyping(false), 3000);
              setTypingTimeout(timeout);
            }
          }
        } else if (data.type === 'messages_read' && data.match_id === matchId) {
          // Update read status of messages
          setMessages(prev => prev.map(msg => {
            if (msg.sender_id === user.id && !msg.read) {
              return { ...msg, read: true, read_at: data.read_at };
            }
            return msg;
          }));
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket closed, attempting reconnect...');
        setTimeout(connectWebSocket, 3000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  // Mark messages as read
  const markMessagesAsRead = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_read',
        match_id: matchId
      }));
    }
  }, [matchId]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping) => {
    const now = Date.now();
    // Throttle typing events to max once per second
    if (now - lastTypingSent.current < 1000 && isTyping) return;
    lastTypingSent.current = now;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && otherUser) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        match_id: matchId,
        receiver_id: otherUser.id,
        is_typing: isTyping
      }));
    }
  }, [matchId, otherUser]);

  // Handle input change with typing indicator
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (e.target.value.trim()) {
      sendTypingIndicator(true);
    } else {
      sendTypingIndicator(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !otherUser) return;

    // Stop typing indicator when sending
    sendTypingIndicator(false);

    const messageContent = newMessage.trim();
    const tempMessage = {
      match_id: matchId,
      sender_id: user.id,
      receiver_id: otherUser.id,
      content: messageContent,
      timestamp: new Date().toISOString(),
      read: false,
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
        navigate('/matches');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center page-with-bottom-nav status-bar-spacing">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 relative overflow-hidden">
      <Toaster position="top-center" />
      
      {/* Header - Unique Chat Design with Gradient Background */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 shadow-lg pt-safe">
        <div className="max-w-2xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Back Button - Keep as is */}
            <button
              data-testid="back-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/matches');
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
                  {/* Online Status Indicator */}
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full"></div>
                </div>
                <div className="text-left min-w-0 flex-1">
                  <h1 className="text-sm font-bold text-white truncate">
                    {otherUser.name}
                  </h1>
                  <div className="flex items-center gap-1.5">
                    {otherUser.is_online ? (
                      <span className="text-xs text-green-300 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></div>
                        <span className="truncate">Online</span>
                      </span>
                    ) : otherUser.last_active ? (
                      <span className="text-xs text-white/70 truncate">
                        {formatLastSeen(otherUser.last_active)}
                      </span>
                    ) : null}
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

      {/* Messages - Absolute positioned with proper top spacing */}
      <div className="absolute inset-0 overflow-y-auto px-4 py-6 space-y-4 bg-gradient-to-b from-pink-50/50 to-transparent" style={{ top: '93px', bottom: '88px' }} data-testid="messages-container">
        {messages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id || `${msg.sender_id}-${msg.created_at}`}
                className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-5 py-3 rounded-3xl ${
                    msg.sender_id === user.id
                      ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                      : 'bg-white text-gray-800 shadow-md'
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${
                    msg.sender_id === user.id ? 'text-white/80' : 'text-gray-500'
                  }`}>
                    <span className="text-xs">
                      {new Date(msg.created_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {/* Read Receipts - Only show for sender's messages */}
                    {msg.sender_id === user.id && (
                      <span className="ml-1">
                        {msg.read ? (
                          <CheckCheck className="w-4 h-4 text-blue-300" data-testid="read-receipt" />
                        ) : (
                          <Check className="w-4 h-4" data-testid="sent-receipt" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && otherUser && (
              <div className="flex justify-start" data-testid="typing-indicator">
                <div className="bg-white px-5 py-3 rounded-3xl shadow-md">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{otherUser.name} is typing...</p>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 sm:p-4 pb-safe z-50">
        <form onSubmit={sendMessage} className="flex gap-2 sm:gap-3">
          <Input
            data-testid="message-input"
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onBlur={() => sendTypingIndicator(false)}
            placeholder="Type a message..."
            className="flex-1 py-6 px-5 rounded-full border-2 border-gray-200 focus:border-pink-500"
          />
          <Button
            data-testid="send-btn"
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 w-14 h-14 rounded-full flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-6 h-6 text-white" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;
