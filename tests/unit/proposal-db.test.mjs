import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, createProposal, markPaidIfUnpaid, createProjectOnce } from '../../lib/proposal-db.mjs';

test('disabled without env — never throws, reports skipped', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await createProposal({ public_id: 'x' }), { ok: false, skipped: true });
  assert.deepEqual(await markPaidIfUnpaid('id', {}), { ok: false, skipped: true });
  assert.deepEqual(await createProjectOnce('pid', null), { ok: false, skipped: true });
});
