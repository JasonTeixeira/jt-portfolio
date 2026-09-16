import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountForKind, isInvoicePaid, KINDS } from '../../lib/invoice-db.mjs';

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
