import { Heart, Compass, MessageSquare, User, Settings, Shield, LogOut, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

const Navbar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [likesCount, setLikesCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  const isActive = (path) => location.pathname === path;
  const API = process.env.REACT_APP_BACKEND_URL + '/api';

  useEffect(() => {
    fetchLikesCount();
    fetchNotificationCount();
    // Poll every 30 seconds for updates
    const interval = setInterval(() => {
      fetchLikesCount();
      fetchNotificationCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [user.id]);

  const fetchLikesCount = async () => {
    try {
      const response = await fetch(`${API}/likes/${user.id}`);
      const data = await response.json();
      setLikesCount(data.total_count || 0);
    } catch (error) {
      console.error('Error fetching likes count:', error);
    }
  };

  const fetchNotificationCount = async () => {
    try {
      const response = await axios.get(`${API}/notifications/${user.id}?limit=1`);
      setNotificationCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] z-50 border-t border-gray-700 pb-safe">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-around h-16 sm:h-18 md:h-20">
          {/* Navigation */}
          <div className="flex items-center justify-around gap-1 sm:gap-4 w-full">
            <button
              data-testid="nav-discover"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/discover');
              }}
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/likes');
              }}
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/notifications');
              }}
              className={`relative flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-300 min-w-[60px] touch-manipulation ${
                isActive('/notifications')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <Bell className={`w-6 h-6 ${isActive('/notifications') ? 'animate-pulse' : ''}`} />
                {notificationCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg animate-pulse">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </div>
              <span className="text-xs">Alerts</span>
            </button>

            <button
              data-testid="nav-matches"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/matches');
              }}
              className={`flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-300 min-w-[60px] touch-manipulation ${
                isActive('/matches') || location.pathname.startsWith('/chat')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <MessageSquare className={`w-6 h-6 ${isActive('/matches') || location.pathname.startsWith('/chat') ? 'animate-pulse' : ''}`} />
              <span className="text-xs">Matches</span>
            </button>

            <button
              data-testid="nav-profile"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/profile');
              }}
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate('/admin');
                }}
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLogout();
              }}
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
    </>
  );
};

export default Navbar;
