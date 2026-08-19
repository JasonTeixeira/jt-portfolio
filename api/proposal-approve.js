import { isEnabled, getProposalById, updateProposal } from '../lib/proposal-db.mjs';
import { appendEvent } from '../lib/scope-db.mjs';
import { sendClient } from '../lib/notify.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
import { clampFirmCents, depositCents, balanceCents, money, DEPOSIT_PCT_DEFAULT, PROPOSAL_STATUS } from '../assets/proposal-core.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const { id, firmCents, depositPct, scopeNote, expiresAt } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  const got = await getProposalById(id);
  if (!got.ok || !got.data) return res.status(404).json({ ok: false, error: 'not_found' });
  const row = got.data;
  const pct = typeof depositPct === 'number' && depositPct > 0 && depositPct < 1 ? depositPct : (row.deposit_pct || DEPOSIT_PCT_DEFAULT);
  const firmIn = typeof firmCents === 'number' ? firmCents : row.firm_cents;
  const { cents: firm } = clampFirmCents(firmIn, [row.band_lo, row.band_hi]);
  const dep = depositCents(firm, pct);
  const patch = {
    firm_cents: firm, deposit_pct: pct, deposit_cents: dep, balance_cents: balanceCents(firm, dep),
    scope_note: typeof scopeNote === 'string' ? scopeNote.slice(0, 2000) : row.scope_note,
    expires_at: expiresAt || row.expires_at,
    status: PROPOSAL_STATUS.APPROVED, approved_at: new Date().toISOString(),
  };
  const upd = await updateProposal(id, patch);
  if (!upd.ok) return res.status(200).json({ ok: false, skipped: true });
  appendEvent({ prospect_id: row.prospect_id, type: 'proposal_approved', meta: { id, firm_cents: firm } }).catch(() => {});
  if (row.client_email) {
    sendClient({ to: row.client_email,
      subject: 'Your project proposal is ready',
      text: `Hi,\n\nYour proposal is ready to review. It has the scope, the price, and the terms in one place.\n\nSee it here: ${SITE}/proposal?id=${row.public_id}\n\nDeposit to start: ${money(dep)}. If anything looks off, just reply and we'll sort it out.\n\n— Jason\n` }).catch(() => {});
  }
  return res.status(200).json({ ok: true, publicId: row.public_id });
}
