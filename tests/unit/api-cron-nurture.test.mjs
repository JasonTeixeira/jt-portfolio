import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { authorized } from '../../api/cron/nurture.js';
function mockRes() { return { code: 0, body: null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;}, setHeader(){} }; }
test('authorized: fail-closed without CRON_SECRET env', () => {
  assert.equal(authorized({ headers: { authorization: 'Bearer anything' } }), false);
});
test('handler 401 without valid cron auth', async () => {
  const res = mockRes();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.code, 401);
});
