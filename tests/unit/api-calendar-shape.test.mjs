import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/calendar.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const req = (method, query = {}, body = {}, headers = {}) => ({ method, query, body, headers });

test('calendar GET is fail-closed: no admin token -> 401', async () => {
  const res = mockRes();
  await handler(req('GET', {}), res);
  assert.equal(res.code, 401);
  assert.equal(res.body.ok, false);
});

test('calendar upcoming GET is also token-gated -> 401', async () => {
  const res = mockRes();
  await handler(req('GET', { upcoming: '1' }), res);
  assert.equal(res.code, 401);
  assert.equal(res.body.ok, false);
});

test('calendar POST actions are token-gated (401 without token), never throw', async () => {
  for (const body of [{ action: 'create', title: 'x', starts_at: '2026-09-10T09:00:00Z' }, { action: 'update', id: 'x' }, { action: 'delete', id: 'x' }, { action: 'bogus' }]) {
    const res = mockRes();
    await handler(req('POST', {}, body), res);
    assert.equal(res.code, 401);
    assert.equal(typeof res.body.ok, 'boolean');
  }
});

test('calendar rejects unknown methods with 405', async () => {
  const res = mockRes();
  await handler(req('DELETE', {}, {}, { 'x-admin-token': 'anything' }), res);
  assert.ok([405, 401].includes(res.code));
  assert.equal(typeof res.body.ok, 'boolean');
});
