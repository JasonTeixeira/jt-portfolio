import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimited, clientIp } from '../../lib/ratelimit.mjs';
import { scrubPii } from '../../lib/observe.mjs';

// No Upstash env in the test runner → exercises the in-memory sliding window,
// which is the exact behavior the endpoints had before the shared refactor.

test('rateLimited allows up to max, blocks the next request (in-memory path)', async () => {
  const ip = 'test-ip-a';
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await rateLimited(ip, 3, 'rl-test-a'));
  assert.deepEqual(results, [false, false, false, true, true]);
});

test('rateLimited buckets are independent per key and per prefix', async () => {
  assert.equal(await rateLimited('ip-x', 2, 'rl-test-b'), false);
  assert.equal(await rateLimited('ip-x', 2, 'rl-test-b'), false);
  assert.equal(await rateLimited('ip-x', 2, 'rl-test-b'), true); // x over its cap
  assert.equal(await rateLimited('ip-y', 2, 'rl-test-b'), false); // different ip: fresh
  assert.equal(await rateLimited('ip-x', 2, 'rl-test-c'), false); // different prefix: fresh
});

test('clientIp returns the first hop when IP-shaped', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }), '203.0.113.9');
  assert.equal(clientIp({ headers: { 'x-real-ip': '198.51.100.7' } }), '198.51.100.7');
});

test('clientIp rejects malformed/oversized values → unknown (key hygiene)', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': 'DROP TABLE; $(rm)' } }), 'unknown');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': 'x'.repeat(200) } }), 'unknown');
  assert.equal(clientIp({ headers: {} }), 'unknown');
});

test('scrubPii redacts emails and card-like numbers, bounds length', () => {
  assert.equal(scrubPii('failed for user jane.doe@acme.com on charge'), 'failed for user [email] on charge');
  assert.equal(scrubPii('card 4242 4242 4242 4242 declined'), 'card [card] declined');
  assert.ok(scrubPii('z'.repeat(5000)).length <= 1000);
});
