import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled as apolloEnabled, searchPeople, enrichPerson } from '../../lib/apollo.mjs';
import { isEnabled as verifyEnabled, verifyEmail } from '../../lib/lead-verify.mjs';
import { ruleScore, parseScore, scoreLead, isEnabled as llmEnabled } from '../../lib/lead-score.mjs';
import { upsertOutboundProspect } from '../../lib/scope-db.mjs';

// ── Apollo client: inert + safe without a key ──
test('apollo is disabled and inert without APOLLO_API_KEY', async () => {
  assert.equal(apolloEnabled(), false);
  assert.deepEqual(await searchPeople({ titles: ['CTO'] }), { ok: false, skipped: true });
});
test('enrichPerson returns the person unchanged when it already has an email (no credit spend)', async () => {
  const p = { name: 'A', email: 'a@b.co' };
  const r = await enrichPerson(p);
  assert.equal(r.ok, true);
  assert.equal(r.data.email, 'a@b.co');
});

// ── Email verifier: inert without a key, but still rejects malformed addresses ──
test('verifier is disabled without a key', async () => {
  assert.equal(verifyEnabled(), false);
  assert.deepEqual(await verifyEmail('a@b.co'), { ok: false, skipped: true });
});

// ── Lead scoring: rule-based fallback is deterministic and bounded ──
test('ruleScore rewards seniority + AI/eng signal and stays in 0..100', () => {
  const senior = ruleScore({ title: 'VP of Machine Learning', company: 'Acme', email: 'x@acme.co', firstName: 'Sam' });
  const junior = ruleScore({ title: 'Office Coordinator' });
  assert.ok(senior.score > junior.score, 'senior AI title scores higher');
  assert.ok(senior.score <= 100 && junior.score >= 0);
  assert.equal(senior.tier, 'A');
  assert.match(senior.opener, /Sam/); // personalized with the first name
  assert.equal(senior.personalized, false); // rule-based, not AI
});

test('scoreLead falls back to a usable rule-based score when the LLM is off', async () => {
  assert.equal(llmEnabled(), false);
  const r = await scoreLead({ title: 'CTO', company: 'Beta', firstName: 'Lee', email: 'l@beta.co' });
  assert.equal(r.ok, true);
  assert.ok(r.data.score >= 0 && r.data.score <= 100);
  assert.ok(['A', 'B', 'C'].includes(r.data.tier));
  assert.ok(r.data.opener.length > 0);
});

test('parseScore extracts JSON from a model reply, even wrapped in prose/fences', () => {
  const good = parseScore('Sure! ```json\n{"score": 82, "tier":"A", "reason":"owns AI roadmap", "opener":"Hi Dana, saw your LLM work at Acme..."}\n``` hope that helps');
  assert.equal(good.score, 82);
  assert.equal(good.tier, 'A');
  assert.equal(good.personalized, true);
  assert.ok(good.opener.startsWith('Hi Dana'));
});
test('parseScore rejects junk / missing opener / non-numeric score', () => {
  assert.equal(parseScore('no json here'), null);
  assert.equal(parseScore('{"score":"high"}'), null);
  assert.equal(parseScore('{"score": 50}'), null); // no opener
});
test('parseScore clamps out-of-range scores', () => {
  const o = parseScore('{"score": 999, "tier":"A", "opener":"hi"}');
  assert.equal(o.score, 100);
});

// ── CRM sink: inert without Supabase, rejects malformed email ──
test('upsertOutboundProspect is inert without Supabase env', async () => {
  const r = await upsertOutboundProspect({ email: 'a@b.co', name: 'A', score: 80, tier: 'A', opener: 'hi' });
  assert.deepEqual(r, { ok: false, skipped: true });
});
