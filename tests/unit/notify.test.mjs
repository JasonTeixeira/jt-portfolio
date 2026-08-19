import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, sendOperator, sendClient } from '../../lib/notify.mjs';
test('disabled without RESEND_API_KEY', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await sendOperator({ subject: 's', text: 't' }), { ok: false, skipped: true });
  assert.deepEqual(await sendClient({ to: 'a@b.co', subject: 's', text: 't' }), { ok: false, skipped: true });
});
