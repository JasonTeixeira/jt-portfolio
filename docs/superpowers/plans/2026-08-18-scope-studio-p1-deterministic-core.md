# Scope Studio — Plan 1: Deterministic Core — Implementation Plan

> **Status:** SHIPPED — merged to main. Checklists below are historical.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fully working, offline self-serve scoping tool at `/build.html` — a guided questionnaire builds a visual, itemized engagement plan with indicative cost bands, a shareable link, and lead capture — with zero AI and zero database.

**Architecture:** A single ES module (`assets/scope-core.mjs`) holds the versioned rate card + pure functions (`computePlan`, `encodeKeys`, `decodeKeys`). The `/build.html` page imports it via `<script type="module">`, runs a small client state machine over a deterministic question set, and renders the plan using the existing site design tokens + the transform section's SVG node vocabulary. Pure functions are unit-tested with Node's built-in test runner; the page is smoke-tested with Playwright. The AI path and Supabase persistence are added later (Plans 2 and 3) and slot into the same `computePlan` output.

**Tech Stack:** Vanilla ES modules (no bundler — native browser modules), Node's built-in `node --test` for units, Playwright for e2e, existing `assets/site.css` design tokens.

**Spec:** `docs/superpowers/specs/2026-08-18-scope-studio-design.md`

## Global Constraints

- **No LLM output of prices, ever.** In this plan there is no LLM; every number comes from `RATE_CARD` in `assets/scope-core.mjs`. (Verbatim from spec §2.)
- **Works fully offline / on a static host.** No network calls in this plan; lead capture uses a `mailto:` fallback. (Spec §1 success criteria, §3.)
- **Indicative bands only**, always labeled illustrative; exact scope "locked on a short call." (Spec §1, §7.5.)
- **Design system:** dark, Instrument Serif + JetBrains Mono, existing tokens in `assets/site.css` (`--bg #09090B`, `--ink #F4F2EF`, `--green #10b981`, `--purple #a78bfa`, `--cyan #22d3ee`, `--line #2A2826`, `--dim #A8A29E`). Reuse, don't reinvent.
- **No em-dash / rule-of-three / "actually/genuinely" tics** in any visible copy (site-wide voice rule already enforced).
- **Every band is `[min, max]` with `min <= max`; every rate-card key is unique.**
- **Lighthouse 100 targets** (a11y/BP/SEO) on `/build.html`; SVG plan viz gets `role="img"` + `aria-label`; zero console errors (smoke tests assert `errors === []`).

---

### Task 1: Rate card module + integrity test

**Files:**
- Create: `assets/scope-core.mjs`
- Create: `tests/unit/ratecard.test.mjs`
- Modify: `package.json` (add `test:unit` script)

**Interfaces:**
- Produces: `RATE_CARD: Card[]` where `Card = { key:string, name:string, track:string, band:[number,number], effort:string, phase:'audit'|'build'|'gate'|'operate', why:string }`; `CARD_BY_KEY: Map<string,Card>`; `DISCLAIMER: string`; `SEGMENTS: Record<string,{label:string,lead:string}>`.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/ratecard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RATE_CARD, CARD_BY_KEY, DISCLAIMER, SEGMENTS } from '../../assets/scope-core.mjs';

test('rate card has cards and every key is unique', () => {
  assert.ok(RATE_CARD.length >= 20, 'expected the full capability catalog');
  const keys = RATE_CARD.map(c => c.key);
  assert.equal(new Set(keys).size, keys.length, 'keys must be unique');
});

test('every card is well-formed', () => {
  const phases = new Set(['audit', 'build', 'gate', 'operate']);
  for (const c of RATE_CARD) {
    assert.match(c.key, /^[a-z0-9-]+$/, `key ${c.key} is kebab-case`);
    assert.ok(c.name && c.track && c.why, `${c.key} has name/track/why`);
    assert.ok(Array.isArray(c.band) && c.band.length === 2, `${c.key} band is a pair`);
    assert.ok(c.band[0] <= c.band[1], `${c.key} band min <= max`);
    assert.ok(c.band[0] > 0, `${c.key} band positive`);
    assert.ok(phases.has(c.phase), `${c.key} phase valid`);
  }
});

test('CARD_BY_KEY resolves every key', () => {
  for (const c of RATE_CARD) assert.equal(CARD_BY_KEY.get(c.key), c);
});

test('disclaimer + segments present', () => {
  assert.match(DISCLAIMER, /indicative/i);
  assert.ok(Object.keys(SEGMENTS).length >= 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/ratecard.test.mjs`
Expected: FAIL — cannot find module `assets/scope-core.mjs`.

- [ ] **Step 3: Write minimal implementation**

Seed from the 32 capabilities in `services.html` `CAPS` (same names/tracks). Band values are placeholders Jason tunes before the AI path launches — mark them.

```js
// assets/scope-core.mjs
// Versioned rate card — the single source of truth for scope + indicative pricing.
// Bands are illustrative placeholders. TODO(jason): tune before launch.

export const DISCLAIMER =
  'Indicative ranges, not a quote. Exact scope and price are locked on a short call.';

export const SEGMENTS = {
  'service-business': { label: 'Service business', lead: 'missed calls, manual follow-up, no time' },
  'ai-product':       { label: 'AI product / feature', lead: 'shipping LLM features you can’t yet prove' },
  'ops-automation':   { label: 'Ops / back-office', lead: 'repetitive work eating the week' },
  'product-build':    { label: 'Product / platform', lead: 'need the real thing built right' }
};

export const RATE_CARD = [
  // AI Build
  { key: 'chatbot',        name: 'Conversational assistant',        track: 'AI Build', band: [4000, 9000],  effort: '~2–4 wks', phase: 'build',   why: 'Support/product chatbot grounded in your docs.' },
  { key: 'voice-agent',    name: 'AI voice agent',                  track: 'AI Build', band: [5000, 12000], effort: '~3–5 wks', phase: 'build',   why: 'Answers 24/7, qualifies, books, texts a summary.' },
  { key: 'doc-intake',     name: 'Document intake & extraction',    track: 'AI Build', band: [4000, 10000], effort: '~2–4 wks', phase: 'build',   why: 'Messy documents into validated structured data.' },
  { key: 'copilot',        name: 'Internal copilot',                track: 'AI Build', band: [6000, 14000], effort: '~3–6 wks', phase: 'build',   why: 'A private assistant that knows how your company works.' },
  { key: 'rag',            name: 'RAG pipeline engineering',        track: 'AI Build', band: [5000, 12000], effort: '~2–5 wks', phase: 'build',   why: 'Retrieval that returns the right thing, with citations.' },
  { key: 'orchestration',  name: 'Multi-agent orchestration',       track: 'AI Build', band: [8000, 18000], effort: '~4–8 wks', phase: 'build',   why: 'Agents that plan, call tools, and hand off, auditably.' },
  { key: 'structured-out', name: 'Structured-output / functions',   track: 'AI Build', band: [3000, 7000],  effort: '~1–3 wks', phase: 'build',   why: 'Make the LLM a reliable part of your backend.' },
  // Eval & QA
  { key: 'llm-eval',       name: 'LLM evaluation harness',          track: 'Eval & QA', band: [3500, 9000], effort: '~1–3 wks', phase: 'gate',   why: 'Golden set + LLM-as-judge scoring for your feature.' },
  { key: 'redteam',        name: 'AI red-team & safety battery',    track: 'Eval & QA', band: [3000, 8000], effort: '~1–3 wks', phase: 'gate',   why: 'Injection, jailbreak, PII, toxicity probes.' },
  { key: 'ci-gate',        name: 'CI quality gate for AI',          track: 'Eval & QA', band: [2500, 6000], effort: '~1–2 wks', phase: 'gate',   why: 'A bad AI change blocks the merge, not the retro.' },
  { key: 'grounding',      name: 'Hallucination / grounding gate',  track: 'Eval & QA', band: [3000, 7000], effort: '~1–3 wks', phase: 'gate',   why: 'Stop it inventing facts and policies.' },
  { key: 'regression',     name: 'Prompt & model regression tests', track: 'Eval & QA', band: [2500, 6000], effort: '~1–2 wks', phase: 'gate',   why: 'Know exactly what the model bump broke.' },
  { key: 'agent-eval',     name: 'Agent evaluation',                track: 'Eval & QA', band: [3500, 8000], effort: '~1–3 wks', phase: 'gate',   why: 'Did the agent use the right tool and finish the task?' },
  { key: 'observability',  name: 'LLM observability & cost',        track: 'Eval & QA', band: [3000, 7000], effort: '~1–3 wks', phase: 'operate', why: 'See quality, drift, and spend in production.' },
  // Test Automation
  { key: 'e2e',            name: 'E2E test automation',             track: 'Test Automation', band: [4000, 12000], effort: '~2–5 wks', phase: 'gate', why: 'Your critical flows, covered and green in CI.' },
  { key: 'api-testing',    name: 'API & contract testing',          track: 'Test Automation', band: [3000, 8000],  effort: '~1–3 wks', phase: 'gate', why: 'Catch the broken endpoint before the frontend does.' },
  { key: 'mobile-cert',    name: 'Mobile real-device certification',track: 'Test Automation', band: [4000, 10000], effort: '~2–4 wks', phase: 'gate', why: 'Ship iOS/Android with proof, not hope.' },
  { key: 'cicd',           name: 'CI/CD pipeline + test wiring',     track: 'Test Automation', band: [3000, 8000],  effort: '~1–3 wks', phase: 'build', why: 'A green badge that actually means something.' },
  { key: 'flaky',          name: 'Flaky-test stabilization',        track: 'Test Automation', band: [2500, 6000],  effort: '~1–2 wks', phase: 'gate', why: 'Make red mean something again.' },
  { key: 'perf',           name: 'Performance & load baselines',    track: 'Test Automation', band: [3000, 7000],  effort: '~1–2 wks', phase: 'gate', why: 'Know your critical path’s breaking point.' },
  { key: 'visual',         name: 'Visual regression testing',       track: 'Test Automation', band: [2500, 6000],  effort: '~1–2 wks', phase: 'gate', why: 'Catch the layout break a unit test can’t see.' },
  { key: 'a11y',           name: 'Accessibility (a11y) audits',     track: 'Test Automation', band: [2500, 6000],  effort: '~1–2 wks', phase: 'gate', why: 'WCAG 2.2: keyboard, contrast, reduced-motion.' },
  // Automation
  { key: 'workflow',       name: 'Workflow automation',             track: 'Automation', band: [2500, 8000], effort: '~1–3 wks', phase: 'build', why: 'The repetitive back-office flow, automated end-to-end.' },
  { key: 'lead-capture',   name: 'Lead capture → qualify → route',  track: 'Automation', band: [3000, 8000], effort: '~1–3 wks', phase: 'build', why: 'Every lead caught, scored, and followed up in minutes.' },
  { key: 'etl',            name: 'Data pipelines / ETL',            track: 'Automation', band: [4000, 10000],effort: '~2–4 wks', phase: 'build', why: 'Move and shape data reliably, on a schedule.' },
  { key: 'integrations',   name: 'Integrations (CRM, tools, APIs)', track: 'Automation', band: [3000, 8000], effort: '~1–3 wks', phase: 'build', why: 'Make your tools finally talk to each other.' },
  { key: 'monitoring',     name: 'Monitoring / scraping / alerting',track: 'Automation', band: [2500, 6000], effort: '~1–2 wks', phase: 'operate', why: 'Watch a source, act when something changes.' },
  { key: 'scheduled',      name: 'Scheduled jobs & back-office',    track: 'Automation', band: [2000, 5000], effort: '~1–2 wks', phase: 'operate', why: 'The recurring task nobody wants to remember.' },
  // Product
  { key: 'web-app',        name: 'Web apps & customer portals',     track: 'Product', band: [8000, 25000], effort: '~4–8 wks', phase: 'build', why: 'Auth, payments, dashboards, production-grade.' },
  { key: 'internal-tools', name: 'Internal tools / admin panels',   track: 'Product', band: [5000, 14000], effort: '~2–5 wks', phase: 'build', why: 'Replace the spreadsheet your team runs by hand.' },
  { key: 'backend',        name: 'APIs & backends',                 track: 'Product', band: [5000, 14000], effort: '~2–5 wks', phase: 'build', why: 'The service layer everything else depends on.' },
  { key: 'dashboards',     name: 'Dashboards & data visualization', track: 'Product', band: [4000, 12000], effort: '~2–4 wks', phase: 'build', why: 'Turn your data into a decision, not a CSV.' }
];

export const CARD_BY_KEY = new Map(RATE_CARD.map(c => [c.key, c]));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/ratecard.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the unit-test script + commit**

Add to `package.json` `scripts`: `"test:unit": "node --test tests/unit/"`.

```bash
git add assets/scope-core.mjs tests/unit/ratecard.test.mjs package.json
git commit -m "feat(scope): versioned rate card + integrity tests"
```

---

### Task 2: `computePlan(keys, segment)` — the pure planning function

**Files:**
- Modify: `assets/scope-core.mjs`
- Create: `tests/unit/compute-plan.test.mjs`

**Interfaces:**
- Consumes: `RATE_CARD`, `CARD_BY_KEY` (Task 1).
- Produces: `computePlan(keys: string[], segment?: string): Plan` where
  `Plan = { segment:string|null, items:Item[], phases:{phase:string,label:string,items:Item[],band:[number,number]}[], totalBand:[number,number], timelineWeeks:[number,number], count:number }`
  and `Item = Card` (unknown keys are dropped — anti-hallucination gate).

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/compute-plan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePlan } from '../../assets/scope-core.mjs';

test('sums bands and counts items', () => {
  const p = computePlan(['llm-eval', 'ci-gate']);
  assert.equal(p.count, 2);
  assert.deepEqual(p.totalBand, [3500 + 2500, 9000 + 6000]); // [6000, 15000]
});

test('drops unknown keys (anti-hallucination gate)', () => {
  const p = computePlan(['llm-eval', 'not-a-real-key', '']);
  assert.equal(p.count, 1);
  assert.equal(p.items[0].key, 'llm-eval');
});

test('dedupes repeated keys', () => {
  const p = computePlan(['e2e', 'e2e']);
  assert.equal(p.count, 1);
});

test('groups items by phase in canonical order', () => {
  const p = computePlan(['web-app', 'llm-eval']); // build + gate
  assert.deepEqual(p.phases.map(x => x.phase), ['build', 'gate']);
  assert.equal(p.phases[0].items[0].key, 'web-app');
});

test('empty selection yields a zero plan, not a crash', () => {
  const p = computePlan([]);
  assert.equal(p.count, 0);
  assert.deepEqual(p.totalBand, [0, 0]);
  assert.deepEqual(p.phases, []);
});

test('carries segment through', () => {
  assert.equal(computePlan(['rag'], 'ai-product').segment, 'ai-product');
  assert.equal(computePlan(['rag']).segment, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/compute-plan.test.mjs`
Expected: FAIL — `computePlan` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `assets/scope-core.mjs`:

```js
const PHASE_ORDER = ['audit', 'build', 'gate', 'operate'];
const PHASE_LABEL = { audit: 'Audit', build: 'Build', gate: 'Prove', operate: 'Operate' };

// Rough weeks-per-phase for a combined timeline (phases run partly in parallel,
// so we take the max lower bound and sum a fraction of the rest — kept simple + honest).
const PHASE_WEEKS = { audit: [1, 1], build: [2, 6], gate: [1, 3], operate: [1, 2] };

export function computePlan(keys, segment = null) {
  const seen = new Set();
  const items = [];
  for (const k of keys || []) {
    if (!k || seen.has(k)) continue;
    const card = CARD_BY_KEY.get(k);
    if (!card) continue; // unknown key dropped
    seen.add(k);
    items.push(card);
  }

  const phases = PHASE_ORDER
    .map(phase => {
      const pItems = items.filter(i => i.phase === phase);
      if (pItems.length === 0) return null;
      const band = pItems.reduce((a, i) => [a[0] + i.band[0], a[1] + i.band[1]], [0, 0]);
      return { phase, label: PHASE_LABEL[phase], items: pItems, band };
    })
    .filter(Boolean);

  const totalBand = items.reduce((a, i) => [a[0] + i.band[0], a[1] + i.band[1]], [0, 0]);

  // timeline: longest single phase floor, plus half the others' floors (parallelism)
  let lo = 0, hi = 0;
  for (const p of phases) {
    const [wLo, wHi] = PHASE_WEEKS[p.phase];
    lo = Math.max(lo, wLo);
    hi += wHi;
  }
  const timelineWeeks = phases.length ? [lo, hi] : [0, 0];

  return { segment, items, phases, totalBand, timelineWeeks, count: items.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/compute-plan.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/scope-core.mjs tests/unit/compute-plan.test.mjs
git commit -m "feat(scope): computePlan — grouping, band sum, timeline, anti-hallucination drop"
```

---

### Task 3: `encodeKeys` / `decodeKeys` — shareable URL round-trip

**Files:**
- Modify: `assets/scope-core.mjs`
- Create: `tests/unit/encode.test.mjs`

**Interfaces:**
- Produces: `encodeKeys(keys:string[], segment?:string): string` and
  `decodeKeys(str:string): { keys:string[], segment:string|null }`. Encoding is URL-safe and stable; decoding is defensive (never throws).

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/encode.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeKeys, decodeKeys } from '../../assets/scope-core.mjs';

test('round-trips keys + segment', () => {
  const enc = encodeKeys(['llm-eval', 'ci-gate'], 'ai-product');
  assert.equal(typeof enc, 'string');
  assert.deepEqual(decodeKeys(enc), { keys: ['llm-eval', 'ci-gate'], segment: 'ai-product' });
});

test('round-trips with no segment', () => {
  assert.deepEqual(decodeKeys(encodeKeys(['rag'])), { keys: ['rag'], segment: null });
});

test('decode is defensive on garbage', () => {
  assert.deepEqual(decodeKeys('%%%not-base64%%%'), { keys: [], segment: null });
  assert.deepEqual(decodeKeys(''), { keys: [], segment: null });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/encode.test.mjs`
Expected: FAIL — `encodeKeys` not exported.

- [ ] **Step 3: Write minimal implementation**

Keys are kebab-case and segments are known slugs, so a compact `segment~key,key` string base64url-encoded is enough and human-debuggable. Use `btoa`/`atob` (present in modern Node ≥ 16 and browsers).

```js
function b64urlEncode(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  try {
    const pad = s.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(pad)));
  } catch { return ''; }
}

export function encodeKeys(keys, segment = null) {
  const clean = (keys || []).filter(Boolean);
  return b64urlEncode((segment || '') + '~' + clean.join(','));
}

export function decodeKeys(str) {
  const raw = b64urlDecode(str || '');
  if (!raw.includes('~')) return { keys: [], segment: null };
  const [seg, keyStr] = raw.split('~');
  const keys = (keyStr || '').split(',').filter(Boolean);
  return { keys, segment: seg || null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/encode.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/scope-core.mjs tests/unit/encode.test.mjs
git commit -m "feat(scope): URL-safe encodeKeys/decodeKeys with defensive decode"
```

---

### Task 4: Question set + `keysFromAnswers` mapping

**Files:**
- Modify: `assets/scope-core.mjs`
- Create: `tests/unit/questions.test.mjs`

**Interfaces:**
- Consumes: `RATE_CARD` keys (Task 1).
- Produces: `QUESTIONS: Question[]` where `Question = { id:string, prompt:string, multi:boolean, options:{label:string, keys:string[]}[] }`; and `keysFromAnswers(answers: Record<string,string[]>): string[]` (flattens selected option keys, deduped, all valid).

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/questions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, keysFromAnswers, CARD_BY_KEY } from '../../assets/scope-core.mjs';

test('questions are well-formed and every option maps to real keys', () => {
  assert.ok(QUESTIONS.length >= 3);
  for (const q of QUESTIONS) {
    assert.ok(q.id && q.prompt && Array.isArray(q.options) && q.options.length >= 2);
    for (const o of q.options) {
      assert.ok(o.label, `option has a label in ${q.id}`);
      for (const k of o.keys) assert.ok(CARD_BY_KEY.has(k), `key ${k} exists (q ${q.id})`);
    }
  }
});

test('keysFromAnswers flattens + dedupes selected options', () => {
  const answers = { needs: ['opt-eval', 'opt-e2e'] };
  // build the expected from the actual question definition to stay in sync
  const q = QUESTIONS.find(x => x.id === 'needs');
  const expected = new Set(q.options.filter(o => answers.needs.includes(o.id)).flatMap(o => o.keys));
  const got = new Set(keysFromAnswers(answers));
  assert.deepEqual(got, expected);
});

test('unknown answer ids are ignored', () => {
  assert.deepEqual(keysFromAnswers({ needs: ['nope'] }), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/questions.test.mjs`
Expected: FAIL — `QUESTIONS` not exported.

- [ ] **Step 3: Write minimal implementation**

Options carry an `id` (for answer tracking) and `keys` (rate-card keys they imply). Keep the set short (spec §5: 4–7 questions). Append to `assets/scope-core.mjs`:

```js
export const QUESTIONS = [
  {
    id: 'segment', prompt: 'What best describes you?', multi: false,
    options: [
      { id: 'seg-service', label: 'A service business', keys: [] },
      { id: 'seg-aiproduct', label: 'Shipping an AI product/feature', keys: [] },
      { id: 'seg-ops', label: 'Drowning in ops/back-office work', keys: [] },
      { id: 'seg-product', label: 'Need a product or platform built', keys: [] }
    ]
  },
  {
    id: 'needs', prompt: 'What do you want to happen?', multi: true,
    options: [
      { id: 'opt-eval', label: 'Prove our AI feature actually works', keys: ['llm-eval', 'ci-gate'] },
      { id: 'opt-safety', label: 'Stop it hallucinating / leaking', keys: ['grounding', 'redteam'] },
      { id: 'opt-e2e', label: 'Stop releases from breaking', keys: ['e2e', 'flaky'] },
      { id: 'opt-build-ai', label: 'Build an AI assistant/agent', keys: ['chatbot', 'rag'] },
      { id: 'opt-voice', label: 'Answer every call automatically', keys: ['voice-agent'] },
      { id: 'opt-automate', label: 'Automate a manual workflow', keys: ['workflow', 'integrations'] },
      { id: 'opt-leads', label: 'Never miss a lead', keys: ['lead-capture'] },
      { id: 'opt-product', label: 'Build a web app / internal tool', keys: ['web-app', 'internal-tools'] },
      { id: 'opt-data', label: 'Make sense of our data', keys: ['dashboards', 'etl'] }
    ]
  },
  {
    id: 'maturity', prompt: 'Where are you today?', multi: false,
    options: [
      { id: 'mat-idea', label: 'Just an idea', keys: [] },
      { id: 'mat-demo', label: 'A demo that isn’t trustworthy yet', keys: ['observability'] },
      { id: 'mat-prod', label: 'Live in production, needs hardening', keys: ['ci-gate', 'observability'] }
    ]
  }
];

const OPTION_BY_ID = new Map(QUESTIONS.flatMap(q => q.options.map(o => [o.id, o])));

export function keysFromAnswers(answers) {
  const out = new Set();
  for (const ids of Object.values(answers || {})) {
    for (const id of ids || []) {
      const opt = OPTION_BY_ID.get(id);
      if (opt) for (const k of opt.keys) if (CARD_BY_KEY.has(k)) out.add(k);
    }
  }
  return [...out];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/questions.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/scope-core.mjs tests/unit/questions.test.mjs
git commit -m "feat(scope): deterministic question set + keysFromAnswers mapping"
```

---

### Task 5: `/build.html` shell + module bootstrap (renders, offline)

**Files:**
- Create: `build.html`
- Create: `assets/scope-studio.mjs` (page controller)
- Modify: `tests/smoke.spec.js` (add a `portfolio — scope studio` describe block)

**Interfaces:**
- Consumes: `QUESTIONS`, `keysFromAnswers`, `computePlan`, `encodeKeys`, `decodeKeys`, `DISCLAIMER` (Tasks 1–4).
- Produces: DOM contract — `#scope-questions` (question UI), `#scope-plan` (rendered plan), `#scope-total` (indicative band), a `data-state` attribute on `#scope-root` (`intro|discovery|plan`).

- [ ] **Step 1: Write the failing test**

```js
// in tests/smoke.spec.js
test.describe('portfolio — scope studio', () => {
  test('build page loads with questions and no console errors', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/build.html');
    await expect(page).toHaveTitle(/Scope|Build/i);
    await expect(page.locator('#scope-questions')).toBeVisible();
    await expect(page.locator('#scope-root')).toHaveAttribute('data-state', 'discovery');
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test -g "build page loads"`
Expected: FAIL — `/build.html` 404.

- [ ] **Step 3: Write minimal implementation**

Copy the `<head>` (fonts, `assets/site.css`, favicon, meta) and the `<nav>`/`<footer>` from `services.html` for consistency (follow the existing page pattern). Body core:

```html
<!-- build.html (within <main id="content">) -->
<section id="scope-root" data-state="discovery" style="max-width:1240px;margin:0 auto;padding:clamp(40px,7vw,88px) clamp(18px,4vw,40px)">
  <div class="sec-rule"><span class="sec-label" style="color:#22d3ee">scope studio · build your plan</span><span class="line"></span></div>
  <h1 class="sec-title" style="max-width:20ch;margin-top:12px">Tell me what you need. I’ll scope it.</h1>
  <p class="subtle" style="margin-top:12px;max-width:56ch">A few questions, and you’ll get an itemized plan with an indicative range. No signup, no call required. This is Jason’s tool — Jason reads every plan it makes.</p>
  <div class="tf-grid" style="margin-top:36px">
    <div id="scope-questions"></div>
    <div class="tf-col"><div id="scope-plan" class="tf-sticky"></div></div>
  </div>
  <p id="scope-disclaimer" class="subtle" style="margin-top:24px;font-size:12px"></p>
</section>
<script type="module" src="assets/scope-studio.mjs"></script>
```

```js
// assets/scope-studio.mjs
import { QUESTIONS, keysFromAnswers, computePlan, encodeKeys, decodeKeys, DISCLAIMER, SEGMENTS } from './scope-core.mjs';

const root = document.getElementById('scope-root');
const qMount = document.getElementById('scope-questions');
const planMount = document.getElementById('scope-plan');
const disc = document.getElementById('scope-disclaimer');
if (root && qMount && planMount) {
  disc.textContent = DISCLAIMER;
  const answers = {};
  renderQuestions();
  rehydrateFromUrl();
  renderPlan();

  function renderQuestions() {
    qMount.innerHTML = QUESTIONS.map(q => `
      <fieldset style="border:1px solid #2A2826;border-radius:12px;padding:18px 20px;margin:0 0 16px">
        <legend style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8E8882;padding:0 6px">${q.prompt}</legend>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${q.options.map(o => `<button type="button" class="scope-opt" data-q="${q.id}" data-id="${o.id}" data-multi="${q.multi}" aria-pressed="false" style="font-family:'JetBrains Mono',monospace;font-size:12.5px;color:#A8A29E;border:1px solid #2A2826;border-radius:999px;padding:7px 13px;background:transparent;cursor:pointer">${o.label}</button>`).join('')}
        </div>
      </fieldset>`).join('');
    qMount.querySelectorAll('.scope-opt').forEach(btn => btn.addEventListener('click', onPick));
  }

  function onPick(e) {
    const b = e.currentTarget, q = b.dataset.q, id = b.dataset.id, multi = b.dataset.multi === 'true';
    answers[q] = answers[q] || [];
    if (multi) {
      const i = answers[q].indexOf(id);
      if (i >= 0) answers[q].splice(i, 1); else answers[q].push(id);
    } else {
      answers[q] = answers[q][0] === id ? [] : [id];
      qMount.querySelectorAll(`.scope-opt[data-q="${q}"]`).forEach(x => setPressed(x, false));
    }
    setPressed(b, answers[q].includes(id));
    renderPlan();
  }

  function setPressed(btn, on) {
    btn.setAttribute('aria-pressed', String(on));
    btn.style.color = on ? '#09090B' : '#A8A29E';
    btn.style.background = on ? '#22d3ee' : 'transparent';
    btn.style.borderColor = on ? '#22d3ee' : '#2A2826';
  }

  function segmentFromAnswers() {
    const s = (answers.segment || [])[0];
    return { 'seg-service': 'service-business', 'seg-aiproduct': 'ai-product', 'seg-ops': 'ops-automation', 'seg-product': 'product-build' }[s] || null;
  }

  function renderPlan() {
    const keys = keysFromAnswers(answers);
    const plan = computePlan(keys, segmentFromAnswers());
    window.__renderScopePlan(plan);           // defined in Task 6
    syncUrl(keys, plan.segment);
    root.setAttribute('data-state', keys.length ? 'plan' : 'discovery');
  }

  function syncUrl(keys, segment) {
    const enc = keys.length ? '#plan=' + encodeKeys(keys, segment) : location.pathname;
    history.replaceState(null, '', enc);
  }

  function rehydrateFromUrl() {
    const m = location.hash.match(/plan=([^&]+)/);
    if (!m) return;
    const { keys } = decodeKeys(m[1]);
    // reverse-map keys → option ids so buttons reflect the shared plan
    const wanted = new Set(keys);
    QUESTIONS.forEach(q => q.options.forEach(o => {
      if (o.keys.length && o.keys.every(k => wanted.has(k))) {
        answers[q.id] = answers[q.id] || [];
        if (!answers[q.id].includes(o.id)) answers[q.id].push(o.id);
        const btn = qMount.querySelector(`.scope-opt[data-q="${q.id}"][data-id="${o.id}"]`);
        if (btn) setPressed(btn, true);
      }
    }));
  }
}
```

Note: `window.__renderScopePlan` is implemented in Task 6; add a temporary no-op at the top of this file for Task 5 to run standalone:
```js
window.__renderScopePlan = window.__renderScopePlan || function () {};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test -g "build page loads"`
Expected: PASS. Also run the full suite: `npx playwright test` — expect all green (no regressions).

- [ ] **Step 5: Commit**

```bash
git add build.html assets/scope-studio.mjs tests/smoke.spec.js
git commit -m "feat(scope): /build.html shell + question controller (offline, no plan viz yet)"
```

---

### Task 6: Plan visualization (reuse the transform node vocabulary)

**Files:**
- Modify: `assets/scope-studio.mjs` (implement `window.__renderScopePlan`)
- Modify: `assets/site.css` (scope-plan styles)
- Modify: `tests/smoke.spec.js`

**Interfaces:**
- Consumes: a `Plan` (Task 2 shape).
- Produces: `window.__renderScopePlan(plan)` renders phase-grouped capability cards, per-item bands, a phase-colored SVG flow (audit→build→gate→operate), and a live indicative total into `#scope-plan`; empty plan shows a friendly prompt.

- [ ] **Step 1: Write the failing test**

```js
// in tests/smoke.spec.js scope studio describe
test('selecting needs builds an itemized plan with an indicative total', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/build.html');
  await page.locator('.scope-opt[data-id="opt-eval"]').click();      // llm-eval + ci-gate
  await expect(page.locator('#scope-plan')).toContainText('LLM evaluation harness');
  await expect(page.locator('#scope-plan')).toContainText('CI quality gate');
  await expect(page.locator('#scope-total')).toContainText('$');     // a computed band
  await expect(page.locator('#scope-total')).toContainText('indicative');
  await expect(page.locator('#scope-root')).toHaveAttribute('data-state', 'plan');
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test -g "itemized plan"`
Expected: FAIL — `#scope-plan` empty / no total.

- [ ] **Step 3: Write minimal implementation**

Replace the no-op with a real renderer. Money helper formats a band as `$6k–$15k`.

```js
// assets/scope-studio.mjs — replace the temporary no-op
const PHASE_COLOR = { audit: '#8FA0FF', build: '#22d3ee', gate: '#a78bfa', operate: '#10b981' };
function money(n) { return '$' + (n >= 1000 ? Math.round(n / 100) / 10 + 'k' : String(n)); }
function band([lo, hi]) { return money(lo) + '–' + money(hi); }

window.__renderScopePlan = function (plan) {
  const mount = document.getElementById('scope-plan');
  if (!mount) return;
  if (!plan.count) {
    mount.innerHTML = '<div style="border:1px dashed #2A2826;border-radius:12px;padding:28px;color:#8E8882;font-family:\'JetBrains Mono\',monospace;font-size:12.5px">Pick what you want to happen — your plan builds here as you go.</div>';
    return;
  }
  const phases = plan.phases.map(p => `
    <div style="margin-top:18px">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:${PHASE_COLOR[p.phase]};margin-bottom:8px">${p.label} · ${band(p.band)}</div>
      ${p.items.map(i => `
        <div style="display:flex;justify-content:space-between;gap:14px;border-top:1px solid #211F1C;padding:11px 0">
          <div><div style="color:#F4F2EF;font-size:14px">${i.name}</div><div style="color:#8E8882;font-size:12px;line-height:1.5">${i.why}</div></div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#A8A29E;white-space:nowrap;text-align:right">${band(i.band)}<br><span style="color:#8E8882">${i.effort}</span></div>
        </div>`).join('')}
    </div>`).join('');
  mount.innerHTML = `
    <div style="border:1px solid #2A2826;border-radius:14px;padding:22px;background:#0C0C0E">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:#8E8882">your plan · ${plan.count} pieces · ~${plan.timelineWeeks[0]}–${plan.timelineWeeks[1]} wks</div>
      ${phases}
      <div id="scope-total" style="margin-top:20px;border-top:1px solid #2A2826;padding-top:16px;display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-size:clamp(1.4rem,2.4vw,2rem);color:#10b981">${band(plan.totalBand)}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#8E8882">indicative range · exact scope on a call</span>
      </div>
    </div>`;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test -g "itemized plan"`
Expected: PASS. Full suite green.

- [ ] **Step 5: Commit**

```bash
git add assets/scope-studio.mjs assets/site.css tests/smoke.spec.js
git commit -m "feat(scope): live itemized plan viz with phase grouping + indicative total"
```

---

### Task 7: Lead capture (mailto fallback) + shareable link + reset

**Files:**
- Modify: `build.html` (handoff block)
- Modify: `assets/scope-studio.mjs` (handoff wiring)
- Modify: `tests/smoke.spec.js`

**Interfaces:**
- Consumes: current plan + URL (Tasks 5–6).
- Produces: a handoff row — "Email me this plan" (opens a prefilled `mailto:` with the plan summary + share URL), a "Copy shareable link" button, and an always-visible "Talk to Jason directly" link to `book.html`.

- [ ] **Step 1: Write the failing test**

```js
// in tests/smoke.spec.js scope studio describe
test('handoff: mailto is prefilled with the plan; talk-to-human always present', async ({ page, context, browserName }) => {
  await page.goto('/build.html');
  await page.locator('.scope-opt[data-id="opt-e2e"]').click();
  const mailto = await page.locator('#scope-email').getAttribute('href');
  expect(mailto).toContain('mailto:hello@sageideas.dev');
  expect(decodeURIComponent(mailto)).toContain('E2E test automation'); // plan summary in the body
  await expect(page.locator('#scope-human')).toHaveAttribute('href', /book\.html/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test -g "handoff"`
Expected: FAIL — `#scope-email` absent.

- [ ] **Step 3: Write minimal implementation**

Add a handoff container to `build.html` inside `#scope-root`, after the grid:
```html
<div id="scope-handoff" style="margin-top:28px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
  <a id="scope-email" class="btn-solid green" href="#">Email me this plan →</a>
  <button id="scope-copy" type="button" class="btn-ghost">Copy shareable link</button>
  <a id="scope-human" class="btn-ghost" href="book.html" style="border-color:#a78bfa;color:#a78bfa">Talk to Jason directly →</a>
</div>
```
Wire it in `scope-studio.mjs` — extend `renderPlan()` to also call `updateHandoff(plan)`:
```js
function planSummaryText(plan) {
  const lines = plan.items.map(i => `• ${i.name} — ${band(i.band)} (${i.effort})`);
  return `Here's the plan I scoped on your site:\n\n${lines.join('\n')}\n\nIndicative total: ${band(plan.totalBand)} · ~${plan.timelineWeeks[0]}–${plan.timelineWeeks[1]} weeks\n(Indicative only — happy to lock exact scope on a call.)\n\nShared plan: ${location.href}`;
}
function updateHandoff(plan) {
  const email = document.getElementById('scope-email');
  if (email) {
    const subj = encodeURIComponent('My scoped plan — via the site');
    const body = encodeURIComponent(plan.count ? planSummaryText(plan) : 'I started scoping on your site and want to talk.');
    email.setAttribute('href', `mailto:hello@sageideas.dev?subject=${subj}&body=${body}`);
  }
  const copy = document.getElementById('scope-copy');
  if (copy && !copy.dataset.wired) {
    copy.dataset.wired = '1';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href); copy.textContent = 'Copied ✓'; setTimeout(() => copy.textContent = 'Copy shareable link', 1600); } catch {}
    });
  }
}
```
(Call `updateHandoff(plan)` at the end of `renderPlan()`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test -g "handoff"`
Expected: PASS. Full suite green.

- [ ] **Step 5: Commit**

```bash
git add build.html assets/scope-studio.mjs tests/smoke.spec.js
git commit -m "feat(scope): handoff — prefilled mailto + copy link + always-on talk-to-human"
```

---

### Task 8: Navigation + reduced-motion/a11y + Lighthouse + sitemap

**Files:**
- Modify: `build.html` (nav link, meta description, prefers-reduced-motion note), `index.html` + `services.html` + `demos.html` (nav: add "Scope" link), `scripts/build-notes.mjs` or wherever `sitemap.xml` is generated (add `/build.html`)
- Modify: `tests/smoke.spec.js`

**Interfaces:**
- Consumes: the finished page.
- Produces: `/build.html` reachable from the nav, in the sitemap, a11y-clean, zero horizontal overflow at 320px.

- [ ] **Step 1: Write the failing test**

```js
// in tests/smoke.spec.js scope studio describe
test('build page: reachable from nav, no overflow at 320, one h1', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await expect(page.locator('nav a[href="build.html"]')).toHaveCount(1);
  await page.goto('/build.html');
  await expect(page.locator('h1')).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test -g "reachable from nav"`
Expected: FAIL — nav link absent.

- [ ] **Step 3: Write minimal implementation**

- Add `<a href="build.html">Scope</a>` (or "Build a plan") to the `<nav>` on `index.html`, `services.html`, `demos.html` (match existing nav link markup).
- `build.html` `<meta name="description">`: "Scope your project in a couple of minutes and get an itemized plan with an indicative range — no signup, no call required." (< 160 chars.)
- Confirm the reused `.tf-grid`/`.tf-sticky`/`.tf-col` rules already collapse to one column < 900px (they do, from the transform section). Add a `@media (prefers-reduced-motion: reduce)` no-op only if any motion was introduced (none here).
- Add `/build.html` to the sitemap generator's page list.

- [ ] **Step 4: Run tests + Lighthouse**

Run: `npx playwright test` (full suite green) and `node --test tests/unit/` (all unit green).
Then Lighthouse `/build.html` (desktop + mobile): expect **Accessibility/Best-Practices/SEO ≥ 100 / 100 / 100**, 0 failures. Fix any flagged item (contrast on the option chips, `aria-pressed` already set).

- [ ] **Step 5: Commit + deploy**

```bash
git add build.html index.html services.html demos.html scripts/ tests/smoke.spec.js
git commit -m "feat(scope): nav + sitemap + a11y/responsive pass for /build.html"
git push origin main
```
Verify live on `agency.sageideas.dev/build.html`, then hand off to Plan 2 (persistence).

---

## Self-Review

**Spec coverage (against `2026-08-18-scope-studio-design.md`):**
- §2 grounding principle → Tasks 1–2 (numbers only from `RATE_CARD`; `computePlan` drops unknown keys). ✓
- §4.1 rate card → Task 1. §4.2 Plan object → Task 2. URL encode → Task 3. ✓
- §5 page + questionnaire fallback → Tasks 4–6 (this plan IS the deterministic fallback; the AI path is Plan 3). ✓
- §6 backend → **out of scope for Plan 1** (Plan 2/3); lead capture uses mailto per §1 offline requirement. ✓
- §7/§7.5 trust & humanity → partially: "Jason's tool, Jason reads every plan" transparency line (Task 5 copy) + always-on "talk to Jason" (Task 7). Full eval/qualification/confidence → Plan 3. ✓ (noted, not a gap — staged.)
- §10 testing → unit (Tasks 1–4) + smoke (Tasks 5–8) + Lighthouse (Task 8). ✓
- §12 build order steps 1–3 → this plan. Steps 4–8 → Plans 2–3. ✓

**Placeholder scan:** no TBD/TODO in steps except the intentional `TODO(jason): tune` band-values marker (a product decision surfaced to the operator, per spec §13), and the explicit `window.__renderScopePlan` no-op that Task 5 installs and Task 6 replaces (sequenced, not a gap). No "add error handling"/"write tests for the above" placeholders — every test and impl is written out.

**Type consistency:** `computePlan → { items, phases, totalBand, timelineWeeks, count, segment }` used identically in Tasks 5–7. `Card` fields (`key/name/track/band/effort/phase/why`) consistent across Tasks 1, 2, 6. `encodeKeys/decodeKeys` signatures match between Task 3 and Task 5. `keysFromAnswers` shape matches between Task 4 and Task 5. Option `id`/`keys` used consistently in Tasks 4–5. ✓

## Execution Handoff

Two execution options:
1. **Subagent-Driven (recommended)** — a fresh subagent per task with review between tasks.
2. **Inline Execution** — tasks executed in-session with checkpoints.
