import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/deliverables.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const req = (method, query = {}, body = {}, headers = {}) => ({ method, query, body, headers });

test('deliverables endpoint is fail-closed: no admin token -> 401 (GET and POST)', async () => {
  const g = mockRes(); await handler(req('GET', { projectId: 'x' }), g);
  assert.equal(g.code, 401);
  const p = mockRes(); await handler(req('POST', {}, { action: 'signUpload', projectId: 'x', filename: 'a.pdf' }), p);
  assert.equal(p.code, 401);
});

test('deliverables handler never throws on malformed bodies', async () => {
  for (const body of [
    {},
    { action: 'register' },                                   // no projectId
    { action: 'register', projectId: 'p1' },                  // no path
    { action: 'register', projectId: 'p1', storagePath: 'OTHER-PROJECT/x' }, // path not under project
    { action: 'delete', projectId: 'p1' },                    // no id
    { action: 'bogus', projectId: 'p1' },
  ]) {
    const res = mockRes();
    await handler(req('POST', {}, body, { 'x-admin-token': 'anything' }), res);
    assert.ok([400, 401, 200].includes(res.code));
    assert.equal(typeof res.body.ok, 'boolean');
  }
});
