import { createClient } from '@supabase/supabase-js';
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
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// The portal token gates a client's whole project, so it needs to be genuinely >=128-bit
// and unbiased. 22 base62 chars ~= 131 bits. Rejection sampling (reject bytes >= 248 =
// 4*62) keeps the `% 62` map uniform instead of biasing low code points.
function randToken() {
  const out = [];
  while (out.length < 22) {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    for (const b of bytes) { if (b < 248) { out.push(B62[b % 62]); if (out.length === 22) break; } }
  }
  return out.join('');
}

// ---- Projects / portal token ----------------------------------------------
export const getProjectByPortalToken = (token) =>
  guard((c) => c.from('scope_projects').select('*').eq('portal_token', token).maybeSingle().then((r) => r.data));

// One project per proposal (unique index) — used to find the project a proposal's
// milestones/portal token live on, once the deposit has been paid.
export const getProjectByProposalId = (proposalId) =>
  guard((c) => c.from('scope_projects').select('*').eq('proposal_id', proposalId).maybeSingle().then((r) => r.data));

// Return existing scope_projects.portal_token or generate+persist a random base62 token.
export async function ensurePortalToken(projectId) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const c = client();
    const { data } = await c.from('scope_projects').select('portal_token').eq('id', projectId).maybeSingle();
    if (data && data.portal_token) return { ok: true, token: data.portal_token };
    const token = randToken();
    await c.from('scope_projects').update({ portal_token: token }).eq('id', projectId);
    return { ok: true, token };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// ---- Milestones -------------------------------------------------------------
export const listMilestones = (projectId) =>
  guard((c) => c.from('scope_milestones').select('*').eq('project_id', projectId).order('seq', { ascending: true }).then((r) => r.data || []));

export async function upsertMilestone(row) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const c = client();
    if (row && row.id) {
      const patch = {};
      if (row.title !== undefined) patch.title = row.title;
      if (row.deliverables !== undefined) patch.deliverables = row.deliverables;
      // Only patch amount_cents when the caller actually sent a number — an edit that
      // omits the amount must not silently zero out an existing milestone's amount.
      if (typeof row.amount_cents === 'number') patch.amount_cents = row.amount_cents;
      if (row.seq !== undefined) patch.seq = row.seq;
      if (row.due_at !== undefined) patch.due_at = row.due_at;
      const { data } = await c.from('scope_milestones').update(patch).eq('id', row.id).select();
      return { ok: true, data: data && data[0] };
    }
    const { data } = await c.from('scope_milestones').insert({
      project_id: row.project_id, seq: row.seq || 0, title: row.title,
      deliverables: row.deliverables || null, amount_cents: row.amount_cents || 0,
      due_at: row.due_at || null,
    }).select();
    return { ok: true, data: data && data[0] };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

export async function markDelivered(id) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_milestones')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', id).select();
    return { ok: true, data: data && data[0] };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

export async function approveMilestone(id, name, projectId) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_milestones')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_name: (name || '').slice(0,120) })
      .eq('id', id).eq('status', 'delivered').eq('project_id', projectId).select();   // only a DELIVERED milestone
      // belonging to THIS project can be approved — enforced in SQL as defense-in-depth
      // even if the handler's membership check is ever removed.
    return { ok: true, approved: Array.isArray(data) && data.length === 1 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// ---- Contracts ----------------------------------------------------------
export const createContract = (row) =>
  guard((c) => c.from('scope_contracts').insert(row).select().then((r) => r.data && r.data[0]));

export const getContractByPublicId = (publicId) =>
  guard((c) => c.from('scope_contracts').select('*').eq('public_id', publicId).maybeSingle().then((r) => r.data));

export const getContractsForProposal = (proposalId) =>
  guard((c) => c.from('scope_contracts').select('*').eq('proposal_id', proposalId).order('created_at', { ascending: false }).then((r) => r.data || []));

export async function sendContract(id) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_contracts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id).select();
    return { ok: true, data: data && data[0] };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

export async function acceptContract(id, { name, ip }) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_contracts')
      .update({ status: 'accepted', accepted_name: (name||'').slice(0,120), accepted_at: new Date().toISOString(), accept_ip: ip || null })
      .eq('id', id).eq('status', 'sent').select();        // only a SENT contract can be accepted
    return { ok: true, accepted: Array.isArray(data) && data.length === 1 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
