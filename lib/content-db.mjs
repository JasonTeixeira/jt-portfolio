// Content studio (cockpit ⑤): plan marketing content idea→draft→scheduled→published.
// Same discipline as the other cockpit modules: boundary validation + db-result
// helpers so a failed query surfaces as { ok:false }, never fake success.
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

const CHANNELS = ['blog', 'linkedin', 'x', 'instagram', 'youtube', 'newsletter', 'other'];
const STATUSES = ['idea', 'draft', 'scheduled', 'published'];
export function isValidChannel(c) { return CHANNELS.includes(c); }
export function isValidStatus(s) { return STATUSES.includes(s); }

const SELECT = 'id,title,channel,status,notes,url,scheduled_for,published_at,position,created_at,updated_at';

export function normalizeContent(input = {}, { partial = false } = {}) {
  const out = {};
  const str = (v, max) => String(v).slice(0, max);

  if (input.title != null) {
    const t = str(input.title, 300).trim();
    if (!t) return { ok: false, error: 'title required' };
    out.title = t;
  } else if (!partial) { return { ok: false, error: 'title required' }; }

  if (input.channel != null) {
    if (!isValidChannel(input.channel)) return { ok: false, error: 'invalid channel' };
    out.channel = input.channel;
  }
  if (input.status != null) {
    if (!isValidStatus(input.status)) return { ok: false, error: 'invalid status' };
    out.status = input.status;
    // stamp/clear published_at as status crosses the published boundary
    out.published_at = input.status === 'published' ? new Date().toISOString() : null;
  }
  if (input.scheduled_for !== undefined) {
    if (!input.scheduled_for) out.scheduled_for = null;
    else { const d = new Date(input.scheduled_for); if (Number.isNaN(d.getTime())) return { ok: false, error: 'invalid scheduled_for' }; out.scheduled_for = d.toISOString(); }
  }
  if (input.notes != null) out.notes = input.notes ? str(input.notes, 8000) : null;
  if (input.url != null) {
    if (!input.url) { out.url = null; }
    else { const u = str(input.url, 500); if (!/^https?:\/\//i.test(u)) return { ok: false, error: 'invalid url' }; out.url = u; }
  }
  if (typeof input.position === 'number' && Number.isFinite(input.position)) out.position = input.position;
  return { ok: true, value: out };
}

export const listContent = ({ status, limit = 500 } = {}) =>
  guard((c) => {
    let q = c.from('scope_content').select(SELECT)
      .order('status', { ascending: true }).order('scheduled_for', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(limit);
    if (status && isValidStatus(status)) q = q.eq('status', status);
    return q.then(list);
  });

export const upcomingContent = (limit = 8) =>
  guard((c) => c.from('scope_content').select(SELECT)
    .eq('status', 'scheduled').gte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true }).limit(limit).then(list));

export const createContent = (payload) =>
  guard((c) => {
    const norm = normalizeContent(payload, { partial: false });
    if (!norm.ok) throw new Error(norm.error);
    return c.from('scope_content').insert(norm.value).select(SELECT).then(first);
  });

export const updateContent = (id, patch) =>
  guard(async (c) => {
    if (!id) throw new Error('id required');
    const norm = normalizeContent(patch, { partial: true });
    if (!norm.ok) throw new Error(norm.error);
    const value = { ...norm.value, updated_at: new Date().toISOString() };
    const row = await c.from('scope_content').update(value).eq('id', id).select(SELECT).then(first);
    if (!row) throw new Error('not_found');
    return row;
  });

export const deleteContent = (id) =>
  guard(async (c) => {
    if (!id) throw new Error('id required');
    const deleted = await c.from('scope_content').delete().eq('id', id).select('id').then(list);
    if (!deleted.length) throw new Error('not_found');
    return { id };
  });
