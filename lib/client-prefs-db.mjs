// Per-client notification prefs, keyed by lowercased email. Service-role only.
// Default (no row) = notifications ON, so a client who never touched settings still gets mail.
import { createClient } from '@supabase/supabase-js';
import { first } from './db-result.mjs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
let _client = null;
export function isEnabled() { return Boolean(URL && KEY); }
function client() {
  if (!isEnabled()) return null;
  if (!_client) _client = createClient(URL, KEY, { auth: { persistSession: false } });
  return _client;
}
const norm = (e) => String(e || '').trim().toLowerCase();

// Read a client's prefs (defaults when no row / DB off). Never throws.
export async function getClientPrefs(email) {
  const e = norm(email);
  const dflt = { notify_updates: true };
  if (!e || !isEnabled()) return dflt;
  try {
    const { data, error } = await client().from('scope_client_prefs').select('notify_updates').eq('email', e).maybeSingle();
    if (error || !data) return dflt;
    return { notify_updates: data.notify_updates !== false };
  } catch { return dflt; }
}

// Does this client want update emails? Fails OPEN (true) so a lookup blip never drops a
// transactional-ish notification.
export async function clientWantsUpdates(email) {
  const p = await getClientPrefs(email);
  return p.notify_updates !== false;
}

export async function setClientPrefs(email, { notify_updates } = {}) {
  const e = norm(email);
  if (!e || !isEnabled()) return { ok: false, skipped: true };
  try {
    const { data, error } = await client().from('scope_client_prefs')
      .upsert({ email: e, notify_updates: notify_updates !== false, updated_at: new Date().toISOString() }, { onConflict: 'email' })
      .select('notify_updates');
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: first({ data }) };
  } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
}
