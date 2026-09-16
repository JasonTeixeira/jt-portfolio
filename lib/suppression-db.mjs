// Email suppression list — address-keyed, fed by the Resend bounce/complaint webhook.
// The send layer (lib/notify.mjs) checks isSuppressed() before every client send so we
// never keep mailing a dead or hostile inbox. Service-role only, RLS deny-all.
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
  try { return { ok: true, data: await fn(client()) }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

const norm = (email) => String(email || '').trim().toLowerCase();

// Fast membership check for the send path. Fails OPEN (returns false) when the DB is
// unreachable — a transient suppression-lookup failure must never block a real send
// (e.g. a password reset); the webhook will re-suppress on the next bounce anyway.
export async function isSuppressed(email) {
  const e = norm(email);
  if (!e || !isEnabled()) return false;
  try {
    const { data, error } = await client().from('scope_email_suppressions').select('email').eq('email', e).maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch { return false; }
}

// Upsert a suppression. Idempotent on email. Routes through first() so a failed write
// (RLS, missing table, schema drift) THROWS → guard() returns { ok:false } instead of a
// silent ok:true — the caller (webhook) can then log/alert instead of dropping a bounce.
export const suppress = (email, reason, detail = {}) => {
  const e = norm(email);
  if (!e) return Promise.resolve({ ok: false, error: 'no_email' });
  return guard((c) => c.from('scope_email_suppressions')
    .upsert({ email: e, reason, detail, updated_at: new Date().toISOString() }, { onConflict: 'email' })
    .select('email,reason').then(first));
};

export const unsuppress = (email) => {
  const e = norm(email);
  if (!e) return Promise.resolve({ ok: false, error: 'no_email' });
  // .select() so a delete error surfaces through list() rather than being swallowed.
  return guard((c) => c.from('scope_email_suppressions').delete().eq('email', e).select('email').then(list));
};

export const listSuppressions = (limit = 200) =>
  guard((c) => c.from('scope_email_suppressions').select('email,reason,detail,created_at')
    .order('created_at', { ascending: false }).limit(limit).then(list));
