import { createClient } from '@supabase/supabase-js';
import { rows, list } from './db-result.mjs';

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
export const upsertProspect = (row) => guard((c) => c.from('scope_prospects').upsert({ ...row, updated_at: new Date().toISOString() }).select().then(rows));
export const insertPlan = (row) => guard((c) => c.from('scope_plans').insert(row).then(rows));
export const appendEvent = (row) => guard(async (c) => {
  const out = await c.from('scope_events').insert(row).then(rows);
  // bump the prospect's last touch so the pipeline board sorts by real activity
  if (row && row.prospect_id) {
    await c.from('scope_prospects').update({ updated_at: new Date().toISOString() }).eq('id', row.prospect_id);
  }
  return out;
});
export const appendConversation = (row) => guard((c) => c.from('scope_conversations').insert(row).then(rows));

/* ── CRM read/write layer (operator pipeline over scope_prospects + scope_events) ── */
const PROSPECT_STAGES = ['new', 'scoped', 'engaged', 'won', 'lost'];
export function isValidStage(s) { return PROSPECT_STAGES.includes(s); }

export const listProspects = ({ stage, limit = 200 } = {}) =>
  guard((c) => {
    let q = c.from('scope_prospects')
      .select('id,email,name,company,segment,stage,source,qualification,created_at,updated_at')
      .order('updated_at', { ascending: false }).limit(limit);
    if (stage && isValidStage(stage)) q = q.eq('stage', stage);
    return q.then(list);
  });

export const getProspect = (id) =>
  guard((c) => c.from('scope_prospects').select('*').eq('id', id).maybeSingle().then(rows));

export const listProspectEvents = (prospectId, limit = 100) =>
  guard((c) => c.from('scope_events').select('id,type,meta,created_at')
    .eq('prospect_id', prospectId).order('created_at', { ascending: false }).limit(limit).then(list));

// Operator moves a prospect through the stage machine. lost_reason stored in qualification jsonb (no schema change).
export const setProspectStage = (id, stage, lostReason) =>
  guard(async (c) => {
    if (!isValidStage(stage)) throw new Error('invalid stage');
    const patch = { stage, updated_at: new Date().toISOString() };
    if (stage === 'lost' && lostReason) {
      const cur = await c.from('scope_prospects').select('qualification').eq('id', id).maybeSingle().then(rows);
      patch.qualification = { ...((cur && cur.qualification) || {}), lost_reason: String(lostReason).slice(0, 300) };
    }
    return c.from('scope_prospects').update(patch).eq('id', id).select().then(rows);
  });

// Outbound: operator manually logs a cold-reached lead into the pipeline.
export const createProspect = (row) =>
  guard((c) => c.from('scope_prospects').insert({
    email: row.email,
    name: row.name || null,
    company: row.company || null,
    segment: row.segment || null,
    stage: isValidStage(row.stage) ? row.stage : 'new',
    // defense-in-depth: clamp source even though the route never forwards caller input here
    source: String(row.source || 'outbound').slice(0, 40),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().then(rows));

// Outreach touches recorded as timeline events. appendEvent also bumps the
// prospect's updated_at so the board sorts by real last-contact activity.
const TOUCH_KINDS = ['email', 'dm', 'call', 'meeting', 'note', 'follow_up'];
export function isValidTouch(k) { return TOUCH_KINDS.includes(k); }
export const logTouch = (prospectId, kind, note) =>
  guard(async (c) => {
    if (!isValidTouch(kind)) throw new Error('invalid touch kind');
    const meta = note ? { note: String(note).slice(0, 1000) } : {};
    const out = await c.from('scope_events').insert({ prospect_id: prospectId, type: `touch_${kind}`, meta }).then(rows);
    await c.from('scope_prospects').update({ updated_at: new Date().toISOString() }).eq('id', prospectId);
    return out;
  });

// Revenue command center: real money numbers computed from the proposals ledger.
// Volumes for a solo shop are small, so we fetch the columns and aggregate in JS.
export const revenueSummary = () =>
  guard(async (c) => {
    const rows = await c.from('scope_proposals')
      .select('status,firm_cents,deposit_cents,balance_cents,paid_at,balance_paid_at,created_at,client_email')
      .then(list);
    const sum = (arr, f) => arr.reduce((a, r) => a + (Number(f(r)) || 0), 0);
    const paid = rows.filter((r) => r.paid_at);
    const balancePaid = rows.filter((r) => r.balance_paid_at);
    const depositOnly = paid.filter((r) => !r.balance_paid_at);
    const open = rows.filter((r) => ['draft_pending', 'approved'].includes(r.status) && !r.paid_at);
    // collected = deposits taken + balances taken
    const collectedCents = sum(paid, (r) => r.deposit_cents) + sum(balancePaid, (r) => r.balance_cents);
    const outstandingCents = sum(depositOnly, (r) => r.balance_cents); // deposit paid, balance still due
    const pipelineCents = sum(open, (r) => r.firm_cents); // proposals out, not yet paid
    const wonCount = paid.length;
    const avgDealCents = wonCount ? Math.round(sum(paid, (r) => r.firm_cents) / wonCount) : 0;
    // last 6 calendar months of collected revenue (by paid_at / balance_paid_at), for a trend
    const monthly = {};
    const bump = (iso, cents) => { if (!iso) return; const k = String(iso).slice(0, 7); monthly[k] = (monthly[k] || 0) + (Number(cents) || 0); };
    paid.forEach((r) => bump(r.paid_at, r.deposit_cents));
    balancePaid.forEach((r) => bump(r.balance_paid_at, r.balance_cents));
    return {
      collectedCents, outstandingCents, pipelineCents,
      wonCount, openCount: open.length, avgDealCents,
      monthly, // { 'YYYY-MM': cents }
    };
  });

// Pipeline counts by stage, for the operator dashboard header.
export const prospectStageCounts = () =>
  guard(async (c) => {
    const stageRows = await c.from('scope_prospects').select('stage').then(list);
    const counts = { new: 0, scoped: 0, engaged: 0, won: 0, lost: 0 };
    stageRows.forEach((r) => { if (counts[r.stage] != null) counts[r.stage]++; });
    return counts;
  });
