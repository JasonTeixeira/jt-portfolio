#!/usr/bin/env node
/**
 * Generates scripts/wf-glossary.mjs — a Workflow script with the remaining
 * body-less glossary terms + the 3 gold-standard exemplars embedded, so the
 * fan-out drafts them to the house voice. Run: node scripts/_gen-wf-glossary.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CATS, TERMS } from './glossary.data.mjs';

const BODIES = JSON.parse(readFileSync('scripts/glossary-bodies.json', 'utf8'));
const todo = TERMS.filter((t) => !BODIES[t.slug]).map((t) => {
  const cat = CATS[t.cat];
  const sibs = TERMS.filter((x) => x.cat === t.cat && x.slug !== t.slug).map((x) => x.term).slice(0, 6);
  return { slug: t.slug, term: t.term, aka: t.aka || '', catLabel: cat.label, gloss: t.gloss, cornerstone: cat.cornerstone.t, siblings: sibs };
});

const exemplars = ['golden-set', 'hallucination', 'faithfulness'].map((s) => {
  const b = BODIES[s]; const t = TERMS.find((x) => x.slug === s);
  return `TERM: ${t.term}\ndefinition: ${b.definition}\nwhy: ${b.why}\nhow: ${b.how}\nexample: ${b.example}`;
}).join('\n\n---\n\n');

const script = `export const meta = {
  name: 'glossary-fanout',
  description: 'Draft + refine the remaining AI glossary term bodies to the house voice',
  phases: [{ title: 'Draft' }, { title: 'Refine' }],
};

const TERMS = ${JSON.stringify(todo)};
const EXEMPLARS = ${JSON.stringify(exemplars)};

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    definition: { type: 'string' }, why: { type: 'string' }, how: { type: 'string' }, example: { type: 'string' },
  },
  required: ['definition', 'why', 'how', 'example'],
};

const VOICE = [
  'VOICE RULES (strict house style):',
  '- Simple and human: explain it like to a smart friend over coffee. Short sentences win.',
  '- Interesting: lead with the intuition, not the jargon. Dry honesty is good.',
  '- Concrete over abstract: prefer a real example to a general statement.',
  '- Do NOT use em dashes. Use a period, comma, or colon. At most one per entry if truly unavoidable.',
  '- Do NOT use the "X, not Y" contrast construction as a tic, and do NOT use rule-of-three lists as filler.',
  '- No filler openers ("In today\\'s world", "It\\'s important to note", "Simply put"). No hype, no hedging.',
  '- Only <b>...</b> tags for emphasis (0-2 per field). No links, no other HTML, no markdown.',
  '- ~250-350 words total across the four fields. Tight beats padded.',
].join('\\n');

function draftPrompt(t) {
  return [
    'You are writing ONE entry for a public AI-engineering glossary by Jason Teixeira, a hands-on AI + QA engineer whose whole brand is honest, proof-first, "no fake green". Readers are smart builders who may be new to this specific term.',
    '',
    'Write the entry for the term "' + t.term + '"' + (t.aka ? ' (also called ' + t.aka + ')' : '') + '. It belongs to the "' + t.catLabel + '" family. One-line summary for reference: "' + t.gloss + '".',
    'Sibling terms in the same family (you may mention them by name in plain text, but do NOT add links): ' + (t.siblings.join(', ') || 'none') + '.',
    '',
    'Return four short fields:',
    '- definition: 2-3 sentences. What it is, in the plainest words, then the one thing that makes it matter or trips people up.',
    '- why: 2-4 sentences on why a builder should care. What goes wrong without it? Concrete.',
    '- how: 2-4 sentences on how it works or how it is measured in practice. Specific, not hand-wavy.',
    '- example: 2-3 sentences. ONE vivid mini-scenario a reader can picture (a support bot, a refund policy, a code generator, a doc Q&A). Show the term in action.',
    '',
    VOICE,
    '',
    'THREE GOLD-STANDARD examples of the exact voice, structure, and length to match:',
    '',
    EXEMPLARS,
    '',
    'Return only the four fields for "' + t.term + '".',
  ].join('\\n');
}

function refinePrompt(t, draft) {
  return [
    'You are the editor for the glossary described below. Tighten this draft entry for "' + t.term + '" for maximum readability and human appeal, WITHOUT padding or changing the meaning.',
    'Enforce the house style: remove EVERY em dash and rewrite around it; kill any "X, not Y" tic or rule-of-three filler; cut filler openers and hedging; shorten long sentences; keep only <b> tags; keep it honest and concrete. If a field is already excellent, return it unchanged.',
    '',
    VOICE,
    '',
    'Draft (JSON):',
    JSON.stringify(draft),
    '',
    'Return the four improved fields.',
  ].join('\\n');
}

const results = await pipeline(
  TERMS,
  (t) => agent(draftPrompt(t), { label: 'draft:' + t.slug, phase: 'Draft', schema: SCHEMA, effort: 'low' }),
  (draft, t) => draft
    ? agent(refinePrompt(t, draft), { label: 'refine:' + t.slug, phase: 'Refine', schema: SCHEMA, effort: 'low' })
        .then((final) => (final ? { slug: t.slug, ...final } : null))
    : null,
);

return results.filter(Boolean);
`;

writeFileSync('scripts/wf-glossary.mjs', script);
console.log(`✓ wrote scripts/wf-glossary.mjs for ${todo.length} terms`);
