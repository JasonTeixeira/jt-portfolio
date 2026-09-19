import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidates, findBusinessEmail, isEnabled } from '../../lib/email-finder.mjs';

test('candidates generates capped role addresses from a domain', () => {
  const c = candidates('https://www.harveybakerplumbing.com/');
  assert.ok(c.includes('info@harveybakerplumbing.com'), 'info@ first');
  assert.ok(c.every((e) => e.endsWith('@harveybakerplumbing.com')));
  assert.ok(c.length <= 4, 'capped to bound verifier spend');
  assert.deepEqual(candidates(''), []);
  assert.deepEqual(candidates('not-a-domain'), []);
});
test('findBusinessEmail is inert without FINDYMAIL_API_KEY', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await findBusinessEmail('acme.com'), { ok: false, skipped: true });
});
