import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/proposal-checkout.js';

/**
 * The existing checkout test only called the pure validate() export — the actual
 * request handler was never invoked. These drive the real default handler through
 * its guard branches with a mock req/res, and confirm it degrades safely (returns
 * a clean 200-with-reason when the backend is unconfigured, never a 500). (Audit
 * critical: checkout handler had no handler-level coverage.)
 */

function mockRes() {
  const res = { _status: 0, _json: null, _headers: {} };
  res.status = (c) => { res._status = c; return res; };
  res.json = (o) => { res._json = o; return res; };
  res.setHeader = (k, v) => { res._headers[k] = v; };
  return res;
}
const mockReq = (over) => ({ method: 'POST', body: {}, url: '/api/proposal-checkout', headers: {}, ...over });

test('checkout handler: non-POST is rejected 405 with Allow header', async () => {
  const res = mockRes();
  await handler(mockReq({ method: 'GET' }), res);
  assert.equal(res._status, 405);
  assert.equal(res._headers.Allow, 'POST');
});

test('checkout handler: invalid body is rejected 400', async () => {
  const res = mockRes();
  await handler(mockReq({ body: { publicId: '', agreed: false } }), res);
  assert.equal(res._status, 400);
  assert.equal(res._json.ok, false);
});

test('checkout handler: valid body but unconfigured backend degrades to 200-skip (never 500)', async () => {
  const res = mockRes();
  await handler(mockReq({ body: { publicId: 'abc123', agreed: true, acceptName: 'Dana Lee' } }), res);
  assert.equal(res._status, 200, 'must not crash or 500 when payments/db are off');
  assert.equal(res._json.ok, false);
  assert.ok(res._json.skipped === true || typeof res._json.reason === 'string', 'returns a skip/reason, degrade-safe');
});
