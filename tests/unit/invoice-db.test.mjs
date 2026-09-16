import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountForKind, isInvoicePaid, KINDS, AGING_OWED_STATUS, bucketForDays, isOwed, computeAging } from '../../lib/invoice-db.mjs';
import { PROPOSAL_STATUS } from '../../assets/proposal-core.mjs';

// The exact value at 864e5 ms/day, so aging tests can build rows at a precise age.
const AGO = (days) => new Date(Date.now() - days * 864e5).toISOString();

const prop = { deposit_cents: 30000, balance_cents: 70000, firm_cents: 100000, paid_at: null, balance_paid_at: null };

test('amountForKind pulls the right line off the ledger', () => {
  assert.equal(amountForKind(prop, 'deposit'), 30000);
  assert.equal(amountForKind(prop, 'balance'), 70000);
  assert.equal(amountForKind(prop, 'full'), 100000);
  assert.equal(amountForKind(prop, 'bogus'), 0);
  assert.equal(amountForKind(null, 'deposit'), 0);
});

test('KINDS is the closed set of invoice kinds', () => {
  assert.deepEqual([...KINDS].sort(), ['balance', 'deposit', 'full']);
});

test('isInvoicePaid is derived from the ledger, not stored state', () => {
  assert.equal(isInvoicePaid(prop, 'deposit'), false);
  const depPaid = { ...prop, paid_at: '2026-09-01T00:00:00Z' };
  assert.equal(isInvoicePaid(depPaid, 'deposit'), true);
  assert.equal(isInvoicePaid(depPaid, 'balance'), false);
  assert.equal(isInvoicePaid(depPaid, 'full'), false, 'full is unpaid until BOTH deposit and balance clear');
  const bothPaid = { ...depPaid, balance_paid_at: '2026-09-20T00:00:00Z' };
  assert.equal(isInvoicePaid(bothPaid, 'balance'), true);
  assert.equal(isInvoicePaid(bothPaid, 'full'), true);
});

// ── AR aging ────────────────────────────────────────────────────────────────
// Regression guard for the original CRITICAL: the owed status MUST be the value the
// app actually writes for a deposit-paid deal. If PROPOSAL_STATUS.PAID is ever renamed,
// this locks the aging query + predicate to the same single source of truth.
test('AGING_OWED_STATUS is exactly the deposit-paid status the app writes', () => {
  assert.equal(AGING_OWED_STATUS, PROPOSAL_STATUS.PAID);
  assert.equal(AGING_OWED_STATUS, 'deposit_paid');
});

test('bucketForDays covers every range with no gap or overlap', () => {
  assert.equal(bucketForDays(0), 'current');
  assert.equal(bucketForDays(30), 'current');
  assert.equal(bucketForDays(31), 'd30');
  assert.equal(bucketForDays(60), 'd30');
  assert.equal(bucketForDays(61), 'd60');
  assert.equal(bucketForDays(90), 'd60');
  assert.equal(bucketForDays(91), 'd90');
  assert.equal(bucketForDays(120), 'd90');
  assert.equal(bucketForDays(121), 'older');
  assert.equal(bucketForDays(9999), 'older');
});

test('isOwed includes ONLY a deposit-paid deal with an unpaid positive balance', () => {
  const owed = { balance_cents: 70000, balance_paid_at: null, status: PROPOSAL_STATUS.PAID };
  assert.equal(isOwed(owed), true);
  // the exact bug: a wrong status must be excluded
  assert.equal(isOwed({ ...owed, status: 'paid' }), false, "no proposal is ever status 'paid'");
  assert.equal(isOwed({ ...owed, status: PROPOSAL_STATUS.APPROVED }), false, 'approved but unpaid = not owed yet');
  assert.equal(isOwed({ ...owed, balance_paid_at: '2026-09-01T00:00:00Z' }), false, 'already paid in full');
  assert.equal(isOwed({ ...owed, balance_cents: 0 }), false, 'nothing owed');
  assert.equal(isOwed(null), false);
});

test('computeAging buckets/sums owed balances deterministically and excludes non-owed rows', () => {
  const now = Date.parse('2026-09-16T00:00:00Z');
  const mk = (over) => ({ public_id: 'p', client_email: 'c@x.com', balance_cents: 10000, accepted_at: null, paid_at: null, balance_paid_at: null, status: PROPOSAL_STATUS.PAID, ...over });
  const rows = [
    mk({ public_id: 'A', balance_cents: 10000, accepted_at: new Date(now - 10 * 864e5).toISOString() }),  // current
    mk({ public_id: 'B', balance_cents: 20000, accepted_at: new Date(now - 45 * 864e5).toISOString() }),  // d30
    mk({ public_id: 'C', balance_cents: 30000, accepted_at: new Date(now - 200 * 864e5).toISOString() }), // older
    mk({ public_id: 'D', balance_cents: 99999, accepted_at: new Date(now - 5 * 864e5).toISOString(), status: 'paid' }), // EXCLUDED (wrong status)
    mk({ public_id: 'E', balance_cents: 88888, accepted_at: new Date(now - 5 * 864e5).toISOString(), balance_paid_at: new Date(now).toISOString() }), // EXCLUDED (paid)
    mk({ public_id: 'F', balance_cents: 40000, accepted_at: null, paid_at: null }), // EXCLUDED (no anchor)
  ];
  const r = computeAging(rows, now);
  assert.equal(r.totalCents, 60000, 'only A+B+C count');
  assert.equal(r.buckets.current, 10000);
  assert.equal(r.buckets.d30, 20000);
  assert.equal(r.buckets.older, 30000);
  assert.equal(r.buckets.d60, 0);
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0].publicId, 'C', 'items sorted oldest-first');
  assert.equal(r.items[0].days, 200);
});

test('computeAging falls back to paid_at when accepted_at is missing', () => {
  const now = Date.parse('2026-09-16T00:00:00Z');
  const rows = [{ public_id: 'X', balance_cents: 5000, accepted_at: null, paid_at: new Date(now - 70 * 864e5).toISOString(), balance_paid_at: null, status: PROPOSAL_STATUS.PAID }];
  const r = computeAging(rows, now);
  assert.equal(r.items[0].bucket, 'd60');
  assert.equal(r.totalCents, 5000);
});

test('computeAging on empty/undefined input is a clean zero', () => {
  for (const input of [[], null, undefined]) {
    const r = computeAging(input, Date.now());
    assert.equal(r.totalCents, 0);
    assert.deepEqual(r.items, []);
    assert.deepEqual(r.buckets, { current: 0, d30: 0, d60: 0, d90: 0, older: 0 });
  }
});
