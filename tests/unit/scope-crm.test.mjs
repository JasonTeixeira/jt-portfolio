import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidStage, isEnabled, listProspects, getProspect,
  listProspectEvents, setProspectStage, prospectStageCounts,
} from '../../lib/scope-db.mjs';

test('isValidStage accepts the 5 pipeline stages and rejects others', () => {
  for (const s of ['new', 'scoped', 'engaged', 'won', 'lost']) assert.equal(isValidStage(s), true);
  for (const s of ['', 'closed', 'WON', 'delivered', undefined, null]) assert.equal(isValidStage(s), false);
});

test('CRM reads are degrade-safe when Supabase is not configured (no throw)', async () => {
  // In the unit env SUPABASE_URL/KEY are unset -> everything returns {skipped:true}, never throws.
  assert.equal(isEnabled(), false);
  assert.deepEqual(await listProspects(), { ok: false, skipped: true });
  assert.deepEqual(await getProspect('x'), { ok: false, skipped: true });
  assert.deepEqual(await listProspectEvents('x'), { ok: false, skipped: true });
  assert.deepEqual(await prospectStageCounts(), { ok: false, skipped: true });
  assert.deepEqual(await setProspectStage('x', 'won'), { ok: false, skipped: true });
});
