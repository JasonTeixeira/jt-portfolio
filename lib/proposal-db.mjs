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
export const createProposal = (row) =>
  guard((c) => c.from('scope_proposals').insert(row).select().then((r) => r.data && r.data[0]));
export const getProposalByPublicId = (publicId) =>
  guard((c) => c.from('scope_proposals').select('*').eq('public_id', publicId).maybeSingle().then((r) => r.data));
export const getProposalById = (id) =>
  guard((c) => c.from('scope_proposals').select('*').eq('id', id).maybeSingle().then((r) => r.data));
export const updateProposal = (id, patch) =>
  guard((c) => c.from('scope_proposals').update(patch).eq('id', id).select().then((r) => r.data && r.data[0]));
export const listProposals = ({ status, limit = 50 } = {}) =>
  guard((c) => {
    let q = c.from('scope_proposals').select('*').order('created_at', { ascending: false }).limit(limit);
    if (status) q = q.eq('status', status);
    return q.then((r) => r.data || []);
  });
// Idempotent paid transition: only rows not already paid flip. transitioned = 1 row returned.
export async function markPaidIfUnpaid(id, { session, intent, paidAtIso }) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_proposals')
      .update({ status: 'deposit_paid', stripe_session_id: session || null,
        stripe_payment_intent: intent || null, paid_at: paidAtIso || new Date().toISOString() })
      .eq('id', id).neq('status', 'deposit_paid').select();
    return { ok: true, transitioned: Array.isArray(data) && data.length === 1 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
// One project per proposal (unique index). Duplicate insert => created:false, still ok.
export async function createProjectOnce(proposalId, prospectId) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { error } = await client().from('scope_projects')
      .insert({ proposal_id: proposalId, prospect_id: prospectId || null });
    if (error && /duplicate|unique/i.test(error.message)) return { ok: true, created: false };
    if (error) return { ok: false, error: error.message };
    return { ok: true, created: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
