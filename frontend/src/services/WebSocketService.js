/**
 * WebSocket Service for Real-time Features
 * Central hub for all real-time events:
 * - Online/Offline status
 * - Chat messages & typing indicators
 * - Match/Like/Superlike notifications
 * - Badge count updates
 * - Profile view notifications
 */

import { WS_URL } from '@/config/api';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.userId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
    this.listeners = new Map();
    this.isConnected = false;
    this.onlineUsers = new Set();
    this.badgeCounts = { likes_count: 0, unread_messages: 0, notification_count: 0 };
    this.pingInterval = null;
  }

  connect(userId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (!WS_URL) return;

    this.userId = userId;

    try {
      this.ws = new WebSocket(`${WS_URL}/api/ws/${userId}`);
      
      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { userId });
        
        // Ping every 30s to keep connection alive
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          // ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        clearInterval(this.pingInterval);
        this.emit('disconnected', {});
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };
    } catch (error) {
      console.error('WebSocket connect failed:', error);
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case 'status_update':
        if (data.is_online) {
          this.onlineUsers.add(data.user_id);
        } else {
          this.onlineUsers.delete(data.user_id);
        }
        this.emit('status_update', data);
        break;

      case 'message':
        this.emit('new_message', data.message);
        // Auto-increment unread badge
        this.badgeCounts.unread_messages++;
        this.emit('badge_update', { ...this.badgeCounts });
        break;

      case 'typing':
        this.emit('typing', data);
        break;

      case 'new_match':
        this.emit('new_match', data);
        this.emit('badge_update', { ...this.badgeCounts });
        break;

      case 'superlike':
        this.emit('superlike', data);
        break;

      case 'new_like':
        this.emit('new_like', data);
        break;

      case 'profile_view':
        this.emit('profile_view', data);
        break;

      case 'badge_update':
        // Authoritative badge counts from server
        this.badgeCounts = {
          likes_count: data.likes_count || 0,
          unread_messages: data.unread_messages || 0,
          notification_count: data.notification_count || 0
        };
        this.emit('badge_update', { ...this.badgeCounts });
        break;

      default:
        break;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    setTimeout(() => {
      if (this.userId) this.connect(this.userId);
    }, Math.min(this.reconnectDelay * this.reconnectAttempts, 15000));
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendMessage(matchId, receiverId, content) {
    return this.send({ match_id: matchId, receiver_id: receiverId, content });
  }

  sendTyping(matchId, receiverId) {
    return this.send({ type: 'typing', match_id: matchId, receiver_id: receiverId });
  }

  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers);
  }

  getBadgeCounts() {
    return { ...this.badgeCounts };
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch (e) { /* ignore */ }
    });
  }

  disconnect() {
    clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.userId = null;
    this.onlineUsers.clear();
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      userId: this.userId,
      onlineUsersCount: this.onlineUsers.size
    };
  }
}

const wsService = new WebSocketService();
export default wsService;
