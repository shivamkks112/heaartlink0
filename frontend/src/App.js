import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import InstallPrompt from '@/components/InstallPrompt';
import { AdProvider } from '@/context/AdContext';
import { requestNotificationPermission, setupForegroundMessageListener } from '@/firebase/messaging';
import { initGoogleAuth } from '@/utils/nativeGoogleAuth';
import { initPushNotifications } from '@/services/pushNotifications';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize native Google Auth
    initGoogleAuth();
    
    // Check for stored user
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
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
            <Route path="/premium" element={user ? <PremiumPage user={user} /> : <Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AdProvider>
      
      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}

export default App;
