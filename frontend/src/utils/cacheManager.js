/**
 * HeartLink Cache Manager
 * Offline caching for Discover profiles, Chat prefetch, Image optimization
 */

const CACHE_KEYS = {
  DISCOVER: 'hl_discover_cache',
  CONVERSATIONS: 'hl_conversations_cache',
  CHAT_PREFIX: 'hl_chat_',
};
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch (e) {
    // Storage full — clear old caches
    Object.values(CACHE_KEYS).forEach(k => {
      if (k !== key) localStorage.removeItem(k);
    });
    try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch (_) {}
  }
}

function getCache(key, ttl = CACHE_TTL) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// Discover profiles cache
export function cacheDiscoverProfiles(userId, profiles) {
  setCache(`${CACHE_KEYS.DISCOVER}_${userId}`, profiles);
}

export function getCachedDiscoverProfiles(userId) {
  return getCache(`${CACHE_KEYS.DISCOVER}_${userId}`);
}

// Conversations cache
export function cacheConversations(userId, conversations) {
  setCache(`${CACHE_KEYS.CONVERSATIONS}_${userId}`, conversations);
}

export function getCachedConversations(userId) {
  return getCache(`${CACHE_KEYS.CONVERSATIONS}_${userId}`, 3 * 60 * 1000); // 3 min TTL
}

// Chat messages cache
export function cacheChatMessages(matchId, messages) {
  setCache(`${CACHE_KEYS.CHAT_PREFIX}${matchId}`, messages.slice(-30)); // Last 30 msgs
}

export function getCachedChatMessages(matchId) {
  return getCache(`${CACHE_KEYS.CHAT_PREFIX}${matchId}`, 2 * 60 * 1000); // 2 min TTL
}

// Prefetch recent chats in background
export async function prefetchRecentChats(userId, apiBase) {
  try {
    const res = await fetch(`${apiBase}/matches/${userId}/conversations`);
    if (!res.ok) return;
    const convos = await res.json();
    cacheConversations(userId, convos);
    
    // Prefetch first 3 chat messages
    const top3 = (convos || []).slice(0, 3);
    for (const c of top3) {
      try {
        const msgRes = await fetch(`${apiBase}/messages/${c.match_id}?user_id=${userId}&limit=20`);
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          cacheChatMessages(c.match_id, msgs);
        }
      } catch (_) {}
    }
  } catch (_) {}
}
