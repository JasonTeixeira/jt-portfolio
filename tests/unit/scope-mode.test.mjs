import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeScopeReply, filterSelection } from '../../api/chat.js';
import { RATE_CARD } from '../../assets/scope-core.mjs';

test('sanitizeScopeReply strips dollar amounts (LLM must never price)', () => {
  const out = sanitizeScopeReply('Roughly $4,000–$9k for that.');
  assert.ok(!/\$\s?\d/.test(out), 'no $-amount remains: ' + out);
});

test('sanitizeScopeReply strips a worded range too', () => {
  const out = sanitizeScopeReply('That runs about $4,000 to $9k.');
  assert.ok(!/\$\s?\d/.test(out), 'no $-amount remains: ' + out);
});

test('sanitizeScopeReply strips a bare no-comma dollar amount', () => {
  const out = sanitizeScopeReply('Budget is $4000, may not fit.');
  assert.ok(!/\$\s?\d/.test(out), 'no $-amount remains: ' + out);
});

test('sanitizeScopeReply strips a bare k-suffixed dollar amount', () => {
  const out = sanitizeScopeReply('Sounds like a $9k budget.');
  assert.ok(!/\$\s?\d/.test(out), 'no $-amount remains: ' + out);
});

test('sanitizeScopeReply leaves price-free text untouched', () => {
  assert.equal(sanitizeScopeReply('We can scope this on a call.'), 'We can scope this on a call.');
});

test('sanitizeScopeReply strips money-word patterns (grand)', () => {
  const out = sanitizeScopeReply('about 5 grand for that');
  assert.ok(!/5\s+grand/.test(out), 'no "5 grand" remains: ' + out);
  assert.ok(out.includes('(scoped on a call)'), 'replacement placeholder present');
});

test('sanitizeScopeReply strips money-word patterns (dollars)', () => {
  const out = sanitizeScopeReply('roughly 5,000 dollars');
  assert.ok(!/5,000\s+dollars/.test(out), 'no "5,000 dollars" remains: ' + out);
  assert.ok(out.includes('(scoped on a call)'), 'replacement placeholder present');
});

test('sanitizeScopeReply preserves technical suffixes (5k, 10m not stripped)', () => {
  const out = sanitizeScopeReply('handles 5k users and 10m rows');
  assert.ok(/5k/.test(out), '5k is preserved in: ' + out);
  assert.ok(/10m/.test(out), '10m is preserved in: ' + out);
});

test('filterSelection drops keys not in the rate card (anti-hallucination)', () => {
  const valid = new Set(RATE_CARD.map((c) => c.key));
  const sel = filterSelection(
    [
      { key: 'llm-eval', why: 'x', confidence: 0.9 },
      { key: 'not-real', why: 'y', confidence: 0.5 },
    ],
    valid
  );
  assert.deepEqual(sel.map((s) => s.key), ['llm-eval']);
});

test('filterSelection guards non-array input', () => {
  const valid = new Set(RATE_CARD.map((c) => c.key));
  assert.deepEqual(filterSelection(null, valid), []);
  assert.deepEqual(filterSelection('nope', valid), []);
  assert.deepEqual(filterSelection(undefined, valid), []);
});
