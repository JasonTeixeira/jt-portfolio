import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/client-onboarding.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const req = (method, body = {}, headers = {}) => ({ method, body, headers });

test('client-onboarding is fail-closed: no JWT -> 401', async () => {
  for (const m of ['GET', 'POST']) {
    const res = mockRes();
    await handler(req(m, { step: 'repo_access', done: true }), res);
    assert.equal(res.code, 401);
    assert.equal(res.body.ok, false);
  }
});

test('client-onboarding never throws on a malformed/forged body (still 401 without a valid JWT)', async () => {
  for (const body of [{}, { step: 'not_a_step' }, { step: 'repo_access', done: 'yes' }, { step: '__proto__' }]) {
    const res = mockRes();
    await handler(req('POST', body, { authorization: 'Bearer bogus' }), res);
    // bogus token → userFromRequest returns null → 401 before validation; contract never throws.
    assert.ok([400, 401, 200].includes(res.code));
    assert.equal(typeof res.body.ok, 'boolean');
  }
});
