import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSow, buildMsa, publicId, money, CONTRACT_CAVEAT, CONTRACT_TERMS_VERSION,
} from '../../assets/contract-core.mjs';
import { CARD_BY_KEY } from '../../assets/scope-core.mjs';

const NOW = '2026-08-23T12:00:00.000Z';

test('buildSow fills fees from passed cents, no stray $ beyond the fee figures', () => {
  const sow = buildSow({
    clientName: 'Acme Co', projectName: 'Support Bot', keys: ['chatbot'],
    firmCents: 650000, depositCents: 195000, balanceCents: 455000, nowIso: NOW,
  });
  assert.equal(sow.kind, 'sow');
  const feesSection = sow.sections.find((s) => s.heading === 'Fees');
  assert.ok(feesSection);
  assert.match(feesSection.body, /\$6,500/);
  assert.match(feesSection.body, /\$1,950/);
  assert.match(feesSection.body, /\$4,550/);

  // No stray $ anywhere outside the Fees section.
  for (const s of sow.sections) {
    if (s.heading === 'Fees') continue;
    assert.doesNotMatch(s.body, /\$/, `unexpected $ in section "${s.heading}"`);
  }
  // Exactly the three fee figures inside Fees — no extra $ signs.
  const dollarCount = (feesSection.body.match(/\$/g) || []).length;
  assert.equal(dollarCount, 3);
});

test('buildSow derives deliverables from a real rate-card key', () => {
  const card = CARD_BY_KEY.get('chatbot');
  assert.ok(card, 'expected "chatbot" to be a real rate-card key');
  const sow = buildSow({
    clientName: 'Acme Co', projectName: 'Support Bot', keys: ['chatbot'],
    firmCents: 650000, depositCents: 195000, balanceCents: 455000, nowIso: NOW,
  });
  const scopeSection = sow.sections.find((s) => s.heading === 'Scope & Deliverables');
  assert.ok(scopeSection);
  assert.ok(scopeSection.body.includes(card.name), `expected "${card.name}" in Scope & Deliverables`);
  assert.ok(scopeSection.body.includes(card.why));
});

test('buildSow falls back to generic scope line when no keys given', () => {
  const sow = buildSow({
    clientName: 'Acme Co', projectName: 'Support Bot', keys: [],
    firmCents: 100000, depositCents: 30000, balanceCents: 70000, nowIso: NOW,
  });
  const scopeSection = sow.sections.find((s) => s.heading === 'Scope & Deliverables');
  assert.match(scopeSection.body, /Scope as discussed and quoted\./);
});

test('CONTRACT_CAVEAT and CONTRACT_TERMS_VERSION are exported and non-empty', () => {
  assert.equal(typeof CONTRACT_CAVEAT, 'string');
  assert.ok(CONTRACT_CAVEAT.length > 20);
  assert.equal(typeof CONTRACT_TERMS_VERSION, 'string');
  assert.ok(CONTRACT_TERMS_VERSION.length >= 8);
});

test('buildMsa includes Illinois governing law and the client name', () => {
  const msa = buildMsa({ clientName: 'Acme Co', nowIso: NOW });
  assert.equal(msa.kind, 'msa');
  const joined = msa.sections.map((s) => `${s.heading} ${s.body}`).join(' ');
  assert.match(joined, /Illinois/);
  assert.match(joined, /Acme Co/);
  assert.equal(msa.meta.clientName, 'Acme Co');
});

test('buildMsa falls back to placeholder when clientName missing', () => {
  const msa = buildMsa({ clientName: '', nowIso: NOW });
  const joined = msa.sections.map((s) => s.body).join(' ');
  assert.match(joined, /\[CLIENT\]/);
});

test('re-exported publicId() returns a url-safe unique string', () => {
  const a = publicId(), b = publicId();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9A-Za-z]{16,}$/);
});

test('re-exported money() formats usd', () => {
  assert.equal(money(650000), '$6,500');
});
