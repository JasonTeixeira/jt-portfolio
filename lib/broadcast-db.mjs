// Newsletter broadcast data layer. Service-role only (RLS deny-all). Subscribers are
// scope_prospects with source='newsletter' who have not unsubscribed or been suppressed.
// Every function is degrade-safe: returns {ok:false,skipped:true} when the DB is unset.
import { createClient } from '@supabase/supabase-js';
import { first, list, rows } from './db-result.mjs';

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
  try { return { ok: true, data: await fn(client()) }; } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// The active newsletter list: subscribed via /api/subscribe (source='newsletter'), not opted
// out, not suppressed. Returns [{ id, email, unsubscribe_token }].
export const newsletterSubscribers = (limit = 5000) => guard((c) => c.from('scope_prospects')
  .select('id,email,unsubscribe_token')
  .eq('source', 'newsletter').eq('unsubscribed', false).eq('nurture_suppressed', false)
  .not('email', 'is', null)
  .limit(limit)
  .then(list));

export const subscriberCount = async () => {
  const r = await newsletterSubscribers();
  return r.ok ? r.data.length : 0;
};

export const createBroadcast = ({ subject, heading, recipientCount, contentHash }) => guard((c) => c.from('scope_broadcasts')
  .insert({ subject, heading: heading || null, recipient_count: recipientCount || 0, content_hash: contentHash || null })
  .select().then(first));

// Resume-or-create: if an identical campaign (same content_hash) was created recently,
// reuse its id so a retry or a capped follow-up run dedupes against what already went out,
// instead of minting a fresh id (which would re-blast the whole list). 24h window.
export const findResumableBroadcast = (contentHash) => guard((c) => c.from('scope_broadcasts')
  .select('id,sent_count')
  .eq('content_hash', contentHash)
  .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
  .order('created_at', { ascending: false }).limit(1).then(first));

// Idempotent per-recipient record. onConflict do-nothing → a retry never double-sends.
export const recordSend = (broadcastId, email) => guard((c) => c.from('scope_broadcast_sends')
  .upsert({ broadcast_id: broadcastId, email }, { onConflict: 'broadcast_id,email', ignoreDuplicates: true })
  .select().then((r) => (r && r.data) || []));

export const alreadySentEmails = (broadcastId) => guard((c) => c.from('scope_broadcast_sends')
  .select('email').eq('broadcast_id', broadcastId).then((r) => new Set(((r && r.data) || []).map((x) => x.email))));

export const markBroadcastSent = (broadcastId, sentCount) => guard((c) => c.from('scope_broadcasts')
  .update({ sent_count: sentCount }).eq('id', broadcastId).then(() => true));

// Ensure a stable unsubscribe token for a subscriber. Returns { ok, token }. If the token
// has to be minted and the DB write fails, ok:false — the caller must then SKIP that
// recipient rather than mail an unsubscribe link that was never persisted (so the one-click
// opt-out would silently not work).
export async function ensureUnsubToken(prospectId, existing) {
  if (existing) return { ok: true, token: existing };
  const token = globalThis.crypto.randomUUID().replace(/-/g, '');
  // Route through rows() so a Supabase {error} throws and guard() reports ok:false.
  const r = await guard((c) => c.from('scope_prospects').update({ unsubscribe_token: token }).eq('id', prospectId).select().then(rows));
  return r.ok ? { ok: true, token } : { ok: false };
}
