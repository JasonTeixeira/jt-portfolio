import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  firmCentsFromBand, depositCents, balanceCents, clampFirmCents,
  publicId, money, isExpired, DEPOSIT_PCT_DEFAULT, PROPOSAL_STATUS, TERMS, TERMS_VERSION,
} from '../../assets/proposal-core.mjs';

test('firmCentsFromBand: midpoint dollars -> cents', () => {
  assert.equal(firmCentsFromBand([4000, 9000]), 650000); // (6500)*100
  assert.equal(firmCentsFromBand([0, 0]), 0);
});
test('depositCents: rounds', () => {
  assert.equal(depositCents(650000, 0.30), 195000);
  assert.equal(depositCents(100001, 0.30), 30000); // 30000.3 -> 30000
});
test('balanceCents', () => { assert.equal(balanceCents(650000, 195000), 455000); });
test('clampFirmCents: within band passes; wild edits clamp', () => {
  assert.deepEqual(clampFirmCents(650000, [4000, 9000]), { cents: 650000, clamped: false });
  const hi = clampFirmCents(99999999, [4000, 9000]); // > hi*100*2 = 1_800_000
  assert.equal(hi.clamped, true); assert.equal(hi.cents, 1800000);
  const lo = clampFirmCents(1000, [4000, 9000]); // < max(floor 5000, lo*100*0.5=200000)
  assert.equal(lo.clamped, true); assert.equal(lo.cents, 200000);
});
test('publicId: unguessable-ish, url-safe, unique across calls', () => {
  const a = publicId(), b = publicId();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9A-Za-z]{16,}$/);
});
test('money formats usd', () => { assert.equal(money(195000), '$1,950'); assert.equal(money(650000), '$6,500'); });
test('isExpired compares against passed now', () => {
  assert.equal(isExpired({ expires_at: '2020-01-01T00:00:00Z' }, '2026-01-01T00:00:00Z'), true);
  assert.equal(isExpired({ expires_at: '2030-01-01T00:00:00Z' }, '2026-01-01T00:00:00Z'), false);
  assert.equal(isExpired({ expires_at: null }, '2026-01-01T00:00:00Z'), false);
});
test('TERMS is real content with headings + IP-on-final-payment clause', () => {
  assert.ok(Array.isArray(TERMS) && TERMS.length >= 7);
  const joined = TERMS.map((t) => `${t.heading} ${t.body}`).join(' ').toLowerCase();
  assert.match(joined, /out of scope/);
  assert.match(joined, /revision/);
  assert.match(joined, /ownership|intellectual property|transfers/);
  assert.match(joined, /tax/);
  assert.ok(TERMS_VERSION.length >= 8);
});
test('no banned tics in terms', () => {
  const joined = TERMS.map((t) => t.body).join(' ');
  assert.doesNotMatch(joined, /\bactually\b|\bgenuinely\b|\bHonestly\b/i);
});
