import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../api/proposal-checkout.js';
test('checkout requires publicId, agreed true, a real name', () => {
  assert.equal(validate({ publicId: 'a', agreed: true, acceptName: 'Dana Lee' }).ok, true);
  assert.equal(validate({ publicId: 'a', agreed: false, acceptName: 'Dana Lee' }).ok, false);
  assert.equal(validate({ publicId: 'a', agreed: true, acceptName: 'D' }).ok, false);
  assert.equal(validate({ agreed: true, acceptName: 'Dana Lee' }).ok, false);
});
