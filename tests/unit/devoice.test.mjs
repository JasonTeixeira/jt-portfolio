import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deVoiceTic } from '../../api/chat.js';
test('em-dash clause-joiner -> comma', () => {
  assert.equal(deVoiceTic('I can do this — here is how.'), 'I can do this, here is how.');
  assert.equal(deVoiceTic('a – b'), 'a, b');
});
test('leaves hyphens, ranges, numbers alone', () => {
  assert.equal(deVoiceTic('front-desk AI'), 'front-desk AI');
  assert.equal(deVoiceTic('range 4k–9k'), 'range 4k–9k'); // no spaces around dash
});
test('collapses exclamation runs', () => { assert.equal(deVoiceTic('wow!!!'), 'wow!'); });
test('idempotent + non-string safe', () => {
  const once = deVoiceTic('a — b — c'); assert.equal(deVoiceTic(once), once);
  assert.equal(deVoiceTic(null), null);
});
