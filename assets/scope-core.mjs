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
