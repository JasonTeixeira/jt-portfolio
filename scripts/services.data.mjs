/**
 * Service landing pages — the contract-revenue SEO play. Each entry becomes
 * services/<slug>.html targeting what a buying CTO/PM actually searches.
 * Build: npm run build:services (then build:notes regenerates the sitemap).
 *
 * Package prices are the LIVE Stripe-backed tiers on sageideas.dev
 * (data/services/tiers.ts there) — the audit checkout is a real payment
 * link, not a mock. Never quote a price here that Stripe can't charge.
 */
export const AUDIT_CHECKOUT = 'https://www.sageideas.dev/checkout/audit?src=agency';
export const BOOK_URL = 'https://www.sageideas.dev/book?src=agency';

export const SERVICES = [
  {
    slug: 'llm-evaluation-qa',
    color: '#a78bfa',
    keyword: 'LLM evaluation & AI quality',
    title: 'LLM Evaluation Consultant — Eval Suites, Hallucination Testing & CI Quality Gates',
    metaDescription: 'Freelance LLM evaluation and AI QA engineer. Golden datasets, LLM-as-judge scoring, hallucination and prompt-injection testing with Promptfoo/DeepEval — wired into your CI so quality regressions block the deploy.',
    h1: 'Your LLM feature, under real evaluation.',
    sub: 'Golden datasets, LLM-as-judge scoring, and safety runners — hallucination, injection, toxicity, PII — wired into your CI. A prompt change that makes things worse stops at the gate, not in production.',
    symptoms: [
      'Prompt changes ship because they "seem better" — nobody can prove it',
      'No golden set, no regression signal, no idea what last week\'s model bump broke',
      'Legal or brand asks "can it say something wrong?" and the honest answer is "probably"',
      'The team argues about output quality with anecdotes instead of scores'
    ],
    deliverables: [
      { t: 'Golden dataset + judge', d: '50–200 real inputs with agreed-good outputs, versioned next to the code; LLM-as-judge scoring for faithfulness, relevance, and safety.' },
      { t: 'Safety runner battery', d: 'Hallucination, jailbreak, prompt-injection, toxicity, PII-leak, refusal, bias, consistency — plus cost and latency budgets.' },
      { t: 'CI quality gate', d: 'The suite runs on every PR. A score below the ratcheted floor blocks the merge — with a scorecard your PM can read.' },
      { t: 'Runbook + handoff', d: 'Your team extends the golden set and owns the gate without me.' }
    ],
    proof: [
      { name: 'llm-eval-gate (open source)', metric: 'clone the minimum viable gate — first green run in 10 minutes, zero API keys', href: 'https://github.com/JasonTeixeira/llm-eval-gate' },
      { name: 'nexural-qa-os', metric: '85 quality runners, 10 dedicated AI-safety evals — scorecard reproducible by one command', href: '/index.html#work' },
      { name: 'BRIEF/03 — The QA OS that can\'t lie', metric: 'the full engineering brief behind the platform', href: '/index.html#briefs' }
    ],
    packages: [
      { name: 'Eval Audit', price: '$750', timing: '1 week', d: 'I map where your LLM feature can fail, score your current coverage against the failure modes that matter, and hand you a costed plan. Credited in full if you continue.', cta: 'checkout' },
      { name: 'Minimum Viable Gate', price: 'from $2,500', timing: '2 weeks', d: '30–50 golden traces, one judge, one CI step that can block a merge. The regression you currently can\'t see, caught this month.', cta: 'book' },
      { name: 'Full Eval Battery', price: 'from $9,500', timing: '4–8 weeks', d: 'Safety runners, ratcheting floors, RAG retrieval metrics, cost budgets, runbook and handoff — the complete quality system, owned by your team.', cta: 'book' },
    ],
    faq: [
      { q: 'Which tools do you use?', a: 'Promptfoo and DeepEval where they fit, custom runners where they don\'t. The tool matters less than the discipline: computed scores from real commands, never opinions.' },
      { q: 'Our feature uses RAG — does that change the approach?', a: 'It adds retrieval-quality evals (context precision/recall, citation coverage) in front of the generation evals. I\'ve shipped RAG systems where 100% of answers carry citations by design.' },
      { q: 'How long until we have a working gate?', a: 'A minimal gate — 30 golden traces and one faithfulness judge in CI — typically lands in the first two weeks. The battery grows from there.' }
    ]
  },
  {
    slug: 'test-automation-ci',
    color: '#10b981',
    keyword: 'Test automation + CI',
    title: 'Playwright Test Automation Consultant — Regression Suites, CI Pipelines & Release Evidence',
    metaDescription: 'Freelance QA automation engineer (ISTQB Test Automation Engineer). Risk-scoped Playwright/Pytest regression suites with traces, reports, and artifacts — wired into GitHub Actions from day one.',
    h1: 'A regression suite a release manager can trust.',
    sub: 'Risk-scoped Playwright or Pytest coverage with the evidence discipline of a release: traces, four reporters, artifact retention, and a green gate on every PR — built in your repo, your CI, your conventions.',
    symptoms: [
      'Releases depend on a manual smoke pass someone runs "when there\'s time"',
      'The old suite is flaky, so everyone ignores red — which means red is meaningless',
      'Coverage follows whoever wrote tests last, not where the release risk actually is',
      'No traces or artifacts, so every failure starts a screenshot scavenger hunt'
    ],
    deliverables: [
      { t: 'Risk model → coverage matrix', d: 'Coverage decided by release risk, not habit. The matrix is a document your team maintains.' },
      { t: 'Playwright/Pytest suite', d: 'Page Object Model, fixtures, data-driven where it pays; trace-on-retry and four reporters standard.' },
      { t: 'CI wiring', d: 'GitHub Actions (or your CI) running on every push/PR with artifact retention — a green badge that actually means something.' },
      { t: 'Flake protocol', d: 'Quarantine lane, retry policy, and a weekly triage ritual — the discipline that keeps red meaningful.' }
    ],
    proof: [
      { name: 'playwright-sdet-regression-suite', metric: '37/37 specs in CI with traces, screenshots, and a written risk model — public repo', href: 'https://github.com/JasonTeixeira/playwright-sdet-regression-suite' },
      { name: 'This site', metric: '60+ checks (smoke + a11y, desktop & mobile) gate every push of the page you\'re reading — the scorecard on the homepage is generated by the suite', href: '/index.html#proof' }
    ],
    packages: [
      { name: 'Suite Audit', price: '$750', timing: '1 week', d: 'Risk map of your release path, honest read on the current suite (including whether it\'s worth saving), and a costed plan. Credited in full if you continue.', cta: 'checkout' },
      { name: 'Stabilize Sprint', price: 'from $2,500', timing: '2 weeks', d: 'The flake protocol installed on your existing suite: quarantine lane, retry policy, isolation fixes — red becomes meaningful again.', cta: 'book' },
      { name: 'Regression Suite Build', price: 'from $9,500', timing: '4–8 weeks', d: 'Risk-scoped Playwright/Pytest coverage with traces, reporters, CI wiring, and the discipline documents your team maintains after I leave.', cta: 'book' },
    ],
    faq: [
      { q: 'Selenium, Cypress, or Playwright?', a: 'Playwright for new builds — speed, tracing, and parallelism. I\'ve shipped 300+ test Selenium frameworks at Fortune 50 scale, so migrations are familiar territory.' },
      { q: 'Can you fix our existing flaky suite instead of rebuilding?', a: 'Usually yes — at HighStrike I cut a live suite\'s flake rate from 10% to under 1% with retry logic and isolation fixes. Rebuild is the last resort, not the default.' },
      { q: 'Do you do load testing?', a: 'k6 baselines on the critical path are part of the standard engagement; deeper performance work is scoped separately.' }
    ]
  },
  {
    slug: 'ai-workflow-automation',
    color: '#0e7490',
    keyword: 'AI workflow automation',
    title: 'AI Workflow Automation Consultant — n8n, Make & LangGraph Builds With Human Approval Gates',
    metaDescription: 'Freelance AI automation engineer. Intake, triage, routing, and RAG-backed workflows on n8n, Make, or LangGraph — with human-in-the-loop approval points, structured outputs, and logs you can audit.',
    h1: 'Automation that ships work, not surprises.',
    sub: 'Intake, triage, routing, RAG-backed answers — built on n8n, Make, or code-level LangGraph. AI on the reading side, humans on the writing side, until evals prove otherwise. Every run logged, every step auditable.',
    symptoms: [
      'The team drowns in triage that a classifier could do in seconds',
      'A previous "AI automation" attempt emailed something embarrassing and got unplugged',
      'Zapier sprawl nobody understands, with no error handling and no audit trail',
      'You want agents, but you also want to keep your customers and your compliance officer'
    ],
    deliverables: [
      { t: 'Working automation', d: 'One scoped workflow end-to-end — intake → classify → route → act — on n8n/Make or LangGraph, in your accounts.' },
      { t: 'Human approval points', d: 'Placed where the risk is: before every send, before novel cases, or after-the-fact review — earned down with evidence, never assumed.' },
      { t: 'Structured outputs + fallbacks', d: 'Schema-validated LLM steps, fallback labels on parse failure, raw inputs always logged beside decisions.' },
      { t: 'Runbook + handoff', d: 'Your team re-runs, extends, and debugs it without me.' }
    ],
    proof: [
      { name: 'BRIEF/01 — Feedback triage that runs itself', metric: 'negative feedback surfaces in seconds instead of the Friday review — full engineering brief', href: '/index.html#briefs' },
      { name: 'sage-agents', metric: 'agent warehouse with cost tracking, tracing, and a hard TCPA consent gate on every outbound call', href: '/index.html#work' }
    ],
    packages: [
      { name: 'Automation Audit', price: '$750', timing: '1 week', d: 'I map your intake → decision → action flows, find the single highest-leverage automation, and hand you a costed plan with the risk gates drawn in. Credited in full if you continue.', cta: 'checkout' },
      { name: 'One-Workflow Sprint', price: 'from $2,500', timing: '2 weeks', d: 'One scoped workflow shipped end-to-end in your accounts — intake, classify, route, act — with human approval points and full run logs.', cta: 'book' },
      { name: 'Automation System Build', price: 'from $9,500', timing: '4–8 weeks', d: 'The full pipeline: multiple workflows, eval-gated AI steps, cost model, structured outputs, runbook and handoff.', cta: 'book' },
    ],
    faq: [
      { q: 'n8n, Make, Zapier, or custom code?', a: 'Whichever your team can own after I leave. Rule of thumb: Make/Zapier for linear flows, n8n when you need branching and self-hosting, LangGraph when the logic is genuinely agentic.' },
      { q: 'Will the AI talk to our customers?', a: 'Not until an eval suite proves it should. The most reliable automation I\'ve shipped sends zero AI-written messages — it reads, classifies, routes, and alerts a human. That design deletes entire failure classes.' },
      { q: 'What does this cost to run?', a: 'Part of the build is a cost model — per-run LLM spend tracked and budgeted, with cheaper models routed in where quality allows.' }
    ]
  }
];
