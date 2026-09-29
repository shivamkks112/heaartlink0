import { Heart, Compass, MessageSquare, User, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import wsService from '@/services/WebSocketService';

const Navbar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [likesCount, setLikesCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const pathRef = useRef(location.pathname);

  const isActive = (path) => location.pathname === path;

  // Keep pathRef in sync
  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  const handleBadgeUpdate = useCallback((d) => {
    const p = pathRef.current;
    // Don't restore counts for the section user is currently viewing
    if (p !== '/likes') setLikesCount(d.likes_count || 0);
    if (p !== '/matches' && !p.startsWith('/chat')) setUnreadMessages(d.unread_messages || 0);
    if (p !== '/notifications') setNotificationCount(d.notification_count || 0);
  }, []);

  useEffect(() => {
    if (user?.id && !wsService.isConnected) wsService.connect(user.id);
    const cached = wsService.getBadgeCounts();
    if (cached.likes_count) setLikesCount(cached.likes_count);
    if (cached.notification_count) setNotificationCount(cached.notification_count);
    if (cached.unread_messages) setUnreadMessages(cached.unread_messages);

    const u1 = wsService.on('badge_update', handleBadgeUpdate);
    const u2 = wsService.on('new_like', () => { if (pathRef.current !== '/likes') setLikesCount(p => p + 1); });
    const u3 = wsService.on('new_match', () => setNotificationCount(p => p + 1));
    return () => { u1(); u2(); u3(); };
  }, [user?.id, handleBadgeUpdate]);

  useEffect(() => {
    if (location.pathname === '/matches' || location.pathname.startsWith('/chat')) setUnreadMessages(0);
    if (location.pathname === '/likes') setLikesCount(0);
    if (location.pathname === '/notifications') setNotificationCount(0);
  }, [location.pathname]);

  const totalAlerts = notificationCount;

  const tabs = [
    { id: 'discover', path: '/discover', icon: Compass, label: 'Discover', badge: 0 },
    { id: 'likes', path: '/likes', icon: Heart, label: 'Likes', badge: likesCount, fillActive: true },
    { id: 'notifications', path: '/notifications', icon: Bell, label: 'Alerts', badge: totalAlerts },
    { id: 'matches', path: '/matches', icon: MessageSquare, label: 'Chats', badge: unreadMessages, matchChat: true },
    { id: 'profile', path: '/profile', icon: User, label: 'Profile', badge: 0 },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100]"
      data-testid="bottom-nav"
      style={{
        paddingBottom: 'max(var(--safe-bottom, 12px), env(safe-area-inset-bottom, 0px), 8px)',
        background: 'var(--m3-glass-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid var(--m3-glass-border)',
      }}
    >
      <div
        className="flex items-stretch justify-around"
        style={{ height: 'var(--nav-inner, 52px)', minHeight: '48px' }}
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
              className="flex-1 flex flex-col items-center justify-center gap-[2px] touch-manipulation relative"
              style={{
                WebkitTapHighlightColor: 'transparent',
                minHeight: '48px',
              }}
            >
              {/* M3 Active Indicator Pill */}
              <div className={`relative flex items-center justify-center rounded-full transition-all duration-150 ${
                active
                  ? 'w-16 h-8'
                  : 'bg-transparent w-8 h-8'
              }`}
              style={active ? { background: 'var(--m3-primary-container)' } : {}}
              >
                <div className="relative">
                  <Icon
                    className={`w-[20px] h-[20px] transition-colors duration-100 ${
                      active && tab.fillActive ? 'fill-current' : ''
                    }`}
                    style={{ color: active ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)' }}
                    strokeWidth={active ? 2.4 : 1.7}
                  />
                  {tab.badge > 0 && (
                    <span className="m3-badge">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[11px] leading-none font-medium transition-colors duration-200"
                style={{ color: active ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)' }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default React.memo(Navbar);
