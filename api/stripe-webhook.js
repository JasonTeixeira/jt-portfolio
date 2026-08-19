import { markPaidIfUnpaid, createProjectOnce, getProposalById } from '../lib/proposal-db.mjs';
import { appendEvent } from '../lib/scope-db.mjs';
import { sendOperator, sendClient } from '../lib/notify.mjs';
import { constructEvent } from '../lib/stripe.mjs';
import { money } from '../assets/proposal-core.mjs';

export const config = { api: { bodyParser: false } };

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
      const proposalId = obj.metadata && obj.metadata.proposalId;
      if (proposalId) {
        const paid = await markPaidIfUnpaid(proposalId, {
          session: obj.id, intent: obj.payment_intent, paidAtIso: new Date().toISOString() });
        if (paid.ok && paid.transitioned) {
          const got = await getProposalById(proposalId);
          const row = got.ok ? got.data : null;
          await createProjectOnce(proposalId, row && row.prospect_id);
          appendEvent({ prospect_id: row && row.prospect_id, type: 'deposit_paid', meta: { proposalId } }).catch(() => {});
          sendOperator({ subject: `Deposit paid — ${row ? money(row.deposit_cents) : ''}`,
            text: `A client just paid their deposit.\nProposal: ${proposalId}\nEmail: ${row ? row.client_email : '?'}\nAccepted by: ${row ? row.accepted_name : '?'}\n` }).catch(() => {});
          if (row && row.client_email) sendClient({ to: row.client_email,
            subject: 'Deposit received — we\'re starting',
            text: `Thanks. Your deposit came through and the work is booked.\n\nHere's what happens next: I'll reach out within one business day to line up the kickoff and access I need. The balance (${money(row.balance_cents)}) is invoiced on delivery.\n\n— Jason\n` }).catch(() => {});
        }
      }
    } else if (event.type === 'charge.dispute.created') {
      const obj = event.data.object;
      const proposalId = obj.metadata && obj.metadata.proposalId;
      appendEvent({ prospect_id: null, type: 'dispute_opened', meta: { proposalId: proposalId || null } }).catch(() => {});
      sendOperator({ subject: 'Payment dispute opened', text: `A dispute was opened. Charge: ${obj.id}. Handle it in the Stripe dashboard.\n` }).catch(() => {});
    }
    return res.status(200).json({ ok: true, received: true });
  } catch (e) {
    return res.status(200).json({ ok: true, received: true }); // ack; never make Stripe retry-storm on our bug
  }
}
