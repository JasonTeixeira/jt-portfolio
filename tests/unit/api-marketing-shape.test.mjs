import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/marketing.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const req = (method, query = {}, body = {}, headers = {}) => ({ method, query, body, headers });

test('marketing is fail-closed: no admin token -> 401', async () => {
  const res = mockRes();
  await handler(req('GET', {}), res);
  assert.equal(res.code, 401);
  assert.equal(res.body.ok, false);
});

test('marketing rejects non-GET methods', async () => {
  const res = mockRes();
  await handler(req('POST', {}, {}, { 'x-admin-token': 'anything' }), res);
  assert.ok([405, 401].includes(res.code));
  assert.equal(typeof res.body.ok, 'boolean');
});
