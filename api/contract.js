import { withObserve } from '../lib/observe.mjs';
import { isEnabled, getContractByPublicId, acceptContract } from '../lib/portal-db.mjs';
import { CONTRACT_CAVEAT } from '../assets/contract-core.mjs';

// Only a contract that has been sent (or already accepted) is visible to the client.
// Drafts stay invisible — matches the proposal-draft convention.
const VISIBLE_STATUSES = new Set(['sent', 'accepted']);

export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad body' };
  if (typeof body.publicId !== 'string' || !body.publicId.trim()) return { ok: false, error: 'publicId required' };
  if (body.agreed !== true) return { ok: false, error: 'must agree to terms' };
  const n = typeof body.name === 'string' ? body.name.trim() : '';
  if (n.length < 2 || n.length > 120) return { ok: false, error: 'name required' };
  return { ok: true };
}

async function handler(req, res) {
  if (req.method === 'GET') {
    // GET always answers 200 with a body the client branches on — a stale/invalid/draft
    // link is a normal state for a visitor, not an HTTP error. Matches api/proposal.js.
    if (!isEnabled()) return res.status(200).json({ ok: false, reason: 'not_configured' });
    const publicIdParam = String(req.query.publicId || '');
    if (!publicIdParam) return res.status(200).json({ ok: false, reason: 'bad_request' });
    const r = await getContractByPublicId(publicIdParam);
    const row = r.ok ? r.data : null;
    if (!row || !VISIBLE_STATUSES.has(row.status)) return res.status(200).json({ ok: false, reason: 'not_found' });
    return res.status(200).json({
      ok: true,
      // accepted_at is whitelisted alongside status so the client page can render
      // "Accepted on <date>" on a repeat visit, without leaking name/ip/terms_version.
      contract: { body: row.body, kind: row.kind, status: row.status, caveat: CONTRACT_CAVEAT, accepted_at: row.accepted_at || null },
    });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  const body = req.body || {};
  if (body.action && body.action !== 'accept') return res.status(400).json({ ok: false, error: 'unknown action' });
  const v = validate(body); if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'not_configured' });
  const r = await getContractByPublicId(body.publicId.trim());
  if (!r.ok || !r.data) return res.status(404).json({ ok: false, error: 'not_found' });
  const row = r.data;
  if (row.status !== 'sent') return res.status(409).json({ ok: false, error: 'not_acceptable' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || null;
  const acc = await acceptContract(row.id, { name: body.name.trim(), ip });
  if (!acc.ok) return res.status(200).json({ ok: false, skipped: true });
  return res.status(200).json({ ok: true, accepted: Boolean(acc.accepted) });
}

export default withObserve('/api/contract', handler);
