import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendClient, sendOperator, isEnabled } from '../../lib/notify.mjs';
test('still degrade-safe with headers arg', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await sendClient({ to: 'a@b.co', subject: 's', text: 't', headers: { 'List-Unsubscribe': '<u>' } }), { ok: false, skipped: true });
  assert.deepEqual(await sendOperator({ subject: 's', text: 't' }), { ok: false, skipped: true });
});
