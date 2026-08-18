import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePlan } from '../../assets/scope-core.mjs';

test('sums bands and counts items', () => {
  const p = computePlan(['llm-eval', 'ci-gate']);
  assert.equal(p.count, 2);
  assert.deepEqual(p.totalBand, [3500 + 2500, 9000 + 6000]); // [6000, 15000]
});

test('drops unknown keys (anti-hallucination gate)', () => {
  const p = computePlan(['llm-eval', 'not-a-real-key', '']);
  assert.equal(p.count, 1);
  assert.equal(p.items[0].key, 'llm-eval');
});

test('dedupes repeated keys', () => {
  const p = computePlan(['e2e', 'e2e']);
  assert.equal(p.count, 1);
});

test('groups items by phase in canonical order', () => {
  const p = computePlan(['web-app', 'llm-eval']); // build + gate
  assert.deepEqual(p.phases.map(x => x.phase), ['build', 'gate']);
  assert.equal(p.phases[0].items[0].key, 'web-app');
});

test('empty selection yields a zero plan, not a crash', () => {
  const p = computePlan([]);
  assert.equal(p.count, 0);
  assert.deepEqual(p.totalBand, [0, 0]);
  assert.deepEqual(p.phases, []);
});

test('carries segment through', () => {
  assert.equal(computePlan(['rag'], 'ai-product').segment, 'ai-product');
  assert.equal(computePlan(['rag']).segment, null);
});
