import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled as placesEnabled, searchBusinesses, domainOf } from '../../lib/places.mjs';
import { isEnabled as hunterEnabled, findEmail } from '../../lib/hunter.mjs';
import { ruleScoreBusiness, scoreBusiness } from '../../lib/lead-score.mjs';

// ── Places: inert + safe without a key ──
test('places is disabled and inert without a key', async () => {
  assert.equal(placesEnabled(), false);
  assert.deepEqual(await searchBusinesses('plumber in Phoenix, AZ'), { ok: false, skipped: true });
});
test('domainOf strips scheme/www/path', () => {
  assert.equal(domainOf('https://www.AcmePlumbing.com/contact'), 'acmeplumbing.com');
  assert.equal(domainOf('http://foo.co'), 'foo.co');
  assert.equal(domainOf(''), null);
  assert.equal(domainOf('not a url'), null);
});

// ── Hunter: inert without a key ──
test('hunter is disabled without a key', async () => {
  assert.equal(hunterEnabled(), false);
  assert.deepEqual(await findEmail('acme.com'), { ok: false, skipped: true });
});

// ── SMB closeability scoring: vertical tiers ranked correctly ──
test('home services and law firms outrank restaurants', () => {
  const plumber = ruleScoreBusiness({ name: 'Ace Plumbing', type: 'plumber', website: 'x', reviews: 40 });
  const lawyer = ruleScoreBusiness({ name: 'Smith Injury Law', type: 'personal injury attorney', website: 'x', reviews: 30 });
  const diner = ruleScoreBusiness({ name: "Joe's Diner", type: 'restaurant', website: 'x', reviews: 200 });
  assert.equal(plumber.tier, 'A');
  assert.equal(lawyer.tier, 'A');
  assert.ok(plumber.score > diner.score, 'plumber closeability > restaurant');
  assert.ok(lawyer.score > diner.score, 'law firm closeability > restaurant');
});
test('opener pitches the AI front desk and names the trade + business', () => {
  const m = ruleScoreBusiness({ name: 'Ace Plumbing', type: 'plumber', website: 'x', reviews: 40 });
  assert.match(m.opener, /Ace Plumbing/);
  assert.match(m.opener, /AI front desk|answers every call/i);
  assert.equal(m.personalized, false);
});
test('a no-website business scores lower (needs a call/SMS motion, not email)', () => {
  const withSite = ruleScoreBusiness({ name: 'A HVAC', type: 'HVAC contractor', website: 'x', reviews: 10 });
  const noSite = ruleScoreBusiness({ name: 'A HVAC', type: 'HVAC contractor', website: null, reviews: 10 });
  assert.ok(withSite.score > noSite.score);
});
test('scoreBusiness falls back to a usable rule-based score without the LLM', async () => {
  const r = await scoreBusiness({ name: 'Bright Dental', type: 'cosmetic dentist', website: 'x', reviews: 20 });
  assert.equal(r.ok, true);
  assert.ok(r.data.score >= 0 && r.data.score <= 100);
  assert.ok(['A', 'B', 'C'].includes(r.data.tier));
  assert.ok(r.data.opener.length > 0);
});
