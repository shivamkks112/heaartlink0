import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import CompleteProfilePage from '@/pages/CompleteProfilePage';
import AdminDashboard from '@/pages/AdminDashboard';
import DiscoverPage from '@/pages/DiscoverPage';
import MatchesPage from '@/pages/MatchesPage';
import LikesYouPage from '@/pages/LikesYouPage';
import ChatPage from '@/pages/ChatPage';
import ProfilePage from '@/pages/ProfilePage';
import UserProfilePage from '@/pages/UserProfilePage';
import PrivacyPage from '@/pages/PrivacyPage';
import SettingsPage from '@/pages/SettingsPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';
import DataDeletionPage from '@/pages/DataDeletionPage';
import TermsPage from '@/pages/TermsPage';
import ProfileViewersPage from '@/pages/ProfileViewersPage';
import ProfileEnhancementPage from '@/pages/ProfileEnhancementPage';
import PremiumPage from '@/pages/PremiumPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ReferralPage from '@/pages/ReferralPage';
import DailyRewardModal from '@/components/DailyRewardModal';
import InstallPrompt from '@/components/InstallPrompt';
import { AdProvider } from '@/context/AdContext';
import { requestNotificationPermission, setupForegroundMessageListener } from '@/firebase/messaging';
import { initGoogleAuth } from '@/utils/nativeGoogleAuth';
import { initPushNotifications } from '@/services/pushNotifications';

// Navigation helper component for native app communication
function NavigationHelper() {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Expose navigation function to window for native app
    window.__HEARTLINK_NAVIGATE__ = (path) => {
      if (path && path !== location.pathname) {
        console.log('[HeartLink] Navigating to:', path);
        navigate(path);
        // Clear pending nav after successful navigation
        localStorage.removeItem('heartlink_pending_nav');
      }
    };
    
    // Check for pending navigation from notification click
    const checkPendingNavigation = () => {
      const pendingNav = localStorage.getItem('heartlink_pending_nav');
      if (pendingNav && pendingNav !== location.pathname) {
        console.log('[HeartLink] Found pending navigation:', pendingNav);
        localStorage.removeItem('heartlink_pending_nav');
        navigate(pendingNav);
      }
    };
    
    // Check immediately
    checkPendingNavigation();
    
    // Also check after a delay (in case app is still loading)
    const timer1 = setTimeout(checkPendingNavigation, 500);
    const timer2 = setTimeout(checkPendingNavigation, 1500);
    const timer3 = setTimeout(checkPendingNavigation, 3000);
    
    // Listen for popstate events (back button, history changes)
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path !== location.pathname) {
        navigate(path);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      delete window.__HEARTLINK_NAVIGATE__;
    };
  }, [navigate, location.pathname]);
  
  return null;
}

// Component to handle pending navigation after user loads
function PendingNavigationHandler({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    if (!user) return; // Wait for user to be loaded
    
    const checkAndNavigate = () => {
      const pendingNav = localStorage.getItem('heartlink_pending_nav');
      console.log('[HeartLink] Checking pending nav:', pendingNav, 'Current:', location.pathname);
      
      if (pendingNav && pendingNav !== '/' && pendingNav !== location.pathname) {
        console.log('[HeartLink] Navigating to pending:', pendingNav);
        localStorage.removeItem('heartlink_pending_nav');
        navigate(pendingNav, { replace: true });
      }
    };
    
    // Check multiple times with delays
    checkAndNavigate();
    const t1 = setTimeout(checkAndNavigate, 100);
    const t2 = setTimeout(checkAndNavigate, 500);
    const t3 = setTimeout(checkAndNavigate, 1000);
    const t4 = setTimeout(checkAndNavigate, 2000);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [user, navigate, location.pathname]);
  
  return null;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDailyReward, setShowDailyReward] = useState(false);

  useEffect(() => {
    // Initialize native Google Auth
    initGoogleAuth();
    
    // Check for stored user
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        // Show daily reward if not shown today
        const lastShown = localStorage.getItem('heartlink_daily_reward_date');
        const today = new Date().toISOString().split('T')[0];
        if (lastShown !== today) {
          setTimeout(() => {
            setShowDailyReward(true);
            localStorage.setItem('heartlink_daily_reward_date', today);
          }, 2000);
        }
        
        // Request native push notification permission when user logs in
        setTimeout(() => {
          initPushNotifications(userData.id);
        }, 2000); // Wait 2 seconds before requesting permission
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
      }
    }
    
    // Mark as loaded
    setLoading(false);

    // Prevent pull-to-refresh on mobile
    document.body.style.overscrollBehavior = 'none';
    
    // Setup foreground message listener
    const unsubscribe = setupForegroundMessageListener((payload) => {
      console.log('Received foreground message:', payload);
      // You can show toast notification here
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    // Show daily reward after login (check if not claimed today)
    const lastShown = localStorage.getItem('heartlink_daily_reward_date');
    const today = new Date().toISOString().split('T')[0];
    if (lastShown !== today) {
      setTimeout(() => {
        setShowDailyReward(true);
        localStorage.setItem('heartlink_daily_reward_date', today);
      }, 1500);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="App flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <AdProvider user={user}>
        <BrowserRouter>
          <NavigationHelper />
          <PendingNavigationHandler user={user} />
          <Routes>
            <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/discover" />} />
            <Route path="/auth" element={!user ? <AuthPage onLogin={handleLogin} /> : <Navigate to="/discover" />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/complete-profile" element={<CompleteProfilePage onLogin={handleLogin} />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/data-deletion" element={<DataDeletionPage />} />
            <Route path="/admin" element={user && user.is_admin ? <AdminDashboard user={user} /> : <Navigate to="/" />} />
            <Route path="/discover" element={user ? <DiscoverPage user={user} /> : <Navigate to="/" />} />
            <Route path="/matches" element={user ? <MatchesPage user={user} /> : <Navigate to="/" />} />
            <Route path="/likes" element={user ? <LikesYouPage user={user} /> : <Navigate to="/" />} />
            <Route path="/chat/:matchId" element={user ? <ChatPage user={user} /> : <Navigate to="/" />} />
            <Route path="/profile" element={user ? <ProfilePage user={user} onUpdate={handleLogin} /> : <Navigate to="/" />} />
            <Route path="/profile/:userId" element={user ? <UserProfilePage user={user} /> : <Navigate to="/" />} />
            <Route path="/privacy" element={user ? <PrivacyPage user={user} onUpdate={handleLogin} /> : <Navigate to="/" />} />
            <Route path="/settings" element={user ? <SettingsPage user={user} /> : <Navigate to="/" />} />
            <Route path="/profile-viewers" element={user ? <ProfileViewersPage user={user} /> : <Navigate to="/" />} />
            <Route path="/enhance-profile" element={user ? <ProfileEnhancementPage user={user} onUpdate={handleLogin} /> : <Navigate to="/" />} />
            <Route path="/notifications" element={user ? <NotificationsPage user={user} /> : <Navigate to="/" />} />
            <Route path="/referral" element={user ? <ReferralPage user={user} /> : <Navigate to="/" />} />
            {/* Premium Route - HIDDEN FOR NOW */}
            {/* <Route path="/premium" element={user ? <PremiumPage user={user} /> : <Navigate to="/" />} /> */}
            <Route path="/premium" element={<Navigate to="/discover" />} />
          </Routes>
          {/* Daily Reward Modal */}
          {showDailyReward && user && (
            <DailyRewardModal user={user} onClose={() => setShowDailyReward(false)} />
          )}
        </BrowserRouter>
      </AdProvider>
      
      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}

export default App;
