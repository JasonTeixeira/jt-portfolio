import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DUE, SEND_CAP, STEP, isSendable, hoursBetween, leadDue, dueStepForProposal,
  leadEmail, unpaidEmail, expiringEmail, listUnsubHeaders,
} from '../../assets/nurture-core.mjs';

const NOW = '2026-08-19T12:00:00Z';
const hoursAgo = (h) => new Date(new Date(NOW).getTime() - h * 3600e3).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);
const daysAhead = (d) => new Date(new Date(NOW).getTime() + d * 864e5).toISOString();

test('isSendable respects unsubscribe + suppress', () => {
  assert.equal(isSendable({}), true);
  assert.equal(isSendable({ unsubscribed: true }), false);
  assert.equal(isSendable({ nurture_suppressed: true }), false);
});
test('leadDue: engaged + email + no proposal + >=48h + sendable + not already sent', () => {
  const base = { stage: 'engaged', email: 'a@b.co', updated_at: hoursAgo(50), unsubscribed: false, nurture_suppressed: false };
  assert.equal(leadDue(base, false, new Set(), NOW), true);
  assert.equal(leadDue(base, true, new Set(), NOW), false);            // has a proposal
  assert.equal(leadDue({ ...base, updated_at: hoursAgo(10) }, false, new Set(), NOW), false); // too fresh
  assert.equal(leadDue({ ...base, email: '' }, false, new Set(), NOW), false); // no email
  assert.equal(leadDue({ ...base, unsubscribed: true }, false, new Set(), NOW), false);
  assert.equal(leadDue(base, false, new Set([STEP.LEAD]), NOW), false); // already sent
  assert.equal(leadDue({ ...base, stage: 'new' }, false, new Set(), NOW), false);
});
test('dueStepForProposal: only approved+unexpired; C>B; B2>B1; sentSteps exclude', () => {
  const appr = (d) => ({ status: 'approved', approved_at: daysAgo(d), expires_at: daysAhead(20) });
  assert.equal(dueStepForProposal(appr(1), new Set(), NOW), null);                 // <3d
  assert.equal(dueStepForProposal(appr(3), new Set(), NOW), STEP.UNPAID_1);        // >=3d
  assert.equal(dueStepForProposal(appr(9), new Set(), NOW), STEP.UNPAID_2);        // backfill >=8d, nothing sent -> single most-overdue nudge
  assert.equal(dueStepForProposal(appr(9), new Set([STEP.UNPAID_1]), NOW), STEP.UNPAID_2); // normal progression: B1 sent -> B2
  assert.equal(dueStepForProposal(appr(5), new Set([STEP.UNPAID_1]), NOW), null);  // B1 sent, not yet 8d -> wait
  assert.equal(dueStepForProposal(appr(9), new Set([STEP.UNPAID_2]), NOW), null);  // never loop back to B1 after B2
  assert.equal(dueStepForProposal(appr(9), new Set([STEP.UNPAID_1, STEP.UNPAID_2]), NOW), null);
  assert.equal(dueStepForProposal({ status: 'draft_pending', approved_at: null, expires_at: daysAhead(20) }, new Set(), NOW), null);
  assert.equal(dueStepForProposal({ status: 'approved', approved_at: daysAgo(5), expires_at: daysAgo(1) }, new Set(), NOW), null); // expired
  // expiring within 3d takes priority over an unpaid step
  assert.equal(dueStepForProposal({ status: 'approved', approved_at: daysAgo(5), expires_at: daysAhead(2) }, new Set(), NOW), STEP.EXPIRING);
  assert.equal(dueStepForProposal({ status: 'approved', approved_at: daysAgo(5), expires_at: daysAhead(2) }, new Set([STEP.EXPIRING]), NOW), STEP.UNPAID_1);
});
test('email builders: non-empty, carry unsubscribe url + List-Unsubscribe header, no banned tics', () => {
  const U = 'https://x/api/unsubscribe?token=abc';
  const emails = [
    leadEmail({ prospect: { email: 'a@b.co' }, hasPlan: true, siteUrl: 'https://x', unsubscribeUrl: U }),
    leadEmail({ prospect: { email: 'a@b.co' }, hasPlan: false, siteUrl: 'https://x', unsubscribeUrl: U }),
    unpaidEmail({ proposal: { public_id: 'pid' }, step: STEP.UNPAID_1, siteUrl: 'https://x', unsubscribeUrl: U }),
    unpaidEmail({ proposal: { public_id: 'pid' }, step: STEP.UNPAID_2, siteUrl: 'https://x', unsubscribeUrl: U }),
    expiringEmail({ proposal: { public_id: 'pid', expires_at: '2026-09-01T00:00:00Z' }, siteUrl: 'https://x', unsubscribeUrl: U }),
  ];
  for (const e of emails) {
    assert.ok(e.subject && e.subject.length > 3);
    assert.ok(e.text.includes(U));
    assert.equal(e.headers['List-Unsubscribe'], `<${U}>`);
    assert.equal(e.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.doesNotMatch(e.text, /\bactually\b|\bgenuinely\b|\bHonestly\b/i);
    assert.doesNotMatch(e.text, / — /); // no em-dash clause-joiner
  }
});
test('SEND_CAP is a sane positive integer', () => { assert.ok(Number.isInteger(SEND_CAP) && SEND_CAP > 0); });
