import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/clients.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const req = (method, query = {}, body = {}, headers = {}) => ({ method, query, body, headers });

test('clients GET is fail-closed: no admin token -> 401', async () => {
  const res = mockRes();
  await handler(req('GET', {}), res);
  assert.equal(res.code, 401);
  assert.equal(res.body.ok, false);
});

test('clients detail + POST are token-gated (401), never throw', async () => {
  for (const call of [['GET', { id: '00000000-0000-0000-0000-000000000000' }, {}], ['POST', {}, { action: 'update_meta', id: 'x' }], ['POST', {}, { action: 'bogus' }]]) {
    const res = mockRes();
    await handler(req(call[0], call[1], call[2]), res);
    assert.equal(res.code, 401);
    assert.equal(typeof res.body.ok, 'boolean');
  }
});

test('clients rejects unknown methods with 405/401', async () => {
  const res = mockRes();
  await handler(req('PUT', {}, {}, { 'x-admin-token': 'anything' }), res);
  assert.ok([405, 401].includes(res.code));
});
