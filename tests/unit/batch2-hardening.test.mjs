import { test } from 'node:test';
import assert from 'node:assert/strict';
import { funnelSummary } from '../../lib/scope-db.mjs';
import { findRecentDraftPublicId } from '../../lib/proposal-db.mjs';

// These DB helpers must be inert (never throw, report skipped) without Supabase env,
// exactly like the rest of scope-db/proposal-db, so a missing-config deploy degrades
// cleanly instead of 500-ing the admin cockpit or the proposal endpoint.

test('funnelSummary is inert without Supabase env', async () => {
  const r = await funnelSummary();
  assert.deepEqual(r, { ok: false, skipped: true });
});

test('funnelSummary accepts a custom window without throwing', async () => {
  const r = await funnelSummary({ days: 7 });
  assert.equal(r.ok, false);
  assert.equal(r.skipped, true);
});

test('findRecentDraftPublicId is inert without Supabase env', async () => {
  const r = await findRecentDraftPublicId('prospect-1', ['rag'], 'ai-product');
  assert.deepEqual(r, { ok: false, skipped: true });
});
