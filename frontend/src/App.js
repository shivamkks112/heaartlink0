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

// OTA: Notify plugin that JS loaded successfully (prevents rollback)
try { import('@capgo/capacitor-updater').then(m => m.CapacitorUpdater.notifyAppReady()).catch(() => {}); } catch {}

// Critical pages - loaded immediately (lightweight)

// Core pages — ALL eagerly loaded for instant native feel
import DiscoverPage from '@/pages/DiscoverPage';
import MatchesPage from '@/pages/MatchesPage';
import ChatPage from '@/pages/ChatPage';
import ProfilePage from '@/pages/ProfilePage';
import LikesYouPage from '@/pages/LikesYouPage';
// Lazy load all non-core pages
const UserProfilePage = lazy(() => import('@/pages/UserProfilePage'));
const PremiumPage = lazy(() => import('@/pages/PremiumPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const ProfileEnhancementPage = lazy(() => import('@/pages/ProfileEnhancementPage'));
const ReferralPage = lazy(() => import('@/pages/ReferralPage'));
const ShareProfilePage = lazy(() => import('@/pages/ShareProfilePage'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const ProfileViewersPage = lazy(() => import('@/pages/ProfileViewersPage'));
const PaymentHistoryPage = lazy(() => import('@/pages/PaymentHistoryPage'));
const FeedbackPage = lazy(() => import('@/pages/FeedbackPage'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const MandatoryPhotoPage = lazy(() => import('@/pages/MandatoryPhotoPage'));
const CompleteProfilePage = lazy(() => import('@/pages/CompleteProfilePage'));
const SelfieVerificationPage = lazy(() => import('@/pages/SelfieVerificationPage'));
const DataDeletionPage = lazy(() => import('@/pages/DataDeletionPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const CityDatingPage = lazy(() => import('@/pages/CityDatingPage'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));

// Auth & rare pages — lazy
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'));
const MatchShareCard = lazy(() => import('@/pages/MatchShareCard'));
const DailyRewardModal = lazy(() => import('@/components/DailyRewardModal'));
const WelcomeModal = lazy(() => import('@/components/WelcomeModal'));
const InstallPrompt = lazy(() => import('@/components/InstallPrompt'));

// Preload critical pages in background — called after login for instant navigation
function preloadCriticalPages() {
  // Core tab pages are already eagerly imported
  // Preload lazy-loaded pages user will likely visit
  setTimeout(() => {
    import('@/pages/SettingsPage');
    import('@/pages/PremiumPage');
    import('@/pages/UserProfilePage');
  }, 2000);
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


// Back button handler — navigate to Recent tab first, then double-press to exit
// Back closes open popups/sheets first. Returns true if something was closed.
function closeTopPopup() {
  const visible = (el) => el && el.getClientRects().length > 0;
  const radix = [...document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-popper-content-wrapper]')].filter(visible);
  if (radix.length) {
    const target = radix[radix.length - 1];
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    return true;
  }
  const modals = [...document.querySelectorAll('[data-testid*="modal"], [data-testid*="sheet"], [data-testid*="popup"]')].filter(visible);
  for (let i = modals.length - 1; i >= 0; i--) {
    const btn = modals[i].querySelector('[data-testid*="close"], [aria-label="Close"], [data-testid*="dismiss"]');
    if (btn) { btn.click(); return true; }
  }
  return false;
}

function BackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastBackPress = useRef(0);
  const currentPath = useRef(location.pathname);
  const navigateRef = useRef(navigate);
  
  const RECENT_TAB = '/matches';
  const MAIN_TABS = ['/discover', '/likes', '/matches', '/profile', '/notifications'];
  
  useEffect(() => { currentPath.current = location.pathname; }, [location.pathname]);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  
  useEffect(() => {
    let handle = null;
    let mounted = true;
    
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        
        handle = await App.addListener('backButton', ({ canGoBack }) => {
          if (!mounted) return;
          if (closeTopPopup()) return;
          const path = currentPath.current;
          const isOnRecent = path === RECENT_TAB || path === RECENT_TAB + '/';
          const isMainTab = MAIN_TABS.some(tab => path === tab || path === tab + '/');
          
          if (isOnRecent) {
            const now = Date.now();
            if (now - lastBackPress.current < 2000) {
              App.exitApp();
            } else {
              lastBackPress.current = now;
              const t = document.createElement('div');
              t.textContent = 'Press back again to exit';
              t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:white;padding:10px 24px;border-radius:24px;font-size:13px;z-index:99999;pointer-events:none;font-family:Poppins,sans-serif';
              document.body.appendChild(t);
              setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 1700);
              setTimeout(() => { try { document.body.removeChild(t); } catch {} }, 2100);
            }
          } else if (isMainTab) {
            navigateRef.current(RECENT_TAB, { replace: true });
          } else if (canGoBack && window.history.length > 1) {
            window.history.back();
          } else {
            navigateRef.current(RECENT_TAB, { replace: true });
          }
        });
      } catch {}
    })();
    
    return () => {
      mounted = false;
      if (handle) { try { handle.remove(); } catch {} }
    };
  }, []);
  
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
        // INSTANT: Prefetch ALL page data in parallel (no delay)
        import('@/utils/cacheManager').then(({ prefetchAllData }) => {
          prefetchAllData(userData.id, API);
        });
        // Connect WebSocket for real-time updates
        import('@/services/WebSocketService').then((mod) => {
          mod.default.connect(userData.id);
        });
        // Push notifications (lower priority, delayed)
        setTimeout(() => {
          import('@/services/pushNotifications').then(({ initPushNotifications }) => {
            initPushNotifications(userData.id);
          });
        }, 3000);
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
      }
    }
    
    // Mark as loaded
    setLoading(false);
    
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
            <Route path="/" element={!user ? <Suspense fallback={<QuickLoader />}><LandingPage /></Suspense> : <Navigate to="/discover" />} />
            <Route path="/auth" element={!user ? <Suspense fallback={<QuickLoader />}><AuthPage onLogin={handleLogin} /></Suspense> : <Navigate to="/discover" />} />
            <Route path="/forgot-password" element={<Suspense fallback={<QuickLoader />}><ForgotPasswordPage /></Suspense>} />
            <Route path="/complete-profile" element={<Suspense fallback={<QuickLoader />}><CompleteProfilePage onLogin={handleLogin} /></Suspense>} />
            <Route path="/mandatory-photo" element={user ? <Suspense fallback={<QuickLoader />}><MandatoryPhotoPage user={user} onComplete={handleLogin} /></Suspense> : <Navigate to="/auth" />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<Suspense fallback={<QuickLoader />}><TermsPage /></Suspense>} />
            <Route path="/data-deletion" element={<Suspense fallback={<QuickLoader />}><DataDeletionPage /></Suspense>} />
            <Route path="/dating-in-:city" element={<Suspense fallback={<QuickLoader />}><CityDatingPage /></Suspense>} />
            <Route path="/dating/:city" element={<Suspense fallback={<QuickLoader />}><CityDatingPage /></Suspense>} />
            <Route path="/admin" element={user && user.is_admin ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><AdminDashboard user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            
            {/* All protected routes — wrapped in ErrorBoundary */}
            <Route path="/discover" element={user ? <ErrorBoundary><DiscoverPage user={user} /></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/matches" element={user ? <ErrorBoundary><MatchesPage user={user} /></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/likes" element={user ? <ErrorBoundary><LikesYouPage user={user} /></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/chat/:matchId" element={user ? <ErrorBoundary><ChatPage user={user} /></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/profile" element={user ? <ErrorBoundary><ProfilePage user={user} onUpdate={handleLogin} /></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/profile/:userId" element={user ? <ErrorBoundary><Suspense fallback={<ProfileSkeleton />}><UserProfilePage user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/verify-selfie" element={user ? <ErrorBoundary><Suspense fallback={<ProfileSkeleton />}><SelfieVerificationPage user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/privacy" element={user ? <ErrorBoundary><PrivacyPage user={user} onUpdate={handleLogin} /></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/settings" element={user ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><SettingsPage user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/profile-viewers" element={user ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><ProfileViewersPage user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/enhance-profile" element={user ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><ProfileEnhancementPage user={user} onUpdate={handleLogin} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/notifications" element={user ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><NotificationsPage user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/referral" element={user ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><ReferralPage user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/share-profile" element={user ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><ShareProfilePage user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/payment-history" element={user ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><PaymentHistoryPage user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/feedback" element={user ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><FeedbackPage user={user} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/share-match" element={user ? <ErrorBoundary><MatchShareCard user={user} /></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/premium" element={user ? <ErrorBoundary><Suspense fallback={<QuickLoader />}><PremiumPage user={user} onUpdate={handleLogin} /></Suspense></ErrorBoundary> : <Navigate to="/" />} />
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
          {showDailyReward && user && !welcomeData && !window.location.pathname.startsWith('/chat') && !window.location.pathname.startsWith('/admin') && (
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
