import { test } from 'node:test';
import assert from 'node:assert/strict';
import { first, rows, list } from '../../lib/db-result.mjs';

test('rows returns the data object or null, and does NOT hide it behind an error', () => {
  assert.deepEqual(rows({ data: { id: 1 }, error: null }), { id: 1 });
  assert.equal(rows({ data: null, error: null }), null);
});

test('first returns the first array element or null', () => {
  assert.deepEqual(first({ data: [{ id: 'a' }, { id: 'b' }], error: null }), { id: 'a' });
  assert.equal(first({ data: [], error: null }), null);
  assert.equal(first({ data: null, error: null }), null);
});

test('list always returns an array', () => {
  assert.deepEqual(list({ data: [1, 2], error: null }), [1, 2]);
  assert.deepEqual(list({ data: null, error: null }), []);
});

test('a supabase error THROWS (so guard turns a failed write into ok:false, not a fake success)', () => {
  const err = { message: 'insert or update on table violates foreign key constraint' };
  assert.throws(() => rows({ data: null, error: err }), /foreign key/);
  assert.throws(() => first({ data: null, error: err }), /foreign key/);
  assert.throws(() => list({ data: null, error: err }), /foreign key/);
});

test('error falls back to details then code when message is absent', () => {
  assert.throws(() => rows({ error: { code: 'PGRST205' } }), /PGRST205/);
  assert.throws(() => first({ error: { details: 'schema cache miss' } }), /schema cache miss/);
});
