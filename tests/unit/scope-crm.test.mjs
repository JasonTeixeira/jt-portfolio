import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidStage, isValidTouch, isEnabled, listProspects, getProspect,
  listProspectEvents, setProspectStage, prospectStageCounts,
  createProspect, logTouch, captureInboundLead, marketingSummary,
  clientList, clientDetail, updateClientMeta,
} from '../../lib/scope-db.mjs';

test('isValidStage accepts the 5 pipeline stages and rejects others', () => {
  for (const s of ['new', 'scoped', 'engaged', 'won', 'lost']) assert.equal(isValidStage(s), true);
  for (const s of ['', 'closed', 'WON', 'delivered', undefined, null]) assert.equal(isValidStage(s), false);
});

test('isValidTouch accepts the 6 outreach kinds and rejects others', () => {
  for (const k of ['email', 'dm', 'call', 'meeting', 'note', 'follow_up']) assert.equal(isValidTouch(k), true);
  for (const k of ['', 'text', 'EMAIL', 'touch_email', undefined, null]) assert.equal(isValidTouch(k), false);
});

test('CRM reads are degrade-safe when Supabase is not configured (no throw)', async () => {
  // In the unit env SUPABASE_URL/KEY are unset -> everything returns {skipped:true}, never throws.
  assert.equal(isEnabled(), false);
  assert.deepEqual(await listProspects(), { ok: false, skipped: true });
  assert.deepEqual(await getProspect('x'), { ok: false, skipped: true });
  assert.deepEqual(await listProspectEvents('x'), { ok: false, skipped: true });
  assert.deepEqual(await prospectStageCounts(), { ok: false, skipped: true });
  assert.deepEqual(await setProspectStage('x', 'won'), { ok: false, skipped: true });
  assert.deepEqual(await createProspect({ email: 'a@b.co' }), { ok: false, skipped: true });
  assert.deepEqual(await logTouch('x', 'email', 'hi'), { ok: false, skipped: true });
  assert.deepEqual(await captureInboundLead({ email: 'a@b.co', source: 'contact_form' }), { ok: false, skipped: true });
  assert.deepEqual(await marketingSummary(), { ok: false, skipped: true });
  assert.deepEqual(await clientList(), { ok: false, skipped: true });
  assert.deepEqual(await clientDetail('id'), { ok: false, skipped: true });
  assert.deepEqual(await updateClientMeta('id', { notes: 'x' }), { ok: false, skipped: true });
});
