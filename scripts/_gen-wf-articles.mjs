#!/usr/bin/env node
/**
 * Generates scripts/wf-articles.mjs — a Workflow that drafts + refines the remaining
 * supporting-article bodies to the house voice, with real insight and no SEO filler.
 * Run: node scripts/_gen-wf-articles.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ARTICLES } from './articles.data.mjs';

const BODIES = JSON.parse(readFileSync('scripts/article-bodies.json', 'utf8'));
const todo = ARTICLES.filter((a) => !BODIES[a.slug]).map((a) => ({ slug: a.slug, title: a.title, lead: a.lead, summary: a.summary }));

const exemplars = ['llm-as-judge-explained', 'what-is-ai-workflow-automation'].map((s) => {
  const b = { ...BODIES[s] }; delete b._verified;
  return `ARTICLE: ${ARTICLES.find((a) => a.slug === s).title}\n` + JSON.stringify(b, null, 2);
}).join('\n\n---\n\n');

const script = `export const meta = {
  name: 'articles-fanout',
  description: 'Draft + refine the remaining supporting cluster articles to the house voice',
  phases: [{ title: 'Draft' }, { title: 'Refine' }],
};

const ARTICLES = ${JSON.stringify(todo)};
const EXEMPLARS = ${JSON.stringify(exemplars)};

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    intro: { type: 'string' },
    sections: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { heading: { type: 'string' }, body: { type: 'string' } }, required: ['heading', 'body'] } },
    keyTakeaway: { type: 'string' },
    closing: { type: 'string' },
  },
  required: ['intro', 'sections', 'keyTakeaway', 'closing'],
};

const VOICE = [
  'VOICE: simple, human, honest, a little dry, engineer to engineer. Short sentences beat long ones. Concrete beats abstract. Lead with the intuition, not the jargon.',
  'This brand is "no fake green": say the real tradeoff, admit what does not work, never hype. Real specific insight, NOT generic SEO filler that could appear on any blog.',
  'No em dashes (use a period or comma). No "X, not Y" tic. No rule-of-three filler. No filler openers ("In today\\'s world", "It\\'s important to note"). Only <b> and <code> tags, used sparingly.',
  'Length: ~600 to 850 words total. 3 to 4 sections. A section body may be 1 to 3 short paragraphs, separated by a blank line.',
].join('\\n');

function draftPrompt(a) {
  return [
    'You are writing ONE article for the Learn library of Jason Teixeira, a hands-on AI + QA engineer. Readers are builders and technical leads who want a straight, useful read, not marketing.',
    '',
    'Article title: "' + a.title + '". The angle / hook: "' + a.lead + '". One-line summary: "' + a.summary + '".',
    '',
    'Return: intro (2-4 sentences that frame the real problem and the take), sections (3 to 4, each with a heading and a body of 1 to 3 short paragraphs), keyTakeaway (1-2 sentences, the one thing to remember), closing (2-3 sentences of honest, decisive wrap-up).',
    'Make it genuinely useful and specific to THIS topic. Include a concrete example or a real distinction a reader could act on. Earn the read.',
    '',
    VOICE,
    '',
    'TWO GOLD-STANDARD examples of the exact voice, depth, and structure to match:', '', EXEMPLARS, '',
    'Return only the fields for "' + a.title + '".',
  ].join('\\n');
}

function refinePrompt(a, draft) {
  return [
    'You are the editor for this "' + a.title + '" article. Sharpen it for readability and real insight WITHOUT padding.',
    'Enforce the house voice: remove EVERY em dash, kill any "X, not Y" tic or rule-of-three filler, cut filler openers and hedging, shorten long sentences, keep only <b> and <code> tags.',
    'Cut anything generic that could appear on any blog. Keep the concrete, specific, honest parts. If a section is vague, make it sharper or shorter. If it is already excellent, return it unchanged.',
    '',
    VOICE, '', 'Draft (JSON):', JSON.stringify(draft), '', 'Return the improved fields.',
  ].join('\\n');
}

const results = await pipeline(
  ARTICLES,
  (a) => agent(draftPrompt(a), { label: 'draft:' + a.slug, phase: 'Draft', schema: SCHEMA, effort: 'low' }),
  (draft, a) => draft
    ? agent(refinePrompt(a, draft), { label: 'refine:' + a.slug, phase: 'Refine', schema: SCHEMA, effort: 'low' })
        .then((final) => (final ? { slug: a.slug, ...final } : null))
    : null,
);

return results.filter(Boolean);
`;

writeFileSync('scripts/wf-articles.mjs', script);
console.log(`✓ wrote scripts/wf-articles.mjs for ${todo.length} articles`);
