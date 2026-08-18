// Versioned rate card — the single source of truth for scope + indicative pricing.
// Bands are illustrative placeholders. TODO(jason): tune before launch.

export const DISCLAIMER =
  'Indicative ranges, not a quote. Exact scope and price are locked on a short call.';

export const SEGMENTS = {
  'service-business': { label: 'Service business', lead: 'missed calls, manual follow-up, no time' },
  'ai-product':       { label: 'AI product / feature', lead: 'shipping LLM features you can\'t yet prove' },
  'ops-automation':   { label: 'Ops / back-office', lead: 'repetitive work eating the week' },
  'product-build':    { label: 'Product / platform', lead: 'need the real thing built right' }
};

export const RATE_CARD = [
  // AI Build
  { key: 'chatbot',        name: 'Conversational assistant',        track: 'AI Build', band: [4000, 9000],  effort: '~2-4 wks', phase: 'build',   why: 'Support/product chatbot grounded in your docs.' },
  { key: 'voice-agent',    name: 'AI voice agent',                  track: 'AI Build', band: [5000, 12000], effort: '~3-5 wks', phase: 'build',   why: 'Answers 24/7, qualifies, books, texts a summary.' },
  { key: 'doc-intake',     name: 'Document intake & extraction',    track: 'AI Build', band: [4000, 10000], effort: '~2-4 wks', phase: 'build',   why: 'Messy documents into validated structured data.' },
  { key: 'copilot',        name: 'Internal copilot',                track: 'AI Build', band: [6000, 14000], effort: '~3-6 wks', phase: 'build',   why: 'A private assistant that knows how your company works.' },
  { key: 'rag',            name: 'RAG pipeline engineering',        track: 'AI Build', band: [5000, 12000], effort: '~2-5 wks', phase: 'build',   why: 'Retrieval that returns the right thing, with citations.' },
  { key: 'orchestration',  name: 'Multi-agent orchestration',       track: 'AI Build', band: [8000, 18000], effort: '~4-8 wks', phase: 'build',   why: 'Agents that plan, call tools, and hand off, auditably.' },
  { key: 'structured-out', name: 'Structured-output / functions',   track: 'AI Build', band: [3000, 7000],  effort: '~1-3 wks', phase: 'build',   why: 'Make the LLM a reliable part of your backend.' },
  // Eval & QA
  { key: 'llm-eval',       name: 'LLM evaluation harness',          track: 'Eval & QA', band: [3500, 9000], effort: '~1-3 wks', phase: 'gate',   why: 'Golden set + LLM-as-judge scoring for your feature.' },
  { key: 'redteam',        name: 'AI red-team & safety battery',    track: 'Eval & QA', band: [3000, 8000], effort: '~1-3 wks', phase: 'gate',   why: 'Injection, jailbreak, PII, toxicity probes.' },
  { key: 'ci-gate',        name: 'CI quality gate for AI',          track: 'Eval & QA', band: [2500, 6000], effort: '~1-2 wks', phase: 'gate',   why: 'A bad AI change blocks the merge, not the retro.' },
  { key: 'grounding',      name: 'Hallucination / grounding gate',  track: 'Eval & QA', band: [3000, 7000], effort: '~1-3 wks', phase: 'gate',   why: 'Stop it inventing facts and policies.' },
  { key: 'regression',     name: 'Prompt & model regression tests', track: 'Eval & QA', band: [2500, 6000], effort: '~1-2 wks', phase: 'gate',   why: 'Know exactly what the model bump broke.' },
  { key: 'agent-eval',     name: 'Agent evaluation',                track: 'Eval & QA', band: [3500, 8000], effort: '~1-3 wks', phase: 'gate',   why: 'Did the agent use the right tool and finish the task?' },
  { key: 'observability',  name: 'LLM observability & cost',        track: 'Eval & QA', band: [3000, 7000], effort: '~1-3 wks', phase: 'operate', why: 'See quality, drift, and spend in production.' },
  // Test Automation
  { key: 'e2e',            name: 'E2E test automation',             track: 'Test Automation', band: [4000, 12000], effort: '~2-5 wks', phase: 'gate', why: 'Your critical flows, covered and green in CI.' },
  { key: 'api-testing',    name: 'API & contract testing',          track: 'Test Automation', band: [3000, 8000],  effort: '~1-3 wks', phase: 'gate', why: 'Catch the broken endpoint before the frontend does.' },
  { key: 'mobile-cert',    name: 'Mobile real-device certification',track: 'Test Automation', band: [4000, 10000], effort: '~2-4 wks', phase: 'gate', why: 'Ship iOS/Android with proof, not hope.' },
  { key: 'cicd',           name: 'CI/CD pipeline + test wiring',     track: 'Test Automation', band: [3000, 8000],  effort: '~1-3 wks', phase: 'build', why: 'A green badge you can trust.' },
  { key: 'flaky',          name: 'Flaky-test stabilization',        track: 'Test Automation', band: [2500, 6000],  effort: '~1-2 wks', phase: 'gate', why: 'Make red mean something again.' },
  { key: 'perf',           name: 'Performance & load baselines',    track: 'Test Automation', band: [3000, 7000],  effort: '~1-2 wks', phase: 'gate', why: 'Know your critical path\'s breaking point.' },
  { key: 'visual',         name: 'Visual regression testing',       track: 'Test Automation', band: [2500, 6000],  effort: '~1-2 wks', phase: 'gate', why: 'Catch the layout break a unit test can\'t see.' },
  { key: 'a11y',           name: 'Accessibility (a11y) audits',     track: 'Test Automation', band: [2500, 6000],  effort: '~1-2 wks', phase: 'gate', why: 'WCAG 2.2: keyboard, contrast, reduced-motion.' },
  // Automation
  { key: 'workflow',       name: 'Workflow automation',             track: 'Automation', band: [2500, 8000], effort: '~1-3 wks', phase: 'build', why: 'The repetitive back-office flow, automated end-to-end.' },
  { key: 'lead-capture',   name: 'Lead capture -> qualify -> route',  track: 'Automation', band: [3000, 8000], effort: '~1-3 wks', phase: 'build', why: 'Every lead caught, scored, and followed up in minutes.' },
  { key: 'etl',            name: 'Data pipelines / ETL',            track: 'Automation', band: [4000, 10000],effort: '~2-4 wks', phase: 'build', why: 'Move and shape data reliably, on a schedule.' },
  { key: 'integrations',   name: 'Integrations (CRM, tools, APIs)', track: 'Automation', band: [3000, 8000], effort: '~1-3 wks', phase: 'build', why: 'Make your tools finally talk to each other.' },
  { key: 'monitoring',     name: 'Monitoring / scraping / alerting',track: 'Automation', band: [2500, 6000], effort: '~1-2 wks', phase: 'operate', why: 'Watch a source, act when something changes.' },
  { key: 'scheduled',      name: 'Scheduled jobs & back-office',    track: 'Automation', band: [2000, 5000], effort: '~1-2 wks', phase: 'operate', why: 'The recurring task nobody wants to remember.' },
  // Product
  { key: 'web-app',        name: 'Web apps & customer portals',     track: 'Product', band: [8000, 25000], effort: '~4-8 wks', phase: 'build', why: 'Auth, payments, dashboards, production-grade.' },
  { key: 'internal-tools', name: 'Internal tools / admin panels',   track: 'Product', band: [5000, 14000], effort: '~2-5 wks', phase: 'build', why: 'Replace the spreadsheet your team runs by hand.' },
  { key: 'backend',        name: 'APIs & backends',                 track: 'Product', band: [5000, 14000], effort: '~2-5 wks', phase: 'build', why: 'The service layer everything else depends on.' },
  { key: 'dashboards',     name: 'Dashboards & data visualization', track: 'Product', band: [4000, 12000], effort: '~2-4 wks', phase: 'build', why: 'Turn your data into a decision, not a CSV.' }
];

export const CARD_BY_KEY = new Map(RATE_CARD.map(c => [c.key, c]));

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

// URL-safe base64url encoding/decoding helpers
function b64urlEncode(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  try {
    const pad = s.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(pad)));
  } catch {
    return '';
  }
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
      { id: 'opt-eval', label: 'Prove our AI feature works', keys: ['llm-eval', 'ci-gate'] },
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
      { id: 'mat-demo', label: 'A demo that isn\'t trustworthy yet', keys: ['observability'] },
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
