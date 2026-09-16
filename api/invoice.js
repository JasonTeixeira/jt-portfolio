/**
 * /api/invoice — operator invoicing (admin-gated).
 *   GET  ?proposal=<uuid>              → { invoices: [...] }  (paid status derived from ledger)
 *   POST { action:'generate', proposalId, kind }  → create a numbered invoice
 *   POST { action:'send',     id }                → mark sent + email the client with the pay link
 *
 * Invoices never move money themselves — the client pays via the portal (deposit or
 * pay_balance), and paid status is derived from the proposal ledger. Operator-private.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { getProposalById } from '../lib/proposal-db.mjs';
import { getProjectByProposalId, ensurePortalToken } from '../lib/portal-db.mjs';
import { sendClient } from '../lib/notify.mjs';
import { money } from '../assets/proposal-core.mjs';
import {
  isEnabled, KINDS, amountForKind, isInvoicePaid,
  listInvoicesForProposal, createInvoice, markInvoiceSent, getInvoice,
} from '../lib/invoice-db.mjs';

const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

// Attach derived paid status to each invoice row so the UI never has to reconcile
// invoice state against the ledger itself.
function decorate(invoices, proposal) {
  return (invoices || []).map((inv) => ({ ...inv, paid: isInvoicePaid(proposal, inv.kind) }));
}

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, invoices: [] });

  if (req.method === 'GET') {
    const proposalId = String(req.query.proposal || '');
    if (!proposalId) return res.status(400).json({ ok: false, error: 'proposal required' });
    const [invR, propR] = await Promise.all([listInvoicesForProposal(proposalId), getProposalById(proposalId)]);
    if (!invR.ok) return res.status(502).json({ ok: false, error: 'invoices_unavailable' });
    return res.status(200).json({ ok: true, invoices: decorate(invR.data, propR.ok ? propR.data : null) });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = String(body.action || '');

    if (action === 'generate') {
      const proposalId = String(body.proposalId || '');
      const kind = String(body.kind || '');
      if (!proposalId) return res.status(400).json({ ok: false, error: 'proposalId required' });
      if (!KINDS.has(kind)) return res.status(400).json({ ok: false, error: 'invalid kind' });
      const propR = await getProposalById(proposalId);
      if (!propR.ok || !propR.data) return res.status(404).json({ ok: false, error: 'not_found' });
      const amount = amountForKind(propR.data, kind);
      if (!(amount > 0)) return res.status(400).json({ ok: false, error: 'no_amount' });
      const r = await createInvoice(proposalId, kind, amount, propR.data.currency || 'usd');
      if (!r.ok) { console.error('[invoice] generate failed', r.error); return res.status(400).json({ ok: false, error: 'save_failed' }); }
      return res.status(200).json({ ok: true, invoice: { ...r.data, paid: isInvoicePaid(propR.data, kind) } });
    }

    if (action === 'send') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ ok: false, error: 'id required' });
      const invR = await getInvoice(id);
      if (!invR.ok || !invR.data) return res.status(404).json({ ok: false, error: 'not_found' });
      const inv = invR.data;
      const propR = await getProposalById(inv.proposal_id);
      const proposal = propR.ok ? propR.data : null;
      if (!proposal || !proposal.client_email) return res.status(400).json({ ok: false, error: 'no_client_email' });
      // Resolve the portal link the client pays from (deposit or balance both live there).
      let link = SITE;
      try {
        const projR = await getProjectByProposalId(inv.proposal_id);
        if (projR.ok && projR.data) { const t = await ensurePortalToken(projR.data.id); if (t.ok && t.token) link = `${SITE}/portal.html?id=${t.token}`; }
      } catch { /* fall back to bare site */ }
      const sent = await markInvoiceSent(id);
      if (!sent.ok) { console.error('[invoice] mark sent failed', sent.error); return res.status(400).json({ ok: false, error: 'save_failed' }); }
      try {
        await sendClient({ to: proposal.client_email,
          subject: `Invoice INV-${inv.invoice_no} — ${money(inv.amount_cents)} ${inv.kind === 'balance' ? 'balance due' : inv.kind === 'deposit' ? 'deposit' : 'due'}`,
          text: `Hi,\n\nHere's invoice INV-${inv.invoice_no} for ${money(inv.amount_cents)} (${inv.kind}).\n\nYou can review and pay securely in your project portal:\n${link}\n\nThank you,\nJason\n` });
      } catch (e) { console.error('[invoice] notify send failed', (e && e.message) || e); }
      return res.status(200).json({ ok: true, invoice: { ...sent.data, paid: isInvoicePaid(proposal, sent.data.kind) } });
    }

    return res.status(400).json({ ok: false, error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/invoice', handler);
