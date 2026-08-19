import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkToken } from '../../lib/admin-auth.mjs';
test('no SCOPE_ADMIN_TOKEN env => fail closed', () => {
  assert.equal(checkToken({ headers: {}, query: {} }), false);
  assert.equal(checkToken({ headers: { 'x-admin-token': 'anything' }, query: {} }), false);
});
