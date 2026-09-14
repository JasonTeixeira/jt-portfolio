import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

/**
 * The webhook handler had no coverage beyond collectRaw. These drive the real
 * default handler: method guard, forged-signature rejection (security-critical),
 * and a genuinely VALID signed checkout.session.completed (via Stripe's test
 * signature helper) that must be accepted and acknowledged. (Audit critical:
 * Stripe webhook had zero success-path coverage.)
 *
 * Env must be set BEFORE importing — lib/stripe.mjs reads WEBHOOK_SECRET at module
 * load. node's test runner isolates each file in its own process, so this is safe.
 */
const SECRET = 'whsec_unit_test_secret_0000000000000000';
process.env.STRIPE_SECRET_KEY = 'sk_test_unit_dummy';
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
const { default: handler } = await import('../../api/stripe-webhook.js');

const mockRes = () => {
  const r = { statusCode: 0, body: null, headers: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.body = o; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
};
const streamReq = (body, headers = {}) => ({
  method: 'POST', headers,
  async *[Symbol.asyncIterator]() { yield Buffer.from(body); }
});

test('webhook: non-POST is rejected 405', async () => {
  const res = mockRes();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

test('webhook: a forged/invalid signature is rejected 400 (no unsigned events accepted)', async () => {
  const res = mockRes();
  await handler(streamReq('{"type":"checkout.session.completed"}', { 'stripe-signature': 't=1,v1=deadbeef' }), res);
  assert.equal(res.statusCode, 400);
});

test('webhook: a VALID signed checkout.session.completed is verified and acknowledged 200', async () => {
  const payload = JSON.stringify({
    id: 'evt_test_1', type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', payment_status: 'paid', metadata: { proposalId: 'not-in-db' } } }
  });
  const stripe = new Stripe('sk_test_unit_dummy');
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const res = mockRes();
  await handler(streamReq(payload, { 'stripe-signature': header }), res);
  // signature verifies -> event processed -> webhook acknowledged (200) even though the
  // proposal isn't in a DB in this test env (DB writes degrade to skip, never crash)
  assert.equal(res.statusCode, 200, 'valid signed event must be acknowledged, not errored');
});
