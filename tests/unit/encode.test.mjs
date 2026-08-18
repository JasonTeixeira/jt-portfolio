import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeKeys, decodeKeys } from '../../assets/scope-core.mjs';

test('round-trips keys + segment', () => {
  const enc = encodeKeys(['llm-eval', 'ci-gate'], 'ai-product');
  assert.equal(typeof enc, 'string');
  assert.deepEqual(decodeKeys(enc), { keys: ['llm-eval', 'ci-gate'], segment: 'ai-product' });
});

test('round-trips with no segment', () => {
  assert.deepEqual(decodeKeys(encodeKeys(['rag'])), { keys: ['rag'], segment: null });
});

test('decode is defensive on garbage', () => {
  assert.deepEqual(decodeKeys('%%%not-base64%%%'), { keys: [], segment: null });
  assert.deepEqual(decodeKeys(''), { keys: [], segment: null });
});
