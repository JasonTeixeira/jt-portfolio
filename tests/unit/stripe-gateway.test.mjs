import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, createCheckoutSession } from '../../lib/stripe.mjs';
test('disabled without STRIPE_SECRET_KEY', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await createCheckoutSession({ amountCents: 1000 }), { ok: false, skipped: true });
});
