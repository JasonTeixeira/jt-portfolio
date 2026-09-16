// Invoices + AR aging (operator cockpit). Invoices are real numbered records; their
// PAID status is derived from the proposal ledger (paid_at / balance_paid_at) so an
// invoice can never disagree with what Stripe actually collected. Service-role only.
import { createClient } from '@supabase/supabase-js';
import { first, list } from './db-result.mjs';
import { PROPOSAL_STATUS } from '../assets/proposal-core.mjs';

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

export const KINDS = new Set(['deposit', 'balance', 'full']);
const DUE_DAYS = 14;

// The amount an invoice of a given kind bills, straight off the proposal ledger.
export function amountForKind(proposal, kind) {
  if (!proposal) return 0;
  if (kind === 'deposit') return proposal.deposit_cents | 0;
  if (kind === 'balance') return proposal.balance_cents | 0;
  if (kind === 'full') return proposal.firm_cents | 0;
  return 0;
}

// Is this invoice's underlying money already collected? Derived, never stored.
export function isInvoicePaid(proposal, kind) {
  if (!proposal) return false;
  if (kind === 'deposit') return Boolean(proposal.paid_at);
  if (kind === 'balance') return Boolean(proposal.balance_paid_at);
  if (kind === 'full') return Boolean(proposal.paid_at && proposal.balance_paid_at);
  return false;
}

export const listInvoicesForProposal = (proposalId) =>
  guard((c) => c.from('scope_invoices')
    .select('id,invoice_no,proposal_id,kind,amount_cents,currency,status,issued_at,sent_at,due_at')
    .eq('proposal_id', proposalId).order('issued_at', { ascending: false }).then(list));

export const getInvoice = (id) =>
  guard((c) => c.from('scope_invoices').select('*').eq('id', id).maybeSingle().then((r) => r.data));

export const createInvoice = (proposalId, kind, amountCents, currency = 'usd') => {
  const dueAt = new Date(Date.now() + DUE_DAYS * 864e5).toISOString().slice(0, 10);
  return guard((c) => c.from('scope_invoices')
    .insert({ proposal_id: proposalId, kind, amount_cents: amountCents | 0, currency, due_at: dueAt })
    .select('id,invoice_no,proposal_id,kind,amount_cents,currency,status,issued_at,sent_at,due_at')
    .then(first));
};

export const markInvoiceSent = (id) =>
  guard((c) => c.from('scope_invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).select('id,invoice_no,proposal_id,kind,amount_cents,currency,status,issued_at,sent_at,due_at')
    .then(first));

// AR aging: outstanding balances bucketed by how long the balance has been owed. A
// balance becomes "owed" once the deposit is paid and the work is booked (accepted_at,
// falling back to paid_at). Buckets in days: 0-30, 31-60, 61-90, 90+.
export async function arAging() {
  return guard(async (c) => {
    const { data, error } = await c.from('scope_proposals')
      .select('public_id,client_email,balance_cents,accepted_at,paid_at,balance_paid_at,status')
      // A balance is owed once the DEPOSIT is paid (status stays 'deposit_paid' — there
      // is no separate 'fully paid' status; that state is balance_paid_at being set).
      .gt('balance_cents', 0).is('balance_paid_at', null).eq('status', PROPOSAL_STATUS.PAID);
    if (error) throw new Error(error.message);
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    const items = [];
    let totalCents = 0;
    for (const row of data || []) {
      const anchor = row.accepted_at || row.paid_at;
      if (!anchor) continue;
      const days = Math.floor((Date.now() - new Date(anchor).getTime()) / 864e5);
      const cents = row.balance_cents | 0;
      totalCents += cents;
      let bucket;
      if (days <= 30) bucket = 'current';
      else if (days <= 60) bucket = 'd30';
      else if (days <= 90) bucket = 'd60';
      else if (days <= 120) bucket = 'd90';
      else bucket = 'older';
      buckets[bucket] += cents;
      items.push({ publicId: row.public_id, email: row.client_email || null, cents, days, bucket });
    }
    items.sort((a, b) => b.days - a.days);
    return { buckets, items, totalCents };
  });
}
