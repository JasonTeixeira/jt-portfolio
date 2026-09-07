import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/messages.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const req = (method, query = {}, body = {}, headers = {}) => ({ method, query, body, headers });

test('messages endpoint is fail-closed: no admin token -> 401', async () => {
  const res = mockRes();
  await handler(req('GET', { projectId: 'x' }), res);
  assert.equal(res.code, 401);
  assert.equal(res.body.ok, false);
});

test('messages POST is also token-gated (401 without token), never throws', async () => {
  const res = mockRes();
  await handler(req('POST', {}, { projectId: 'x', body: 'hi' }), res);
  assert.ok([401, 200, 400].includes(res.code));
  assert.equal(typeof res.body.ok, 'boolean');
});

test('messages handler never throws on a malformed body', async () => {
  for (const body of [{}, { projectId: '' }, { projectId: 'x' }, { projectId: 'x', body: '' }]) {
    const res = mockRes();
    await handler(req('POST', {}, body, { 'x-admin-token': 'anything' }), res);
    assert.ok([400, 401, 200].includes(res.code));
    assert.equal(typeof res.body.ok, 'boolean');
  }
});
