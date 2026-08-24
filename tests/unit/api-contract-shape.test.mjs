import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../api/contract.js';
import contractGenerate from '../../api/contract-generate.js';
import contractSend from '../../api/contract-send.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

test('contract accept validate requires publicId, agreed true, a real name', () => {
  assert.equal(validate({ publicId: 'a', agreed: true, name: 'Dana Lee' }).ok, true);
  assert.equal(validate({ publicId: 'a', agreed: false, name: 'Dana Lee' }).ok, false);
  assert.equal(validate({ publicId: 'a', agreed: true, name: 'D' }).ok, false);
  assert.equal(validate({ agreed: true, name: 'Dana Lee' }).ok, false);
  assert.equal(validate({ publicId: 'a', agreed: true, name: 'x'.repeat(121) }).ok, false);
  assert.equal(validate(null).ok, false);
});

test('contract-generate fails closed without admin token (no DB work happens)', async () => {
  const res = mockRes();
  await contractGenerate({ method: 'POST', headers: {}, body: { proposalId: 'p1', kind: 'sow' } }, res);
  assert.equal(res.code, 401);
});

test('contract-send fails closed without admin token (no DB work happens)', async () => {
  const res = mockRes();
  await contractSend({ method: 'POST', headers: {}, body: { id: 'c1' } }, res);
  assert.equal(res.code, 401);
});

test('contract-generate/send reject non-POST', async () => {
  const res1 = mockRes();
  await contractGenerate({ method: 'GET', headers: {}, query: {} }, res1);
  assert.equal(res1.code, 405);
  const res2 = mockRes();
  await contractSend({ method: 'GET', headers: {}, query: {} }, res2);
  assert.equal(res2.code, 405);
});
