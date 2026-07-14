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
    <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.25)] z-50 border-t border-gray-500 pb-safe">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-around h-16 sm:h-18 md:h-20">
          <div className="flex items-center justify-around gap-1 sm:gap-4 w-full">
            <button
              data-testid="nav-discover"
              onClick={() => navigate('/discover')}
              className={`flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-300 min-w-[60px] touch-manipulation ${
                isActive('/discover')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Compass className={`w-6 h-6 ${isActive('/discover') ? 'animate-pulse' : ''}`} />
              <span className="text-xs">Discover</span>
            </button>

            <button
              data-testid="nav-likes"
              onClick={() => navigate('/likes')}
              className={`relative flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-300 min-w-[60px] touch-manipulation ${
                isActive('/likes')
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <Heart className={`w-6 h-6 ${isActive('/likes') ? 'animate-pulse fill-current' : ''}`} />
                {likesCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg animate-pulse">
                    {likesCount > 99 ? '99+' : likesCount}
                  </span>
                )}
              </div>
              <span className="text-xs">Likes</span>
            </button>

            <button
              data-testid="nav-notifications"
              onClick={() => navigate('/notifications')}
              className={`relative flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-300 min-w-[60px] touch-manipulation ${
                isActive('/notifications')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <Bell className={`w-6 h-6 ${isActive('/notifications') ? 'animate-pulse' : ''}`} />
                {totalAlerts > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg animate-pulse">
                    {totalAlerts > 99 ? '99+' : totalAlerts}
                  </span>
                )}
              </div>
              <span className="text-xs">Alerts</span>
            </button>

            <button
              data-testid="nav-matches"
              onClick={() => navigate('/matches')}
              className={`relative flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-300 min-w-[60px] touch-manipulation ${
                isActive('/matches') || location.pathname.startsWith('/chat')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <MessageSquare className={`w-6 h-6 ${isActive('/matches') || location.pathname.startsWith('/chat') ? 'animate-pulse' : ''}`} />
                {unreadMessages > 0 && !isActive('/matches') && !location.pathname.startsWith('/chat') && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </div>
              <span className="text-xs">Matches</span>
            </button>

            <button
              data-testid="nav-profile"
              onClick={() => navigate('/profile')}
              className={`flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-300 min-w-[60px] touch-manipulation ${
                isActive('/profile')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <User className={`w-6 h-6 ${isActive('/profile') ? 'animate-pulse' : ''}`} />
              <span className="text-xs">Profile</span>
            </button>

            {user.is_admin && (
              <button
                data-testid="nav-admin"
                onClick={() => navigate('/admin')}
                className={`flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-300 min-w-[60px] touch-manipulation ${
                  isActive('/admin')
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-glow'
                    : 'text-purple-400 hover:bg-purple-900/50 hover:text-purple-300'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Shield className={`w-6 h-6 ${isActive('/admin') ? 'animate-pulse' : ''}`} />
                <span className="text-xs">Admin</span>
              </button>
            )}

            <button
              data-testid="nav-logout"
              onClick={handleLogout}
              className="flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-all duration-300 min-w-[60px] touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <LogOut className="w-6 h-6" />
              <span className="text-xs">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
