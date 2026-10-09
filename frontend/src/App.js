import { useState, useEffect, lazy, Suspense, useRef, useCallback } from 'react';
import '@/App.css';
import '@/styles/material3.css';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { initSafeArea } from '@/utils/safeArea';
import { trackInstall } from '@/utils/installTracker';
import { useTheme } from '@/hooks/useTheme';
import { API } from '@/config/api';
import ErrorBoundary from '@/components/ErrorBoundary';
import AppUpdateBanner from '@/components/AppUpdateBanner';
import RatingPrompt from '@/components/RatingPrompt';
import { DiscoverSkeleton, MatchesSkeleton, ChatSkeleton, ProfileSkeleton, QuickLoader } from '@/components/PageSkeletons';

// Critical pages - loaded immediately (lightweight)
import LandingPage from '@/pages/LandingPage';

// Core pages — ALL eagerly loaded for instant native feel
import DiscoverPage from '@/pages/DiscoverPage';
import MatchesPage from '@/pages/MatchesPage';
import LikesYouPage from '@/pages/LikesYouPage';
import ChatPage from '@/pages/ChatPage';
import ProfilePage from '@/pages/ProfilePage';
import UserProfilePage from '@/pages/UserProfilePage';
import PremiumPage from '@/pages/PremiumPage';
import SettingsPage from '@/pages/SettingsPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ProfileEnhancementPage from '@/pages/ProfileEnhancementPage';
import ReferralPage from '@/pages/ReferralPage';
import ShareProfilePage from '@/pages/ShareProfilePage';
import ProfileViewersPage from '@/pages/ProfileViewersPage';
import PaymentHistoryPage from '@/pages/PaymentHistoryPage';

// Auth & rare pages — lazy
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const CompleteProfilePage = lazy(() => import('@/pages/CompleteProfilePage'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const MandatoryPhotoPage = lazy(() => import('@/pages/MandatoryPhotoPage'));
const SelfieVerificationPage = lazy(() => import('@/pages/SelfieVerificationPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'));
const DataDeletionPage = lazy(() => import('@/pages/DataDeletionPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const CityDatingPage = lazy(() => import('@/pages/CityDatingPage'));
const MatchShareCard = lazy(() => import('@/pages/MatchShareCard'));
const DailyRewardModal = lazy(() => import('@/components/DailyRewardModal'));
const WelcomeModal = lazy(() => import('@/components/WelcomeModal'));
const InstallPrompt = lazy(() => import('@/components/InstallPrompt'));

// Preload critical pages in background — called after login for instant navigation
function preloadCriticalPages() {
  // Preload the 4 main tab pages user will navigate to
  import('@/pages/DiscoverPage');
  import('@/pages/MatchesPage');
  import('@/pages/LikesYouPage');
  import('@/pages/ProfilePage');
  // Preload chat slightly later
  setTimeout(() => { import('@/pages/ChatPage'); import('@/pages/NotificationsPage'); }, 1000);
}

// Lazy load AdProvider - only needed for logged-in users
const LazyAdProvider = lazy(() => import('@/context/AdContext').then(mod => ({ default: mod.AdProvider })));

// Wrapper to provide ad context only when logged in
function AdWrapper({ user, children }) {
  if (!user) return children;
  return (
    <Suspense fallback={children}>
      <LazyAdProvider user={user}>{children}</LazyAdProvider>
    </Suspense>
  );
}

// Navigation helper component for native app communication
function NavigationHelper() {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Expose navigation function to window for native app AND push notifications
    window.__HEARTLINK_NAVIGATE__ = (path) => {
      if (path && path !== location.pathname) {
        console.log('[HeartLink] Navigating to:', path);
        navigate(path);
        localStorage.removeItem('heartlink_pending_nav');
      }
    };
    // Also expose as __heartlink_navigate for pushNotifications.js
    window.__heartlink_navigate = window.__HEARTLINK_NAVIGATE__;
    
    // Check for pending navigation from notification click
    const checkPendingNavigation = () => {
      const pendingNav = localStorage.getItem('heartlink_pending_nav');
      if (pendingNav && pendingNav !== location.pathname) {
        console.log('[HeartLink] Found pending navigation:', pendingNav);
        localStorage.removeItem('heartlink_pending_nav');
        navigate(pendingNav);
      }
    };
    
    // Check immediately and on rapid intervals for fast notification response
    checkPendingNavigation();
    const timer1 = setTimeout(checkPendingNavigation, 100);
    const timer2 = setTimeout(checkPendingNavigation, 300);
    const timer3 = setTimeout(checkPendingNavigation, 800);
    const timer4 = setTimeout(checkPendingNavigation, 2000);
    
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
      clearTimeout(timer4);
      delete window.__HEARTLINK_NAVIGATE__;
    };
  }, [navigate, location.pathname]);
  
  return null;
}


// Double-back-to-exit handler — Android native behavior
function BackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastBackPress = useRef(0);
  const toastShown = useRef(false);
  
  const MAIN_TABS = ['/discover', '/likes', '/matches', '/profile', '/notifications'];
  
  useEffect(() => {
    const handleBackButton = (e) => {
      const isMainTab = MAIN_TABS.some(tab => location.pathname === tab || location.pathname.startsWith(tab + '/'));
      
      if (!isMainTab) {
        // Inner page — normal back navigation
        return;
      }
      
      // Main tab — double back to exit
      e.preventDefault();
      const now = Date.now();
      
      if (now - lastBackPress.current < 2500) {
        // Double back within 2.5s — exit app
        try {
          // Capacitor App.exitApp()
          import(/* webpackIgnore: true */ '@capacitor/app').then(({ App }) => App.exitApp()).catch(() => window.close());
        } catch {
          window.close();
        }
      } else {
        // First back — show toast
        lastBackPress.current = now;
        if (!toastShown.current) {
          toastShown.current = true;
          // Use a simple native-style toast
          const toast = document.createElement('div');
          toast.textContent = 'Press back again to exit';
          toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:8px 20px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;transition:opacity 0.3s;font-family:Poppins,sans-serif';
          document.body.appendChild(toast);
          setTimeout(() => { toast.style.opacity = '0'; }, 2000);
          setTimeout(() => { document.body.removeChild(toast); toastShown.current = false; }, 2500);
        }
      }
    };
    
    // Listen for browser back button (popstate)
    window.addEventListener('popstate', handleBackButton);
    
    // Also listen for Capacitor hardware back button
    let backButtonCleanup = null;
    import(/* webpackIgnore: true */ '@capacitor/app').then(({ App }) => {
      backButtonCleanup = App.addListener('backButton', ({ canGoBack }) => {
        const isMainTab = MAIN_TABS.some(tab => location.pathname === tab);
        if (isMainTab) {
          const now = Date.now();
          if (now - lastBackPress.current < 2500) {
            App.exitApp();
          } else {
            lastBackPress.current = now;
            // Show toast
            const toast = document.createElement('div');
            toast.textContent = 'Press back again to exit';
            toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:8px 20px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;transition:opacity 0.3s;font-family:Poppins,sans-serif';
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; }, 2000);
            setTimeout(() => { try { document.body.removeChild(toast); } catch {} }, 2500);
          }
        } else if (canGoBack) {
          window.history.back();
        }
      });
    }).catch(() => {}); // Not in Capacitor — web only uses popstate
    
    return () => {
      window.removeEventListener('popstate', handleBackButton);
      if (backButtonCleanup) backButtonCleanup.remove();
    };
  }, [location.pathname]);
  
  return null;
}

// Component to handle pending navigation after user loads
function PendingNavigationHandler({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    if (!user) return;
    
    const pendingNav = localStorage.getItem('heartlink_pending_nav');
    if (pendingNav && pendingNav !== '/' && pendingNav !== location.pathname) {
      localStorage.removeItem('heartlink_pending_nav');
      navigate(pendingNav, { replace: true });
    }
  }, [user, navigate, location.pathname]);
  
  return null;
}

// Loading spinner for lazy components — fast, non-blocking
const PageLoader = () => <QuickLoader />;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null);
  const welcomeRef = useRef(null);
  useTheme(); // Initialize theme (applies dark class on <html>)

  useEffect(() => {
    // Register Service Worker for offline caching
    import('@/utils/hybridLoader').then(({ registerServiceWorker, checkForAppUpdate }) => {
      registerServiceWorker();
      // Check for updates after 5 seconds (don't block initial load)
      setTimeout(checkForAppUpdate, 5000);
    });

    // Initialize safe area measurements
    initSafeArea();

    // Track install / first open (idempotent)
    trackInstall();

    // Check for stored user
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        // Check welcome message for returning users
        setTimeout(() => checkWelcome(userData.id), 1000);
        
        // Show daily reward if not shown today (delayed to not conflict with welcome)
        const lastShown = localStorage.getItem('heartlink_daily_reward_date');
        const today = new Date().toISOString().split('T')[0];
        if (lastShown !== today) {
          setTimeout(() => {
            setShowDailyReward(true);
            localStorage.setItem('heartlink_daily_reward_date', today);
          }, 3000);
        }
        
        // Lazy load heavy native modules only when user is logged in
        import('@/utils/nativeGoogleAuth').then(({ initGoogleAuth }) => initGoogleAuth());
        // Preload critical pages for instant navigation
        preloadCriticalPages();
        import('@/services/pushNotifications').then(({ initPushNotifications }) => {
          setTimeout(() => initPushNotifications(userData.id), 2000);
        });
        // Connect WebSocket for real-time updates
        import('@/services/WebSocketService').then((mod) => {
          mod.default.connect(userData.id);
        });
        // Prefetch recent chats in background for instant open
        import('@/utils/cacheManager').then(({ prefetchRecentChats }) => {
          setTimeout(() => prefetchRecentChats(userData.id, API), 3000);
        });
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
      }
    }
    
    // Mark as loaded
    setLoading(false);

    // Prevent pull-to-refresh on mobile
    document.body.style.overscrollBehavior = 'none';
    
    // Setup foreground message listener only if user exists
    let unsubscribe = null;
    if (storedUser) {
      import('@/firebase/messaging').then(({ setupForegroundMessageListener }) => {
        unsubscribe = setupForegroundMessageListener((payload) => {
          console.log('Received foreground message:', payload);
        });
      });
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Check if welcome message should be shown
  const checkWelcome = async (userId) => {
    try {
      const res = await fetch(`${API}/welcome-check/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.show) {
          setWelcomeData(data);
          welcomeRef.current = data;
          fetch(`${API}/welcome-shown/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: data.type })
          }).catch(() => {});
        }
      }
      // 404 = endpoint not deployed yet, silently skip
    } catch (_) {}
  };

  const handleWelcomeCta = (userId) => {
    if (welcomeData) {
      fetch(`${API}/welcome-clicked/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: welcomeData.type })
      }).catch(() => {});
    }
    setWelcomeData(null);
    welcomeRef.current = null;
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    // Initialize FCM push on fresh login
    import('@/services/pushNotifications').then(({ initPushNotifications }) => {
      initPushNotifications(userData.id);
    });
    // Connect WebSocket
    import('@/services/WebSocketService').then((mod) => mod.default.connect(userData.id));
    // Preload critical pages for instant tab switching
    preloadCriticalPages();
    // Check welcome message (show before daily reward)
    setTimeout(() => checkWelcome(userData.id), 800);
    // Show daily reward after login — delayed and uses ref to avoid stale closure
    const lastShown = localStorage.getItem('heartlink_daily_reward_date');
    const today = new Date().toISOString().split('T')[0];
    if (lastShown !== today) {
      setTimeout(() => {
        if (!welcomeRef.current) {
          setShowDailyReward(true);
          localStorage.setItem('heartlink_daily_reward_date', today);
        }
      }, 2500);
    }
  };

  const handleLogout = () => {
    // Disconnect services
    import('@/services/pushNotifications').then(({ removePushNotifications }) => removePushNotifications());
    import('@/services/WebSocketService').then((mod) => mod.default.disconnect());
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('heartlink_token');
  };

  // Show instant background while checking authentication (no spinner)
  if (loading) {
    return <div className="App min-h-screen" style={{ background: 'linear-gradient(to bottom right, #FFF1F2, #FFF0F3, #FFF7ED)' }} />;
  }

  return (
    <div className="App">
      <AdWrapper user={user}>
        <BrowserRouter>
          <NavigationHelper />
          <PendingNavigationHandler user={user} />
          <BackButtonHandler />
          {user && <AppUpdateBanner />}
          {user && <RatingPrompt user={user} />}
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/discover" />} />
            <Route path="/auth" element={!user ? <AuthPage onLogin={handleLogin} /> : <Navigate to="/discover" />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/complete-profile" element={<CompleteProfilePage onLogin={handleLogin} />} />
            <Route path="/mandatory-photo" element={user ? <MandatoryPhotoPage user={user} onComplete={handleLogin} /> : <Navigate to="/auth" />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/data-deletion" element={<DataDeletionPage />} />
            <Route path="/dating-in-:city" element={<CityDatingPage />} />
            <Route path="/dating/:city" element={<CityDatingPage />} />
            <Route path="/admin" element={user && user.is_admin ? <AdminDashboard user={user} /> : <Navigate to="/" />} />
            
            {/* All protected routes */}
            <Route path="/discover" element={user ? <DiscoverPage user={user} /> : <Navigate to="/" />} />
            <Route path="/matches" element={user ? <MatchesPage user={user} /> : <Navigate to="/" />} />
            <Route path="/likes" element={user ? <LikesYouPage user={user} /> : <Navigate to="/" />} />
            <Route path="/chat/:matchId" element={user ? <ErrorBoundary><ChatPage user={user} /></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/profile" element={user ? <ProfilePage user={user} onUpdate={handleLogin} /> : <Navigate to="/" />} />
            <Route path="/profile/:userId" element={user ? <UserProfilePage user={user} /> : <Navigate to="/" />} />
            <Route path="/verify-selfie" element={user ? <Suspense fallback={<ProfileSkeleton />}><SelfieVerificationPage user={user} /></Suspense> : <Navigate to="/" />} />
            <Route path="/privacy" element={user ? <PrivacyPage user={user} onUpdate={handleLogin} /> : <Navigate to="/" />} />
            <Route path="/settings" element={user ? <SettingsPage user={user} /> : <Navigate to="/" />} />
            <Route path="/profile-viewers" element={user ? <ProfileViewersPage user={user} /> : <Navigate to="/" />} />
            <Route path="/enhance-profile" element={user ? <ProfileEnhancementPage user={user} onUpdate={handleLogin} /> : <Navigate to="/" />} />
            <Route path="/notifications" element={user ? <NotificationsPage user={user} /> : <Navigate to="/" />} />
            <Route path="/referral" element={user ? <ReferralPage user={user} /> : <Navigate to="/" />} />
            <Route path="/share-profile" element={user ? <ShareProfilePage user={user} /> : <Navigate to="/" />} />
            <Route path="/payment-history" element={user ? <PaymentHistoryPage user={user} /> : <Navigate to="/" />} />
            <Route path="/share-match" element={user ? <MatchShareCard user={user} /> : <Navigate to="/" />} />
            <Route path="/premium" element={user ? <PremiumPage user={user} onUpdate={handleLogin} /> : <Navigate to="/" />} />
          </Routes>
          </Suspense>
          {/* Welcome Message Modal */}
          {welcomeData && welcomeData.show && user && (
            <Suspense fallback={null}>
              <WelcomeModal 
                data={welcomeData} 
                onCta={() => handleWelcomeCta(user.id)} 
                onClose={() => { setWelcomeData(null); welcomeRef.current = null; }} 
              />
            </Suspense>
          )}

          {/* Daily Reward Modal — only if welcome is not showing */}
          {showDailyReward && user && !welcomeData && (
            <Suspense fallback={null}>
              <DailyRewardModal user={user} onClose={() => setShowDailyReward(false)} />
            </Suspense>
          )}
        </BrowserRouter>
      </AdWrapper>
      
      {/* PWA Install Prompt - only for non-logged in users */}
      {!user && (
        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>
      )}
    </div>
  );
}

export default App;
