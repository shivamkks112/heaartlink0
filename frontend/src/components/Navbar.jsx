import { Heart, Compass, MessageSquare, User, Shield, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-lg z-[9999] border-t border-gray-200 safe-area-inset-bottom">
      <div className="max-w-7xl mx-auto px-2">
        <div className="flex items-center justify-around h-16 sm:h-20">
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
                  : 'text-gray-600 hover:bg-gray-100 hover:text-pink-600'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Compass className={`w-6 h-6 ${isActive('/discover') ? 'animate-pulse' : ''}`} />
              <span className="text-xs">Discover</span>
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
                  : 'text-gray-600 hover:bg-gray-100 hover:text-pink-600'
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
                  : 'text-gray-600 hover:bg-gray-100 hover:text-pink-600'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <User className={`w-6 h-6 ${isActive('/profile') ? 'animate-pulse' : ''}`} />
              <span className="text-xs">Profile</span>
            </button>

            <button
              data-testid="nav-privacy"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/privacy');
              }}
              className={`flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-300 min-w-[60px] touch-manipulation ${
                isActive('/privacy')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-pink-600'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Shield className={`w-6 h-6 ${isActive('/privacy') ? 'animate-pulse' : ''}`} />
              <span className="text-xs">Privacy</span>
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
                    : 'text-purple-600 hover:bg-purple-50 hover:text-purple-700'
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
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-300 transform hover:scale-105 ml-1 sm:ml-2"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
