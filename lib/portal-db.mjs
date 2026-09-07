import { createClient } from '@supabase/supabase-js';
import { first, rows, list } from './db-result.mjs';
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
  guard((c) => c.from('scope_projects').select('*').eq('portal_token', token).maybeSingle().then(rows));

// One project per proposal (unique index) — used to find the project a proposal's
// milestones/portal token live on, once the deposit has been paid.
export const getProjectByProposalId = (proposalId) =>
  guard((c) => c.from('scope_projects').select('*').eq('proposal_id', proposalId).maybeSingle().then(rows));

export const getProjectById = (id) =>
  guard((c) => c.from('scope_projects').select('*').eq('id', id).maybeSingle().then(rows));

// All projects belonging to a client (matched by the proposal's client_email). Used by the
// logged-in client dashboard. Returns portal_token + a whitelisted plan/payment summary.
export const listClientProjectsByEmail = (email) =>
  guard((c) => c.from('scope_projects')
    .select('status,portal_token,created_at,scope_proposals!inner(id,public_id,client_email,firm_cents,deposit_cents,balance_cents,paid_at,balance_paid_at,keys,segment)')
    .eq('scope_proposals.client_email', String(email).toLowerCase())
    .order('created_at', { ascending: false }).then(list));

// Visible contract summaries for a set of proposals, for the client dashboard
// ("contract awaiting your signature" badge). Batched to avoid N+1 queries.
export const contractSummariesForProposals = (ids) =>
  guard((c) => {
    if (!Array.isArray(ids) || !ids.length) return [];
    return c.from('scope_contracts').select('proposal_id,public_id,status')
      .in('proposal_id', ids).order('created_at', { ascending: false }).then(list);
  });

// Return existing scope_projects.portal_token or generate+persist a random base62 token.
export async function ensurePortalToken(projectId) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const c = client();
    const { data, error } = await c.from('scope_projects').select('portal_token').eq('id', projectId).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (data && data.portal_token) return { ok: true, token: data.portal_token };
    const token = randToken();
    const { error: upErr } = await c.from('scope_projects').update({ portal_token: token }).eq('id', projectId);
    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true, token };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// ---- Milestones -------------------------------------------------------------
export const listMilestones = (projectId) =>
  guard((c) => c.from('scope_milestones').select('*').eq('project_id', projectId).order('seq', { ascending: true }).then(list));

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
      const { data, error } = await c.from('scope_milestones').update(patch).eq('id', row.id).select();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: data && data[0] };
    }
    const { data, error } = await c.from('scope_milestones').insert({
      project_id: row.project_id, seq: row.seq || 0, title: row.title,
      deliverables: row.deliverables || null, amount_cents: row.amount_cents || 0,
      due_at: row.due_at || null,
    }).select();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data && data[0] };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

export async function markDelivered(id) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data, error } = await client().from('scope_milestones')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', id).select();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data && data[0] };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

export async function approveMilestone(id, name, projectId) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data, error } = await client().from('scope_milestones')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_name: (name || '').slice(0,120) })
      .eq('id', id).eq('status', 'delivered').eq('project_id', projectId).select();   // only a DELIVERED milestone
      // belonging to THIS project can be approved — enforced in SQL as defense-in-depth
      // even if the handler's membership check is ever removed.
    if (error) return { ok: false, error: error.message };
    return { ok: true, approved: Array.isArray(data) && data.length === 1 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// ---- Contracts ----------------------------------------------------------
export const createContract = (row) =>
  guard((c) => c.from('scope_contracts').insert(row).select().then(first));

export const getContractByPublicId = (publicId) =>
  guard((c) => c.from('scope_contracts').select('*').eq('public_id', publicId).maybeSingle().then(rows));

export const getContractsForProposal = (proposalId) =>
  guard((c) => c.from('scope_contracts').select('*').eq('proposal_id', proposalId).order('created_at', { ascending: false }).then(list));

export async function sendContract(id) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data, error } = await client().from('scope_contracts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id).select();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data && data[0] };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// ---- Deliverable files (private bucket + signed URLs) ----------------------
const DELIVERABLES_BUCKET = 'deliverables';
// keep only a safe basename — no path separators, no traversal, bounded length
function safeName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop();
  return (base.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(0, 120)) || 'file';
}

// Operator asks for a one-time signed upload URL; the browser PUTs the file straight to
// storage (never through our function). Path is server-built under the project's prefix.
export async function signDeliverableUpload(projectId, filename) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const path = `${projectId}/${globalThis.crypto.randomUUID()}-${safeName(filename)}`;
    const { data, error } = await client().storage.from(DELIVERABLES_BUCKET).createSignedUploadUrl(path);
    if (error) return { ok: false, error: error.message };
    return { ok: true, path, token: data.token, signedUrl: data.signedUrl };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

export const registerDeliverable = (row) =>
  guard((c) => c.from('scope_deliverable_files').insert({
    project_id: row.project_id, milestone_id: row.milestone_id || null,
    name: safeName(row.name), storage_path: row.storage_path,
    size_bytes: typeof row.size_bytes === 'number' ? row.size_bytes : null,
    content_type: row.content_type ? String(row.content_type).slice(0, 120) : null,
  }).select().then(first));

export const listDeliverables = (projectId) =>
  guard((c) => c.from('scope_deliverable_files')
    .select('id,milestone_id,name,storage_path,size_bytes,content_type,created_at')
    .eq('project_id', projectId).order('created_at', { ascending: false }).then(list));

// short-lived signed download URL (default 5 min) — the client never sees the bucket directly
export async function signDeliverableDownload(storagePath, expiresIn = 300) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    // download:true forces Content-Disposition: attachment, so a deliverable can never
    // render inline in the browser (neutralizes an uploaded HTML/SVG serving script).
    const { data, error } = await client().storage.from(DELIVERABLES_BUCKET).createSignedUrl(storagePath, expiresIn, { download: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, url: data.signedUrl };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

export async function deleteDeliverable(id, projectId) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const c = client();
    // scope the lookup to the project so an operator can't delete another project's file by id
    const { data: row, error: selErr } = await c.from('scope_deliverable_files')
      .select('storage_path').eq('id', id).eq('project_id', projectId).maybeSingle();
    if (selErr) return { ok: false, error: selErr.message };
    if (!row) return { ok: false, error: 'not_found' };
    await c.storage.from(DELIVERABLES_BUCKET).remove([row.storage_path]);
    const { error } = await c.from('scope_deliverable_files').delete().eq('id', id).eq('project_id', projectId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// ---- Messages (client <-> operator thread, per project) --------------------
export const listMessages = (projectId, limit = 200) =>
  guard((c) => c.from('scope_messages').select('id,sender,body,created_at')
    .eq('project_id', projectId).order('created_at', { ascending: true }).limit(limit).then(list));

// sender is 'client' or 'operator' — set by the caller (portal token vs admin token), never trusted from the body.
export const addMessage = (projectId, sender, body) =>
  guard((c) => c.from('scope_messages')
    .insert({ project_id: projectId, sender, body: String(body).slice(0, 5000) })
    .select().then(first));

// mark the other side's messages read when you open the thread
export async function markMessagesRead(projectId, reader) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const col = reader === 'operator' ? 'read_by_operator_at' : 'read_by_client_at';
    const other = reader === 'operator' ? 'client' : 'operator';
    const { error } = await client().from('scope_messages')
      .update({ [col]: new Date().toISOString() })
      .eq('project_id', projectId).eq('sender', other).is(col, null);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// count unread (for the admin pipeline badge) — messages from the client not yet read by operator
export const unreadFromClientCount = (projectId) =>
  guard((c) => c.from('scope_messages').select('id')
    .eq('project_id', projectId).eq('sender', 'client').is('read_by_operator_at', null).then(list));

export async function acceptContract(id, { name, ip }) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data, error } = await client().from('scope_contracts')
      .update({ status: 'accepted', accepted_name: (name||'').slice(0,120), accepted_at: new Date().toISOString(), accept_ip: ip || null })
      .eq('id', id).eq('status', 'sent').select();        // only a SENT contract can be accepted
    if (error) return { ok: false, error: error.message };
    return { ok: true, accepted: Array.isArray(data) && data.length === 1 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
