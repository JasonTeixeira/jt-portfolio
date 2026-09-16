import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWeek } from '../../lib/gtm-db.mjs';

test('normalizeWeek accepts a clean YYYY-MM-DD key', () => {
  assert.equal(normalizeWeek('2026-09-14'), '2026-09-14');
  assert.equal(normalizeWeek('  2026-09-14  '), '2026-09-14');
});

test('normalizeWeek rejects anything that is not a bare date', () => {
  for (const bad of ['', 'this week', '2026/09/14', '2026-9-14', '2026-09-14T00:00:00Z', null, undefined, 42, '9999-99-99garbage']) {
    assert.equal(normalizeWeek(bad), null, `rejected: ${String(bad)}`);
  }
  // a syntactically valid but nonsense date still passes the shape gate (DB stores it as-is);
  // the point of the guard is to block injection/junk, not to validate calendar correctness.
  assert.equal(normalizeWeek('2026-13-40'), '2026-13-40');
});
