import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySvix, recipients, isHardBounce } from '../../api/resend-webhook.js';

// Build a valid Svix signature the same way Resend does, so we can prove verify accepts
// a genuine one and rejects tampering — without needing the real secret.
const SECRET = 'whsec_' + Buffer.from('super-secret-signing-key-1234567890').toString('base64');
function signed(body, { id = 'msg_1', ts = Math.floor(Date.now() / 1000) } = {}) {
  const key = Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return { headers: { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${sig}` }, body };
}

test('verifySvix accepts a correctly-signed payload', () => {
  const { headers, body } = signed('{"type":"email.bounced"}');
  assert.equal(verifySvix(SECRET, body, headers), true);
});

test('verifySvix rejects a tampered body', () => {
  const { headers } = signed('{"type":"email.bounced"}');
  assert.equal(verifySvix(SECRET, '{"type":"email.complained"}', headers), false);
});

test('verifySvix rejects the wrong secret', () => {
  const { headers, body } = signed('{"a":1}');
  assert.equal(verifySvix('whsec_' + Buffer.from('different-key').toString('base64'), body, headers), false);
});

test('verifySvix rejects a stale timestamp (replay window)', () => {
  const old = Math.floor(Date.now() / 1000) - 60 * 60; // 1h old
  const { headers, body } = signed('{"a":1}', { ts: old });
  assert.equal(verifySvix(SECRET, body, headers), false);
});

test('verifySvix rejects missing headers or empty secret', () => {
  const { body } = signed('{"a":1}');
  assert.equal(verifySvix(SECRET, body, {}), false);
  assert.equal(verifySvix('', body, { 'svix-id': 'x', 'svix-timestamp': '1', 'svix-signature': 'v1,x' }), false);
});

test('verifySvix matches when the header carries multiple signatures', () => {
  const { headers, body } = signed('{"a":1}');
  headers['svix-signature'] = 'v1,not-the-one ' + headers['svix-signature'];
  assert.equal(verifySvix(SECRET, body, headers), true);
});

test('recipients normalizes array/string/missing', () => {
  assert.deepEqual(recipients({ to: ['a@x.com', 'b@x.com'] }), ['a@x.com', 'b@x.com']);
  assert.deepEqual(recipients({ to: 'a@x.com' }), ['a@x.com']);
  assert.deepEqual(recipients({}), []);
  assert.deepEqual(recipients(null), []);
});

test('isHardBounce suppresses permanent/unknown but not transient', () => {
  assert.equal(isHardBounce({ bounce: { type: 'Permanent' } }), true);
  assert.equal(isHardBounce({ bounce: { type: 'HardBounce' } }), true);
  assert.equal(isHardBounce({}), true, 'unknown shape treated as hard (Resend default bounce is hard)');
  assert.equal(isHardBounce({ bounce: { type: 'Transient' } }), false);
  assert.equal(isHardBounce({ bounce: { type: 'SoftBounce' } }), false);
});
