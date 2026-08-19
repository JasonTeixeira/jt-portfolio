import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, appendEvent } from '../../lib/scope-db.mjs';

test('disabled without env — never throws, reports skipped', async () => {
  // In CI there is no SUPABASE_URL/KEY, so the module must be inert.
  assert.equal(isEnabled(), false);
  const r = await appendEvent({ prospect_id: 'x', type: 'started' });
  assert.deepEqual(r, { ok: false, skipped: true });
});
