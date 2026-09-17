#!/usr/bin/env node
/**
 * Generates scripts/wf-tutorials.mjs — a Workflow that drafts the remaining how-to
 * tutorial bodies, then runs a CODE-REVIEW refine pass (correctness is the high-stakes
 * part). Run: node scripts/_gen-wf-tutorials.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { TUTORIALS } from './tutorials.data.mjs';

const BODIES = JSON.parse(readFileSync('scripts/tutorial-bodies.json', 'utf8'));
const todo = TUTORIALS.filter((t) => !BODIES[t.slug]).map((t) => ({ slug: t.slug, title: t.title, tool: t.tool, summary: t.summary, lead: t.lead }));

const exemplars = ['build-llm-eval-gate-ci', 'build-golden-set'].map((s) => {
  const b = { ...BODIES[s] }; delete b._verified;
  return `TUTORIAL: ${TUTORIALS.find((t) => t.slug === s).title}\n` + JSON.stringify(b, null, 2);
}).join('\n\n---\n\n');

const script = `export const meta = {
  name: 'tutorials-fanout',
  description: 'Draft + code-review refine of the remaining how-to tutorial bodies',
  phases: [{ title: 'Draft' }, { title: 'Code review' }],
};

const TUTORIALS = ${JSON.stringify(todo)};
const EXEMPLARS = ${JSON.stringify(exemplars)};

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    intro: { type: 'string' },
    prereqs: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { heading: { type: 'string' }, prose: { type: 'string' },
        code: { type: 'object', additionalProperties: false, properties: { file: { type: 'string' }, content: { type: 'string' } }, required: ['file', 'content'] } },
      required: ['heading', 'prose', 'code'] } },
    gotchas: { type: 'array', items: { type: 'string' } },
    result: { type: 'string' },
  },
  required: ['intro', 'prereqs', 'steps', 'gotchas', 'result'],
};

const VOICE = 'VOICE: simple, human, honest, a little dry. Short sentences. Concrete. No em dashes (use a period or comma). No "X, not Y" tic. No rule-of-three filler. No hype. Only <b> and <code> tags in prose, used sparingly.';

const CODE_RULES = [
  'CODE RULES (this brand is "no fake green" and cannot ship code that does not run):',
  '- Every code block must be CORRECT and RUNNABLE with the real, current API of the named tool. No invented functions, flags, or config keys.',
  '- Keep snippets minimal and focused: a config file, a short function, a CLI command, a CI yaml. Not a whole program.',
  '- Prefer widely-stable APIs. If an exact detail is uncertain, choose the simplest well-known form and keep it small rather than guessing an elaborate one.',
  '- A step that needs no code sets code to { "file": "", "content": "" }.',
  '- Put secrets in env vars / CI secrets, never inline.',
].join('\\n');

function draftPrompt(t) {
  return [
    'You are writing ONE hands-on tutorial for a public AI-engineering library by Jason Teixeira, a working AI + QA engineer. Readers are builders who want to actually ship this, not read theory.',
    '',
    'Tutorial: "' + t.title + '". Main tool: ' + t.tool + '. One-line goal: "' + t.lead + '". Summary: "' + t.summary + '".',
    '',
    'Return: intro (2-3 sentences: what they will build and roughly how long), prereqs (2-4 short items), steps (4 to 6, each with heading, prose of 2-4 sentences, and a code block where useful), gotchas (2-3 honest ones), result (2-3 sentences on what they built and the next step).',
    '',
    VOICE, '', CODE_RULES, '',
    'TWO GOLD-STANDARD examples of the exact structure, voice, code style, and honesty to match:', '', EXEMPLARS, '',
    'Return only the fields for "' + t.title + '".',
  ].join('\\n');
}

function refinePrompt(t, draft) {
  return [
    'You are a senior engineer reviewing this "' + t.title + '" tutorial before it ships. Two jobs.',
    '1) CODE REVIEW: check every code block against the real, current API of ' + t.tool + '. Fix anything that would not run: wrong flags, invented functions, bad syntax, missing steps. Simplify over-complex snippets. If a block is uncertain, make it smaller and safer. Confirm secrets use env vars.',
    '2) EDIT: enforce the house voice, remove EVERY em dash, kill any "X, not Y" tic or filler, tighten prose, keep only <b> and <code> tags in prose.',
    'Keep the structure. Do not add fluff. If it is already correct and clear, return it unchanged.',
    '',
    VOICE, '', CODE_RULES, '',
    'Draft (JSON):', JSON.stringify(draft), '',
    'Return the improved fields.',
  ].join('\\n');
}

const results = await pipeline(
  TUTORIALS,
  (t) => agent(draftPrompt(t), { label: 'draft:' + t.slug, phase: 'Draft', schema: SCHEMA, effort: 'low' }),
  (draft, t) => draft
    ? agent(refinePrompt(t, draft), { label: 'review:' + t.slug, phase: 'Code review', schema: SCHEMA, effort: 'medium' })
        .then((final) => (final ? { slug: t.slug, ...final } : null))
    : null,
);

return results.filter(Boolean);
`;

writeFileSync('scripts/wf-tutorials.mjs', script);
console.log(`✓ wrote scripts/wf-tutorials.mjs for ${todo.length} tutorials`);
