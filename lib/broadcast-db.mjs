// Newsletter broadcast data layer. Service-role only (RLS deny-all). Subscribers are
// scope_prospects with source='newsletter' who have not unsubscribed or been suppressed.
// Every function is degrade-safe: returns {ok:false,skipped:true} when the DB is unset.
import { createClient } from '@supabase/supabase-js';
import { first, list } from './db-result.mjs';

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
export const newsletterSubscribers = () => guard((c) => c.from('scope_prospects')
  .select('id,email,unsubscribe_token')
  .eq('source', 'newsletter').eq('unsubscribed', false).eq('nurture_suppressed', false)
  .not('email', 'is', null)
  .then(list));

export const subscriberCount = async () => {
  const r = await newsletterSubscribers();
  return r.ok ? r.data.length : 0;
};

export const createBroadcast = ({ subject, heading, recipientCount }) => guard((c) => c.from('scope_broadcasts')
  .insert({ subject, heading: heading || null, recipient_count: recipientCount || 0 })
  .select().then(first));

// Idempotent per-recipient record. onConflict do-nothing → a retry never double-sends.
export const recordSend = (broadcastId, email) => guard((c) => c.from('scope_broadcast_sends')
  .upsert({ broadcast_id: broadcastId, email }, { onConflict: 'broadcast_id,email', ignoreDuplicates: true })
  .select().then((r) => (r && r.data) || []));

export const alreadySentEmails = (broadcastId) => guard((c) => c.from('scope_broadcast_sends')
  .select('email').eq('broadcast_id', broadcastId).then((r) => new Set(((r && r.data) || []).map((x) => x.email))));

export const markBroadcastSent = (broadcastId, sentCount) => guard((c) => c.from('scope_broadcasts')
  .update({ sent_count: sentCount }).eq('id', broadcastId).then(() => true));

// Ensure a stable unsubscribe token for a subscriber (mirrors nurture's ensureUnsubToken).
export async function ensureUnsubToken(prospectId, existing) {
  if (existing) return existing;
  const token = (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID().replace(/-/g, '') : String(prospectId);
  await guard((c) => c.from('scope_prospects').update({ unsubscribe_token: token }).eq('id', prospectId).then(() => true));
  return token;
}
