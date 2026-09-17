/**
 * learn.data.mjs — content model for the Learn reference hub (the public knowledge
 * library, distinct from /docs which is buyer/engagement-facing).
 *
 * build-learn.mjs renders:
 *   learn.html            — the hub home: all 8 pillars as a navigable library
 *   learn-<pillar>.html   — one cornerstone landing page per pillar, listing its cluster
 *
 * Depth-first honesty rule: only LIVE entries (real existing pages) are linked. The
 * content roadmap in docs/CONTENT_ARCHITECTURE.md drives what gets ADDED here over
 * time — we never ship "coming soon" dead links to fake depth.
 *
 * Entry shape: { title, href, type, desc }
 *   type ∈ guide | tutorial | glossary | comparison | study | service | note | case | tool | reference
 *   (type only drives the little monospace tag + icon; all are real pages)
 */

// 8 pillars. `accent` reuses the site's existing phase palette so the hub reads as
// the same system as the scope-studio blueprint + docs diagrams.
export const PILLARS = [
  {
    id: 'llm-evaluation',
    num: '01',
    title: 'LLM Evaluation & Quality',
    kicker: 'Does your AI feature actually work?',
    accent: '#22d3ee',
    blurb: 'How to measure whether an LLM feature is good enough to ship — metrics, judges, golden sets, and the evidence that a change did not quietly regress.',
    intent: 'The core discipline. Everything else is downstream of being able to answer "is this good enough, and how do I know?"',
  },
  {
    id: 'rag-retrieval',
    num: '02',
    title: 'RAG & Retrieval Quality',
    kicker: 'Why your retrieval-augmented app hallucinates — and how to catch it.',
    accent: '#a78bfa',
    blurb: 'Evaluating retrieval-augmented generation end to end: faithfulness, context precision and recall, chunking, reranking, and citation accuracy.',
    intent: 'Most "AI app" work is RAG under the hood. This is where accuracy is won or lost.',
  },
  {
    id: 'agent-reliability',
    num: '03',
    title: 'AI Agent Reliability',
    kicker: 'Testing systems that take actions, not just answer questions.',
    accent: '#8FA0FF',
    blurb: 'Making multi-step, tool-using agents trustworthy: trajectory evaluation, tool-call accuracy, multi-turn testing, and the non-determinism problem.',
    intent: 'The fastest-growing build category — and the least-covered as a testing discipline. Genuine white space.',
  },
  {
    id: 'ai-in-ci',
    num: '04',
    title: 'AI Testing in CI/CD',
    kicker: 'Treat AI quality like code quality: gate it.',
    accent: '#10b981',
    blurb: 'Wiring evaluation into the pipeline — eval gates, quality ratchets, regression suites, canary releases, and "no fake green" as an actual workflow.',
    intent: 'The most differentiated idea here: the methodology this whole practice is built on.',
  },
  {
    id: 'test-automation',
    num: '05',
    title: 'Test Automation & QA',
    kicker: 'The QA foundation underneath the AI.',
    accent: '#F59E0B',
    blurb: 'Classic software quality engineering, sharpened for AI-powered products: flaky tests, Playwright, visual regression, coverage that means something.',
    intent: 'The other half of the positioning — and the broad-volume on-ramp for people who will later need AI testing.',
  },
  {
    id: 'shipping-ai',
    num: '06',
    title: 'Shipping AI Safely',
    kicker: 'For the people deciding whether — and how — to add AI.',
    accent: '#f43f5e',
    blurb: 'The product- and leadership-level view: launch checklists, "passing tests isn\'t proof," build-vs-buy, cost, rollback plans, and hiring for AI quality.',
    intent: 'The on-ramp that turns a curious founder into someone who reads the eval-gate guide next.',
  },
  {
    id: 'workflow-automation',
    num: '07',
    title: 'AI Workflow Automation',
    kicker: 'Automating real work without it going off the rails.',
    accent: '#34d399',
    blurb: 'Business-process automation with AI in the loop: support triage, lead qualification, human-approval steps, failure modes, and honest ROI.',
    intent: 'The biggest single volume opportunity outside the QA niche — built from real client work.',
  },
  {
    id: 'tool-landscape',
    num: '08',
    title: 'Tools & Landscape',
    kicker: 'What to actually adopt — from someone who has used the stack.',
    accent: '#e879f9',
    blurb: 'Straight comparisons and landscape maps across the eval, RAG, and testing tool ecosystems. Written from hands-on use, not SEO farming.',
    intent: 'Highest-conversion content: people comparing tools are close to a buying or building decision.',
  },
];

// Real, LIVE pages mapped into each pillar. Every href resolves to an existing file.
export const LIBRARY = {
  'llm-evaluation': [
    { title: 'The eval gate, explained', href: 'guide-eval-gate.html', type: 'guide', desc: 'Animated walkthrough of the gate that blocks a regression before it ships.' },
    { title: 'Golden sets, explained', href: 'guide-golden-set.html', type: 'guide', desc: 'What a golden set is and why it is the backbone of LLM regression testing.' },
    { title: 'Adversarial probes, explained', href: 'guide-probes.html', type: 'guide', desc: 'How probes surface prompt-injection and jailbreak failures on purpose.' },
    { title: 'The evaluation method', href: 'docs-eval-method.html', type: 'reference', desc: 'The end-to-end method behind every engagement — how quality is actually proven.' },
    { title: 'Evaluation & quality (reference)', href: 'docs-evaluation-and-quality.html', type: 'reference', desc: 'The reference page for the evaluation and quality capability.' },
    { title: 'Run a live eval in your browser', href: 'eval.html', type: 'tool', desc: 'An eval harness that runs client-side so you can watch it score, honestly.' },
    { title: 'The day my own quality gate blocked me', href: 'notes/gate-blocked-me.html', type: 'note', desc: 'A field note on being stopped by your own gate — the point of the whole thing.' },
    { title: 'No fake green', href: 'notes/no-fake-green.html', type: 'note', desc: 'What a proof ledger taught me about trusting AI agents.' },
    { title: 'LLM evaluation & QA (service)', href: 'services/llm-evaluation-qa.html', type: 'service', desc: 'The engagement: measure, gate, and prove your AI feature works.' },
  ],
  'rag-retrieval': [
    { title: 'RAG evaluation guide', href: 'rag-evaluation-guide.html', type: 'guide', desc: 'How to evaluate a retrieval-augmented pipeline end to end, metric by metric.' },
    { title: 'AI product build (service)', href: 'services/ai-product-build.html', type: 'service', desc: 'Building RAG-powered products with evaluation wired in from day one.' },
  ],
  'agent-reliability': [
    { title: 'AI agent testing', href: 'ai-agent-testing.html', type: 'guide', desc: 'Testing agents that plan, call tools, and take multi-step actions.' },
    { title: 'Eighteen agents audited a live curriculum', href: 'notes/eighteen-agent-audit-gauntlet.html', type: 'note', desc: 'A multi-agent audit gauntlet — and the false error one agent was teaching.' },
    { title: 'Five pages, five agents, zero conflicts', href: 'notes/five-pages-five-agents.html', type: 'note', desc: 'Coordinating parallel agents against one design file without merge chaos.' },
  ],
  'ai-in-ci': [
    { title: 'LLM regression testing with Promptfoo in CI', href: 'notes/promptfoo-ci-minimum-gate.html', type: 'note', desc: 'The minimum viable eval gate you can add to CI this week.' },
    { title: 'Your LLM feature needs a regression suite', href: 'notes/llm-regression-suite.html', type: 'note', desc: 'Why a regression suite beats a better prompt, every time.' },
    { title: 'Human-approval checkpoints, explained', href: 'guide-human-approval.html', type: 'guide', desc: 'Where a human belongs in an otherwise-automated AI pipeline.' },
    { title: 'AI under test', href: 'ai-under-test.html', type: 'reference', desc: 'What it looks like when an AI system is held to a real testing standard.' },
  ],
  'test-automation': [
    { title: 'Reduce test flakiness', href: 'reduce-test-flakiness.html', type: 'guide', desc: 'Root causes of flaky tests and how to actually fix them.' },
    { title: 'Test automation & CI (service)', href: 'services/test-automation-ci.html', type: 'service', desc: 'The engagement: a test suite leadership can trust, wired into CI.' },
    { title: 'Test automation (reference)', href: 'docs-test-automation.html', type: 'reference', desc: 'The reference page for the test-automation capability.' },
    { title: 'Security hardening (service)', href: 'services/security-hardening.html', type: 'service', desc: 'Hardening AI-powered surfaces against abuse and injection.' },
  ],
  'shipping-ai': [
    { title: 'AI feature launch checklist', href: 'checklist.html', type: 'tool', desc: 'A scored, adaptive checklist for shipping an AI feature without breaking trust.' },
    { title: 'Case studies', href: 'case-studies.html', type: 'case', desc: 'Real before/after outcomes, each linked to its verifiable receipt.' },
    { title: 'Cost-of-bad-AI ROI calculator', href: 'roi.html', type: 'tool', desc: 'Model the annual exposure of an unproven AI feature — and what a gate recovers.' },
    { title: 'Hiring an AI QA engineer', href: 'hire-ai-qa-engineer.html', type: 'reference', desc: 'What to look for when hiring for AI quality.' },
    { title: 'What an LLM evaluation consultant does', href: 'llm-evaluation-consultant.html', type: 'reference', desc: 'The role, the scope, and when you actually need one.' },
    { title: 'AI product build (service)', href: 'services/ai-product-build.html', type: 'service', desc: 'From idea to a shipped, proven AI feature.' },
  ],
  'workflow-automation': [
    { title: 'AI workflow automation (service)', href: 'services/ai-workflow-automation.html', type: 'service', desc: 'Automating real business processes with AI safely in the loop.' },
    { title: 'Automations catalog', href: 'automations/index.html', type: 'reference', desc: 'The catalog of automations, by function and by niche.' },
    { title: 'The AI front desk', href: 'front-desk.html', type: 'reference', desc: 'Lead qualification and reception that does not feel robotic.' },
    { title: 'Automation that never talks to your customer', href: 'notes/automation-that-never-talks.html', type: 'note', desc: 'The back-office automations that quietly earn their keep.' },
    { title: 'Custom AI builds (service)', href: 'services/custom-ai-builds.html', type: 'service', desc: 'Bespoke AI systems, built and proven.' },
  ],
  'tool-landscape': [
    { title: 'Stack & integrations (reference)', href: 'docs-stack-integrations.html', type: 'reference', desc: 'The tools and integrations this practice is built on.' },
    { title: 'Product & platform (reference)', href: 'docs-product-and-platform.html', type: 'reference', desc: 'How the pieces fit into a product and platform view.' },
    { title: 'Glossary', href: 'docs-glossary.html', type: 'glossary', desc: 'Plain-English definitions of the eval, RAG, and testing vocabulary.' },
    { title: 'Proof index', href: 'docs-proof-index.html', type: 'reference', desc: 'Every verifiable artifact behind the claims on this site, in one place.' },
  ],
};

// Slugs for the generated pillar pages (used by the sitemap in build-notes.mjs).
export const LEARN_SLUGS = PILLARS.map((p) => p.id);
