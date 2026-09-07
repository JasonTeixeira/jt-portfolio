import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/tasks.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const req = (method, query = {}, body = {}, headers = {}) => ({ method, query, body, headers });

test('tasks GET is fail-closed: no admin token -> 401', async () => {
  const res = mockRes();
  await handler(req('GET', {}), res);
  assert.equal(res.code, 401);
  assert.equal(res.body.ok, false);
});

test('tasks budget + costs GETs are token-gated -> 401', async () => {
  for (const q of [{ budget: '1' }, { costs: 'x' }]) {
    const res = mockRes();
    await handler(req('GET', q), res);
    assert.equal(res.code, 401);
  }
});

test('tasks POST actions are token-gated (401 without token), never throw', async () => {
  for (const body of [
    { action: 'task_create', title: 'x' }, { action: 'task_update', id: 'x' }, { action: 'task_delete', id: 'x' },
    { action: 'cost_add', proposal_id: 'x' }, { action: 'cost_delete', id: 'x' }, { action: 'bogus' },
  ]) {
    const res = mockRes();
    await handler(req('POST', {}, body), res);
    assert.equal(res.code, 401);
    assert.equal(typeof res.body.ok, 'boolean');
  }
});

test('tasks rejects unknown methods with 405/401', async () => {
  const res = mockRes();
  await handler(req('PUT', {}, {}, { 'x-admin-token': 'anything' }), res);
  assert.ok([405, 401].includes(res.code));
});
