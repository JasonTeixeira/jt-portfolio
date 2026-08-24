import { test } from 'node:test';
import assert from 'node:assert/strict';
import health from '../../api/health.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

test('health responds 200 with an object of booleans, no env set', async () => {
  const res = mockRes();
  await health({ method: 'GET' }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.ts, 'string');
  assert.ok(res.body.subsystems && typeof res.body.subsystems === 'object' && !Array.isArray(res.body.subsystems));

  const keys = Object.keys(res.body.subsystems);
  assert.ok(keys.length > 0);
  for (const k of keys) {
    // Every subsystem value must be a boolean — never a secret value, key
    // prefix, or anything string-shaped that could leak configuration.
    assert.equal(typeof res.body.subsystems[k], 'boolean', `subsystems.${k} should be boolean`);
    // With no env set, every subsystem should read as unconfigured.
    assert.equal(res.body.subsystems[k], false, `subsystems.${k} should be false with no env set`);
  }
});

test('health rejects non-GET with 405', async () => {
  const res = mockRes();
  await health({ method: 'POST' }, res);
  assert.equal(res.code, 405);
  assert.equal(res.body.ok, false);
});
