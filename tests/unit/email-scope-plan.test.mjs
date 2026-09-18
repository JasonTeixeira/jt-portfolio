import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePlan, SEGMENTS, DISCLAIMER } from '../../assets/scope-core.mjs';
import { locCardName, locCardWhy, locPhase, locSegment } from '../../assets/scope-i18n.mjs';
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

// Mirrors how api/lead.js localizes the plan for /es/ and /pt/ visitors: pricing stays
// deterministic (computePlan is untouched); only the DISPLAY strings (segment, phase labels,
// capability name/why) are localized upstream, then `lang` is passed to scopePlanEmail so it
// localizes its own chrome (subject, audit rung, labels, disclaimer, CTA).
function buildLang(keys, segment, lang) {
  const p = computePlan(keys, segment);
  const enSeg = segment && SEGMENTS[segment] ? SEGMENTS[segment].label : '';
  const phases = p.phases.map((ph) => ({
    ...ph,
    label: locPhase(ph.phase, ph.label, lang),
    items: (ph.items || []).map((i) => ({ ...i, name: locCardName(i, lang), why: locCardWhy(i, lang) })),
  }));
  return scopePlanEmail({
    segmentLabel: segment ? locSegment(segment, enSeg, lang) : '',
    phases, totalBand: p.totalBand, timelineWeeks: p.timelineWeeks,
    bookUrl: 'https://agency.sageideas.dev/book.html',
    planUrl: 'https://agency.sageideas.dev/build.html#plan=abc', disclaimer: DISCLAIMER, lang,
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

test('scopePlanEmail leads with the $497 audit rung, credited into the build (html + text)', () => {
  const m = build(['chatbot'], 'ai-product');
  // HTML rung
  assert.ok(m.html.includes('$497'), 'html shows the $497 audit price');
  assert.ok(m.html.includes('AI Quality Audit'), 'html names the AI Quality Audit rung');
  assert.ok(m.html.includes('Start here'), 'html carries the "Start here" anchor label');
  assert.ok(m.html.toLowerCase().includes('credited into the build'), 'html says it is credited into the build');
  assert.ok(m.html.includes('$0'), 'html states the real cost of starting is $0');
  // Rung leads: it appears before the full-build total in the body
  assert.ok(m.html.indexOf('AI Quality Audit') < m.html.indexOf('Full build'), 'audit rung leads before the full-build range');
  // Plain-text rung
  assert.ok(m.text.includes('$497') && m.text.includes('AI Quality Audit'), 'text mentions the $497 audit rung');
  assert.ok(m.text.toLowerCase().includes('credited into the build'), 'text says it is credited into the build');
});

test('scopePlanEmail reframes the total as full build and adds a typical ~$X midpoint', () => {
  const m = build(['chatbot'], 'ai-product'); // band [1300, 2800] -> mean 2050
  assert.ok(m.html.includes('Full build'), 'html reframes the total as the full build');
  assert.ok(m.html.includes('~$2,050'), 'html shows the dollar-formatted typical midpoint');
  assert.ok(m.text.includes('~$2,050'), 'text carries the typical midpoint');
  assert.ok(m.text.toLowerCase().includes('typical'), 'text labels the midpoint as typical');
});

test('scopePlanEmail is a plain, safe object with subject/text/html', () => {
  const m = build(['workflow'], 'ops-automation');
  assert.equal(typeof m.subject, 'string');
  assert.ok(m.html.startsWith('<!doctype html>') || m.html.startsWith('<!DOCTYPE'), 'full html doc');
  assert.ok(m.text.length > 40, 'has a real plain-text body');
});

test('lang="en" (localization path, no-op) is byte-identical to the un-localized call', () => {
  // Proves the es/pt localization plumbing never disturbs the English output.
  assert.deepEqual(buildLang(['chatbot', 'llm-eval', 'ci-gate'], 'ai-product', 'en'), build(['chatbot', 'llm-eval', 'ci-gate'], 'ai-product'));
  assert.deepEqual(buildLang(['workflow'], 'ops-automation', 'en'), build(['workflow'], 'ops-automation'));
});

test('scopePlanEmail localizes the whole plan into Spanish (es) with prices unchanged', () => {
  const en = build(['chatbot', 'llm-eval'], 'ai-product'); // bands [1300,2800] + [1500,4000]
  const es = buildLang(['chatbot', 'llm-eval'], 'ai-product', 'es');
  // Subject + chrome are Spanish
  assert.ok(es.subject.startsWith('Tu plan personalizado'), 'Spanish subject');
  assert.ok(es.html.includes('Empieza aquí'), 'Spanish "Start here" rung label');
  assert.ok(es.html.includes('Auditoría de Calidad de IA'), 'Spanish audit rung title');
  assert.ok(es.html.includes('Proyecto completo (indicativo)'), 'Spanish "full build" label');
  assert.ok(es.html.includes('Agenda una llamada de 15 min'), 'Spanish CTA');
  // Itemized rows localized
  assert.ok(es.html.includes('Asistente conversacional'), 'Spanish capability name');
  assert.ok(es.html.includes('Marco de evaluación de LLM'), 'Spanish eval capability name');
  // Disclaimer localized (via locDisclaimer)
  assert.ok(es.html.toLowerCase().includes('no un presupuesto'), 'Spanish disclaimer');
  assert.ok(es.text.toLowerCase().includes('no un presupuesto'), 'Spanish disclaimer in text');
  // English strings are gone from the visitor chrome
  assert.ok(!es.html.includes('Your scoped plan'), 'no leftover English heading');
  assert.ok(!es.html.includes('AI Quality Audit</div>') || es.html.includes('Auditoría'), 'audit rung is Spanish');
  // Prices/format are byte-for-byte the same as English
  assert.ok(es.subject.includes('$2,800') && es.subject.includes('$6,800'), 'same dollar range as en');
  assert.equal(es.subject.replace('Tu plan personalizado', 'Your scoped plan'), en.subject, 'only the words differ, not the numbers');
  assert.ok(es.html.includes('$497'), 'audit price unchanged');
});

test('scopePlanEmail localizes the whole plan into Portuguese (pt) with prices unchanged', () => {
  const en = build(['chatbot', 'llm-eval'], 'ai-product');
  const pt = buildLang(['chatbot', 'llm-eval'], 'ai-product', 'pt');
  assert.ok(pt.subject.startsWith('Seu plano personalizado'), 'Portuguese subject');
  assert.ok(pt.html.includes('Comece aqui'), 'Portuguese "Start here" rung label');
  assert.ok(pt.html.includes('Auditoria de Qualidade de IA'), 'Portuguese audit rung title');
  assert.ok(pt.html.includes('Projeto completo (indicativo)'), 'Portuguese "full build" label');
  assert.ok(pt.html.includes('Agende uma conversa de 15 min'), 'Portuguese CTA');
  assert.ok(pt.html.includes('Assistente conversacional'), 'Portuguese capability name');
  assert.ok(pt.html.includes('Suíte de avaliação de LLM'), 'Portuguese eval capability name');
  assert.ok(pt.html.toLowerCase().includes('não um orçamento'), 'Portuguese disclaimer');
  assert.ok(pt.text.toLowerCase().includes('não um orçamento'), 'Portuguese disclaimer in text');
  assert.ok(!pt.html.includes('Your scoped plan'), 'no leftover English heading');
  assert.ok(pt.subject.includes('$2,800') && pt.subject.includes('$6,800'), 'same dollar range as en');
  assert.equal(pt.subject.replace('Seu plano personalizado', 'Your scoped plan'), en.subject, 'only the words differ, not the numbers');
  assert.ok(pt.html.includes('$497'), 'audit price unchanged');
});

test('unsupported/blank lang falls back to English chrome', () => {
  const m = buildLang(['chatbot'], 'ai-product', 'de');
  assert.ok(m.subject.startsWith('Your scoped plan'), 'unknown locale falls back to English');
  assert.ok(m.html.includes('AI Quality Audit'), 'English audit rung on fallback');
});
