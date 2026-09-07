import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidKind, isValidStatus, normalizeEvent, isEnabled,
  listEvents, upcomingEvents, createEvent, updateEvent, deleteEvent,
} from '../../lib/calendar-db.mjs';

test('isValidKind accepts the 5 event kinds and rejects others', () => {
  for (const k of ['meeting', 'call', 'deadline', 'task', 'reminder']) assert.equal(isValidKind(k), true);
  for (const k of ['', 'event', 'MEETING', 'appt', undefined, null]) assert.equal(isValidKind(k), false);
});

test('isValidStatus accepts scheduled/done/canceled only', () => {
  for (const s of ['scheduled', 'done', 'canceled']) assert.equal(isValidStatus(s), true);
  for (const s of ['', 'cancelled', 'open', undefined, null]) assert.equal(isValidStatus(s), false);
});

test('normalizeEvent requires a non-empty title on create', () => {
  assert.equal(normalizeEvent({ starts_at: '2026-09-10T09:00:00Z' }).ok, false);
  assert.equal(normalizeEvent({ title: '   ', starts_at: '2026-09-10T09:00:00Z' }).ok, false);
});

test('normalizeEvent requires a valid start on create and validates its format', () => {
  assert.equal(normalizeEvent({ title: 'X' }).ok, false);
  assert.equal(normalizeEvent({ title: 'X', starts_at: 'not-a-date' }).ok, false);
  const good = normalizeEvent({ title: 'X', starts_at: '2026-09-10T09:00:00Z' });
  assert.equal(good.ok, true);
  assert.equal(good.value.starts_at, new Date('2026-09-10T09:00:00Z').toISOString());
});

test('normalizeEvent rejects an invalid kind/status but accepts valid ones', () => {
  assert.equal(normalizeEvent({ title: 'X', starts_at: '2026-09-10T09:00:00Z', kind: 'party' }).ok, false);
  assert.equal(normalizeEvent({ title: 'X', starts_at: '2026-09-10T09:00:00Z', status: 'nope' }).ok, false);
  assert.equal(normalizeEvent({ title: 'X', starts_at: '2026-09-10T09:00:00Z', kind: 'deadline', status: 'done' }).ok, true);
});

test('normalizeEvent rejects ends_at before starts_at', () => {
  const r = normalizeEvent({ title: 'X', starts_at: '2026-09-10T10:00:00Z', ends_at: '2026-09-10T09:00:00Z' });
  assert.equal(r.ok, false);
  assert.match(r.error, /ends_at before/);
});

test('normalizeEvent clamps long strings and coerces all_day to boolean', () => {
  const r = normalizeEvent({ title: 'T'.repeat(500), starts_at: '2026-09-10T09:00:00Z', all_day: true, notes: 'N'.repeat(9000) });
  assert.equal(r.ok, true);
  assert.equal(r.value.title.length, 200);
  assert.equal(r.value.all_day, true);
  assert.equal(r.value.notes.length, 4000);
});

test('normalizeEvent partial mode allows patching a single field without title/start', () => {
  const r = normalizeEvent({ status: 'canceled' }, { partial: true });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { status: 'canceled' });
});

test('normalizeEvent rejects a non-http(s) url (javascript: scheme) but accepts https', () => {
  const base = { title: 'X', starts_at: '2026-09-10T09:00:00Z' };
  assert.equal(normalizeEvent({ ...base, url: 'javascript:alert(1)' }).ok, false);
  assert.equal(normalizeEvent({ ...base, url: 'ftp://x' }).ok, false);
  const good = normalizeEvent({ ...base, url: 'https://cal.com/jason' });
  assert.equal(good.ok, true);
  assert.equal(good.value.url, 'https://cal.com/jason');
});

test('normalizeEvent rejects a malformed FK id but accepts a valid uuid / empty', () => {
  const base = { title: 'X', starts_at: '2026-09-10T09:00:00Z' };
  assert.equal(normalizeEvent({ ...base, prospect_id: 'not-a-uuid' }).ok, false);
  assert.equal(normalizeEvent({ ...base, project_id: '123' }).ok, false);
  const ok = normalizeEvent({ ...base, prospect_id: '565a8367-4e3d-4d8c-b4f6-8b88401e6e7e', project_id: '' });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.prospect_id, '565a8367-4e3d-4d8c-b4f6-8b88401e6e7e');
  assert.equal(ok.value.project_id, null);
});

test('normalizeEvent all_day is strict: only boolean true counts', () => {
  const base = { title: 'X', starts_at: '2026-09-10T09:00:00Z' };
  assert.equal(normalizeEvent({ ...base, all_day: 'false' }).value.all_day, false);
  assert.equal(normalizeEvent({ ...base, all_day: true }).value.all_day, true);
});

test('normalizeEvent clears FK links and ends_at with empty values', () => {
  const r = normalizeEvent({ prospect_id: '', project_id: '', ends_at: '' }, { partial: true });
  assert.equal(r.ok, true);
  assert.equal(r.value.prospect_id, null);
  assert.equal(r.value.project_id, null);
  assert.equal(r.value.ends_at, null);
});

test('calendar reads/writes are degrade-safe when Supabase is unconfigured (no throw)', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await listEvents(), { ok: false, skipped: true });
  assert.deepEqual(await upcomingEvents(), { ok: false, skipped: true });
  assert.deepEqual(await createEvent({ title: 'X', starts_at: '2026-09-10T09:00:00Z' }), { ok: false, skipped: true });
  assert.deepEqual(await updateEvent('id', { status: 'done' }), { ok: false, skipped: true });
  assert.deepEqual(await deleteEvent('id'), { ok: false, skipped: true });
});
