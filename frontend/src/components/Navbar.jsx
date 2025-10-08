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
    <nav className="bg-white/90 backdrop-blur-md shadow-soft sticky top-0 z-50 border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            onClick={() => navigate('/discover')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="bg-gradient-to-r from-pink-500 to-orange-500 p-2 rounded-xl group-hover:animate-heart-beat transition-all duration-300 group-hover:shadow-glow">
              <Heart className="w-6 h-6 text-white" fill="white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent group-hover:animate-pulse">
              HeartLink
            </span>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              data-testid="nav-discover"
              onClick={() => navigate('/discover')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                isActive('/discover')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow animate-glow'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-pink-600'
              }`}
            >
              <Compass className={`w-5 h-5 ${isActive('/discover') ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Discover</span>
            </button>

            <button
              data-testid="nav-matches"
              onClick={() => navigate('/matches')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                isActive('/matches') || location.pathname.startsWith('/chat')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow animate-glow'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-pink-600'
              }`}
            >
              <MessageSquare className={`w-5 h-5 ${isActive('/matches') || location.pathname.startsWith('/chat') ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Matches</span>
            </button>

            <button
              data-testid="nav-profile"
              onClick={() => navigate('/profile')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                isActive('/profile')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow animate-glow'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-pink-600'
              }`}
            >
              <User className={`w-5 h-5 ${isActive('/profile') ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Profile</span>
            </button>

            <button
              data-testid="nav-privacy"
              onClick={() => navigate('/privacy')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                isActive('/privacy')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-glow animate-glow'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-pink-600'
              }`}
            >
              <Shield className={`w-5 h-5 ${isActive('/privacy') ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Privacy</span>
            </button>

            {user.is_admin && (
              <button
                data-testid="nav-admin"
                onClick={() => navigate('/admin')}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                  isActive('/admin')
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-glow animate-glow'
                    : 'text-purple-600 hover:bg-purple-50 hover:text-purple-700'
                }`}
              >
                <Shield className={`w-5 h-5 ${isActive('/admin') ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">Admin</span>
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
