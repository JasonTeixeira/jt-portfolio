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
// balance becomes "owed" once the DEPOSIT is paid and the work is booked (status stays
// PROPOSAL_STATUS.PAID = 'deposit_paid'; there is no separate 'fully paid' status — that
// state is balance_paid_at being set). Anchor date = accepted_at, falling back to paid_at.
//
// The money math below is PURE and unit-tested (computeAging/bucketForDays/isOwed). The
// single source of truth for the owed status is AGING_OWED_STATUS — the DB query AND the
// predicate both reference it, so there is no bare literal to drift out of sync. (The
// original bug was a hardcoded 'paid' in the query that no status is ever written as.)
export const AGING_OWED_STATUS = PROPOSAL_STATUS.PAID;
const DAY_MS = 864e5;

export function bucketForDays(days) {
  if (days <= 30) return 'current';
  if (days <= 60) return 'd30';
  if (days <= 90) return 'd60';
  if (days <= 120) return 'd90';
  return 'older';
}

// A row counts toward AR aging iff a balance is still owed on a deposit-paid deal.
export function isOwed(row) {
  return Boolean(row) && (row.balance_cents | 0) > 0 && !row.balance_paid_at && row.status === AGING_OWED_STATUS;
}

// Pure aggregation over already-fetched proposal rows. Re-applies isOwed() defensively so
// the function encodes the full "what's owed" contract independent of the query, and takes
// nowMs so tests are deterministic (no Date.now() coupling).
export function computeAging(rows, nowMs = Date.now()) {
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
  const items = [];
  let totalCents = 0;
  for (const row of rows || []) {
    if (!isOwed(row)) continue;
    const anchor = row.accepted_at || row.paid_at;
    if (!anchor) continue;
    const days = Math.floor((nowMs - new Date(anchor).getTime()) / DAY_MS);
    const cents = row.balance_cents | 0;
    totalCents += cents;
    const bucket = bucketForDays(days);
    buckets[bucket] += cents;
    items.push({ publicId: row.public_id, email: row.client_email || null, cents, days, bucket });
  }
  items.sort((a, b) => b.days - a.days);
  return { buckets, items, totalCents };
}

export async function arAging() {
  return guard(async (c) => {
    const { data, error } = await c.from('scope_proposals')
      .select('public_id,client_email,balance_cents,accepted_at,paid_at,balance_paid_at,status')
      .gt('balance_cents', 0).is('balance_paid_at', null).eq('status', AGING_OWED_STATUS);
    if (error) throw new Error(error.message);
    return computeAging(data);
  });
}
