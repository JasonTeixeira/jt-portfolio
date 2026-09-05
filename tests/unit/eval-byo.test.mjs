import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BYO_RUBRIC, BYO_LIMITS, clampByo, byoInputError, buildByoJudgeUser,
  parseByoRaw, mapByoResults, scoreByo,
} from '../../lib/eval-byo.mjs';

test('clampByo trims and caps each field to its limit', () => {
  const c = clampByo({ question: '  hi  ', answer: 'x'.repeat(BYO_LIMITS.answer + 500), source: '  s  ' });
  assert.equal(c.question, 'hi');
  assert.equal(c.source, 's');
  assert.equal(c.answer.length, BYO_LIMITS.answer);
});

test('clampByo coerces missing/undefined fields to empty strings', () => {
  const c = clampByo({});
  assert.deepEqual(c, { question: '', answer: '', source: '' });
});

test('byoInputError flags missing question then missing answer, null when usable', () => {
  assert.match(byoInputError(clampByo({ answer: 'a' })), /question/i);
  assert.match(byoInputError(clampByo({ question: 'q' })), /answer/i);
  assert.equal(byoInputError(clampByo({ question: 'q', answer: 'a' })), null);
});

test('buildByoJudgeUser fences user content and lists every rubric criterion', () => {
  const u = buildByoJudgeUser({ question: 'Q?', answer: 'A.', source: '' });
  assert.match(u, /<<<QUESTION\nQ\?\nQUESTION/);
  assert.match(u, /<<<ANSWER\nA\.\nANSWER/);
  assert.match(u, /none provided/); // no source path
  for (const r of BYO_RUBRIC) assert.ok(u.includes(r.dimension), `mentions ${r.dimension}`);
});

test('buildByoJudgeUser includes the source block when a source is given', () => {
  const u = buildByoJudgeUser({ question: 'Q', answer: 'A', source: 'DOCS' });
  assert.match(u, /<<<SOURCE\nDOCS\nSOURCE/);
});

test('parseByoRaw returns the array on valid JSON and null otherwise', () => {
  assert.deepEqual(parseByoRaw('{"results":[{"n":1,"verdict":"PASS"}]}'), [{ n: 1, verdict: 'PASS' }]);
  assert.equal(parseByoRaw('not json'), null);
  assert.equal(parseByoRaw('{"nope":1}'), null);
});

test('mapByoResults aligns by n and defaults missing entries to FAIL', () => {
  const arr = [{ n: 1, verdict: 'PASS', reason: 'grounded' }, { n: 3, verdict: 'PASS', reason: 'safe' }];
  const mapped = mapByoResults(arr);
  assert.equal(mapped.length, BYO_RUBRIC.length);
  assert.equal(mapped[0].verdict, 'PASS');
  assert.equal(mapped[0].reason, 'grounded');
  assert.equal(mapped[1].verdict, 'FAIL'); // n=2 missing
  assert.equal(mapped[2].verdict, 'PASS');
});

test('scoreByo returns PASS all-pass, FAIL all-fail, PARTIAL mixed', () => {
  const pass = BYO_RUBRIC.map((r) => ({ dimension: r.dimension, verdict: 'PASS' }));
  const fail = BYO_RUBRIC.map((r) => ({ dimension: r.dimension, verdict: 'FAIL' }));
  assert.equal(scoreByo(pass).verdict, 'PASS');
  assert.equal(scoreByo(fail).verdict, 'FAIL');
  const mixed = pass.slice(0, 2).concat(fail.slice(0, 2));
  assert.equal(scoreByo(mixed).verdict, 'PARTIAL');
  assert.equal(scoreByo(mixed).pass, 2);
});
