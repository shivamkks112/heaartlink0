import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, ArrowLeft, Shield, Flag, BellOff, Bell, MoreVertical } from 'lucide-react';
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
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchMatch();
    fetchMessages();
    connectWebSocket();
    checkMuteStatus();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [matchId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav status-bar-spacing">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="bg-white shadow-md px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            data-testid="back-btn"
            onClick={() => navigate('/matches')}
            className="p-2 hover:bg-gray-100 rounded-full transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          
          {otherUser && (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                {otherUser.profile_picture ? (
                  <img 
                    src={otherUser.profile_picture} 
                    alt={otherUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  otherUser.name.charAt(0)
                )}
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{otherUser.name}</h2>
                {otherUser.verified && (
                  <span className="text-xs text-blue-600 font-semibold">✓ Verified</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
                title="More options"
              >
                <MoreVertical className="w-5 h-5 text-gray-700" />
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="messages-container">
        {messages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
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
                <p
                  className={`text-xs mt-1 ${
                    msg.sender_id === user.id ? 'text-white/80' : 'text-gray-500'
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="flex gap-3">
          <Input
            data-testid="message-input"
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
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
