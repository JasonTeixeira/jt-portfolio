import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, createCampaign, addLead } from '../../lib/instantly.mjs';

test('instantly adapter is inert without INSTANTLY_API_KEY', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await createCampaign('x', [{ subject: 's', body: 'b', delay: 0 }]), { ok: false, skipped: true });
  assert.deepEqual(await addLead('c', { email: 'a@b.co' }), { ok: false, skipped: true });
});
