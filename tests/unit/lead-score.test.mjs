import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead, rankLeads } from '../../assets/lead-score.mjs';

test('scoreLead: engaged + fresh = hot; new + stale = cool', () => {
  assert.equal(scoreLead({ stage: 'engaged', daysSinceActivity: 0 }).tier, 'hot');
  assert.equal(scoreLead({ stage: 'new', daysSinceActivity: 40 }).tier, 'cool');
});

test('scoreLead: engagement outranks a fresh brand-new lead', () => {
  const engaged = scoreLead({ stage: 'engaged', daysSinceActivity: 3 }).score;
  const fresh = scoreLead({ stage: 'new', daysSinceActivity: 0 }).score;
  assert.ok(engaged > fresh);
});

test('scoreLead: recency raises score within the same stage', () => {
  const hot = scoreLead({ stage: 'scoped', daysSinceActivity: 0 }).score;
  const cold = scoreLead({ stage: 'scoped', daysSinceActivity: 20 }).score;
  assert.ok(hot > cold);
});

test('scoreLead: closed deals never rank', () => {
  assert.equal(scoreLead({ stage: 'won', daysSinceActivity: 0 }).score, 0);
  assert.equal(scoreLead({ stage: 'lost', daysSinceActivity: 0 }).score, 0);
});

test('scoreLead: score is bounded 0..100', () => {
  const s = scoreLead({ stage: 'engaged', daysSinceActivity: 0 }).score;
  assert.ok(s >= 0 && s <= 100);
});

test('rankLeads: hottest first, attaches _score, does not mutate input', () => {
  const leads = [
    { email: 'a', stage: 'new', daysSinceActivity: 30 },
    { email: 'b', stage: 'engaged', daysSinceActivity: 0 },
    { email: 'c', stage: 'scoped', daysSinceActivity: 5 },
  ];
  const ranked = rankLeads(leads);
  assert.equal(ranked[0].email, 'b');
  assert.ok(ranked[0]._score.tier === 'hot');
  assert.equal(leads[0]._score, undefined); // original untouched
});
