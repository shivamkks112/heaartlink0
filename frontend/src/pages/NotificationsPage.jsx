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

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const NotificationsPage = ({ user }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    
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
          navigate('/profile-viewers');
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Toaster position="top-center" />
      <TopBar user={user} title="Notifications" />
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-8 h-8 text-pink-500" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{unreadCount}</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-sm text-gray-500">{unreadCount} unread</p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              variant="outline"
              size="sm"
              className="text-pink-600 border-pink-200"
            >
              <Check className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">No notifications yet</h3>
            <p className="text-gray-500">{"We'll notify you when something happens"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${
                  notification.is_read 
                    ? 'border-gray-100' 
                    : 'border-pink-200 bg-pink-50/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-full ${
                    notification.is_read ? 'bg-gray-100' : 'bg-pink-100'
                  }`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold truncate ${
                        notification.is_read ? 'text-gray-700' : 'text-gray-900'
                      }`}>
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-pink-500 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${
                      notification.is_read ? 'text-gray-500' : 'text-gray-600'
                    }`}>
                      {notification.body}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <Navbar user={user} />
    </div>
  );
};

export default NotificationsPage;
