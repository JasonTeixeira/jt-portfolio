// Native calendar for the operator cockpit — scheduling, deadlines, and logged
// meetings stored in Supabase (service-role only; RLS deny-all on the table).
// Money-layer discipline: every query routes through db-result helpers so a
// failed query surfaces as { ok:false, error }, never fake success.
import { createClient } from '@supabase/supabase-js';
import { first, list } from './db-result.mjs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
let _client = null;

export function isEnabled() { return Boolean(URL && KEY); }
function getClient() {
  if (!isEnabled()) return null;
  if (!_client) _client = createClient(URL, KEY, { auth: { persistSession: false } });
  return _client;
}
async function guard(fn) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { return { ok: true, data: await fn(getClient()) }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

const EVENT_KINDS = ['meeting', 'call', 'deadline', 'task', 'reminder'];
const EVENT_STATUS = ['scheduled', 'done', 'canceled'];
export function isValidKind(k) { return EVENT_KINDS.includes(k); }
export function isValidStatus(s) { return EVENT_STATUS.includes(s); }

const SELECT = 'id,title,kind,starts_at,ends_at,all_day,location,url,notes,status,prospect_id,project_id,created_at,updated_at';

// Clamp/normalize an incoming event payload. Returns { ok, value } | { ok:false, error }.
// Rejects at the boundary rather than trusting caller input (dates, enums, lengths).
export function normalizeEvent(input = {}, { partial = false } = {}) {
  const out = {};
  const str = (v, max) => String(v).slice(0, max);

  if (input.title != null) {
    const t = str(input.title, 200).trim();
    if (!t) return { ok: false, error: 'title required' };
    out.title = t;
  } else if (!partial) { return { ok: false, error: 'title required' }; }

  if (input.starts_at != null) {
    const d = new Date(input.starts_at);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'invalid starts_at' };
    out.starts_at = d.toISOString();
  } else if (!partial) { return { ok: false, error: 'starts_at required' }; }

  if (input.ends_at != null && input.ends_at !== '') {
    const d = new Date(input.ends_at);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'invalid ends_at' };
    out.ends_at = d.toISOString();
  } else if (input.ends_at === '' || input.ends_at === null) { out.ends_at = null; }

  if (input.kind != null) {
    if (!isValidKind(input.kind)) return { ok: false, error: 'invalid kind' };
    out.kind = input.kind;
  }
  if (input.status != null) {
    if (!isValidStatus(input.status)) return { ok: false, error: 'invalid status' };
    out.status = input.status;
  }
  if (input.all_day != null) out.all_day = input.all_day === true; // strict: "false"/"0" strings are not true
  if (input.location != null) out.location = input.location ? str(input.location, 300) : null;
  if (input.url != null) {
    if (!input.url) { out.url = null; }
    else { const u = str(input.url, 500); if (!/^https?:\/\//i.test(u)) return { ok: false, error: 'invalid url' }; out.url = u; }
  }
  if (input.notes != null) out.notes = input.notes ? str(input.notes, 4000) : null;
  // FK links are optional (empty clears them); validate UUID shape so a bad id
  // yields a clean error instead of leaking a raw Postgres cast failure.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const fk = (v, label) => { if (!v) return null; if (!UUID_RE.test(String(v))) throw new Error(`invalid ${label}`); return String(v); };
  try {
    if (input.prospect_id !== undefined) out.prospect_id = fk(input.prospect_id, 'prospect_id');
    if (input.project_id !== undefined) out.project_id = fk(input.project_id, 'project_id');
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }

  // ends_at, when present, must not precede starts_at.
  if (out.ends_at && out.starts_at && new Date(out.ends_at) < new Date(out.starts_at)) {
    return { ok: false, error: 'ends_at before starts_at' };
  }
  return { ok: true, value: out };
}

// List events in a time window (inclusive of anything starting before `to` and
// ending after `from`). Caller passes ISO strings; bad input yields an empty range.
export const listEvents = ({ from, to, limit = 500 } = {}) =>
  guard((c) => {
    let q = c.from('scope_calendar_events').select(SELECT).order('starts_at', { ascending: true }).limit(limit);
    if (from) q = q.gte('starts_at', new Date(from).toISOString());
    if (to) q = q.lte('starts_at', new Date(to).toISOString());
    return q.then(list);
  });

// Upcoming scheduled events from now, for the cockpit header / dashboard.
export const upcomingEvents = (limit = 8) =>
  guard((c) => c.from('scope_calendar_events').select(SELECT)
    .eq('status', 'scheduled').gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true }).limit(limit).then(list));

export const createEvent = (payload) =>
  guard((c) => {
    const norm = normalizeEvent(payload, { partial: false });
    if (!norm.ok) throw new Error(norm.error);
    return c.from('scope_calendar_events').insert(norm.value).select(SELECT).then(first);
  });

export const updateEvent = (id, patch) =>
  guard(async (c) => {
    if (!id) throw new Error('id required');
    const norm = normalizeEvent(patch, { partial: true });
    if (!norm.ok) throw new Error(norm.error);
    const value = { ...norm.value, updated_at: new Date().toISOString() };
    const row = await c.from('scope_calendar_events').update(value).eq('id', id).select(SELECT).then(first);
    if (!row) throw new Error('not_found'); // stale/mistyped id must not report fake success
    return row;
  });

export const deleteEvent = (id) =>
  guard(async (c) => {
    if (!id) throw new Error('id required');
    const deleted = await c.from('scope_calendar_events').delete().eq('id', id).select('id').then(list);
    if (!deleted.length) throw new Error('not_found');
    return { id };
  });
