import { test } from 'node:test';
import assert from 'node:assert/strict';
import unsubscribe from '../../api/unsubscribe.js';
import suppress from '../../api/suppress.js';
function mockRes() { return { code: 0, body: null, headers: {}, status(c){this.code=c;return this;}, json(b){this.body=b;return this;}, setHeader(k,v){this.headers[k]=v;}, redirect(u){this.code=302;this.redirected=u;return this;} }; }
test('suppress fails closed without admin token', async () => {
  const res = mockRes();
  await suppress({ method: 'GET', headers: {}, query: { prospect: 'p' } }, res);
  assert.equal(res.code, 401);
});
test('unsubscribe never errors on unknown token (degrade-safe 200/redirect)', async () => {
  const res = mockRes();
  await unsubscribe({ method: 'POST', headers: {}, query: { token: 'nope' }, body: {} }, res);
  assert.ok(res.code === 200);
});
