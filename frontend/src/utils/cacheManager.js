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
  return getCache(`${CACHE_KEYS.CONVERSATIONS}_${userId}`, 30 * 60 * 1000); // 30 min TTL
}

// Chat messages cache
export function cacheChatMessages(matchId, messages) {
  setCache(`${CACHE_KEYS.CHAT_PREFIX}${matchId}`, messages.slice(-30)); // Last 30 msgs
}

export function getCachedChatMessages(matchId) {
  return getCache(`${CACHE_KEYS.CHAT_PREFIX}${matchId}`, 30 * 60 * 1000); // 30 min TTL
}

// Prefetch recent chats in background
export async function prefetchRecentChats(userId, apiBase) {
  try {
    const res = await fetch(`${apiBase}/matches/${userId}`);
    if (!res.ok) return;
    const allMatches = await res.json();
    
    // Prefetch first 3 match conversations
    const top3 = (allMatches || []).slice(0, 3);
    for (const m of top3) {
      try {
        const msgRes = await fetch(`${apiBase}/messages/${m.match_id}?user_id=${userId}&limit=20`);
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          cacheChatMessages(m.match_id, msgs);
        }
      } catch (_) {}
    }
  } catch (_) {}
}

// GLOBAL PREFETCH — fetch ALL page data in parallel on app startup
// Pages read from pageCache first → instant render → background refresh
export async function prefetchAllData(userId, apiBase) {
  const { setPageData } = await import('@/utils/pageCache');
  
  try {
    // Fire ALL requests in parallel
    const [matchesRes, convsRes, likesRes, profilesRes, crushesRes, viewersRes] = await Promise.allSettled([
      fetch(`${apiBase}/matches/${userId}`).then(r => r.json()),
      fetch(`${apiBase}/conversations/${userId}`).then(r => r.json()),
      fetch(`${apiBase}/likes/${userId}`).then(r => r.json()),
      fetch(`${apiBase}/discover/${userId}`).then(r => r.json()),
      fetch(`${apiBase}/crushes/${userId}`).then(r => r.json()),
      fetch(`${apiBase}/profile-viewers/${userId}`).then(r => r.json()),
    ]);
    
    const matches = matchesRes.status === 'fulfilled' ? matchesRes.value : [];
    const convs = convsRes.status === 'fulfilled' ? convsRes.value : [];
    const likes = likesRes.status === 'fulfilled' ? likesRes.value : {};
    const profiles = profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value) ? profilesRes.value : null;
    const crushes = crushesRes.status === 'fulfilled' ? crushesRes.value : {};
    const viewers = viewersRes.status === 'fulfilled' ? viewersRes.value : {};
    
    // Cache for instant page loads
    setPageData('matches', { matches, conversations: convs, activeUsers: [] }, userId);
    setPageData('likes', { likes, crushes, viewers }, userId);
    if (profiles) {
      setPageData('discover', profiles, userId);
      cacheDiscoverProfiles(userId, profiles);
    }
    // Warm image cache so Likes/Discover/Chats show photos instantly
    const warm = [
      ...(likes.super_likes || []), ...(likes.regular_likes || []),
      ...(profiles || []).slice(0, 5), ...(convs || []).map(c => c.user).filter(Boolean),
    ].slice(0, 30);
    warm.forEach(p => { const u = p.profile_picture || p.photos?.[0]; if (u) { const img = new Image(); img.src = u; } });
    cacheConversations(userId, convs);
    
    // Prefetch ALL chat messages (not just top 3)
    const allConvs = (convs || []).slice(0, 10);
    await Promise.allSettled(allConvs.map(async (conv) => {
      try {
        const msgRes = await fetch(`${apiBase}/messages/${conv.match_id}?user_id=${userId}&limit=20`);
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          cacheChatMessages(conv.match_id, msgs);
          setPageData('chat', { messages: msgs, otherUser: conv.user }, conv.match_id);
        }
      } catch (_) {}
    }));
    
    console.log('[Prefetch] All data cached for instant page loads');
  } catch (err) {
    console.warn('[Prefetch] Partial failure:', err.message);
  }
}
