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
export const appendEvent = (row) => guard(async (c) => {
  const out = await c.from('scope_events').insert(row).then((r) => r.data);
  // bump the prospect's last touch so the pipeline board sorts by real activity
  if (row && row.prospect_id) {
    await c.from('scope_prospects').update({ updated_at: new Date().toISOString() }).eq('id', row.prospect_id);
  }
  return out;
});
export const appendConversation = (row) => guard((c) => c.from('scope_conversations').insert(row).then((r) => r.data));

/* ── CRM read/write layer (operator pipeline over scope_prospects + scope_events) ── */
const PROSPECT_STAGES = ['new', 'scoped', 'engaged', 'won', 'lost'];
export function isValidStage(s) { return PROSPECT_STAGES.includes(s); }

export const listProspects = ({ stage, limit = 200 } = {}) =>
  guard((c) => {
    let q = c.from('scope_prospects')
      .select('id,email,name,company,segment,stage,source,qualification,created_at,updated_at')
      .order('updated_at', { ascending: false }).limit(limit);
    if (stage && isValidStage(stage)) q = q.eq('stage', stage);
    return q.then((r) => r.data || []);
  });

export const getProspect = (id) =>
  guard((c) => c.from('scope_prospects').select('*').eq('id', id).maybeSingle().then((r) => r.data));

export const listProspectEvents = (prospectId, limit = 100) =>
  guard((c) => c.from('scope_events').select('id,type,meta,created_at')
    .eq('prospect_id', prospectId).order('created_at', { ascending: false }).limit(limit).then((r) => r.data || []));

// Operator moves a prospect through the stage machine. lost_reason stored in qualification jsonb (no schema change).
export const setProspectStage = (id, stage, lostReason) =>
  guard(async (c) => {
    if (!isValidStage(stage)) throw new Error('invalid stage');
    const patch = { stage, updated_at: new Date().toISOString() };
    if (stage === 'lost' && lostReason) {
      const cur = await c.from('scope_prospects').select('qualification').eq('id', id).maybeSingle().then((r) => r.data);
      patch.qualification = { ...((cur && cur.qualification) || {}), lost_reason: String(lostReason).slice(0, 300) };
    }
    return c.from('scope_prospects').update(patch).eq('id', id).select().then((r) => r.data);
  });

// Pipeline counts by stage, for the operator dashboard header.
export const prospectStageCounts = () =>
  guard(async (c) => {
    const rows = await c.from('scope_prospects').select('stage').then((r) => r.data || []);
    const counts = { new: 0, scoped: 0, engaged: 0, won: 0, lost: 0 };
    rows.forEach((r) => { if (counts[r.stage] != null) counts[r.stage]++; });
    return counts;
  });
