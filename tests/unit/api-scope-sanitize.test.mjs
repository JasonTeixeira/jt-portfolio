import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanKeys, cleanSegment, cleanFlags, cleanMeta } from '../../api/scope.js';

// /api/scope is a PUBLIC unauthenticated beacon: prospectId is client-minted and the body
// is untrusted. These sanitizers are the per-row shape guard that keeps a script from
// poisoning the operator pipeline or writing arbitrary blobs into Supabase.

test('cleanKeys keeps only real rate-card keys and drops garbage', () => {
  assert.deepEqual(cleanKeys(['rag', 'not-a-real-key', 'chatbot']), ['rag', 'chatbot']);
  assert.deepEqual(cleanKeys(['definitely-fake', '<script>']), []);
});

test('cleanKeys de-dupes and is not fooled by non-strings', () => {
  assert.deepEqual(cleanKeys(['rag', 'rag', 'chatbot']), ['rag', 'chatbot']);
  assert.deepEqual(cleanKeys(['rag', 42, null, {}, 'chatbot']), ['rag', 'chatbot']);
});

test('cleanKeys caps the array so a flood of keys cannot bloat a row', () => {
  const flood = Array.from({ length: 500 }, () => 'rag'); // all valid, but duplicated
  assert.deepEqual(cleanKeys(flood), ['rag']); // de-dupe collapses it
  assert.deepEqual(cleanKeys('nope'), []);
  assert.deepEqual(cleanKeys(undefined), []);
});

test('cleanSegment allows known enum values only, else null', () => {
  assert.equal(cleanSegment('ai-product'), 'ai-product');
  assert.equal(cleanSegment('service-business'), 'service-business');
  assert.equal(cleanSegment('__proto__'), null); // prototype-key not treated as a segment
  assert.equal(cleanSegment('made-up-segment'), null);
  assert.equal(cleanSegment(123), null);
  assert.equal(cleanSegment(null), null);
});

test('cleanFlags keeps strings, caps count, and clamps length', () => {
  assert.deepEqual(cleanFlags(['a', 'b']), ['a', 'b']);
  assert.deepEqual(cleanFlags(['ok', 5, null, 'fine']), ['ok', 'fine']);
  assert.equal(cleanFlags(Array.from({ length: 100 }, () => 'x')).length, 20);
  assert.equal(cleanFlags(['y'.repeat(500)])[0].length, 120);
  assert.deepEqual(cleanFlags('nope'), []);
});

test('cleanMeta accepts a small object but rejects arrays and oversized blobs', () => {
  assert.deepEqual(cleanMeta({ total: [1, 2] }), { total: [1, 2] });
  assert.deepEqual(cleanMeta(['not', 'an', 'object']), {});
  assert.deepEqual(cleanMeta('string'), {});
  assert.deepEqual(cleanMeta(null), {});
  const huge = { blob: 'z'.repeat(5000) };
  assert.deepEqual(cleanMeta(huge), {}, 'a >2KB meta payload is dropped');
});
