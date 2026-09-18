import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP, outboundDueStep, outbound1Email, outbound2Email, outbound3Email } from '../../assets/nurture-core.mjs';
import { outboundConfigured, outboundFromHeader } from '../../lib/notify.mjs';

const NOW = '2026-03-20T12:00:00.000Z';
const daysAgo = (n) => new Date(new Date(NOW).getTime() - n * 864e5).toISOString();
const P = { id: 'p1', email: 'lead@acme.co', name: 'Dana Lee', unsubscribed: false, nurture_suppressed: false,
  qualification: { opener: 'Hi Dana — saw your LLM work at Acme and thought a free eval of one live feature might help.' } };

// ── outboundDueStep: the cold cadence, in order, never backward ──
test('sends the opener when nothing has been sent yet', () => {
  assert.equal(outboundDueStep(P, [], NOW), STEP.OUTBOUND_1);
});
test('holds step 2 until 3 days after the opener', () => {
  assert.equal(outboundDueStep(P, [{ step: STEP.OUTBOUND_1, sent_at: daysAgo(1) }], NOW), null);
  assert.equal(outboundDueStep(P, [{ step: STEP.OUTBOUND_1, sent_at: daysAgo(3) }], NOW), STEP.OUTBOUND_2);
});
test('holds step 3 until 4 days after step 2, then stops', () => {
  const afterTwo = [{ step: STEP.OUTBOUND_1, sent_at: daysAgo(10) }, { step: STEP.OUTBOUND_2, sent_at: daysAgo(2) }];
  assert.equal(outboundDueStep(P, afterTwo, NOW), null);
  const due3 = [{ step: STEP.OUTBOUND_1, sent_at: daysAgo(10) }, { step: STEP.OUTBOUND_2, sent_at: daysAgo(4) }];
  assert.equal(outboundDueStep(P, due3, NOW), STEP.OUTBOUND_3);
  const done = [...due3, { step: STEP.OUTBOUND_3, sent_at: daysAgo(1) }];
  assert.equal(outboundDueStep(P, done, NOW), null);
});
test('never emails an unsubscribed or suppressed or email-less prospect', () => {
  assert.equal(outboundDueStep({ ...P, unsubscribed: true }, [], NOW), null);
  assert.equal(outboundDueStep({ ...P, nurture_suppressed: true }, [], NOW), null);
  assert.equal(outboundDueStep({ ...P, email: null }, [], NOW), null);
});

// ── the cold emails: personalized, compliant, safe ──
test('opener uses the AI-personalized opener and carries unsubscribe + postal address', () => {
  const m = outbound1Email({ prospect: P, siteUrl: 'https://x.co', unsubscribeUrl: 'https://x.co/api/unsubscribe?token=t' });
  assert.ok(m.text.includes('saw your LLM work at Acme'), 'uses stored personalized opener');
  assert.ok(m.html.includes('Orlando, FL'), 'postal address present (CAN-SPAM)');
  assert.ok(m.text.includes('Unsubscribe:'), 'text unsubscribe present');
  assert.equal(m.headers['List-Unsubscribe'], '<https://x.co/api/unsubscribe?token=t>');
});
test('opener falls back to a default when no personalized opener was stored', () => {
  const m = outbound1Email({ prospect: { id: 'p2', email: 'x@y.co', name: 'Sam Ray' }, siteUrl: 'https://x.co', unsubscribeUrl: 'https://x.co/u?token=t' });
  assert.ok(m.text.includes('Sam'), 'greets by first name in the default opener');
  assert.ok(m.html.length > 0);
});
test('steps 2 and 3 build cleanly with unsubscribe headers', () => {
  for (const build of [outbound2Email, outbound3Email]) {
    const m = build({ prospect: P, siteUrl: 'https://x.co', unsubscribeUrl: 'https://x.co/u?token=t' });
    assert.ok(m.subject && m.text && m.html);
    assert.ok(m.html.includes('Orlando, FL'));
    assert.ok(m.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click');
  }
});

// ── deliverability gating ──
test('outboundConfigured is false unless OUTBOUND_FROM is a distinct domain', () => {
  // In the test env neither var is set → not configured → cold sending stays off.
  assert.equal(outboundConfigured(), false);
  assert.match(outboundFromHeader('Jason Teixeira'), /Jason Teixeira <.+@.+>/);
});
