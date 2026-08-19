import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
let _c = null;
export function isEnabled() { return Boolean(URL && KEY); }
function client() { if (!isEnabled()) return null; if (!_c) _c = createClient(URL, KEY, { auth: { persistSession: false } }); return _c; }
async function guard(fn) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { return { ok: true, data: await fn(client()) }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
function randToken() {
  const b = new Uint8Array(16); globalThis.crypto.getRandomValues(b);
  const A = '0123456789abcdefghijklmnopqrstuvwxyz'; let s = ''; for (const x of b) s += A[x % 36]; return s;
}

export async function leadCandidates(nowIso) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const c = client();
    const cutoff = new Date(new Date(nowIso).getTime() - 48 * 3600e3).toISOString();
    const { data: prospects } = await c.from('scope_prospects').select('*')
      .eq('stage', 'engaged').eq('unsubscribed', false).eq('nurture_suppressed', false)
      .not('email', 'is', null).lte('updated_at', cutoff).limit(500);
    const list = prospects || [];
    if (!list.length) return { ok: true, data: [] };
    const ids = list.map((p) => p.id);
    const { data: props } = await c.from('scope_proposals').select('prospect_id').in('prospect_id', ids);
    const withProposal = new Set((props || []).map((r) => r.prospect_id));
    const { data: plans } = await c.from('scope_plans').select('prospect_id').in('prospect_id', ids);
    const withPlan = new Set((plans || []).map((r) => r.prospect_id));
    const out = list.filter((p) => !withProposal.has(p.id)).map((p) => ({ prospect: p, hasPlan: withPlan.has(p.id) }));
    return { ok: true, data: out };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export const unpaidProposals = () =>
  guard((c) => c.from('scope_proposals').select('*, scope_prospects(unsubscribed,nurture_suppressed)')
    .eq('status', 'approved').not('client_email', 'is', null).limit(500).then((r) => r.data || []));
export const expiringProposals = (nowIso) =>
  guard((c) => {
    const soon = new Date(new Date(nowIso).getTime() + 3 * 864e5).toISOString();
    return c.from('scope_proposals').select('*, scope_prospects(unsubscribed,nurture_suppressed)')
      .eq('status', 'approved').gt('expires_at', nowIso).lte('expires_at', soon).limit(500).then((r) => r.data || []);
  });
export const staleDrafts = (nowIso) =>
  guard((c) => {
    const cutoff = new Date(new Date(nowIso).getTime() - 24 * 3600e3).toISOString();
    return c.from('scope_proposals').select('id,public_id,firm_cents,client_email,prospect_id,created_at')
      .eq('status', 'draft_pending').lte('created_at', cutoff).limit(200).then((r) => r.data || []);
  });
export const sentStepsForProposal = (proposalId) =>
  guard((c) => c.from('scope_nurture_sends').select('step').eq('proposal_id', proposalId)
    .then((r) => new Set((r.data || []).map((x) => x.step))));
export const sentStepsForProspect = (prospectId) =>
  guard((c) => c.from('scope_nurture_sends').select('step').eq('prospect_id', prospectId).is('proposal_id', null)
    .then((r) => new Set((r.data || []).map((x) => x.step))));
export async function recordSend({ prospect_id, proposal_id, step }) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { error } = await client().from('scope_nurture_sends')
      .insert({ prospect_id: prospect_id || null, proposal_id: proposal_id || null, step });
    if (error && /duplicate|unique/i.test(error.message)) return { ok: true, recorded: false };
    if (error) return { ok: false, error: error.message };
    return { ok: true, recorded: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export async function ensureUnsubToken(prospectId) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const c = client();
    const { data } = await c.from('scope_prospects').select('unsubscribe_token').eq('id', prospectId).maybeSingle();
    if (data && data.unsubscribe_token) return { ok: true, token: data.unsubscribe_token };
    const token = randToken();
    await c.from('scope_prospects').update({ unsubscribe_token: token }).eq('id', prospectId);
    return { ok: true, token };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export async function setUnsubscribedByToken(token) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_prospects').update({ unsubscribed: true }).eq('unsubscribe_token', token).select('id');
    return { ok: true, matched: Array.isArray(data) && data.length > 0 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export const setSuppressed = (prospectId) =>
  guard((c) => c.from('scope_prospects').update({ nurture_suppressed: true }).eq('id', prospectId).then(() => true));
