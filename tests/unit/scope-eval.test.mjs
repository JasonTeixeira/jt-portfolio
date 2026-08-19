import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RATE_CARD } from '../../assets/scope-core.mjs';
import { precisionRecallF1 } from '../../scripts/eval-scope.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(__dirname, '../../evals/scope-golden.json');
const VALID_KEYS = new Set(RATE_CARD.map((c) => c.key));
const VALID_FITS = new Set(['strong', 'maybe', 'poor']);

function loadGolden() {
  return JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
}

test('golden file loads and has a cases array', () => {
  const golden = loadGolden();
  assert.ok(Array.isArray(golden.cases), 'golden.cases must be an array');
  assert.ok(golden.cases.length >= 10, 'expected at least 10 golden cases');
  assert.ok(golden.cases.length <= 15, 'expected at most 15 golden cases');
});

test('every golden case is well-formed', () => {
  const golden = loadGolden();
  const ids = new Set();
  for (const c of golden.cases) {
    assert.ok(c && typeof c === 'object', 'case must be an object');
    assert.ok(typeof c.id === 'string' && c.id.length > 0, 'case has a non-empty string id');
    assert.ok(!ids.has(c.id), `case id "${c.id}" must be unique`);
    ids.add(c.id);

    assert.ok(Array.isArray(c.messages) && c.messages.length > 0, `${c.id}: messages must be a non-empty array`);
    for (const m of c.messages) {
      assert.ok(m && typeof m === 'object', `${c.id}: each message must be an object`);
      assert.ok(m.role === 'user' || m.role === 'assistant', `${c.id}: message role must be user/assistant`);
      assert.ok(typeof m.content === 'string' && m.content.trim().length > 0, `${c.id}: message content must be non-empty string`);
    }
    assert.equal(c.messages[c.messages.length - 1].role, 'user', `${c.id}: last message must be from the user`);

    assert.ok(Array.isArray(c.expectKeys), `${c.id}: expectKeys must be an array`);
    assert.ok(VALID_FITS.has(c.expectFit), `${c.id}: expectFit must be strong/maybe/poor`);
  }
});

test('every expectKeys entry is a real RATE_CARD key', () => {
  const golden = loadGolden();
  for (const c of golden.cases) {
    for (const key of c.expectKeys) {
      assert.ok(VALID_KEYS.has(key), `${c.id}: expectKeys contains "${key}" which is not a real rate-card key`);
    }
  }
});

test('golden set covers at least one poor-fit case', () => {
  const golden = loadGolden();
  assert.ok(golden.cases.some((c) => c.expectFit === 'poor'), 'expected at least one expectFit:"poor" case');
});

test('precisionRecallF1: perfect match scores 1/1/1', () => {
  const r = precisionRecallF1(['llm-eval', 'ci-gate'], ['llm-eval', 'ci-gate']);
  assert.equal(r.precision, 1);
  assert.equal(r.recall, 1);
  assert.equal(r.f1, 1);
});

test('precisionRecallF1: hand-computed partial overlap', () => {
  // expected {a,b,c}, got {a,b,d} -> tp=2, precision=2/3, recall=2/3, f1=2/3
  const r = precisionRecallF1(['a', 'b', 'c'], ['a', 'b', 'd']);
  assert.equal(r.tp, 2);
  assert.equal(r.fp, 1);
  assert.equal(r.fn, 1);
  assert.ok(Math.abs(r.precision - 2 / 3) < 1e-9);
  assert.ok(Math.abs(r.recall - 2 / 3) < 1e-9);
  assert.ok(Math.abs(r.f1 - 2 / 3) < 1e-9);
});

test('precisionRecallF1: no overlap scores 0/0/0', () => {
  const r = precisionRecallF1(['a', 'b'], ['c', 'd']);
  assert.equal(r.precision, 0);
  assert.equal(r.recall, 0);
  assert.equal(r.f1, 0);
});

test('precisionRecallF1: nothing expected, nothing returned is a perfect match', () => {
  const r = precisionRecallF1([], []);
  assert.equal(r.precision, 1);
  assert.equal(r.recall, 1);
  assert.equal(r.f1, 1);
});

test('precisionRecallF1: nothing expected but something returned is all false positives', () => {
  const r = precisionRecallF1([], ['a']);
  assert.equal(r.precision, 0);
  assert.equal(r.recall, 1);
  assert.equal(r.f1, 0);
});

test('precisionRecallF1: something expected but nothing returned is all false negatives', () => {
  const r = precisionRecallF1(['a', 'b'], []);
  assert.equal(r.precision, 1);
  assert.equal(r.recall, 0);
  assert.equal(r.f1, 0);
});

test('precisionRecallF1: duplicate keys in input do not distort the score', () => {
  const r = precisionRecallF1(['a', 'a', 'b'], ['a', 'b', 'b']);
  assert.equal(r.precision, 1);
  assert.equal(r.recall, 1);
  assert.equal(r.f1, 1);
});
