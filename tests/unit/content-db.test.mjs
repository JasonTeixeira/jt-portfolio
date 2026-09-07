import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidChannel, isValidStatus, normalizeContent, isEnabled,
  listContent, upcomingContent, createContent, updateContent, deleteContent,
} from '../../lib/content-db.mjs';

test('channel/status validators accept valid, reject invalid', () => {
  for (const c of ['blog', 'linkedin', 'x', 'instagram', 'youtube', 'newsletter', 'other']) assert.equal(isValidChannel(c), true);
  for (const c of ['', 'tiktok', 'BLOG', null]) assert.equal(isValidChannel(c), false);
  for (const s of ['idea', 'draft', 'scheduled', 'published']) assert.equal(isValidStatus(s), true);
  for (const s of ['', 'done', 'live', null]) assert.equal(isValidStatus(s), false);
});

test('normalizeContent requires a title on create; stamps published_at on publish', () => {
  assert.equal(normalizeContent({}).ok, false);
  assert.equal(normalizeContent({ title: '  ' }).ok, false);
  const pub = normalizeContent({ title: 'Post', status: 'published' });
  assert.equal(pub.ok, true);
  assert.ok(pub.value.published_at, 'published_at set when published');
  assert.equal(normalizeContent({ title: 'x', status: 'draft' }).value.published_at, null);
});

test('normalizeContent validates channel, status, scheduled_for, and url scheme', () => {
  const base = { title: 'x' };
  assert.equal(normalizeContent({ ...base, channel: 'tiktok' }).ok, false);
  assert.equal(normalizeContent({ ...base, status: 'live' }).ok, false);
  assert.equal(normalizeContent({ ...base, scheduled_for: 'not-a-date' }).ok, false);
  assert.equal(normalizeContent({ ...base, url: 'javascript:alert(1)' }).ok, false);
  const ok = normalizeContent({ ...base, channel: 'linkedin', scheduled_for: '2026-09-20T09:00:00Z', url: 'https://x.co/p' });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.channel, 'linkedin');
  assert.equal(ok.value.url, 'https://x.co/p');
});

test('normalizeContent partial mode patches a single field', () => {
  const r = normalizeContent({ status: 'scheduled' }, { partial: true });
  assert.equal(r.ok, true);
  assert.equal(r.value.status, 'scheduled');
});

test('content reads/writes are degrade-safe when Supabase unconfigured (no throw)', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await listContent(), { ok: false, skipped: true });
  assert.deepEqual(await upcomingContent(), { ok: false, skipped: true });
  assert.deepEqual(await createContent({ title: 'x' }), { ok: false, skipped: true });
  assert.deepEqual(await updateContent('id', { status: 'draft' }), { ok: false, skipped: true });
  assert.deepEqual(await deleteContent('id'), { ok: false, skipped: true });
});
