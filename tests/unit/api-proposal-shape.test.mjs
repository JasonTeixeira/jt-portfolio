import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, clientView } from '../../api/proposal.js';

test('validate requires prospectId + a plan with keys', () => {
  assert.equal(validate({ prospectId: 'p', plan: { keys: ['ai-agent'], totalBand: [4000, 9000] } }).ok, true);
  assert.equal(validate({ plan: { keys: ['x'] } }).ok, false);
  assert.equal(validate({ prospectId: 'p', plan: { keys: [] } }).ok, false);
  assert.equal(validate({ prospectId: 'p' }).ok, false);
});
test('clientView hides drafts and whitelists fields', () => {
  const base = { public_id: 'abc', status: 'approved', keys: ['ai-agent'], segment: 'ai-product',
    firm_cents: 650000, deposit_cents: 195000, balance_cents: 455000, currency: 'usd',
    scope_note: 'n', terms_version: '2026-08-19', expires_at: '2030-01-01T00:00:00Z', paid_at: null,
    id: 'SECRET-UUID', client_email: 'x@y.co', accept_ip: '1.2.3.4', stripe_session_id: 'sess' };
  const v = clientView(base, '2026-01-01T00:00:00Z');
  assert.equal(v.status, 'approved');
  assert.equal(v.firm_cents, 650000);
  assert.equal(v.id, undefined); assert.equal(v.client_email, undefined);
  assert.equal(v.accept_ip, undefined); assert.equal(v.stripe_session_id, undefined);
  assert.equal(clientView({ ...base, status: 'draft_pending' }, '2026-01-01T00:00:00Z'), null);
  assert.equal(clientView({ ...base, status: 'approved', expires_at: '2020-01-01T00:00:00Z' }, '2026-01-01T00:00:00Z').status, 'expired');
});
