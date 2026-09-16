import { markPaidIfUnpaid, markBalancePaidIfUnpaid, createProjectOnce, getProposalById } from '../lib/proposal-db.mjs';
import { getProjectByProposalId, ensurePortalToken } from '../lib/portal-db.mjs';
import { appendEvent, setProspectStage } from '../lib/scope-db.mjs';
import { sendOperator, sendClient } from '../lib/notify.mjs';
import { receiptEmail } from '../lib/email-templates.mjs';
import { constructEvent } from '../lib/stripe.mjs';
import { captureError } from '../lib/observe.mjs';
import { money } from '../assets/proposal-core.mjs';

export const config = { api: { bodyParser: false } };
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

// Best-effort: resolve the project's portal URL for the receipt CTA. Never throws — a
// missing/failed lookup just falls back to the site root.
async function portalUrl(proposalId) {
  try {
    const projGot = await getProjectByProposalId(proposalId);
    if (!projGot.ok || !projGot.data) return SITE;
    const tok = await ensurePortalToken(projGot.data.id);
    return tok.ok && tok.token ? `${SITE}/portal.html?id=${tok.token}` : SITE;
  } catch { return SITE; }
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
  } catch {
    return res.status(400).json({ ok: false, error: 'bad signature' });
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const obj = event.data.object;
      if (obj.payment_status && obj.payment_status !== 'paid') {
        return res.status(200).json({ ok: true, received: true });
      }
      const proposalId = obj.metadata && obj.metadata.proposalId;
      const kind = obj.metadata && obj.metadata.kind;
      if (proposalId && kind === 'balance') {
        // balance payment (client paid the remainder from the portal)
        const bal = await markBalancePaidIfUnpaid(proposalId, { session: obj.id, paidAtIso: new Date().toISOString() });
        if (bal.ok && bal.transitioned) {
          const got = await getProposalById(proposalId);
          const row = got.ok ? got.data : null;
          appendEvent({ prospect_id: row && row.prospect_id, type: 'balance_paid', meta: { proposalId } }).catch(() => {});
          try {
            await sendOperator({ subject: `Balance paid — ${row ? money(row.balance_cents) : ''}`,
              text: `A client just paid the remaining balance.\nProposal: ${proposalId}\nEmail: ${row ? row.client_email : '?'}\n` });
          } catch (e) { console.error('[stripe-webhook] notify send failed', (e && e.message) || e); }
          // Client receipt — the balance payment previously sent the client nothing.
          if (row && row.client_email) {
            try {
              const mail = receiptEmail({ kind: 'balance', amountCents: row.balance_cents, totalCents: row.firm_cents, link: await portalUrl(proposalId) });
              await sendClient({ to: row.client_email, subject: mail.subject, text: mail.text, html: mail.html });
            } catch (e) { console.error('[stripe-webhook] notify send failed', (e && e.message) || e); }
          }
        }
        return res.status(200).json({ ok: true, received: true });
      }
      if (proposalId) {
        const paid = await markPaidIfUnpaid(proposalId, {
          session: obj.id, intent: obj.payment_intent, paidAtIso: new Date().toISOString() });
        if (paid.ok) {
          const got = await getProposalById(proposalId);
          const row = got.ok ? got.data : null;
          await createProjectOnce(proposalId, row && row.prospect_id); // idempotent (unique index) -> self-heals on retry
          if (paid.transitioned) {
            appendEvent({ prospect_id: row && row.prospect_id, type: 'deposit_paid', meta: { proposalId } }).catch(() => {});
            // stage machine: a paid deposit = a closed-won prospect
            if (row && row.prospect_id) setProspectStage(row.prospect_id, 'won').catch(() => {});
            try {
              await sendOperator({ subject: `Deposit paid — ${row ? money(row.deposit_cents) : ''}`,
                text: `A client just paid their deposit.\nProposal: ${proposalId}\nEmail: ${row ? row.client_email : '?'}\nAccepted by: ${row ? row.accepted_name : '?'}\n` });
            } catch (e) { console.error('[stripe-webhook] notify send failed', (e && e.message) || e); }
            if (row && row.client_email) {
              try {
                const mail = receiptEmail({ kind: 'deposit', amountCents: row.deposit_cents, totalCents: row.balance_cents, link: await portalUrl(proposalId) });
                await sendClient({ to: row.client_email, subject: mail.subject, text: mail.text, html: mail.html });
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
