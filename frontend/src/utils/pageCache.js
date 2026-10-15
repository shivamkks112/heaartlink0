/**
 * HeartLink Page Cache — Stale-While-Revalidate
 * ALWAYS returns cached data if available (even stale)
 * Pages show instantly, refresh silently in background
 */

const memCache = {};

function key(page, id) { return `hl_${page}_${id || 'g'}`; }

export function setPageData(page, data, id) {
  const k = key(page, id);
  memCache[k] = { data, ts: Date.now() };
  try {
    localStorage.setItem(k, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

export function getPageData(page, id) {
  const k = key(page, id);
  // Memory first (instant, 0ms)
  if (memCache[k]?.data) {
    return memCache[k].data;
  }
  // Fallback to localStorage — ALWAYS return data, never expire
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (!data) return null;
    memCache[k] = { data, ts }; // Promote to memory
    return data;
  } catch { return null; }
}

// Check if cache is older than given ms (for background refresh decisions)
export function isCacheStale(page, id, maxAge = 5 * 60 * 1000) {
  const k = key(page, id);
  const entry = memCache[k];
  if (!entry) return true;
  return Date.now() - entry.ts > maxAge;
}

export function clearPageData(page, id) {
  const k = key(page, id);
  delete memCache[k];
  try { localStorage.removeItem(k); } catch (_) {}
}
