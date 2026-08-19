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

test('sanitizeScopeReply leaves price-free text untouched', () => {
  assert.equal(sanitizeScopeReply('We can scope this on a call.'), 'We can scope this on a call.');
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
