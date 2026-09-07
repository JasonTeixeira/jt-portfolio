import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/auth-email.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const req = (method, body = {}) => ({ method, query: {}, body, headers: {} });

test('auth-email rejects non-POST with 405', async () => {
  const res = mockRes();
  await handler(req('GET'), res);
  assert.equal(res.code, 405);
});

test('auth-email answers 200 generically regardless of input (no account-existence leak, never throws)', async () => {
  // Note: a strict 5/window rate-limit guards this endpoint, so later iterations may
  // return 429 — also a generic, non-leaking response. Both are acceptable.
  for (const body of [{}, { email: 'x' }, { email: 'a@b.co' }, { email: 'a@b.co', type: 'bogus' }, { email: 'a@b.co', type: 'recovery' }, { email: 'a@b.co', type: 'signup' }]) {
    const res = mockRes();
    await handler(req('POST', body), res);
    assert.ok([200, 429].includes(res.code), `expected 200/429, got ${res.code}`);
    assert.equal(res.body.ok, res.code === 200);
  }
});
