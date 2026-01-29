/**
 * WebSocket Service for Real-time Features
 * - Online/Offline status
 * - Real-time chat messages
 * - Typing indicators
 * - Match notifications
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.userId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.isConnected = false;
    this.onlineUsers = new Set();
  }

  /**
   * Connect to WebSocket server
   */
  connect(userId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.userId = userId;
    const wsUrl = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
    
    if (!wsUrl) {
      console.error('WebSocket URL not configured');
      return;
    }

    try {
      this.ws = new WebSocket(`${wsUrl}/api/ws/${userId}`);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { userId });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.emit('disconnected', { userId });
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', { error });
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    switch (data.type) {
      case 'status_update':
        // User online/offline status changed
        if (data.is_online) {
          this.onlineUsers.add(data.user_id);
        } else {
          this.onlineUsers.delete(data.user_id);
        }
        this.emit('status_update', data);
        break;

      case 'message':
        // New chat message
        this.emit('new_message', data.message);
        break;

      case 'typing':
        // User is typing
        this.emit('typing', data);
        break;

      case 'new_match':
        // New match notification
        this.emit('new_match', data);
        break;

      case 'superlike':
        // Received a superlike
        this.emit('superlike', data);
        break;

      case 'new_like':
        // Someone liked you
        this.emit('new_like', data);
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Attempt to reconnect on disconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
    
    setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Send message through WebSocket
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    console.error('WebSocket not connected');
    return false;
  }

  /**
   * Send chat message
   */
  sendMessage(matchId, receiverId, content) {
    return this.send({
      match_id: matchId,
      receiver_id: receiverId,
      content: content
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(matchId, receiverId) {
    return this.send({
      type: 'typing',
      match_id: matchId,
      receiver_id: receiverId
    });
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  /**
   * Get all online users
   */
  getOnlineUsers() {
    return Array.from(this.onlineUsers);
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to all listeners
   */
  emit(event, data) {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.userId = null;
    this.onlineUsers.clear();
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      userId: this.userId,
      onlineUsersCount: this.onlineUsers.size
    };
  }
}

// Singleton instance
const wsService = new WebSocketService();

export default wsService;
