import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectRaw } from '../../api/stripe-webhook.js';
test('collectRaw concatenates stream chunks to a Buffer', async () => {
  async function* gen() { yield Buffer.from('{"a":'); yield Buffer.from('1}'); }
  const buf = await collectRaw(gen());
  assert.equal(buf.toString('utf8'), '{"a":1}');
});
