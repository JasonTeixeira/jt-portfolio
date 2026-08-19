import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
let _client = null;

export function isEnabled() { return Boolean(URL && KEY); }
export function getClient() {
  if (!isEnabled()) return null;
  if (!_client) _client = createClient(URL, KEY, { auth: { persistSession: false } });
  return _client;
}
async function guard(fn) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { return { ok: true, data: await fn(getClient()) }; }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
export const upsertProspect = (row) => guard((c) => c.from('scope_prospects').upsert({ ...row, updated_at: new Date().toISOString() }).select().then((r) => r.data));
export const insertPlan = (row) => guard((c) => c.from('scope_plans').insert(row).then((r) => r.data));
export const appendEvent = (row) => guard((c) => c.from('scope_events').insert(row).then((r) => r.data));
export const appendConversation = (row) => guard((c) => c.from('scope_conversations').insert(row).then((r) => r.data));
