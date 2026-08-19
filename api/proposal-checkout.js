import { isEnabled, getProposalByPublicId, updateProposal } from '../lib/proposal-db.mjs';
import { appendEvent } from '../lib/scope-db.mjs';
import * as stripe from '../lib/stripe.mjs';
import { isExpired, PROPOSAL_STATUS } from '../assets/proposal-core.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
const hits = new Map();
function throttled(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
  const now = Date.now(); const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(ip, arr); return arr.length > 20;
}

export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad body' };
  if (typeof body.publicId !== 'string' || !body.publicId.trim()) return { ok: false, error: 'publicId required' };
  if (body.agreed !== true) return { ok: false, error: 'must agree to terms' };
  const n = typeof body.acceptName === 'string' ? body.acceptName.trim() : '';
  if (n.length < 2 || n.length > 120) return { ok: false, error: 'name required' };
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  const v = validate(req.body || {}); if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
  if (throttled(req)) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'not_configured' });
  const r = await getProposalByPublicId(req.body.publicId.trim());
  if (!r.ok || !r.data) return res.status(404).json({ ok: false, error: 'not_found' });
  const row = r.data;
  const nowIso = new Date().toISOString();
  if (row.status !== PROPOSAL_STATUS.APPROVED) return res.status(409).json({ ok: false, error: 'not_payable' });
  if (isExpired(row, nowIso)) return res.status(410).json({ ok: false, error: 'expired' });
  if (!stripe.isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'payments_off' });
  // record acceptance intent (finalized by payment webhook)
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || null;
  const acc = await updateProposal(row.id, { accepted_name: req.body.acceptName.trim(), accepted_at: nowIso,
    accept_ip: ip, accept_terms_version: row.terms_version });
  if (!acc.ok) return res.status(200).json({ ok: false, skipped: true, reason: 'accept_write_failed' });
  // reuse an open session if one exists
  if (row.stripe_session_id) {
    const got = await stripe.retrieveSession(row.stripe_session_id);
    if (got.ok && got.session && got.session.status === 'open' && got.session.url) {
      return res.status(200).json({ ok: true, url: got.session.url });
    }
  }
  const sess = await stripe.createCheckoutSession({
    amountCents: row.deposit_cents, currency: row.currency || 'usd',
    productName: 'Project deposit', publicId: row.public_id, proposalId: row.id,
    customerEmail: row.client_email || undefined,
    successUrl: `${SITE}/proposal?id=${row.public_id}&paid=1`,
    cancelUrl: `${SITE}/proposal?id=${row.public_id}`,
  });
  if (!sess.ok) return res.status(200).json({ ok: false, skipped: true });
  await updateProposal(row.id, { stripe_session_id: sess.id });
  appendEvent({ prospect_id: row.prospect_id, type: 'proposal_accepted', meta: { public_id: row.public_id } }).catch(() => {});
  return res.status(200).json({ ok: true, url: sess.url });
}
