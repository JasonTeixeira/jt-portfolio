import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled as placesEnabled, searchBusinesses, domainOf } from '../../lib/places.mjs';
import { isEnabled as hunterEnabled, findEmail } from '../../lib/hunter.mjs';
import { ruleScoreBusiness, scoreBusiness, parseProposal } from '../../lib/lead-score.mjs';
import { BY_ID } from '../../lib/automation-catalog.mjs';

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
test('tailored proposal names the business + recommends fitting automations', () => {
  const m = ruleScoreBusiness({ name: 'Ace Plumbing', type: 'plumber', website: 'x', reviews: 40 });
  assert.match(m.pitch, /Ace Plumbing/);
  assert.ok(Array.isArray(m.automations) && m.automations.length >= 2, 'recommends 2+ automations');
  m.automations.forEach((a) => assert.ok(BY_ID.has(a.id), `automation ${a.id} is a real catalog item`));
  // home services should get the receptionist + missed-call automations, not restaurant ones
  const ids = m.automations.map((a) => a.id);
  assert.ok(ids.includes('ai-receptionist') || ids.includes('missed-call-textback'));
  assert.equal(m.personalized, false);
});

test('parseProposal validates automation IDs against the catalog and requires a pitch', () => {
  const good = parseProposal('```json\n{"score":88,"tier":"A","reason":"home services","automations":["ai-receptionist","missed-call-textback","not-a-real-id"],"pitch":"Hi Ace, I\'d set up an AI receptionist and missed-call text-back so you never lose a job."}\n```');
  assert.equal(good.score, 88);
  assert.equal(good.personalized, true);
  assert.deepEqual(good.automations.map((a) => a.id), ['ai-receptionist', 'missed-call-textback'], 'unknown id dropped');
  assert.equal(parseProposal('{"score":80,"automations":["ai-receptionist"]}'), null, 'no pitch → null');
  assert.equal(parseProposal('garbage'), null);
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
