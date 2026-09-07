import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidTaskStatus, isValidTaskPriority, isValidCostKind, normalizeTask, normalizeCost,
  isEnabled, listTasks, createTask, updateTask, deleteTask, listCosts, addCost, deleteCost, budgetSummary,
} from '../../lib/tasks-db.mjs';

const UUID = '565a8367-4e3d-4d8c-b4f6-8b88401e6e7e';

test('task status/priority/cost-kind validators accept valid, reject invalid', () => {
  for (const s of ['todo', 'doing', 'done', 'blocked']) assert.equal(isValidTaskStatus(s), true);
  for (const s of ['', 'open', 'DONE', null]) assert.equal(isValidTaskStatus(s), false);
  for (const p of ['low', 'medium', 'high']) assert.equal(isValidTaskPriority(p), true);
  for (const p of ['', 'urgent', null]) assert.equal(isValidTaskPriority(p), false);
  for (const k of ['subcontractor', 'tool', 'ads', 'fees', 'other']) assert.equal(isValidCostKind(k), true);
  for (const k of ['', 'salary', null]) assert.equal(isValidCostKind(k), false);
});

test('normalizeTask requires a title on create and sets done_at when status=done', () => {
  assert.equal(normalizeTask({}).ok, false);
  assert.equal(normalizeTask({ title: '  ' }).ok, false);
  const t = normalizeTask({ title: 'Ship it', status: 'done' });
  assert.equal(t.ok, true);
  assert.ok(t.value.done_at, 'done_at set when done');
  const t2 = normalizeTask({ title: 'x', status: 'doing' });
  assert.equal(t2.value.done_at, null);
});

test('normalizeTask rejects bad status/priority/due and malformed FK', () => {
  assert.equal(normalizeTask({ title: 'x', status: 'nope' }).ok, false);
  assert.equal(normalizeTask({ title: 'x', priority: 'urgent' }).ok, false);
  assert.equal(normalizeTask({ title: 'x', due_at: 'not-a-date' }).ok, false);
  assert.equal(normalizeTask({ title: 'x', proposal_id: 'nope' }).ok, false);
  const ok = normalizeTask({ title: 'x', proposal_id: UUID, due_at: '2026-09-20' });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.proposal_id, UUID);
});

test('normalizeTask partial mode patches a single field', () => {
  const r = normalizeTask({ status: 'blocked' }, { partial: true });
  assert.equal(r.ok, true);
  assert.equal(r.value.status, 'blocked');
});

test('normalizeCost requires a valid proposal_id, label, and non-negative amount', () => {
  assert.equal(normalizeCost({ label: 'x', amount_cents: 100 }).ok, false); // no proposal
  assert.equal(normalizeCost({ proposal_id: 'nope', label: 'x', amount_cents: 100 }).ok, false);
  assert.equal(normalizeCost({ proposal_id: UUID, label: '', amount_cents: 100 }).ok, false);
  assert.equal(normalizeCost({ proposal_id: UUID, label: 'x', amount_cents: -5 }).ok, false);
  const ok = normalizeCost({ proposal_id: UUID, label: 'Contractor', kind: 'subcontractor', amount_cents: 50000 });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.amount_cents, 50000);
  assert.equal(ok.value.kind, 'subcontractor');
});

test('normalizeCost rejects an invalid kind', () => {
  assert.equal(normalizeCost({ proposal_id: UUID, label: 'x', amount_cents: 1, kind: 'salary' }).ok, false);
});

test('normalizeCost bounds the amount and rejects non-numeric types (booleans/arrays)', () => {
  assert.equal(normalizeCost({ proposal_id: UUID, label: 'x', amount_cents: 1e21 }).ok, false); // absurd ceiling
  assert.equal(normalizeCost({ proposal_id: UUID, label: 'x', amount_cents: true }).ok, false);  // boolean
  assert.equal(normalizeCost({ proposal_id: UUID, label: 'x', amount_cents: [100] }).ok, false);  // array
  assert.equal(normalizeCost({ proposal_id: UUID, label: 'x', amount_cents: '25000' }).ok, true); // numeric string ok
});

test('tasks/costs/budget reads+writes are degrade-safe when Supabase unconfigured (no throw)', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await listTasks(), { ok: false, skipped: true });
  assert.deepEqual(await createTask({ title: 'x' }), { ok: false, skipped: true });
  assert.deepEqual(await updateTask('id', { status: 'done' }), { ok: false, skipped: true });
  assert.deepEqual(await deleteTask('id'), { ok: false, skipped: true });
  assert.deepEqual(await listCosts(UUID), { ok: false, skipped: true });
  assert.deepEqual(await addCost({ proposal_id: UUID, label: 'x', amount_cents: 1 }), { ok: false, skipped: true });
  assert.deepEqual(await deleteCost('id'), { ok: false, skipped: true });
  assert.deepEqual(await budgetSummary(), { ok: false, skipped: true });
});
