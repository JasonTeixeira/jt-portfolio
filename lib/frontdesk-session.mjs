/**
 * frontdesk-session.mjs — remembers an SMS conversation between webhook calls.
 *
 * Each inbound SMS is a separate HTTP request, so we key the running history by
 * the customer's phone number. In-memory with a TTL for the MVP (persists across
 * requests on a warm serverless instance — good enough for a demo conversation
 * that completes in minutes). Swap to Supabase/Upstash for durable production
 * state behind the same three functions.
 */

const TTL_MS = 30 * 60 * 1000; // 30 min
const MAX_TURNS = 20;
const store = new Map(); // key -> { history:[{role,content}], updated:number }

function sweep() {
  if (store.size < 2000) return;
  const now = Date.now();
  for (const [k, v] of store) if (now - v.updated > TTL_MS) store.delete(k);
}

export function getHistory(key) {
  const v = store.get(key);
  if (!v) return [];
  if (Date.now() - v.updated > TTL_MS) { store.delete(key); return []; }
  return v.history;
}

export function append(key, role, content) {
  sweep();
  const v = store.get(key) || { history: [], updated: 0 };
  v.history.push({ role, content: String(content || '').slice(0, 800) });
  if (v.history.length > MAX_TURNS) v.history = v.history.slice(-MAX_TURNS);
  v.updated = Date.now();
  store.set(key, v);
  return v.history;
}

export function clear(key) { store.delete(key); }
