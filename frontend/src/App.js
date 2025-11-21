import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import AdminDashboard from '@/pages/AdminDashboard';
import DiscoverPage from '@/pages/DiscoverPage';
import MatchesPage from '@/pages/MatchesPage';
import ChatPage from '@/pages/ChatPage';
import ProfilePage from '@/pages/ProfilePage';
import PrivacyPage from '@/pages/PrivacyPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';
import DataDeletionPage from '@/pages/DataDeletionPage';
import InstallPrompt from '@/components/InstallPrompt';
import { requestNotificationPermission, setupForegroundMessageListener } from '@/firebase/messaging';
import { initGoogleAuth } from '@/utils/nativeGoogleAuth';

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
        
        // Request notification permission when user logs in
        setTimeout(() => {
          requestNotificationPermission(userData.id);
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

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/discover" />} />
          <Route path="/auth" element={!user ? <AuthPage onLogin={handleLogin} /> : <Navigate to="/discover" />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/data-deletion" element={<DataDeletionPage />} />
          <Route path="/admin" element={user && user.is_admin ? <AdminDashboard user={user} /> : <Navigate to="/" />} />
          <Route path="/discover" element={user ? <DiscoverPage user={user} /> : <Navigate to="/" />} />
          <Route path="/matches" element={user ? <MatchesPage user={user} /> : <Navigate to="/" />} />
          <Route path="/chat/:matchId" element={user ? <ChatPage user={user} /> : <Navigate to="/" />} />
          <Route path="/profile" element={user ? <ProfilePage user={user} onUpdate={handleLogin} /> : <Navigate to="/" />} />
          <Route path="/privacy" element={user ? <PrivacyPage user={user} /> : <Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
      
      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}

export default App;
