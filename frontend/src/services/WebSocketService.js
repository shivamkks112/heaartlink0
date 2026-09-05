/**
 * WebSocket Service for Real-time Features
 * Central hub for ALL real-time events:
 * - Online/Offline status
 * - Chat messages & typing indicators
 * - Match/Like/Superlike notifications
 * - Badge count updates
 * - Profile view notifications
 * - Message delivered/read receipts
 * - Screenshot alerts & system warnings
 */

import { WS_URL } from '@/config/api';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.userId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 15;
    this.reconnectDelay = 2000;
    this.listeners = new Map();
    this.isConnected = false;
    this.onlineUsers = new Set();
    this.badgeCounts = { likes_count: 0, unread_messages: 0, notification_count: 0 };
    this.pingInterval = null;
    this._connecting = false;
  }

  connect(userId) {
    if (this._connecting) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.userId === userId) return;
    if (!WS_URL) return;

    this._connecting = true;
    this.userId = userId;

    // Close existing connection cleanly before opening a new one
    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
      this.ws = null;
    }

    try {
      this.ws = new WebSocket(`${WS_URL}/api/ws/${userId}`);
      
      this.ws.onopen = () => {
        this._connecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { userId });
        
        // Ping every 25s to keep connection alive AND update last_active on server
        // Also detect zombie connections — if pong doesn't come back, reconnect
        clearInterval(this.pingInterval);
        this._lastPongAt = Date.now();
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            // If no pong received in 35s (ping is 25s + 10s grace), connection is dead
            if (Date.now() - this._lastPongAt > 35000) {
              console.warn('WS zombie detected — no pong in 35s, reconnecting');
              try { this.ws.close(); } catch(e) {}
              return;
            }
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
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
        this._connecting = false;
        this.isConnected = false;
        clearInterval(this.pingInterval);
        this.emit('disconnected', {});
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this._connecting = false;
      };
    } catch (error) {
      this._connecting = false;
      console.error('WebSocket connect failed:', error);
    }
  }

  handleMessage(data) {
    // Any message from server proves connection is alive
    this._lastPongAt = Date.now();
    
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
        // Only increment unread for messages from OTHER users (not own echo)
        if (data.message && data.message.sender_id !== this.userId) {
          this.badgeCounts.unread_messages++;
          this.emit('badge_update', { ...this.badgeCounts });
        }
        break;

      case 'typing':
      case 'typing_indicator':
        this.emit('typing', data);
        this.emit('typing_indicator', data);
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
        this.badgeCounts = {
          likes_count: data.likes_count || 0,
          unread_messages: data.unread_messages || 0,
          notification_count: data.notification_count || 0
        };
        this.emit('badge_update', { ...this.badgeCounts });
        break;

      case 'screenshot_alert':
        this.emit('screenshot_alert', data);
        break;

      case 'system_warning':
        this.emit('system_warning', data);
        break;

      case 'message_deleted':
        this.emit('message_deleted', data);
        break;

      case 'messages_read':
        this.emit('messages_read', data);
        break;

      case 'message_delivered':
        this.emit('message_delivered', data);
        break;

      default:
        // Emit unknown types so components can handle them
        this.emit(data.type, data);
        break;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
    setTimeout(() => {
      if (this.userId && !this.isConnected) this.connect(this.userId);
    }, delay);
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

  sendTyping(matchId, receiverId, isTyping = true) {
    return this.send({ type: 'typing', match_id: matchId, receiver_id: receiverId, is_typing: isTyping });
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
    this._connecting = false;
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
