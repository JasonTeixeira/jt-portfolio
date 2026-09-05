import { markPaidIfUnpaid, createProjectOnce, getProposalById } from '../lib/proposal-db.mjs';
import { getProjectByProposalId, ensurePortalToken } from '../lib/portal-db.mjs';
import { appendEvent } from '../lib/scope-db.mjs';
import { sendOperator, sendClient } from '../lib/notify.mjs';
import { constructEvent } from '../lib/stripe.mjs';
import { captureError } from '../lib/observe.mjs';
import { money } from '../assets/proposal-core.mjs';

export const config = { api: { bodyParser: false } };
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

// Best-effort: resolve the project's portal token so the receipt email can link to it.
// Never throws — a missing/failed lookup just means the email goes out without the line.
async function portalLinkLine(proposalId) {
  try {
    const projGot = await getProjectByProposalId(proposalId);
    if (!projGot.ok || !projGot.data) return '';
    const tok = await ensurePortalToken(projGot.data.id);
    if (!tok.ok || !tok.token) return '';
    return `\n\nTrack your project here: ${SITE}/portal.html?id=${tok.token}\n`;
  } catch { return ''; }
}

export async function collectRaw(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  let event;
  try {
    const raw = await collectRaw(req);
    const sig = req.headers['stripe-signature'];
    const r = await constructEvent(raw, sig);
    if (r.skipped) return res.status(200).json({ ok: false, skipped: true }); // webhook secret unset
    event = r.event;
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'bad signature' });
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const obj = event.data.object;
      if (obj.payment_status && obj.payment_status !== 'paid') {
        return res.status(200).json({ ok: true, received: true });
      }
      const proposalId = obj.metadata && obj.metadata.proposalId;
      if (proposalId) {
        const paid = await markPaidIfUnpaid(proposalId, {
          session: obj.id, intent: obj.payment_intent, paidAtIso: new Date().toISOString() });
        if (paid.ok) {
          const got = await getProposalById(proposalId);
          const row = got.ok ? got.data : null;
          await createProjectOnce(proposalId, row && row.prospect_id); // idempotent (unique index) -> self-heals on retry
          if (paid.transitioned) {
            appendEvent({ prospect_id: row && row.prospect_id, type: 'deposit_paid', meta: { proposalId } }).catch(() => {});
            try {
              await sendOperator({ subject: `Deposit paid — ${row ? money(row.deposit_cents) : ''}`,
                text: `A client just paid their deposit.\nProposal: ${proposalId}\nEmail: ${row ? row.client_email : '?'}\nAccepted by: ${row ? row.accepted_name : '?'}\n` });
            } catch (e) { console.error('[stripe-webhook] notify send failed', (e && e.message) || e); }
            if (row && row.client_email) {
              const portalLine = await portalLinkLine(proposalId);
              try {
                await sendClient({ to: row.client_email,
                  subject: 'Deposit received. We\'re starting.',
                  text: `Thanks. Your deposit came through and the work is booked.\n\nHere's what happens next: I'll reach out within one business day to line up the kickoff and access I need. The balance (${money(row.balance_cents)}) is invoiced on delivery.\n\n— Jason\n${portalLine}` });
              } catch (e) { console.error('[stripe-webhook] notify send failed', (e && e.message) || e); }
            }
          }
        }
      }
    } else if (event.type === 'charge.dispute.created') {
      const obj = event.data.object;
      const proposalId = obj.metadata && obj.metadata.proposalId;
      appendEvent({ prospect_id: null, type: 'dispute_opened', meta: { proposalId: proposalId || null } }).catch(() => {});
      try {
        await sendOperator({ subject: 'Payment dispute opened', text: `A dispute was opened. Charge: ${obj.id}. Handle it in the Stripe dashboard.\n` });
      } catch (e) { console.error('[stripe-webhook] notify send failed', (e && e.message) || e); }
    }
    return res.status(200).json({ ok: true, received: true });
  } catch (e) {
    // Still ack 200 so Stripe doesn't retry-storm on OUR bug — but LOG + report,
    // so a real payment-reconciliation gap (deposit paid, project not created,
    // no email) is visible in logs/Sentry instead of silently lost.
    console.error('[stripe-webhook] handler error', event && event.type, e instanceof Error ? e.message : e);
    captureError(e, { route: '/api/stripe-webhook', kind: 'webhook_handler_failed', eventType: event && event.type });
    return res.status(200).json({ ok: true, received: true });
  }
}
