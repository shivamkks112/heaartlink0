import { Heart, Compass, MessageSquare, User, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import wsService from '@/services/WebSocketService';

const Navbar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [likesCount, setLikesCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    if (user?.id && !wsService.isConnected) wsService.connect(user.id);
    const cached = wsService.getBadgeCounts();
    if (cached.likes_count) setLikesCount(cached.likes_count);
    if (cached.notification_count) setNotificationCount(cached.notification_count);
    if (cached.unread_messages) setUnreadMessages(cached.unread_messages);

    const u1 = wsService.on('badge_update', (d) => { setLikesCount(d.likes_count||0); setNotificationCount(d.notification_count||0); setUnreadMessages(d.unread_messages||0); });
    const u2 = wsService.on('new_like', () => setLikesCount(p => p + 1));
    const u3 = wsService.on('new_match', () => setNotificationCount(p => p + 1));
    return () => { u1(); u2(); u3(); };
  }, [user?.id]);

  useEffect(() => {
    if (location.pathname === '/matches' || location.pathname.startsWith('/chat')) setUnreadMessages(0);
    if (location.pathname === '/likes') setLikesCount(0);
    if (location.pathname === '/notifications') setNotificationCount(0);
  }, [location.pathname]);

  const totalAlerts = notificationCount + unreadMessages;

  const tabs = [
    { id: 'discover', path: '/discover', icon: Compass, label: 'Discover', badge: 0 },
    { id: 'likes', path: '/likes', icon: Heart, label: 'Likes', badge: likesCount, fillActive: true },
    { id: 'notifications', path: '/notifications', icon: Bell, label: 'Alerts', badge: totalAlerts },
    { id: 'matches', path: '/matches', icon: MessageSquare, label: 'Chats', badge: unreadMessages, matchChat: true },
    { id: 'profile', path: '/profile', icon: User, label: 'Profile', badge: 0 },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] bg-[#0f0f0f]/98 backdrop-blur-xl border-t border-white/[0.06]"
      data-testid="bottom-nav"
      style={{
        // Triple-redundant safe bottom padding:
        // 1. var(--safe-bottom) from safeArea.js (plugin or heuristic)
        // 2. env() as CSS-native fallback
        // 3. Hard minimum 8px for web
        paddingBottom: 'max(var(--safe-bottom, 12px), env(safe-area-inset-bottom, 0px), 8px)',
      }}
    >
      {/* Icon row — min-height ensures 48dp+ touch targets */}
      <div
        className="flex items-stretch justify-around"
        style={{
          height: 'var(--nav-inner, 52px)',
          minHeight: '48px',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.matchChat
            ? isActive(tab.path) || location.pathname.startsWith('/chat')
            : isActive(tab.path);

          return (
            <button
              key={tab.id}
              data-testid={`nav-${tab.id}`}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 touch-manipulation ${
                active ? 'text-pink-400' : 'text-gray-400 active:text-gray-200'
              }`}
              style={{
                WebkitTapHighlightColor: 'transparent',
                // Ensure every button is at least 48px tall for tap target
                minHeight: '48px',
              }}
            >
              <div className="relative">
                <Icon
                  className={`w-[22px] h-[22px] ${active && tab.fillActive ? 'fill-current' : ''}`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-none ${active ? 'font-semibold' : 'font-normal'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
