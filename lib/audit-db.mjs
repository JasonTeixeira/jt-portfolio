// Operator audit log — one row per meaningful admin mutation. Service-role only.
// logAudit is fire-and-forget from the caller's perspective (never block a mutation on it).
import { createClient } from '@supabase/supabase-js';
import { list } from './db-result.mjs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
let _client = null;
export function isEnabled() { return Boolean(URL && KEY); }
function client() {
  if (!isEnabled()) return null;
  if (!_client) _client = createClient(URL, KEY, { auth: { persistSession: false } });
  return _client;
}
async function guard(fn) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { return { ok: true, data: await fn(client()) }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// Append an audit entry. Bounded so a bug can't write an unbounded row. Returns a promise
// but callers should treat it as fire-and-forget (.catch(()=>{})) — auditing must never
// break the operation it records.
export function logAudit({ actor, action, targetType, targetId, meta } = {}) {
  return guard((c) => c.from('scope_audit').insert({
    actor: String(actor || 'operator').slice(0, 200),
    action: String(action || 'unknown').slice(0, 80),
    target_type: targetType ? String(targetType).slice(0, 40) : null,
    target_id: targetId ? String(targetId).slice(0, 120) : null,
    meta: meta && typeof meta === 'object' ? meta : {},
  }).then(() => true));
}

export const listAudit = (limit = 100) =>
  guard((c) => c.from('scope_audit').select('actor,action,target_type,target_id,meta,created_at')
    .order('created_at', { ascending: false }).limit(Math.min(Math.max(1, limit | 0), 300)).then(list));
