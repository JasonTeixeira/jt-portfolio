import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RATE_CARD, CARD_BY_KEY, DISCLAIMER, SEGMENTS } from '../../assets/scope-core.mjs';

test('rate card has cards and every key is unique', () => {
  assert.ok(RATE_CARD.length >= 30, 'expected the full capability catalog');
  const keys = RATE_CARD.map(c => c.key);
  assert.equal(new Set(keys).size, keys.length, 'keys must be unique');
});

test('every card is well-formed', () => {
  const phases = new Set(['audit', 'build', 'gate', 'operate']);
  for (const c of RATE_CARD) {
    assert.match(c.key, /^[a-z0-9-]+$/, `key ${c.key} is kebab-case`);
    assert.ok(c.name && c.track && c.why, `${c.key} has name/track/why`);
    assert.ok(Array.isArray(c.band) && c.band.length === 2, `${c.key} band is a pair`);
    assert.ok(c.band[0] <= c.band[1], `${c.key} band min <= max`);
    assert.ok(c.band[0] > 0, `${c.key} band positive`);
    assert.ok(phases.has(c.phase), `${c.key} phase valid`);
  }
});

test('CARD_BY_KEY resolves every key', () => {
  for (const c of RATE_CARD) assert.equal(CARD_BY_KEY.get(c.key), c);
});

test('disclaimer + segments present', () => {
  assert.match(DISCLAIMER, /indicative/i);
  assert.ok(Object.keys(SEGMENTS).length >= 3);
});
