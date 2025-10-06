import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import DiscoverPage from '@/pages/DiscoverPage';
import MatchesPage from '@/pages/MatchesPage';
import ChatPage from '@/pages/ChatPage';
import ProfilePage from '@/pages/ProfilePage';
import PrivacyPage from '@/pages/PrivacyPage';
import InstallPrompt from '@/components/InstallPrompt';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for stored user
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Prevent pull-to-refresh on mobile
    document.body.style.overscrollBehavior = 'none';
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
