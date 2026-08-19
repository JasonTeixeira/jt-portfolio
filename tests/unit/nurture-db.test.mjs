import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, recordSend, setSuppressed, leadCandidates } from '../../lib/nurture-db.mjs';
test('disabled without env — never throws, reports skipped', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await recordSend({ prospect_id: 'p', step: 'x' }), { ok: false, skipped: true });
  assert.deepEqual(await setSuppressed('p'), { ok: false, skipped: true });
  assert.deepEqual(await leadCandidates('2026-01-01T00:00:00Z'), { ok: false, skipped: true });
});
