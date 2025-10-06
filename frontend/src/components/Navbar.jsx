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
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            onClick={() => navigate('/discover')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="bg-gradient-to-r from-pink-500 to-orange-500 p-2 rounded-xl">
              <Heart className="w-6 h-6 text-white" fill="white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent">
              HeartLink
            </span>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              data-testid="nav-discover"
              onClick={() => navigate('/discover')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${
                isActive('/discover')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Compass className="w-5 h-5" />
              <span className="hidden sm:inline">Discover</span>
            </button>

            <button
              data-testid="nav-matches"
              onClick={() => navigate('/matches')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${
                isActive('/matches') || location.pathname.startsWith('/chat')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="hidden sm:inline">Matches</span>
            </button>

            <button
              data-testid="nav-profile"
              onClick={() => navigate('/profile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${
                isActive('/profile')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="hidden sm:inline">Profile</span>
            </button>

            <button
              data-testid="nav-privacy"
              onClick={() => navigate('/privacy')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${
                isActive('/privacy')
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="hidden sm:inline">Privacy</span>
            </button>

            {user.is_admin && (
              <button
                data-testid="nav-admin"
                onClick={() => navigate('/admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${
                  isActive('/admin')
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white'
                    : 'text-purple-600 hover:bg-purple-50'
                }`}
              >
                <Shield className="w-5 h-5" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            <button
              data-testid="nav-logout"
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-red-600 hover:bg-red-50 transition-all ml-2"
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
