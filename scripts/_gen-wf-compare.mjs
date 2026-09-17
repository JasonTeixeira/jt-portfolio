#!/usr/bin/env node
/**
 * Generates scripts/wf-compare.mjs — a Workflow script that drafts the remaining
 * body-less tool comparisons to the house voice AND to stable, defensible facts.
 * Run: node scripts/_gen-wf-compare.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CATS, COMPARISONS } from './comparisons.data.mjs';

const BODIES = JSON.parse(readFileSync('scripts/compare-bodies.json', 'utf8'));
const todo = COMPARISONS.filter((c) => !BODIES[c.slug]).map((c) => ({
  slug: c.slug, a: c.a, b: c.b, catLabel: CATS[c.cat].label, gloss: c.gloss, cornerstone: CATS[c.cat].cornerstone.t,
}));

const exemplars = ['promptfoo-vs-deepeval', 'playwright-vs-cypress'].map((s) => {
  const b = BODIES[s]; const c = COMPARISONS.find((x) => x.slug === s);
  return `MATCHUP: ${c.a} vs ${c.b}\n` + JSON.stringify(b, null, 2);
}).join('\n\n---\n\n');

const script = `export const meta = {
  name: 'compare-fanout',
  description: 'Draft + fact-conservative refine of the remaining X-vs-Y tool comparisons',
  phases: [{ title: 'Draft' }, { title: 'Refine' }],
};

const MATCHUPS = ${JSON.stringify(todo)};
const EXEMPLARS = ${JSON.stringify(exemplars)};

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    intro: { type: 'string' },
    table: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { dim: { type: 'string' }, a: { type: 'string' }, b: { type: 'string' } }, required: ['dim', 'a', 'b'] } },
    pickA: { type: 'string' }, pickB: { type: 'string' }, honestTake: { type: 'string' },
  },
  required: ['intro', 'table', 'pickA', 'pickB', 'honestTake'],
};

const VOICE = [
  'VOICE: simple, human, honest, a little dry. Short sentences. Concrete over abstract. This brand is "no fake green" and never shills.',
  'NO em dashes (use a period or comma). NO "X, not Y" tic. NO rule-of-three filler. NO hype or filler openers. Only <b> tags for emphasis, used sparingly.',
].join('\\n');

const ACCURACY = [
  'ACCURACY RULES (critical, this brand loses everything if it ships wrong facts):',
  '- Only state facts you are confident are STABLE and true. When unsure, describe the general category or architecture, do not guess specifics.',
  '- Do NOT invent pricing numbers, version numbers, benchmark results, or feature claims. Describe licensing as "open source", "commercial / hosted", or "open-core", never a dollar figure.',
  '- Prefer slow-changing differences: open-source vs commercial, self-host vs SaaS, code-first vs UI-first, language/browser support, what each is genuinely best for.',
  '- Be honest where the two tools overlap or are similar. "Both do X well" is a fine and often correct row.',
  '- If you are not sure a specific claim is true, leave it out. A shorter honest comparison beats a detailed wrong one.',
].join('\\n');

function draftPrompt(m) {
  return [
    'You are writing ONE head-to-head tool comparison for a public AI-engineering library by Jason Teixeira, a hands-on AI + QA engineer who has actually used these tools. Readers are builders deciding which to adopt.',
    '',
    'Compare "' + m.a + '" vs "' + m.b + '" (' + m.catLabel + '). One-line framing: "' + m.gloss + '".',
    '',
    'Return five fields:',
    '- intro: 2-3 sentences. Who is choosing between these, and the one-line shape of the difference. Name each tool in <b>bold</b> once.',
    '- table: 6 to 8 rows, each { dim, a, b }. dim is a short dimension label (e.g. "What it is", "License", "Best for"). a is the value for ' + m.a + ', b for ' + m.b + '. Keep cells short (a phrase, not a sentence). Use <b> only to flag a genuine standout.',
    '- pickA: 2-3 sentences. When to pick ' + m.a + '.',
    '- pickB: 2-3 sentences. When to pick ' + m.b + '.',
    '- honestTake: 3-5 sentences. A real, decisive recommendation with the nuance. This is the brand\\'s value: say what you would actually reach for and why, and name the mistake people make when choosing.',
    '',
    VOICE, '', ACCURACY, '',
    'TWO GOLD-STANDARD examples of the exact structure, voice, and honesty to match:', '', EXEMPLARS, '',
    'Return only the five fields for ' + m.a + ' vs ' + m.b + '.',
  ].join('\\n');
}

function refinePrompt(m, draft) {
  return [
    'You are the editor AND the fact-checker for this ' + m.a + ' vs ' + m.b + ' comparison. Improve it without changing correct meaning.',
    'Editing: enforce the house voice below, remove EVERY em dash, kill any "X, not Y" tic or filler, tighten long sentences, keep only <b> tags.',
    'Fact-conservatism: DELETE or generalize any shaky specific claim (a price, a version, a benchmark, a feature you are not confident is true). When in doubt, make the cell more general and safe. Keep the table to stable architectural facts. If a whole row is dubious, drop it.',
    '',
    VOICE, '', ACCURACY, '',
    'Draft (JSON):', JSON.stringify(draft), '',
    'Return the five improved fields.',
  ].join('\\n');
}

const results = await pipeline(
  MATCHUPS,
  (m) => agent(draftPrompt(m), { label: 'draft:' + m.slug, phase: 'Draft', schema: SCHEMA, effort: 'low' }),
  (draft, m) => draft
    ? agent(refinePrompt(m, draft), { label: 'refine:' + m.slug, phase: 'Refine', schema: SCHEMA, effort: 'low' })
        .then((final) => (final ? { slug: m.slug, ...final } : null))
    : null,
);

return results.filter(Boolean);
`;

writeFileSync('scripts/wf-compare.mjs', script);
console.log(`✓ wrote scripts/wf-compare.mjs for ${todo.length} matchups`);
