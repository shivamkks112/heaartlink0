import { Heart, Compass, MessageSquare, User, Shield, LogOut, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import wsService from '@/services/WebSocketService';

const Navbar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [likesCount, setLikesCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    // Connect WebSocket if not connected
    if (user?.id && !wsService.isConnected) {
      wsService.connect(user.id);
    }

    // Set initial badge counts from WS cache
    const cached = wsService.getBadgeCounts();
    if (cached.likes_count) setLikesCount(cached.likes_count);
    if (cached.notification_count) setNotificationCount(cached.notification_count);
    if (cached.unread_messages) setUnreadMessages(cached.unread_messages);

    // Listen for real-time badge updates
    const unsubBadge = wsService.on('badge_update', (data) => {
      setLikesCount(data.likes_count || 0);
      setNotificationCount(data.notification_count || 0);
      setUnreadMessages(data.unread_messages || 0);
    });

    // Listen for new likes (instant badge bump)
    const unsubLike = wsService.on('new_like', () => {
      setLikesCount(prev => prev + 1);
    });

    // Listen for new matches
    const unsubMatch = wsService.on('new_match', () => {
      setNotificationCount(prev => prev + 1);
    });

    return () => {
      unsubBadge();
      unsubLike();
      unsubMatch();
    };
  }, [user?.id]);

  // Reset unread messages when on matches/chat page
  useEffect(() => {
    if (location.pathname === '/matches' || location.pathname.startsWith('/chat')) {
      setUnreadMessages(0);
    }
    if (location.pathname === '/likes') {
      setLikesCount(0);
    }
    if (location.pathname === '/notifications') {
      setNotificationCount(0);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      wsService.disconnect();
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  };

  const totalAlerts = notificationCount + unreadMessages;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 shadow-[0_-2px_10px_rgba(0,0,0,0.3)] z-[100] border-t border-gray-600">
      <div className="w-full px-2 pt-2 pb-5">
        <div className="flex items-center justify-around">
            <button
              data-testid="nav-discover"
              onClick={() => navigate('/discover')}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-300 touch-manipulation ${
                isActive('/discover')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Compass className={`w-5 h-5 ${isActive('/discover') ? 'animate-pulse' : ''}`} />
              <span className="text-[10px]">Discover</span>
            </button>

            <button
              data-testid="nav-likes"
              onClick={() => navigate('/likes')}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-300 touch-manipulation ${
                isActive('/likes')
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <Heart className={`w-5 h-5 ${isActive('/likes') ? 'animate-pulse fill-current' : ''}`} />
                {likesCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-lg animate-pulse">
                    {likesCount > 99 ? '99+' : likesCount}
                  </span>
                )}
              </div>
              <span className="text-[10px]">Likes</span>
            </button>

            <button
              data-testid="nav-notifications"
              onClick={() => navigate('/notifications')}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-300 touch-manipulation ${
                isActive('/notifications')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <Bell className={`w-5 h-5 ${isActive('/notifications') ? 'animate-pulse' : ''}`} />
                {totalAlerts > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-lg animate-pulse">
                    {totalAlerts > 99 ? '99+' : totalAlerts}
                  </span>
                )}
              </div>
              <span className="text-[10px]">Alerts</span>
            </button>

            <button
              data-testid="nav-matches"
              onClick={() => navigate('/matches')}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-300 touch-manipulation ${
                isActive('/matches') || location.pathname.startsWith('/chat')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <MessageSquare className={`w-5 h-5 ${isActive('/matches') || location.pathname.startsWith('/chat') ? 'animate-pulse' : ''}`} />
                {unreadMessages > 0 && !isActive('/matches') && !location.pathname.startsWith('/chat') && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-lg">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </div>
              <span className="text-[10px]">Chats</span>
            </button>

            <button
              data-testid="nav-profile"
              onClick={() => navigate('/profile')}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-300 touch-manipulation ${
                isActive('/profile')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <User className={`w-5 h-5 ${isActive('/profile') ? 'animate-pulse' : ''}`} />
              <span className="text-[10px]">Profile</span>
            </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
