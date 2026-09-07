// Operator tasks + per-deal costs/budget (cockpit module 3).
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Tasks ─────────────────────────────────────────────────────────────── */
const TASK_STATUS = ['todo', 'doing', 'done', 'blocked'];
const TASK_PRIORITY = ['low', 'medium', 'high'];
export function isValidTaskStatus(s) { return TASK_STATUS.includes(s); }
export function isValidTaskPriority(p) { return TASK_PRIORITY.includes(p); }

const TASK_SELECT = 'id,title,status,priority,due_at,notes,position,proposal_id,project_id,done_at,created_at,updated_at';

export function normalizeTask(input = {}, { partial = false } = {}) {
  const out = {};
  const str = (v, max) => String(v).slice(0, max);
  const fk = (v, label) => { if (!v) return null; if (!UUID_RE.test(String(v))) throw new Error(`invalid ${label}`); return String(v); };

  if (input.title != null) {
    const t = str(input.title, 300).trim();
    if (!t) return { ok: false, error: 'title required' };
    out.title = t;
  } else if (!partial) { return { ok: false, error: 'title required' }; }

  if (input.status != null) {
    if (!isValidTaskStatus(input.status)) return { ok: false, error: 'invalid status' };
    out.status = input.status;
    out.done_at = input.status === 'done' ? new Date().toISOString() : null;
  }
  if (input.priority != null) {
    if (!isValidTaskPriority(input.priority)) return { ok: false, error: 'invalid priority' };
    out.priority = input.priority;
  }
  if (input.due_at !== undefined) {
    if (!input.due_at) out.due_at = null;
    else { const d = new Date(input.due_at); if (Number.isNaN(d.getTime())) return { ok: false, error: 'invalid due_at' }; out.due_at = d.toISOString(); }
  }
  if (input.notes != null) out.notes = input.notes ? str(input.notes, 4000) : null;
  if (typeof input.position === 'number' && Number.isFinite(input.position)) out.position = input.position;
  try {
    if (input.proposal_id !== undefined) out.proposal_id = fk(input.proposal_id, 'proposal_id');
    if (input.project_id !== undefined) out.project_id = fk(input.project_id, 'project_id');
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  return { ok: true, value: out };
}

export const listTasks = ({ status, limit = 500 } = {}) =>
  guard((c) => {
    let q = c.from('scope_tasks').select(TASK_SELECT)
      .order('status', { ascending: true }).order('position', { ascending: true }).order('created_at', { ascending: false }).limit(limit);
    if (status && isValidTaskStatus(status)) q = q.eq('status', status);
    return q.then(list);
  });

export const createTask = (payload) =>
  guard((c) => {
    const norm = normalizeTask(payload, { partial: false });
    if (!norm.ok) throw new Error(norm.error);
    return c.from('scope_tasks').insert(norm.value).select(TASK_SELECT).then(first);
  });

export const updateTask = (id, patch) =>
  guard(async (c) => {
    if (!id) throw new Error('id required');
    const norm = normalizeTask(patch, { partial: true });
    if (!norm.ok) throw new Error(norm.error);
    const value = { ...norm.value, updated_at: new Date().toISOString() };
    const row = await c.from('scope_tasks').update(value).eq('id', id).select(TASK_SELECT).then(first);
    if (!row) throw new Error('not_found');
    return row;
  });

export const deleteTask = (id) =>
  guard(async (c) => {
    if (!id) throw new Error('id required');
    const deleted = await c.from('scope_tasks').delete().eq('id', id).select('id').then(list);
    if (!deleted.length) throw new Error('not_found');
    return { id };
  });

/* ── Costs + budget/margin ─────────────────────────────────────────────── */
const COST_KINDS = ['subcontractor', 'tool', 'ads', 'fees', 'other'];
export function isValidCostKind(k) { return COST_KINDS.includes(k); }
const COST_SELECT = 'id,proposal_id,label,kind,amount_cents,incurred_at,notes,created_at';

export function normalizeCost(input = {}) {
  const str = (v, max) => String(v).slice(0, max);
  if (!input.proposal_id || !UUID_RE.test(String(input.proposal_id))) return { ok: false, error: 'invalid proposal_id' };
  const label = input.label != null ? str(input.label, 200).trim() : '';
  if (!label) return { ok: false, error: 'label required' };
  // Strict at the boundary: only a number or numeric string is money; reject
  // booleans/arrays/objects that would loosely coerce. Bound to a sane ceiling.
  const MAX_CENTS = 1_000_000_000; // $10M per single cost line
  if (typeof input.amount_cents !== 'number' && typeof input.amount_cents !== 'string') return { ok: false, error: 'invalid amount' };
  const cents = Math.round(Number(input.amount_cents));
  if (!Number.isFinite(cents) || cents < 0 || cents > MAX_CENTS) return { ok: false, error: 'invalid amount' };
  const out = { proposal_id: String(input.proposal_id), label, amount_cents: cents };
  if (input.kind != null) { if (!isValidCostKind(input.kind)) return { ok: false, error: 'invalid kind' }; out.kind = input.kind; }
  if (input.notes != null) out.notes = input.notes ? str(input.notes, 2000) : null;
  if (input.incurred_at) { const d = new Date(input.incurred_at); if (!Number.isNaN(d.getTime())) out.incurred_at = d.toISOString(); }
  return { ok: true, value: out };
}

export const listCosts = (proposalId) =>
  guard((c) => {
    if (!proposalId || !UUID_RE.test(String(proposalId))) throw new Error('invalid proposal_id');
    return c.from('scope_project_costs').select(COST_SELECT).eq('proposal_id', proposalId)
      .order('incurred_at', { ascending: false }).then(list);
  });

export const addCost = (payload) =>
  guard((c) => {
    const norm = normalizeCost(payload);
    if (!norm.ok) throw new Error(norm.error);
    return c.from('scope_project_costs').insert(norm.value).select(COST_SELECT).then(first);
  });

export const deleteCost = (id) =>
  guard(async (c) => {
    if (!id) throw new Error('id required');
    const deleted = await c.from('scope_project_costs').delete().eq('id', id).select('id').then(list);
    if (!deleted.length) throw new Error('not_found');
    return { id };
  });

// Budget rollup: for every won/paid deal (or any deal that has costs), compute
// revenue (firm_cents) − costs = margin. Small volumes → aggregate in JS.
export const budgetSummary = () =>
  guard(async (c) => {
    const proposals = await c.from('scope_proposals')
      .select('id,public_id,client_email,status,firm_cents,paid_at').then(list);
    const costs = await c.from('scope_project_costs').select('proposal_id,amount_cents').then(list);
    const costByProposal = {};
    for (const r of costs) costByProposal[r.proposal_id] = (costByProposal[r.proposal_id] || 0) + (Number(r.amount_cents) || 0);
    const rows = proposals
      .filter((p) => p.paid_at || costByProposal[p.id]) // deals that are real (paid) or already have spend
      .map((p) => {
        const revenueCents = Number(p.firm_cents) || 0;
        const costCents = costByProposal[p.id] || 0;
        return {
          proposalId: p.id, publicId: p.public_id, clientEmail: p.client_email, status: p.status,
          revenueCents, costCents, marginCents: revenueCents - costCents,
          marginPct: revenueCents ? Math.round(((revenueCents - costCents) / revenueCents) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenueCents - a.revenueCents);
    const totals = rows.reduce((a, r) => ({
      revenueCents: a.revenueCents + r.revenueCents, costCents: a.costCents + r.costCents, marginCents: a.marginCents + r.marginCents,
    }), { revenueCents: 0, costCents: 0, marginCents: 0 });
    totals.marginPct = totals.revenueCents ? Math.round((totals.marginCents / totals.revenueCents) * 100) : 0;
    return { rows, totals };
  });
