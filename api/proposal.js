import { isEnabled, createProposal, getProposalByPublicId, updateProposal } from '../lib/proposal-db.mjs';
import { appendEvent } from '../lib/scope-db.mjs';
import { sendOperator } from '../lib/notify.mjs';
import { computePlan } from '../assets/scope-core.mjs';
import {
  firmCentsFromBand, depositCents, balanceCents, publicId, money,
  isExpired, DEPOSIT_PCT_DEFAULT, TERMS_VERSION, PROPOSAL_STATUS,
} from '../assets/proposal-core.mjs';

const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
const CLIENT_FIELDS = ['public_id', 'status', 'keys', 'segment', 'firm_cents', 'deposit_cents',
  'balance_cents', 'currency', 'scope_note', 'terms_version', 'expires_at', 'paid_at'];
const hits = new Map();

export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad body' };
  if (typeof body.prospectId !== 'string' || !body.prospectId.trim()) return { ok: false, error: 'prospectId required' };
  const p = body.plan;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, error: 'plan required' };
  if (!Array.isArray(p.keys) || p.keys.length === 0) return { ok: false, error: 'plan.keys required' };
  return { ok: true };
}
export function clientView(row, nowIso) {
  if (!row) return null;
  if (row.status === PROPOSAL_STATUS.DRAFT) return null; // drafts invisible to client
  const out = {};
  for (const f of CLIENT_FIELDS) out[f] = row[f];
  if (row.status === PROPOSAL_STATUS.APPROVED && isExpired(row, nowIso)) out.status = PROPOSAL_STATUS.EXPIRED;
  return out;
}
// Price band is derived from the catalog keys, NEVER from client-sent totalBand.
export function serverBand(plan) {
  const p = computePlan(Array.isArray(plan && plan.keys) ? plan.keys : [], (plan && plan.segment) || null);
  return p.totalBand;
}
function throttled(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
  const now = Date.now(); const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(ip, arr); return arr.length > 20;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!isEnabled()) return res.status(404).json({ ok: false, error: 'not_found' });
    const publicIdParam = String(req.query.publicId || '');
    if (!publicIdParam) return res.status(400).json({ ok: false, error: 'publicId required' });
    const r = await getProposalByPublicId(publicIdParam);
    const view = r.ok ? clientView(r.data, new Date().toISOString()) : null;
    if (!view) return res.status(404).json({ ok: false, error: 'not_found' });
    if (view.status === PROPOSAL_STATUS.APPROVED && r.data && r.data.id) {
      appendEvent({ prospect_id: r.data.prospect_id, type: 'proposal_viewed', meta: { public_id: publicIdParam } }).catch(() => {});
    }
    return res.status(200).json({ ok: true, proposal: view });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'not_configured' });
  if (throttled(req)) return res.status(429).json({ ok: false, error: 'slow_down' });
  const body = req.body || {};
  const v = validate(body); if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
  const plan = body.plan;
  const band = serverBand(plan);
  const firm = firmCentsFromBand(band);
  const dep = depositCents(firm, DEPOSIT_PCT_DEFAULT);
  const now = new Date();
  const expires = new Date(now.getTime() + 14 * 864e5).toISOString();
  const pid = publicId();
  const row = {
    public_id: pid, prospect_id: body.prospectId.trim(),
    keys: plan.keys, segment: plan.segment || null,
    band_lo: band[0] || 0, band_hi: band[1] || 0,
    firm_cents: firm, deposit_pct: DEPOSIT_PCT_DEFAULT, deposit_cents: dep,
    balance_cents: balanceCents(firm, dep), currency: 'usd',
    terms_version: TERMS_VERSION, status: PROPOSAL_STATUS.DRAFT,
    client_email: typeof body.email === 'string' ? body.email.slice(0, 320) : null,
    expires_at: expires,
  };
  const created = await createProposal(row);
  if (!created.ok) return res.status(200).json({ ok: false, skipped: true });
  appendEvent({ prospect_id: row.prospect_id, type: 'proposal_drafted', meta: { public_id: pid, firm_cents: firm } }).catch(() => {});
  const adminToken = process.env.SCOPE_ADMIN_TOKEN || '';
  const adminLink = adminToken ? `${SITE}/proposal-admin?key=${adminToken}` : `${SITE}/proposal-admin`;
  sendOperator({
    subject: `New proposal to approve — ${money(firm)} draft`,
    text: `A scope just came in.\n\nSegment: ${row.segment || '(none)'}\nItems: ${plan.keys.length}\nDraft firm price: ${money(firm)} (deposit ${money(dep)})\nClient email: ${row.client_email || '(none)'}\n\nApprove it: ${adminLink}\nProposal id: ${created.data ? created.data.id : '(unknown)'}\n`,
  }).catch(() => {});
  return res.status(200).json({ ok: true, publicId: pid });
}
