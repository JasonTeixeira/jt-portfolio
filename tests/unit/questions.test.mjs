import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, keysFromAnswers, CARD_BY_KEY } from '../../assets/scope-core.mjs';

test('questions are well-formed and every option maps to real keys', () => {
  assert.ok(QUESTIONS.length >= 3);
  for (const q of QUESTIONS) {
    assert.ok(q.id && q.prompt && Array.isArray(q.options) && q.options.length >= 2);
    for (const o of q.options) {
      assert.ok(o.label, `option has a label in ${q.id}`);
      for (const k of o.keys) assert.ok(CARD_BY_KEY.has(k), `key ${k} exists (q ${q.id})`);
    }
  }
});

test('keysFromAnswers flattens + dedupes selected options', () => {
  const answers = { needs: ['opt-eval', 'opt-e2e'] };
  // build the expected from the actual question definition to stay in sync
  const q = QUESTIONS.find(x => x.id === 'needs');
  const expected = new Set(q.options.filter(o => answers.needs.includes(o.id)).flatMap(o => o.keys));
  const got = new Set(keysFromAnswers(answers));
  assert.deepEqual(got, expected);
});

test('unknown answer ids are ignored', () => {
  assert.deepEqual(keysFromAnswers({ needs: ['nope'] }), []);
});
