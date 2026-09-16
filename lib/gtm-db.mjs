// GTM weekly tracker (operator cockpit) — server-persisted replacement for the old
// browser-localStorage ops.html sheet. One row per week; `data` is a flexible jsonb
// blob of metric inputs + retro note + mini-eval queue. Service-role only, RLS deny-all.
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

// A YYYY-MM-DD date string is the only accepted week key — reject anything else so a
// malformed value can't create junk rows or slip past the unique(week_of) constraint.
export function normalizeWeek(week) {
  const s = String(week || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export const recentWeeks = (limit = 12) =>
  guard((c) => c.from('scope_gtm_weeks').select('week_of,data,updated_at')
    .order('week_of', { ascending: false }).limit(Math.min(Math.max(1, limit | 0), 52)).then(list));

// Upsert the week's blob. `data` is sanitized by the caller (api/gtm.js) before it lands here.
export const upsertWeek = (week, data) =>
  guard((c) => c.from('scope_gtm_weeks')
    .upsert({ week_of: week, data, updated_at: new Date().toISOString() }, { onConflict: 'week_of' })
    .select('week_of,data,updated_at').then(first));
