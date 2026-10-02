/**
 * HeartLink Page Cache — In-memory + localStorage hybrid
 * Provides instant data on tab switch (native feel)
 * Memory cache = instant (0ms), localStorage = fallback after refresh
 */

const memCache = {};
const TTL = 10 * 60 * 1000; // 10 min

function key(page, id) { return `hl_${page}_${id || 'g'}`; }

export function setPageData(page, data, id) {
  const k = key(page, id);
  memCache[k] = { data, ts: Date.now() };
  try {
    localStorage.setItem(k, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

export function getPageData(page, id, ttl = TTL) {
  const k = key(page, id);
  // Memory first (instant)
  if (memCache[k] && Date.now() - memCache[k].ts < ttl) {
    return memCache[k].data;
  }
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) return null;
    memCache[k] = { data, ts }; // Promote to memory
    return data;
  } catch { return null; }
}

export function clearPageData(page, id) {
  const k = key(page, id);
  delete memCache[k];
  try { localStorage.removeItem(k); } catch (_) {}
}
