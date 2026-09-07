import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/my-projects.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const req = (method, query = {}, body = {}, headers = {}) => ({ method, query, body, headers });

test('my-projects is fail-closed: no JWT -> 401', async () => {
  const res = mockRes();
  await handler(req('GET', {}, {}, {}), res);
  assert.equal(res.code, 401);
  assert.equal(res.body.ok, false);
});

test('my-projects rejects a bogus bearer token -> 401 (never 200 with data)', async () => {
  const res = mockRes();
  await handler(req('GET', {}, {}, { authorization: 'Bearer not-a-real-jwt' }), res);
  assert.equal(res.code, 401);
});

test('my-projects rejects non-GET methods', async () => {
  const res = mockRes();
  await handler(req('POST', {}, {}, {}), res);
  assert.ok([405, 401].includes(res.code));
});
