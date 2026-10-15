import { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, Check, Trash2, Heart, MessageSquare, UserPlus, Megaphone, ChevronRight, Eye, Star, Shield, Image, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import wsService from '@/services/WebSocketService';
import { API } from '@/config/api';
import { getPageData, setPageData } from '@/utils/pageCache';


const NotificationsPage = ({ user }) => {
  const navigate = useNavigate();
  const _nc = getPageData('notifications', user?.id);
  const [notifications, setNotifications] = useState(_nc?.notifications || []);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(_nc?.unreadCount || 0);

  useEffect(() => {
    fetchNotifications();
    // Auto mark all notifications as read on visit
    axios.post(`${API}/notifications/${user.id}/read-all`).catch(() => {});
    
    // Real-time notification listeners
    const unsubMatch = wsService.on('new_match', () => fetchNotifications());
    const unsubLike = wsService.on('new_like', () => fetchNotifications());
    const unsubView = wsService.on('profile_view', () => fetchNotifications());
    
    return () => {
      unsubMatch();
      unsubLike();
      unsubView();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications/${user.id}`);
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
      setPageData('notifications', { notifications: response.data.notifications || [], unreadCount: response.data.unread_count || 0 }, user.id);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`${API}/notifications/${notificationId}/read?user_id=${user.id}`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/${user.id}/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`${API}/notifications/${notificationId}?user_id=${user.id}`);
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'match':
        return <Heart className="w-5 h-5 text-pink-500" />;
      case 'like':
        return <Heart className="w-5 h-5 text-red-500" />;
      case 'superlike':
        return <Star className="w-5 h-5 text-yellow-500" />;
      case 'profile_view':
        return <Eye className="w-5 h-5 text-blue-500" />;
      case 'message':
      case 'unread_reminder':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'verification':
        return <Shield className="w-5 h-5 text-green-500" />;
      case 'photo_approved':
        return <Image className="w-5 h-5 text-green-500" />;
      case 'photo_rejected':
        return <Image className="w-5 h-5 text-red-500" />;
      case 'welcome':
        return <UserCheck className="w-5 h-5 text-pink-500" />;
      case 'online':
        return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'admin':
      case 'promotion':
        return <Megaphone className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Navigate using route from notification data (most reliable)
    if (notification.data?.route) {
      navigate(notification.data.route);
      return;
    }
    
    // Fallback navigation based on type
    switch (notification.type) {
      case 'match':
        navigate('/matches');
        break;
      case 'like':
      case 'superlike':
        navigate('/likes');
        break;
      case 'message':
      case 'unread_reminder':
        if (notification.data?.match_id) {
          navigate(`/chat/${notification.data.match_id}`);
        } else {
          navigate('/matches');
        }
        break;
      case 'profile_view':
        if (notification.data?.viewer_id) {
          navigate(`/profile/${notification.data.viewer_id}`);
        } else {
          navigate('/likes');
        }
        break;
      case 'crush':
        navigate('/likes');
        break;
      case 'game':
      case 'game_result':
        if (notification.data?.match_id) {
          navigate(`/chat/${notification.data.match_id}`);
        } else {
          navigate('/matches');
        }
        break;
      case 'verification':
      case 'photo_approved':
      case 'photo_rejected':
        navigate('/profile');
        break;
      case 'online':
        navigate('/matches');
        break;
      case 'welcome':
        navigate('/discover');
        break;
      default:
        break;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // ── Group duplicate notifications ──
  const groupedNotifications = (() => {
    if (!notifications.length) return [];
    const groups = [];
    const seen = new Map();
    
    for (const n of notifications) {
      // Group by: same type + same title prefix (e.g. "Rani came online") within same day
      const day = new Date(n.created_at).toDateString();
      const key = `${n.type}::${(n.title || '').split(' ').slice(0, 2).join(' ')}::${day}`;
      
      if (seen.has(key)) {
        const group = seen.get(key);
        group.count++;
        group.ids.push(n.id);
        // Keep the latest timestamp
        if (new Date(n.created_at) > new Date(group.latest.created_at)) {
          group.latest = n;
        }
      } else {
        const group = { latest: n, count: 1, ids: [n.id] };
        seen.set(key, group);
        groups.push(group);
      }
    }
    return groups;
  })();

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
      <Toaster position="top-center" />
      <TopBar user={user} title="Notifications" />
      
      <div className="max-w-2xl mx-auto px-4 py-6" style={{ paddingTop: 'calc(var(--safe-top, 24px) + 68px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 rounded-xl" style={{ background: 'var(--m3-primary-container)' }}>
              <Bell className="w-6 h-6" style={{ color: 'var(--m3-primary)' }} />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--m3-primary)' }}>
                  <span className="text-white text-[10px] font-bold">{unreadCount}</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--m3-on-surface)' }}>Notifications</h1>
              <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>{unreadCount} unread</p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs font-semibold px-4 py-2 rounded-full transition-all active:scale-95"
              style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-primary)' }}
            >
              <Check className="w-3.5 h-3.5 mr-1 inline" /> Read all
            </button>
          )}
        </div>

        {/* Notifications */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl p-4 flex gap-3" style={{ background: 'var(--m3-surface-container-lowest)' }}>
                <div className="w-10 h-10 rounded-xl m3-skeleton flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-3/4 h-4 m3-skeleton rounded-full" />
                  <div className="w-1/2 h-3 m3-skeleton rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : groupedNotifications.length === 0 ? (
          <div className="text-center py-16 m3-animate-in">
            <div className="w-20 h-20 mx-auto mb-4 rounded-[28px] flex items-center justify-center" style={{ background: 'var(--m3-surface-container-high)' }}>
              <Bell className="w-10 h-10" style={{ color: 'var(--m3-outline)' }} />
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--m3-on-surface)' }}>No notifications yet</h3>
            <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>We'll notify you when something happens</p>
          </div>
        ) : (
          <div className="space-y-2 m3-stagger">
            {groupedNotifications.map((group) => {
              const n = group.latest;
              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className="rounded-2xl p-4 cursor-pointer transition-all duration-200 active:scale-[0.99]"
                  style={{
                    background: n.is_read ? 'var(--m3-surface-container-lowest)' : 'var(--m3-primary-container)',
                    boxShadow: n.is_read ? 'var(--m3-elevation-1)' : 'var(--m3-elevation-2)',
                    border: n.is_read ? '1px solid var(--m3-outline-variant)' : '1px solid transparent',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl flex-shrink-0"
                      style={{ background: n.is_read ? 'var(--m3-surface-container-high)' : 'var(--m3-surface-container-lowest)' }}>
                      {getNotificationIcon(n.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate"
                          style={{ color: n.is_read ? 'var(--m3-on-surface-variant)' : 'var(--m3-on-surface)' }}>
                          {n.title}
                        </h3>
                        {!n.is_read && (
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--m3-primary)' }} />
                        )}
                      </div>
                      <p className="text-[13px] mt-0.5 leading-relaxed"
                        style={{ color: 'var(--m3-on-surface-variant)' }}>
                        {group.count > 1 ? `${n.body} (${group.count}x today)` : n.body}
                      </p>
                      <p className="text-[11px] mt-1.5 font-medium"
                        style={{ color: 'var(--m3-outline)' }}>
                        {formatTime(n.created_at)}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {group.count > 1 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full mr-1"
                          style={{ background: 'var(--m3-surface-container-high)', color: 'var(--m3-on-surface-variant)' }}>
                          {group.count}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          group.ids.forEach(id => deleteNotification(id));
                        }}
                        className="p-2 rounded-full transition-colors"
                        style={{ color: 'var(--m3-outline)' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4" style={{ color: 'var(--m3-outline)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <Navbar user={user} />
    </div>
  );
};

export default NotificationsPage;
