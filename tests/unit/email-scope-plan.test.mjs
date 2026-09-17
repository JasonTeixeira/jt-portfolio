import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePlan, SEGMENTS, DISCLAIMER } from '../../assets/scope-core.mjs';
import { scopePlanEmail } from '../../lib/email-templates.mjs';

function build(keys, segment) {
  const p = computePlan(keys, segment);
  return scopePlanEmail({
    segmentLabel: segment && SEGMENTS[segment] ? SEGMENTS[segment].label : '',
    phases: p.phases, totalBand: p.totalBand, timelineWeeks: p.timelineWeeks,
    bookUrl: 'https://agency.sageideas.dev/book.html',
    planUrl: 'https://agency.sageideas.dev/build.html#plan=abc', disclaimer: DISCLAIMER,
  });
}

test('scopePlanEmail renders the actual itemized plan the visitor scoped', () => {
  const m = build(['chatbot', 'llm-eval', 'ci-gate'], 'ai-product');
  assert.ok(m.html.includes('Conversational assistant'), 'includes a scoped capability by name');
  assert.ok(m.html.includes('LLM evaluation harness'), 'includes the eval capability');
  assert.ok(m.html.includes('/book.html'), 'has a book-a-call CTA');
  assert.ok(m.text.includes('Conversational assistant'), 'plain-text fallback has line items');
});

test('scopePlanEmail formats the total as dollars (not cents), with an honest disclaimer', () => {
  const p = computePlan(['chatbot'], 'ai-product'); // band [1300, 2800]
  const m = build(['chatbot'], 'ai-product');
  assert.ok(m.subject.includes('$1,300') && m.subject.includes('$2,800'), 'dollar-formatted range in subject');
  assert.ok(!m.html.includes('$13.00'), 'not treated as cents');
  assert.ok(m.html.toLowerCase().includes('not a quote'), 'carries the indicative/not-a-quote disclaimer');
  assert.deepEqual(p.totalBand, [1300, 2800]);
});

test('scopePlanEmail is a plain, safe object with subject/text/html', () => {
  const m = build(['workflow'], 'ops-automation');
  assert.equal(typeof m.subject, 'string');
  assert.ok(m.html.startsWith('<!doctype html>') || m.html.startsWith('<!DOCTYPE'), 'full html doc');
  assert.ok(m.text.length > 40, 'has a real plain-text body');
});
