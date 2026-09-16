// Global operator search across clients (prospects) + proposals. Service-role only.
// Powers the ⌘K command palette. Read-only; every result carries enough to deep-link.
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

// PostgREST `.or()` splits on commas and treats `*` as a wildcard, so a raw query could
// inject extra filter clauses. Strip everything except letters/digits/space/@/.-/_ and
// cap length before it ever reaches the filter string.
export function sanitizeQuery(q) {
  return String(q || '').replace(/[^\w@.\-\s]/g, '').trim().slice(0, 80);
}

export async function search(rawQ) {
  const q = sanitizeQuery(rawQ);
  if (q.length < 2) return { ok: true, data: { clients: [], proposals: [] } };
  const like = `%${q}%`;
  return guard(async (c) => {
    const [clientsR, proposalsR] = await Promise.all([
      c.from('scope_prospects').select('id,email,name,company,stage')
        .or(`name.ilike.${like},email.ilike.${like},company.ilike.${like}`)
        .order('updated_at', { ascending: false }).limit(6).then(list),
      c.from('scope_proposals').select('id,public_id,client_email,status,firm_cents')
        .or(`public_id.ilike.${like},client_email.ilike.${like}`)
        .order('created_at', { ascending: false }).limit(6).then(list),
    ]);
    return { clients: clientsR, proposals: proposalsR };
  });
}
