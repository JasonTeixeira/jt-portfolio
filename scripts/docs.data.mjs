/**
 * docs.data.mjs — content model for the documentation site.
 * build-docs.mjs renders NAV (the sidebar) + PAGES (generated docs pages) into
 * a consistent, sidebar-navigated documentation experience.
 *
 * Brand rules baked into the copy: quote-first (never a dollar figure), proof
 * over promises (link real artifacts), engineer-to-engineer, no invented
 * clients or metrics beyond what the site already verifies.
 *
 * Block DSL (each page.blocks entry):
 *   ['p', html]                     paragraph (html allowed)
 *   ['h', text]                     section subheading (h2)
 *   ['ul', [items]] / ['ol', [items]]
 *   ['note', html]                  highlighted callout
 *   ['cards', [[title, desc], ...]] grid of small cards
 *   ['proof', [[label, href], ...]] proof-link row
 *   ['cta', headline, sub]          call-to-action band
 */

// Sidebar structure. Internal pages reference a slug in PAGES; external items
// (the animated deep-dive guides) link out with their own chrome.
export const NAV = [
  { cat: 'Getting started', items: [
    { slug: 'overview' }, { slug: 'start-here' }, { slug: 'how-engagements-work' },
  ]},
  { cat: 'What I build', items: [
    { slug: 'ai-engineering' }, { slug: 'evaluation-and-quality' }, { slug: 'test-automation' },
    { slug: 'workflow-automation' }, { slug: 'product-and-platform' },
  ]},
  { cat: 'The eval method', items: [
    { slug: 'eval-method' },
    { title: 'The CI eval gate', href: 'guide-eval-gate.html', ext: true },
    { title: 'Safety probes', href: 'guide-probes.html', ext: true },
    { title: 'Golden sets & judges', href: 'guide-golden-set.html', ext: true },
    { title: 'Human approval', href: 'guide-human-approval.html', ext: true },
  ]},
  { cat: 'Working together', items: [
    { slug: 'process-and-handoff' }, { slug: 'data-and-security' }, { slug: 'pricing' },
  ]},
  { cat: 'Reference', items: [
    { slug: 'faq' }, { slug: 'glossary' }, { slug: 'proof-index' },
  ]},
];

const BOOK = 'book.html';

export const PAGES = {
  overview: {
    title: 'Overview',
    cat: 'Getting started',
    desc: 'What Jason Teixeira builds and proves for teams shipping AI — the thesis, who it is for, and how the documentation is organized.',
    lead: 'I ship AI features and then prove they work. This documentation is the honest, complete version of what I build, how engagements run, and the method behind the proof.',
    blocks: [
      ['h', 'The thesis'],
      ['p', 'Shipping an AI feature is the easy 80%. The hard 20% — the part that decides whether it survives contact with real users — is proving it behaves: that a prompt change didn’t quietly regress, that it won’t leak data or get jailbroken, that it stays in its lane. I build both halves, and I treat the proof as a first-class deliverable, not an afterthought.'],
      ['p', 'The through-line on everything here is <b>proof, not vibes</b>: every capability links to a real artifact — a public repo, a verbatim test run, or a live screenshot — and this very site runs its own QA suite on every deploy.'],
      ['h', 'Who this is for'],
      ['cards', [
        ['Teams shipping LLM features', 'You have a chatbot, agent, RAG system, or generator in production (or nearly), and a wrong or unsafe answer has real cost.'],
        ['Teams whose releases keep breaking', 'You need a regression suite and a CI gate a release manager can actually trust.'],
        ['Teams drowning in manual work', 'You have an intake, triage, or routing workflow a well-built automation could run — safely.'],
      ]],
      ['h', 'How this documentation is organized'],
      ['ul', [
        '<b>What I build</b> — the capabilities, documented: what each is, what you get, and how it works.',
        '<b>The eval method</b> — the philosophy and mechanics of proving AI features (with animated deep-dive guides).',
        '<b>Working together</b> — how engagements run, how your data is handled, and how pricing works.',
        '<b>Reference</b> — FAQ, a plain-English glossary, and an index of every proof artifact.',
      ]],
      ['cta', 'The fastest way to see it', 'Get a free mini-eval on your live AI feature — real findings, no call required.'],
    ],
  },

  'start-here': {
    title: 'Start here',
    cat: 'Getting started',
    desc: 'The three lowest-friction ways to start working with Jason: a free mini-eval, a short audit, or a 15-minute call.',
    lead: 'There are three doors, ordered by commitment. Most people start with the first — it costs nothing and does real work.',
    blocks: [
      ['h', '1. The free mini-eval'],
      ['p', 'Point me at your live AI feature and I’ll run a batch of real adversarial probes — prompt injection, hallucination, scope, PII, tone — and send you the verbatim findings: pass/fail, the exact failure modes, and what I’d gate before your next release. No call, no cost. It’s proof-of-work, not a pitch.'],
      ['note', 'See the exact format first: the <a href="sample.html">sample report</a> shows what you’d receive, and the <a href="eval.html">live eval</a> grades an AI in real time in your browser.'],
      ['h', '2. The audit'],
      ['p', 'A short, focused engagement (about a week) that maps your highest-leverage failure surface — the AI risk, the test gap, or the automation ROI — and hands you a prioritized plan you own, plus a concrete quote for the build. If the scoping shows I can’t help, I’ll say so and it costs nothing.'],
      ['h', '3. A 15-minute call'],
      ['p', 'Describe the problem and I’ll tell you honestly which of these it needs, what it takes, and roughly what it costs — or that it doesn’t need me at all. You leave with a concrete plan either way.'],
      ['proof', [['The sample report', 'sample.html'], ['The live eval', 'eval.html'], ['Book a call', 'book.html']]],
      ['cta', 'Ready when you are', 'Start with the free mini-eval or book a call — whichever fits.'],
    ],
  },

  'how-engagements-work': {
    title: 'How engagements work',
    cat: 'Getting started',
    desc: 'The fixed path from a short audit to a shipped, owned system: Audit, Sprint, Build, Operate. Quote-first, evidence at every step.',
    lead: 'One path, four stages, evidence at each. You can stop after any stage — nothing is a trap, and everything you get is yours to keep.',
    blocks: [
      ['cards', [
        ['01 · Audit — ~1 week', 'Your highest-leverage failure mapped, a prioritized plan you own, and a concrete quote for the build. The lowest-risk way to a real number.'],
        ['02 · Sprint — ~2 weeks', 'One visible, production-grade improvement — real code, deployed, measured. A minimum viable gate or a shipped workflow.'],
        ['03 · Build — ~4–8 weeks', 'The full system: the eval battery, the CI gate, the automation, the runbook — owned by your team at handoff.'],
        ['04 · Operate — ongoing (optional)', 'Measure, improve, publish. The system stays green and compounds instead of quietly decaying.'],
      ]],
      ['h', 'What every engagement guarantees'],
      ['ul', [
        'Built in <b>your</b> repo, your CI, your conventions — not a dependency on me.',
        'Every deliverable ends with a runbook and a walkthrough so your team owns it.',
        'Nothing is retained after handoff; access is scoped to the engagement.',
        'If the scoping shows I can’t help, I say so and it costs nothing.',
      ]],
      ['note', 'There is no fixed price list — scope varies too much for one to be honest. Every engagement is scoped and quoted after a short call, so you pay for your problem, not a package. See <a href="docs-pricing.html">Pricing</a>.'],
      ['cta', 'Scope your path', 'Book a call and we’ll figure out which stage you actually need.'],
    ],
  },

  'ai-engineering': {
    title: 'AI product engineering',
    cat: 'What I build',
    desc: 'Building the AI feature itself: chatbots and RAG assistants, voice agents, document intake, copilots, multi-agent orchestration, and reliable function-calling.',
    lead: 'The AI feature itself — built to be reliable from day one, with the evaluation seams already in place so it can be proven later.',
    blocks: [
      ['h', 'What I build'],
      ['cards', [
        ['Conversational assistants / chatbots', 'RAG over your docs, streaming UI, source citations, and a scope guard so it stays on-topic.'],
        ['AI voice agents', 'Inbound + outbound voice that qualifies, books, and follows up — with a hard consent gate on outbound.'],
        ['Document intake & extraction', 'Invoices, forms, and PDFs turned into validated structured data, with a review lane for low-confidence cases.'],
        ['Internal copilots', 'A private assistant wired into your wiki, code, and tickets — access-scoped and auditable.'],
        ['RAG pipeline engineering', 'Chunking, embeddings, hybrid retrieval, reranking, and grounding — with retrieval-quality evals in front.'],
        ['Multi-agent orchestration', 'LangGraph-style flows with explicit state, tool boundaries, retries, and approval checkpoints.'],
      ]],
      ['h', 'How I build it'],
      ['ul', [
        'Structured outputs and function-calling are schema-validated, with fallbacks on parse failure and raw inputs logged beside every decision.',
        'Grounding is enforced by construction where it matters — e.g. no uncited generation path — not asked for in a prompt and hoped for.',
        'The evaluation harness is designed in from the start, so the feature is provable, not just shippable.',
      ]],
      ['note', 'Proven in public: a RAG system where <b>100% of answers cite their source by design</b> — verified live, screenshot on the <a href="index.html#work">homepage</a>.'],
      ['proof', [['Related: Evaluation & quality', 'docs-evaluation-and-quality.html'], ['All services', 'services.html']]],
      ['cta', 'Building an AI feature?', 'Book a call, or get a free mini-eval on the one you already have.'],
    ],
  },

  'evaluation-and-quality': {
    title: 'AI evaluation & quality',
    cat: 'What I build',
    desc: 'The flagship: LLM evaluation harnesses, adversarial safety batteries, CI quality gates, hallucination gates, agent evaluation, and LLM observability.',
    lead: 'The part almost nobody has: the system that proves your AI feature works and blocks the change that would break it. This is the flagship.',
    blocks: [
      ['h', 'What you get'],
      ['ul', [
        '<b>Golden dataset + judge</b> — 50–200 real inputs with agreed-good outputs, versioned next to the code; LLM-as-judge scoring for faithfulness, relevance, and safety.',
        '<b>Safety runner battery</b> — hallucination, jailbreak, prompt-injection, toxicity, PII-leak, refusal, bias, consistency, plus cost and latency budgets.',
        '<b>CI quality gate</b> — the suite runs on every PR; a score below the ratcheted floor blocks the merge, with a scorecard your PM can read.',
        '<b>Runbook + handoff</b> — your team extends the golden set and owns the gate without me.',
      ]],
      ['h', 'Why it matters'],
      ['p', 'Without a gate, prompt changes ship because they “seem better,” nobody can prove what last week’s model bump broke, and the honest answer to “can it say something wrong?” is “probably.” The gate replaces the argument-by-anecdote with a computed score, and moves the failure from production to the pull request.'],
      ['note', 'The mechanics are documented in depth in <a href="guide-eval-gate.html">The CI eval gate</a>, <a href="guide-probes.html">Safety probes</a>, and <a href="guide-golden-set.html">Golden sets &amp; judges</a>.'],
      ['proof', [['llm-eval-gate (open source)', 'https://github.com/JasonTeixeira/llm-eval-gate'], ['nexural-qa-os case study', 'case-studies.html'], ['Watch a live eval', 'eval.html']]],
      ['cta', 'Get the real number', 'A free mini-eval measures your actual failure surface — no call required.'],
    ],
  },

  'test-automation': {
    title: 'Test automation & CI',
    cat: 'What I build',
    desc: 'Risk-scoped Playwright/Pytest regression suites, CI/CD wiring, flake stabilization, mobile real-device certification, performance baselines, and accessibility audits.',
    lead: 'A regression suite a release manager can trust — coverage decided by risk, evidence on every failure, and a green gate that actually means something.',
    blocks: [
      ['h', 'What I build'],
      ['cards', [
        ['E2E test automation', 'Playwright or Cypress with Page Object Model, fixtures, trace-on-retry, and four reporters.'],
        ['CI/CD pipeline + wiring', 'Parallelized runs, artifact retention, required checks — a green badge that means something.'],
        ['Flake stabilization', 'Quarantine lane, retry policy, isolation fixes, weekly triage — red becomes a real signal again.'],
        ['Mobile real-device cert', 'End-to-end certification on real devices — the flows a simulator lies about.'],
        ['Performance baselines', 'k6 load baselines on the critical path, with budgets wired into CI.'],
        ['Accessibility audits', 'WCAG 2.2: keyboard, screen-reader semantics, contrast, reduced-motion — with a prioritized fix list.'],
      ]],
      ['h', 'The discipline'],
      ['p', 'Coverage follows a risk model, not whoever wrote tests last. Every failure ships with a trace and screenshot, so triage is reading evidence, not a scavenger hunt. And flake is treated as a first-class bug — because when red is noise, the team learns to ignore it, and the real regression sails through.'],
      ['note', 'Proven in public: a <b>37/37, zero-flake</b> suite in CI with evidence in the repo, and a live client suite taken from <b>10% flake to under 1%</b>. See the <a href="case-studies.html">case studies</a>.'],
      ['proof', [['playwright-sdet-regression-suite', 'https://github.com/JasonTeixeira/playwright-sdet-regression-suite'], ['Case studies', 'case-studies.html']]],
      ['cta', 'Releases breaking?', 'Book a call and we’ll scope the suite that stops it.'],
    ],
  },

  'workflow-automation': {
    title: 'AI workflow automation',
    cat: 'What I build',
    desc: 'Intake, triage, routing, and RAG-backed workflows on n8n, Make, or code — with human approval points where the risk is, structured outputs, and auditable logs.',
    lead: 'Automation that ships work, not surprises — with humans on the writing side until evals prove otherwise, and a log for every decision.',
    blocks: [
      ['h', 'What I build'],
      ['cards', [
        ['One workflow, end-to-end', 'Intake → classify → route → act, in your accounts, on n8n/Make or code-level LangGraph.'],
        ['Lead capture → qualify → route', 'Every lead caught, scored, routed, and followed up in minutes — nothing slips.'],
        ['Data pipelines / ETL', 'Validation, idempotency, and alerting so the report your business runs on is correct and fresh.'],
        ['Integrations', 'Make the CRM, billing, support desk, and spreadsheet talk — with error handling and an audit trail.'],
      ]],
      ['h', 'The design principle'],
      ['p', 'The most reliable automation I’ve shipped sends zero AI-written messages — it reads, classifies, routes, and alerts a human. Human approval points are placed where the risk is, and earned down with evidence, never assumed away. That design deletes entire classes of failure.'],
      ['note', 'How approval points are placed and earned down is documented in <a href="guide-human-approval.html">Human approval</a>.'],
      ['proof', [['BRIEF/01 — feedback triage', 'index.html#briefs'], ['All services', 'services.html']]],
      ['cta', 'Drowning in manual work?', 'Book a call and we’ll find the highest-leverage thing to automate.'],
    ],
  },

  'product-and-platform': {
    title: 'Product & platform',
    cat: 'What I build',
    desc: 'The surrounding app: production-grade web apps and portals, internal tools and admin panels, APIs and backends, and dashboards.',
    lead: 'The product around the AI: auth, payments, dashboards, and the boring-but-critical parts done right — production-grade, not prototype-grade.',
    blocks: [
      ['cards', [
        ['Web apps & customer portals', 'Authentication, payments, dashboards — the real thing, on Next.js + Supabase or your stack.'],
        ['Internal tools & admin panels', 'The ops dashboard or back-office tool your team runs by hand in a fragile spreadsheet.'],
        ['APIs & backends', 'REST or typed APIs with validation, auth, rate limiting, and tests — a service layer you can build on.'],
        ['Dashboards & data viz', 'Institutional-grade visualization treated as part of the design system, not an afterthought.'],
      ]],
      ['note', 'This site itself is an example: static + serverless, self-hosted fonts, a strict CSP, and its own Playwright + axe suite gating every deploy.'],
      ['cta', 'Need the app, not just the AI?', 'Book a call and we’ll scope it.'],
    ],
  },

  'eval-method': {
    title: 'The eval method',
    cat: 'The eval method',
    desc: 'The philosophy behind proving AI features: computed scores over opinions, adversarial probes, golden sets, ratcheting CI gates, and human approval earned down with evidence.',
    lead: 'A short philosophy, then four deep-dive guides. The whole method reduces to one idea: replace opinions about AI quality with computed scores from real commands.',
    blocks: [
      ['h', 'The four moving parts'],
      ['ol', [
        '<b>A golden set</b> — real inputs paired with agreed-good outputs, versioned next to the code. This is the source of truth.',
        '<b>A judge</b> — an evaluation model (or deterministic check) that scores each output for faithfulness, relevance, and safety.',
        '<b>Safety probes</b> — adversarial inputs that try to break the feature the way a real user or attacker would.',
        '<b>A CI gate</b> — the suite runs on every change; a score below the ratcheted floor blocks the merge.',
      ]],
      ['h', 'The principles'],
      ['ul', [
        '<b>Computed, not claimed.</b> A score comes from a command anyone can re-run — never from an opinion.',
        '<b>Ratchet, don’t just pass.</b> The floor only goes up, so quality can’t silently erode over time.',
        '<b>Earn down human review.</b> Start with a human in the loop; remove approval points only when evals prove it’s safe.',
        '<b>No fake green.</b> If the gate should be red, it goes red — publicly. (This site’s own scorecard works the same way.)',
      ]],
      ['note', 'Deep dives, each with an animated diagram: <a href="guide-eval-gate.html">The CI eval gate</a> · <a href="guide-probes.html">Safety probes</a> · <a href="guide-golden-set.html">Golden sets &amp; judges</a> · <a href="guide-human-approval.html">Human approval</a>.'],
      ['cta', 'See it run', 'The live eval grades an AI in real time — press run and watch it fail probes.'],
    ],
  },

  'process-and-handoff': {
    title: 'Process & handoff',
    cat: 'Working together',
    desc: 'How a week runs, what "done" means, and the runbook + walkthrough that leave your team owning the system.',
    lead: 'How the work actually runs, and what you’re left holding at the end. The deliverable is a system your team runs without me — never a dependency on me.',
    blocks: [
      ['h', 'How a typical build runs'],
      ['cards', [
        ['Week 1 — Scope & risk map', 'Your feature, your failure modes. We agree what “working” means and how it will be measured.'],
        ['Week 2–3 — Build', 'The automation, agent, or suite — in your repo, your CI, your conventions.'],
        ['Week 3–4 — Harness & gate', 'Evals and regression wired into CI. A red gate blocks the deploy, not the retro.'],
        ['Handoff — Runbook & evidence', 'Docs, scorecard, and a walkthrough so your team owns it without me.'],
      ]],
      ['h', 'What "done" means'],
      ['ul', [
        'Something visible ships inside the first two weeks — no long silent phases.',
        'The final artifact is reproducible: a command your team can run to get the same result.',
        'A runbook covers how to extend, re-run, and debug it — and I walk your team through it live.',
      ]],
      ['cta', 'Questions about process?', 'Book a call — happy to walk through exactly how it’d go for your team.'],
    ],
  },

  'data-and-security': {
    title: 'Data & security',
    cat: 'Working together',
    desc: 'How your code, credentials, and data are handled: NDA-friendly, access scoped to the engagement, credentials in your systems, nothing retained after handoff.',
    lead: 'The short version: your code stays in your repos, your credentials stay in your systems, and nothing is retained after handoff.',
    blocks: [
      ['ul', [
        '<b>NDA-friendly.</b> Happy to sign yours before anything sensitive changes hands.',
        '<b>Scoped access.</b> I take the least access needed for the engagement, and it’s revoked at the end.',
        '<b>Your systems of record.</b> Code stays in your repos; credentials stay in your secret manager; automations run in your accounts.',
        '<b>Nothing retained.</b> After handoff I don’t keep copies of your data or code.',
        '<b>Evaluation data.</b> Golden sets and eval fixtures live in your repo, versioned next to the code — you own them.',
      ]],
      ['note', 'A one-page data-handling summary is available before we start — ask for it on the call.'],
      ['cta', 'Security questions?', 'Book a call — I’ll answer them plainly and put it in writing.'],
    ],
  },

  pricing: {
    title: 'Pricing',
    cat: 'Working together',
    desc: 'How pricing works: quote-first, no fixed price list. Every engagement is scoped and quoted after a short call so you pay for your problem, not a package.',
    lead: 'There is no fixed price list — and that’s a deliberate, honest choice, not a dodge.',
    blocks: [
      ['h', 'Why quote-first'],
      ['p', 'Scope varies too much between a one-workflow automation and a full eval battery for a single price list to be honest. A menu price is either padded to cover the worst case or a bait number that balloons later. Instead, every engagement is scoped and quoted in writing after a short call — fixed scope, never open-ended hours — so you pay for your specific problem, not a package.'],
      ['h', 'How to get a real number, fast'],
      ['ol', [
        'Start with a <b>free mini-eval</b> or a 15-minute call — both end with a concrete plan.',
        'The <b>audit</b> (about a week) produces a prioritized plan and a firm quote for the build, which is credited into the build if you continue.',
        'Everything is quoted in writing before work starts, with a 50% deposit on builds.',
      ]],
      ['note', 'Want to size the upside first? The <a href="roi.html">ROI calculator</a> estimates what an unreliable AI feature is costing you per year.'],
      ['cta', 'Get your quote', 'Book a call and you’ll leave with a real number either way.'],
    ],
  },

  faq: {
    title: 'FAQ',
    cat: 'Reference',
    desc: 'Common questions about working with Jason: existing QA teams, your stack vs mine, cost, timelines, data handling, and full-time roles.',
    lead: 'The questions I get most, answered plainly.',
    blocks: [
      ['h', 'We already have QA — why bring you in?'],
      ['p', 'Your QA team almost certainly covers the deterministic surface. The gap is the LLM feature: no golden set, no judge, no gate — prompt changes ship on vibes. I add the eval layer to your existing pipeline, and your team owns it when I leave.'],
      ['h', 'Do you work in our stack or yours?'],
      ['p', 'Yours. Your repo, your CI, your conventions. Every engagement ends with a runbook and a walkthrough — the deliverable is a system your team runs without me.'],
      ['h', 'What does it cost?'],
      ['p', 'There’s no fixed price list because scope varies too much for one to be honest. Every engagement is quoted in writing after a short scoping call. See <a href="docs-pricing.html">Pricing</a>.'],
      ['h', 'How fast can you start, and how long does it take?'],
      ['p', 'Booking one engagement at a time — check the availability chip on the site. The audit is about a week; sprints run ~2–3 weeks; full builds ~4–8 depending on scope. Something visible ships in the first two weeks.'],
      ['h', 'What if the evals show our AI is fine?'],
      ['p', 'Then you ship with evidence instead of hope — that’s the win. The suite stays in CI catching the regression that would have landed six weeks later.'],
      ['h', 'Do you take full-time roles?'],
      ['p', 'Open to the right one. The site has a “Hire me” mode and a résumé — the capabilities here are the ones I’d bring to a team on day one.'],
      ['cta', 'Still have a question?', 'Ask my AI associate on any page, or book a call.'],
    ],
  },

  glossary: {
    title: 'Glossary',
    cat: 'Reference',
    desc: 'Plain-English definitions of the AI-evaluation and QA terms used across this documentation.',
    lead: 'Plain-English definitions — no jargon for its own sake.',
    blocks: [
      ['ul', [
        '<b>Golden set</b> — a curated collection of real inputs paired with agreed-good outputs, used as the source of truth for scoring an AI feature.',
        '<b>LLM-as-judge</b> — using an evaluation model to score another model’s output against criteria like faithfulness, relevance, and safety.',
        '<b>Faithfulness / grounding</b> — whether an answer is actually supported by its source material, rather than invented.',
        '<b>Hallucination</b> — a confident, fluent answer that is not true or not grounded in any source.',
        '<b>Prompt injection</b> — an input crafted to make the model ignore its instructions and do something else.',
        '<b>Jailbreak</b> — an attempt to bypass a model’s safety rules, often via role-play or a fake “no-rules” persona.',
        '<b>CI quality gate</b> — an automated check in your pipeline that blocks a merge or deploy when a quality score drops below a floor.',
        '<b>Ratchet</b> — a gate whose passing floor only ever moves up, so quality can’t silently erode.',
        '<b>Flake</b> — a test that passes and fails without any code change; flaky suites train teams to ignore red.',
        '<b>Golden run / evidence</b> — a saved, reproducible test run (traces, screenshots) that proves a result.',
        '<b>Human-in-the-loop</b> — a design where a person approves an AI action at a defined risk point.',
        '<b>RAG</b> — retrieval-augmented generation: grounding answers in retrieved documents instead of model memory.',
      ]],
    ],
  },

  'proof-index': {
    title: 'Proof index',
    cat: 'Reference',
    desc: 'Every proof artifact in one place: public repos, verbatim test runs, case studies, and live demos.',
    lead: 'Everything on this site is backed by something you can open. Here it all is, in one place.',
    blocks: [
      ['h', 'Public code'],
      ['proof', [
        ['llm-eval-gate — keyless eval-gate template (MIT)', 'https://github.com/JasonTeixeira/llm-eval-gate'],
        ['playwright-sdet-regression-suite — 37/37 in CI', 'https://github.com/JasonTeixeira/playwright-sdet-regression-suite'],
        ['GitHub profile', 'https://github.com/JasonTeixeira'],
      ]],
      ['h', 'Verbatim runs & case studies'],
      ['proof', [
        ['Case studies — four measured outcomes', 'case-studies.html'],
        ['nexural-qa-os — the red run', 'captures/nexural-qa-os.html'],
        ['nexural-qa-os — the green rerun', 'captures/nexural-qa-os-fixed.html'],
        ['playwright suite — the run', 'captures/playwright-suite.html'],
      ]],
      ['h', 'Live & interactive'],
      ['proof', [
        ['The live eval (grades an AI in real time)', 'eval.html'],
        ['Live demos (AI receptionist, voice, pipeline)', 'demos.html'],
        ['Sample eval report', 'sample.html'],
        ['ROI calculator', 'roi.html'],
      ]],
      ['note', 'This documentation site is itself proof: it’s generated, static, and gated by its own Playwright + axe suite on every deploy.'],
      ['cta', 'Want your system on the case-studies page?', 'Start with a free mini-eval.'],
    ],
  },
};

// Slugs of generated pages, in sidebar order — consumed by build-notes.mjs for the sitemap.
export const DOC_SLUGS = NAV.flatMap((g) => g.items.filter((i) => i.slug).map((i) => i.slug));
export { BOOK };
