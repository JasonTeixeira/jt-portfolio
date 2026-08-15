/* Jason Teixeira Portfolio — data + behavior, ported from the Claude Design DCLogic component. */
(function () {
  'use strict';

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────────────────────── data ───────────────────────── */

  var TERM_LINES = [
    { c: '#22d3ee', t: '$ node scripts/proof-loop.mjs' },
    { c: '#8E8882', t: '┌─ PROOF SCORECARD ────────────────────────────────────────────────────' },
    { c: '#d4d4d8', t: '│ ✓ Tests green            3,750 passed / 0 failed' },
    { c: '#d4d4d8', t: '│ ✓ Coverage: lines        91.25%  (≥ 90.03% ratcheted)' },
    { c: '#d4d4d8', t: '│ ✓ Coverage: branches     82.73%  (≥ 81.52% ratcheted)' },
    { c: '#d4d4d8', t: '│ ✓ Security: prod CVEs    0 high/critical in shipped deps' },
    { c: '#d4d4d8', t: '│ ✓ Security: secrets      0 in tracked source' },
    { c: '#d4d4d8', t: '│ ✓ Build / Typecheck      113/113 tasks · exit 0' },
    { c: '#d4d4d8', t: '│ ✓ Perf: startup / bundle 413ms · 2.7 MB' },
    { c: '#8E8882', t: '└────────────────────────────────────────────────────' },
    { c: '#10b981', t: 'VERDICT: PROVEN ✓ — 13/13 gates   (evidence: .nexural/proof-ledger.json)' },
    { c: '#8E8882', t: '# run it twice — identical output. that reproducibility IS the proof.' }
  ];

  var TOOLS = ['LangGraph', 'Mastra', 'n8n', 'Make', 'Zapier', 'pgvector', 'Supabase', 'FastAPI', 'Next.js', 'Playwright', 'Pytest', 'k6', 'Promptfoo', 'DeepEval', 'LLM-as-judge', 'Langfuse', 'GitHub Actions'];

  var TIMELINE = [
    { week: 'WEEK 1', delay: '0s', name: 'Scope & risk map', desc: 'Your feature, your failure modes. We agree what "working" means and how it will be measured.', color: '#0e7490' },
    { week: 'WEEK 2–3', delay: '0.5s', name: 'Build', desc: 'The automation, agent, or suite — in your repo, your CI, your conventions.', color: '#57534E' },
    { week: 'WEEK 3–4', delay: '1s', name: 'Harness & gate', desc: 'Evals and regression wired into CI. A red gate blocks the deploy, not the retro.', color: '#a78bfa' },
    { week: 'HANDOFF', delay: '1.5s', name: 'Runbook & evidence', desc: 'Docs, scorecard, and a walkthrough so your team owns it without me.', color: '#10b981' }
  ];

  var PROJECTS = [
    {
      num: '01', fig: '02', dir: 'row', name: 'sage-agents', kind: 'Agents · LLM apps', color: '#22d3ee',
      badge: 'ESTIMATED', badgeColor: '#F59E0B', badgeBorder: 'rgba(245,158,11,0.4)', priv: true, href: '',
      desc: 'Agent warehouse monorepo: voice agents, outbound SDR, RAG support chat, and workflow orchestrators on Mastra + LangGraph — with a multi-provider LLM router, cost tracking per run, Langfuse tracing, and a hard TCPA consent gate on every outbound call.',
      metric: 'blank page → staged client agent in days, not weeks — estimated from template scaffold time',
      tags: ['Mastra', 'LangGraph', 'Vercel AI SDK', 'Supabase', 'Langfuse'],
      term: [
        { c: '#8E8882', t: '$ pnpm tsx infra/scripts/create-agent.ts \\' },
        { c: '#8E8882', t: '    inbound-voice acme-inbound-voice' },
        { c: '#22d3ee', t: 'scaffolded @sage/agent-acme-inbound-voice' },
        { c: '#10b981', t: '✓ prompts · tools · evals/golden.json ready' }
      ]
    },
    {
      num: '02', fig: '03', dir: 'row-reverse', name: 'sage-kernel', kind: 'Autonomous workflow', color: '#10b981',
      badge: 'VERIFIED', badgeColor: '#10b981', badgeBorder: 'rgba(16,185,129,0.4)', priv: false, href: 'https://github.com/JasonTeixeira/sage-kernel',
      desc: 'Proof-first MCP engineering OS: 140 tools an AI agent drives through policy, signed approvals, and a hash-chained proof ledger. Nothing is "done" because a model said so — a claim-firewall rejects unproven success language.',
      metric: '140 MCP tools · 78 release gates green — verified: npm run release:check exits 0',
      tags: ['Node 22', 'MCP', 'SAST + taint', 'SQLite/Postgres'],
      term: [
        { c: '#8E8882', t: '$ npm run mcp:smoke' },
        { c: '#10b981', t: 'passed, 140 tools' },
        { c: '#8E8882', t: '$ npm run release:check' },
        { c: '#10b981', t: '✓ 78/78 gates · exit 0' }
      ]
    },
    {
      num: '03', fig: '04', dir: 'row', name: 'ai-research-dashboard', kind: 'RAG', color: '#22d3ee',
      badge: 'VERIFIED', badgeColor: '#10b981', badgeBorder: 'rgba(16,185,129,0.4)', priv: true, href: '',
      desc: 'RAG knowledge base where every answer is extractive and cited. Durable ingestion worker, pgvector retrieval, persisted eval runs, and a full audit trail from source to answer.',
      metric: '100% of answers carry citations to their source chunks — verified: enforced by design, no free generation path',
      tags: ['FastAPI', 'pgvector', 'Gemini', 'React'],
      term: [
        { c: '#8E8882', t: '$ curl -X POST /queries -d "…"' },
        { c: '#d4d4d8', t: 'answer: "…" [chunk 14, chunk 22]' },
        { c: '#8E8882', t: '$ curl /evals/run-seed' },
        { c: '#10b981', t: '✓ eval run persisted · citations 100%' }
      ]
    },
    {
      num: '04', fig: '05', dir: 'row-reverse', name: 'playwright-sdet-regression-suite', kind: 'QA framework + CI', color: '#a78bfa',
      badge: 'VERIFIED', badgeColor: '#10b981', badgeBorder: 'rgba(16,185,129,0.4)', priv: false, href: 'https://github.com/JasonTeixeira/playwright-sdet-regression-suite',
      desc: 'Release-critical e-commerce flows under regression with the evidence a release manager would ask for: traces, screenshots, four reporters, and a written risk model. CI uploads artifacts on every push.',
      metric: '37/37 specs passing · 9 failure modes covered — verified: CI badge + evidence/ folder in repo',
      tags: ['Playwright', 'TypeScript', 'POM', 'GitHub Actions'],
      term: [
        { c: '#8E8882', t: '$ npm test' },
        { c: '#d4d4d8', t: 'Running 37 tests using 4 workers' },
        { c: '#10b981', t: '  37 passed (2.1m)' },
        { c: '#8E8882', t: 'artifacts → evidence/ · HTML · JSON · JUnit' }
      ]
    },
    {
      num: '05', fig: '06', dir: 'row', name: 'nexural-qa-os', kind: 'LLM-eval suite', color: '#a78bfa',
      badge: 'VERIFIED', badgeColor: '#10b981', badgeBorder: 'rgba(16,185,129,0.4)', priv: true, href: '',
      desc: '85 quality runners under one CLI — including hallucination, jailbreak, prompt-injection, toxicity, and PII-leak evals for LLM features. Every score is computed from a real command and packaged as ed25519-signed evidence.',
      metric: '3,750 tests · 91% line coverage · 13/13 proof gates — verified: reproducible via proof-loop.mjs',
      tags: ['Turbo + pnpm', 'vitest', 'DAG orchestrator', 'ed25519'],
      term: [
        { c: '#8E8882', t: '$ npx @nexural/qa-cli run --fast' },
        { c: '#d4d4d8', t: 'DAG: 85 runners · honest-skip on absent infra' },
        { c: '#10b981', t: 'VERDICT: PROVEN ✓ — 13/13 gates' },
        { c: '#a78bfa', t: 'evidence signed → qa verify re-checks offline' }
      ]
    }
  ];

  /* per-project architecture diagrams — nodes on a 440×150 grid.
     y:75 = main line; 35/115 = branch lanes. Packets travel the paths. */
  var ARCH = {
    'sage-agents': {
      nodes: [
        { x: 38, y: 75, c: '#A8A29E', l: 'intake', s: 'web · phone' },
        { x: 148, y: 75, c: '#22d3ee', l: 'LLM router', s: 'cost-tracked' },
        { x: 262, y: 35, c: '#22d3ee', l: 'voice', s: 'TCPA gate' },
        { x: 262, y: 75, c: '#A8A29E', l: 'SDR', s: '' },
        { x: 262, y: 115, c: '#a78bfa', l: 'RAG chat', s: '' },
        { x: 396, y: 75, c: '#10b981', l: 'Langfuse', s: 'every run traced' }
      ],
      edges: [[0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [3, 5], [4, 5]],
      packets: [
        { d: 'M38,75 H148 C190,75 210,35 262,35 C314,35 350,75 396,75', c: '#22d3ee', dur: 5, delay: 0 },
        { d: 'M38,75 H396', c: '#A8A29E', dur: 5, delay: 1.6 },
        { d: 'M38,75 H148 C190,75 210,115 262,115 C314,115 350,75 396,75', c: '#a78bfa', dur: 5, delay: 3.2 }
      ]
    },
    'sage-kernel': {
      nodes: [
        { x: 38, y: 75, c: '#A8A29E', l: 'AI agent', s: 'claude · cursor' },
        { x: 155, y: 75, c: '#F59E0B', l: 'policy', s: 'signed approvals' },
        { x: 272, y: 75, c: '#22d3ee', l: '140 tools', s: 'MCP' },
        { x: 396, y: 75, c: '#10b981', l: 'proof ledger', s: 'hash-chained' }
      ],
      edges: [[0, 1], [1, 2], [2, 3]],
      packets: [
        { d: 'M38,75 H396', c: '#10b981', dur: 4.5, delay: 0 },
        { d: 'M38,75 H396', c: '#22d3ee', dur: 4.5, delay: 2.2 }
      ]
    },
    'ai-research-dashboard': {
      nodes: [
        { x: 38, y: 75, c: '#A8A29E', l: 'sources', s: 'durable ingest' },
        { x: 155, y: 75, c: '#22d3ee', l: 'chunker', s: 'embed' },
        { x: 272, y: 75, c: '#a78bfa', l: 'pgvector', s: 'cosine top-k' },
        { x: 396, y: 75, c: '#10b981', l: 'cited answer', s: 'audit trail' }
      ],
      edges: [[0, 1], [1, 2], [2, 3]],
      packets: [
        { d: 'M38,75 H396', c: '#22d3ee', dur: 4.5, delay: 0 },
        { d: 'M38,75 H396', c: '#a78bfa', dur: 4.5, delay: 2.2 }
      ]
    },
    'playwright-sdet-regression-suite': {
      nodes: [
        { x: 38, y: 75, c: '#A8A29E', l: 'push / PR', s: '' },
        { x: 155, y: 75, c: '#22d3ee', l: 'CI', s: 'GitHub Actions' },
        { x: 272, y: 75, c: '#a78bfa', l: '37 specs', s: '4 workers · POM' },
        { x: 396, y: 75, c: '#10b981', l: 'green gate', s: 'traces · 4 reporters' }
      ],
      edges: [[0, 1], [1, 2], [2, 3]],
      packets: [
        { d: 'M38,75 H396', c: '#a78bfa', dur: 4.5, delay: 0 },
        { d: 'M38,75 H396', c: '#10b981', dur: 4.5, delay: 2.2 }
      ]
    },
    'nexural-qa-os': {
      nodes: [
        { x: 38, y: 75, c: '#A8A29E', l: 'qa run', s: 'one CLI' },
        { x: 155, y: 75, c: '#22d3ee', l: 'DAG', s: 'plugin runners' },
        { x: 272, y: 75, c: '#a78bfa', l: '85 runners', s: '10 AI-safety' },
        { x: 396, y: 75, c: '#10b981', l: 'verdict', s: 'ed25519 signed' }
      ],
      edges: [[0, 1], [1, 2], [2, 3]],
      packets: [
        { d: 'M38,75 H396', c: '#a78bfa', dur: 4.5, delay: 0 },
        { d: 'M38,75 H396', c: '#10b981', dur: 4.5, delay: 2.2 }
      ]
    }
  };

  var BRIEFS = [
    {
      num: 'BRIEF/01', fig: '07', color: '#22d3ee', title: 'Feedback triage that runs itself', repo: 'Make + Gemini workflow',
      outcome: 'Negative feedback now surfaces in seconds — not at the Friday review.',
      stack: 'Make · Gemini 2.5 Flash · Google Forms · Sheets · Gmail',
      flow: [
        { t: 'Google Forms', c: '#A8A29E', b: '#2A2826', arrow: true },
        { t: 'Make webhook', c: '#22d3ee', b: 'rgba(34,211,238,0.35)', arrow: true },
        { t: 'Gemini 2.5 Flash — classify + summarize', c: '#22d3ee', b: 'rgba(34,211,238,0.35)', arrow: true },
        { t: 'Sheets log', c: '#A8A29E', b: '#2A2826', arrow: true },
        { t: 'negative? → email alert', c: '#f43f5e', b: 'rgba(244,63,94,0.35)', arrow: false }
      ],
      sections: [
        { label: 'Problem', text: 'Customer feedback arrived through a form and sat unread. Negative signals surfaced days late — after the customer was already gone.' },
        { label: 'Why not a chatbot', text: 'Nobody wants to converse with their own feedback queue. The value is deterministic: classify, summarize, route, alert. A chat interface would add latency and remove auditability.' },
        { label: 'Architecture', text: 'Make scenario, four steps end to end — see fig. 1. Each step re-runnable in isolation.' },
        { label: 'Retrieval / memory', text: 'None needed — each message is classified independently. Deliberately avoided: statelessness keeps the pipeline debuggable.' },
        { label: 'Human approval points', text: 'The AI never replies to a customer. It routes to a human with a summary; the alert email is the handoff, not the resolution.' },
        { label: 'Production safeguards', text: 'Structured output schema on the LLM step, fallback label on parse failure, and the raw message always logged alongside the classification.' },
        { label: 'Measured results', text: 'Negative feedback surfaces in real time instead of at end-of-week review — measured as webhook-to-alert latency of seconds vs a manual weekly pass.' },
        { label: 'What I would harden next', text: 'A golden set of labeled messages run nightly through Promptfoo to catch classification drift when the model version changes.' }
      ]
    },
    {
      num: 'BRIEF/02', fig: '08', color: '#10b981', title: 'RAG that cites or shuts up', repo: 'ai-research-dashboard',
      outcome: '100% of answers cite their source. Not by prompt — by design.',
      stack: 'FastAPI · pgvector · SQLite/Postgres · Gemini · React',
      flow: [
        { t: 'source', c: '#A8A29E', b: '#2A2826', arrow: true },
        { t: 'chunker', c: '#22d3ee', b: 'rgba(34,211,238,0.35)', arrow: true },
        { t: 'embed → pgvector', c: '#22d3ee', b: 'rgba(34,211,238,0.35)', arrow: true },
        { t: 'cosine retrieval', c: '#a78bfa', b: 'rgba(167,139,250,0.35)', arrow: true },
        { t: 'extractive answer + citations', c: '#10b981', b: 'rgba(16,185,129,0.35)', arrow: true },
        { t: 'audit trail', c: '#A8A29E', b: '#2A2826', arrow: false }
      ],
      sections: [
        { label: 'Problem', text: 'Research teams need answers from their own corpus — but a RAG system that paraphrases confidently without sources is a liability, not a tool.' },
        { label: 'Why not a chatbot', text: 'A chat wrapper over the corpus was the obvious build. The actual need was an operations dashboard: sources, ingestion jobs, eval runs, and feedback all inspectable — the Q&A is one feature inside it.' },
        { label: 'Architecture', text: 'FastAPI API + durable ingestion worker feeding fig. 1; provider gateway swaps local deterministic embeddings for Gemini per environment. React dashboard on top.' },
        { label: 'Retrieval / memory', text: 'Persisted queries, answers, and citations. Deleting a source cascades: chunks, embeddings, jobs, payloads, citations — no orphaned memory.' },
        { label: 'Human approval points', text: 'Answer-level feedback endpoint feeds a review loop; eval runs are triggered and persisted by API so a human signs off before provider or threshold changes ship.' },
        { label: 'Production safeguards', text: 'Extractive-only answers (cite or abstain), full audit trail on source/query/eval/feedback events, deterministic local providers for reproducible dev, Gemini fallback-to-local on missing keys.' },
        { label: 'Measured results', text: '100% of answers citation-backed — verified by design: there is no uncited generation path. Quality, safety, latency, and cost tracked per query on the analytics endpoint.' },
        { label: 'What I would harden next', text: 'Promote eval thresholds into deployment gates so a retrieval regression blocks the release, not the retro.' }
      ]
    },
    {
      num: 'BRIEF/03', fig: '09', color: '#a78bfa', title: 'The QA OS that can’t lie', repo: 'nexural-qa-os',
      outcome: '3,750 tests. 13/13 gates. Run it twice — identical output.',
      stack: 'TypeScript · Turbo/pnpm · vitest · Playwright · k6 · ed25519',
      flow: [
        { t: 'qa init — detect stack', c: '#A8A29E', b: '#2A2826', arrow: true },
        { t: 'DAG orchestrator', c: '#22d3ee', b: 'rgba(34,211,238,0.35)', arrow: true },
        { t: '85 runners — incl. 10 LLM-safety evals', c: '#a78bfa', b: 'rgba(167,139,250,0.35)', arrow: true },
        { t: 'computed verdict', c: '#10b981', b: 'rgba(16,185,129,0.35)', arrow: true },
        { t: 'ed25519-signed evidence', c: '#10b981', b: 'rgba(16,185,129,0.35)', arrow: false }
      ],
      sections: [
        { label: 'Problem', text: 'Quality dashboards state numbers they can’t defend. For LLM features it’s worse: teams ship prompt changes with no regression signal at all.' },
        { label: 'Why not a chatbot', text: 'An "AI QA assistant" that opines on quality is exactly the failure mode. The verdict must be computed by code from command exit codes — an LLM never grades its own homework here.' },
        { label: 'Architecture', text: 'One CLI driving fig. 1: every runner is a plugin (detect → plan → run → collectEvidence); one hung runner can’t stall a run. Two gates: <15ms pre-commit, full-repo merge gate.' },
        { label: 'Retrieval / memory', text: 'Evidence ledger instead of memory: every run’s exact command, exit code, and parsed metric recorded to a proof ledger, re-verifiable offline.' },
        { label: 'Human approval points', text: 'The autonomous fix loop is bounded — fixes only what the harness can verify, commits on improvement, reverts on regression, stops on an honest stall for human review.' },
        { label: 'Production safeguards', text: 'Anti-hallucination contract: no score without a backing artifact. Ratcheting coverage floors, honest-skip discipline, ed25519-signed redacted evidence.' },
        { label: 'Measured results', text: '3,750 tests, 91.25% line coverage, 13/13 proof gates — verified: one command regenerates the scorecard, and running it twice produces identical output.' },
        { label: 'LLM-eval coverage', text: 'Ten dedicated AI-safety runners: bias, consistency, hallucination, jailbreak, prompt-injection, refusal, toxicity, PII-leak, cost, latency — the harness I bring to client LLM features.' }
      ]
    }
  ];

  var SERVICES = [
    {
      name: 'LLM feature QA & eval harness', color: '#a78bfa', href: 'services/llm-evaluation-qa.html',
      desc: 'Your LLM feature gets a regression suite: golden traces, LLM-as-judge scoring for faithfulness and safety, and a CI gate that blocks the deploy when quality drops.',
      items: ['Promptfoo / DeepEval suite on your real traffic patterns', 'Hallucination, injection & toxicity runners', 'CI gate + scorecard your PM can read'],
      proof: 'nexural-qa-os — 10 AI-safety runners, 13/13 gates'
    },
    {
      name: 'Test automation + CI setup', color: '#10b981', href: 'services/test-automation-ci.html',
      desc: 'A risk-scoped Playwright/Pytest suite with the evidence discipline of a release manager: traces, reports, artifacts — wired into GitHub Actions from day one.',
      items: ['Risk model → coverage matrix, not script soup', 'Four reporters, trace-on-retry, artifact retention', 'k6 load baseline on the critical path'],
      proof: 'playwright-sdet-regression-suite — 37/37 in CI'
    },
    {
      name: 'AI workflow automation build', color: '#0e7490', href: 'services/ai-workflow-automation.html',
      desc: 'A working automation — intake, triage, routing, RAG-backed answers — built on n8n/Make or LangGraph, with human approval points where they belong and logs you can audit.',
      items: ['n8n / Make / Zapier or code-level LangGraph', 'Human-in-the-loop gates, structured outputs', 'Runbook + handoff so your team owns it'],
      proof: 'sage-agents templates · feedback-triage pipeline'
    }
  ];

  var NOTES = [
    { href: 'notes/no-fake-green.html', date: '2026·08', color: '#10b981', read: '6 min', title: 'No fake green: what a proof ledger taught me about AI agents', dek: 'Agents will happily report success they never earned. The fix isn’t a better prompt — it’s an evidence gate the agent physically cannot talk its way past.' },
    { href: 'notes/llm-regression-suite.html', date: '2026·07', color: '#a78bfa', read: '5 min', title: 'Your LLM feature needs a regression suite more than a better prompt', dek: 'Prompt tweaks feel like progress because nobody is measuring. Golden traces + LLM-as-judge in CI turn "it seems better" into a diff you can gate on.' },
    { href: 'notes/automation-that-never-talks.html', date: '2026·06', color: '#22d3ee', read: '4 min', title: 'Automation that never talks to your customer', dek: 'The best-converting AI workflow I’ve shipped sends zero AI-written messages. Where to put the human approval point, and why it beats full autonomy.' }
  ];

  var PIPELINE_LOGS = ['eval:faithfulness 0.94 PASS', 'ci:typecheck exit 0', 'eval:injection blocked 12/12', 'deploy:staging ok 8.2s', 'regression 37/37 green', 'judge:toxicity 0.00 PASS', 'proof:ledger +1 entry sha256 ok', 'k6 p95 210ms < 400ms budget', 'eval:pii-leak 0 findings', 'retry: prompt v2 → faithfulness 0.96', 'gate:coverage 91.25% ≥ 90.03%', 'verdict PROVEN — evidence signed'];

  /* ───────────────────────── helpers ───────────────────────── */

  function el(tag, style, children, attrs) {
    var node = document.createElement(tag);
    if (style) node.setAttribute('style', style);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  function txt(tag, style, text, attrs) { return el(tag, style, [text], attrs); }
  var MONO = "font-family:'JetBrains Mono',monospace;";
  var SERIF = "font-family:'Instrument Serif',Georgia,serif;";

  /* ───────────────────────── funnel toggle ───────────────────────── */

  var root = document.getElementById('jt-root');
  function setFunnel(f) {
    root.setAttribute('data-funnel', f);
    document.querySelectorAll('.funnel-btn').forEach(function (b) {
      var on = b.getAttribute('data-set') === f;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    try { localStorage.setItem('jt-funnel', f); } catch (e) { /* private mode */ }
    if (typeof window.va === 'function') window.va('event', { name: 'funnel-' + f });
  }
  document.querySelectorAll('.funnel-btn').forEach(function (b) {
    b.addEventListener('click', function () { setFunnel(b.getAttribute('data-set')); });
  });
  var savedFunnel = null;
  try { savedFunnel = localStorage.getItem('jt-funnel'); } catch (e) { /* private mode */ }
  setFunnel(savedFunnel === 'hire' ? 'hire' : 'client');

  /* ───────────────────────── hero pipeline ───────────────────────── */

  function buildPipeline() {
    var W = 1160, H = 300;
    var pTop = 'M110,150 H370 C480,150 560,70 700,70 C840,70 920,150 1010,150';
    var pMid = 'M110,150 H1010';
    var pBot = 'M110,150 H370 C480,150 560,230 700,230 C840,230 920,150 1010,150';
    var NS = 'http://www.w3.org/2000/svg';

    function sv(tag, attrs, children) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      (children || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    function node(x, y, color, r) {
      return sv('g', {}, [
        sv('circle', { cx: x, cy: y, r: r + 7, fill: 'none', stroke: color, 'stroke-opacity': '0.35' }),
        sv('circle', { cx: x, cy: y, r: r, fill: color })
      ]);
    }
    function label(x, y, text, color, size, anchor) {
      var t = sv('text', { x: x, y: y, fill: color, 'font-family': "'JetBrains Mono',monospace", 'font-size': size, 'letter-spacing': '0.12em', 'text-anchor': anchor || 'middle' });
      t.textContent = text;
      return t;
    }
    var svg = sv('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, style: 'position:absolute;inset:0' }, [
      sv('path', { d: pTop, fill: 'none', stroke: '#2A2826', 'stroke-width': '1' }),
      sv('path', { d: pMid, fill: 'none', stroke: '#2A2826', 'stroke-width': '1' }),
      sv('path', { d: pBot, fill: 'none', stroke: '#2A2826', 'stroke-width': '1' }),
      node(110, 150, '#22d3ee', 5), label(110, 190, 'BUILD', '#22d3ee', 12), label(110, 208, 'LangGraph · n8n · RAG', '#8E8882', 9.5),
      node(370, 150, '#A8A29E', 5), label(370, 190, 'DEPLOY', '#A8A29E', 12), label(370, 208, 'CI · gated release', '#8E8882', 9.5),
      node(700, 70, '#a78bfa', 4), label(722, 66, 'FAITHFULNESS', '#a78bfa', 10, 'start'), label(722, 80, '0.94 · judge', '#8E8882', 9, 'start'),
      node(700, 150, '#a78bfa', 4), label(722, 146, 'INJECTION', '#a78bfa', 10, 'start'), label(722, 160, 'blocked · retried', '#8E8882', 9, 'start'),
      node(700, 230, '#a78bfa', 4), label(722, 226, 'REGRESSION', '#a78bfa', 10, 'start'), label(722, 240, '37/37 · Playwright', '#8E8882', 9, 'start'),
      node(1010, 150, '#10b981', 6), label(1010, 190, 'PASS', '#10b981', 12), label(1010, 208, 'proof ledger · signed', '#8E8882', 9.5)
    ]);

    function packet(path, color, dur, delay, anim) {
      return el('div', 'position:absolute;left:0;top:0;width:7px;height:7px;border-radius:50%;background:' + color +
        ';opacity:0;box-shadow:0 0 8px ' + color + ";offset-path:path('" + path + "');offset-rotate:0deg;animation:" +
        anim + ' ' + dur + 's linear infinite;animation-delay:' + delay + 's');
    }
    var flash = el('div', 'position:absolute;left:689px;top:139px;width:22px;height:22px;border-radius:50%;border:1.5px solid #f43f5e;opacity:0;animation:jt-evalflash 11s linear infinite');
    var ringDefs = [
      { x: 99, y: 139, c: '#22d3ee' }, { x: 359, y: 139, c: '#A8A29E' },
      { x: 689, y: 59, c: '#a78bfa' }, { x: 999, y: 139, c: '#10b981' }
    ];
    var rings = ringDefs.map(function (r, i) {
      return el('span', 'position:absolute;left:' + r.x + 'px;top:' + r.y + 'px;width:22px;height:22px;border-radius:50%;border:1px solid ' + r.c + ';animation:jt-ringpulse 3s ease-out infinite;animation-delay:' + (i * 0.75) + 's');
    });

    var logCol = el('div', 'animation:jt-scrollup 26s linear infinite',
      PIPELINE_LOGS.concat(PIPELINE_LOGS).map(function (l) { return txt('div', 'white-space:nowrap', l); }));
    var logs = el('div', "position:absolute;right:18px;top:10px;bottom:10px;width:300px;overflow:hidden;opacity:0.07;" + MONO + "font-size:10px;line-height:1.9;color:#F4F2EF;text-align:right;pointer-events:none;-webkit-mask-image:linear-gradient(transparent,black 20%,black 80%,transparent);mask-image:linear-gradient(transparent,black 20%,black 80%,transparent)", [logCol]);

    var stage = el('div', 'position:relative;width:' + W + 'px;height:' + H + 'px', [svg].concat(rings, [flash,
      packet(pTop, '#22d3ee', 5.5, 0, 'jt-travel'),
      packet(pTop, '#a78bfa', 5.5, 2.7, 'jt-travel'),
      packet(pBot, '#10b981', 6.5, 1.2, 'jt-travel'),
      packet(pBot, '#22d3ee', 6.5, 4.3, 'jt-travel'),
      packet(pMid, '#22d3ee', 11, 0.5, 'jt-fail')
    ]));

    return el('div', 'position:relative;background:#0C0C0E;border:1px solid #2A2826;border-radius:14px;overflow:hidden;min-width:' + W + 'px', [logs, stage]);
  }
  var pipelineMount = document.getElementById('jt-pipeline');
  if (pipelineMount) pipelineMount.appendChild(buildPipeline());

  /* ───────────────────────── live ticker + stat counters ───────────────────────── */

  var run = 482, faith = 0.94, p95 = 210;
  var runLineEl = document.getElementById('jt-runline');
  function renderRunLine() {
    if (runLineEl) runLineEl.textContent = 'run #' + run + ' · faithfulness ' + faith.toFixed(2) + ' · p95 ' + p95 + 'ms · verdict PASS';
  }
  renderRunLine();
  if (!REDUCED) {
    setInterval(function () {
      run += 1;
      faith = Math.round((0.9 + Math.random() * 0.09) * 100) / 100;
      p95 = 180 + Math.floor(Math.random() * 90);
      renderRunLine();
    }, 3200);
  }

  var GATES_T = 13, TESTS_T = 3750, COV_T = 91;
  function paintStats(g, t, c) {
    document.querySelectorAll('[data-stat="gates"]').forEach(function (n) { n.textContent = g + '/13'; });
    document.querySelectorAll('[data-stat="tests"]').forEach(function (n) { n.textContent = t.toLocaleString('en-US'); });
    document.querySelectorAll('[data-stat="cov"]').forEach(function (n) { n.textContent = c + '%'; });
  }
  if (REDUCED) {
    paintStats(GATES_T, TESTS_T, COV_T);
  } else {
    var step = 0, steps = 30;
    var cu = setInterval(function () {
      step++;
      var e = 1 - Math.pow(1 - step / steps, 3);
      paintStats(Math.round(GATES_T * e), Math.round(TESTS_T * e), Math.round(COV_T * e));
      if (step >= steps) clearInterval(cu);
    }, 38);
  }

  /* ───────────────────────── terminal typing ───────────────────────── */

  var termBody = document.getElementById('jt-term-body');
  var cursor = document.getElementById('jt-term-cursor');
  function paintTerm(count) {
    if (!termBody) return;
    while (termBody.children.length > count) termBody.removeChild(termBody.lastChild);
    for (var i = termBody.children.length; i < count; i++) {
      var ln = TERM_LINES[i];
      termBody.appendChild(txt('div', 'color:' + ln.c + ';white-space:pre-wrap', ln.t));
    }
  }
  if (REDUCED) {
    paintTerm(TERM_LINES.length);
  } else {
    var typing = false;
    var startTyping = function () {
      if (typing) return; typing = true;
      var typed = 0;
      var ty = setInterval(function () {
        typed++;
        paintTerm(typed);
        if (typed >= TERM_LINES.length) clearInterval(ty);
      }, 190);
    };
    var termEl = document.getElementById('jt-term');
    if (termEl && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { startTyping(); io.disconnect(); }
      }, { threshold: 0.35 });
      io.observe(termEl);
    } else { startTyping(); }
  }
  if (cursor) cursor.style.display = 'inline-block';

  /* ───────────────────────── tool tape ───────────────────────── */

  var tape = document.getElementById('jt-tape');
  if (tape && tape.children.length === 0) {
    for (var rep = 0; rep < 2; rep++) {
      var row = el('div', 'display:flex;gap:0;padding:12px 0;' + MONO + 'font-size:12px;color:#8E8882;white-space:nowrap');
      TOOLS.forEach(function (t) { row.appendChild(txt('span', 'padding:0 22px;border-right:1px solid #1A1917', t)); });
      tape.appendChild(row);
    }
  }

  /* ───────────────────────── architecture diagram builder ───────────────────────── */

  function buildArch(arch) {
    var W = 440, H = 150;
    var NS = 'http://www.w3.org/2000/svg';
    function sv(tag, attrs, children) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      (children || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, style: 'display:block;width:100%;height:auto', role: 'img', 'aria-label': 'architecture diagram' });

    arch.edges.forEach(function (e) {
      var a = arch.nodes[e[0]], b = arch.nodes[e[1]];
      var d = a.y === b.y
        ? 'M' + a.x + ',' + a.y + ' H' + b.x
        : 'M' + a.x + ',' + a.y + ' C' + (a.x + 42) + ',' + a.y + ' ' + (b.x - 42) + ',' + b.y + ' ' + b.x + ',' + b.y;
      svg.appendChild(sv('path', { d: d, fill: 'none', stroke: '#2A2826', 'stroke-width': '1' }));
    });

    arch.nodes.forEach(function (n, i) {
      svg.appendChild(sv('circle', { cx: n.x, cy: n.y, r: 9, fill: 'none', stroke: n.c, 'stroke-opacity': '0.35' }));
      svg.appendChild(sv('circle', { cx: n.x, cy: n.y, r: 3.5, fill: n.c }));
      var ring = sv('circle', { cx: n.x, cy: n.y, r: 9, fill: 'none', stroke: n.c, 'stroke-opacity': '0.5', style: 'transform-origin:' + n.x + 'px ' + n.y + 'px;animation:jt-ringpulse 3s ease-out infinite;animation-delay:' + (i * 0.55) + 's' });
      svg.appendChild(ring);
      var above = n.y < 75; // branch-lane labels flip to avoid the midline
      var ly = n.y === 75 ? n.y + 24 : (above ? n.y - 24 : n.y + 24);
      var l = sv('text', { x: n.x, y: ly, fill: n.c, 'font-family': "'JetBrains Mono',monospace", 'font-size': '9.5', 'letter-spacing': '0.08em', 'text-anchor': 'middle' });
      l.textContent = n.l;
      svg.appendChild(l);
      if (n.s) {
        var s = sv('text', { x: n.x, y: ly + 12, fill: '#8E8882', 'font-family': "'JetBrains Mono',monospace", 'font-size': '8', 'text-anchor': 'middle' });
        s.textContent = n.s;
        svg.appendChild(s);
      }
    });

    // packets ride SMIL animateMotion so they scale with the viewBox
    // (and are simply omitted under reduced motion — SMIL ignores the media query)
    if (!REDUCED) {
      (arch.packets || []).forEach(function (p) {
        var dot = sv('circle', { r: '2.6', fill: p.c, opacity: '0.9', class: 'pkt' });
        var mo = sv('animateMotion', { dur: p.dur + 's', begin: p.delay + 's', repeatCount: 'indefinite', path: p.d });
        dot.appendChild(mo);
        svg.appendChild(dot);
      });
    }

    var wrap = el('div', 'border:1px solid #2A2826;border-radius:10px;overflow:hidden;background:#0A0B0D;padding:4px 0');
    wrap.appendChild(svg);
    return wrap;
  }

  /* ───────────────────────── project index ───────────────────────── */

  var projMount = document.getElementById('jt-projects');
  if (projMount && projMount.children.length === 0) PROJECTS.forEach(function (p) {
    var links = el('div', 'display:flex;gap:16px;font-size:12.5px;font-weight:600;margin-top:2px;flex-wrap:wrap');
    if (p.href) links.appendChild(txt('a', 'color:#22d3ee', 'GitHub ↗', { href: p.href, target: '_blank', rel: 'noopener' }));
    // video: set p.video to a YouTube watch URL to replace the "on request"
    // label with a public walkthrough link (the demo lane for private repos)
    if (p.video) links.appendChild(txt('a', 'color:' + p.color, '▶ watch the walkthrough', { href: p.video, target: '_blank', rel: 'noopener' }));
    if (p.priv && !p.video) links.appendChild(txt('span', 'color:#8E8882;font-weight:500', 'Private — walkthrough on request'));

    var tags = el('div', 'display:flex;flex-wrap:wrap;gap:6px', p.tags.map(function (tag) {
      return txt('span', MONO + 'font-size:10.5px;color:#8E8882;padding:3px 8px;background:#1A1917;border-radius:4px', tag);
    }));

    var head = el('div', 'display:flex;align-items:center;gap:12px;flex-wrap:wrap', [
      txt('span', MONO + 'font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:' + p.color, p.kind),
      txt('span', MONO + 'font-size:10px;letter-spacing:0.1em;padding:3px 8px;border-radius:4px;border:1px solid ' + p.badgeBorder + ';color:' + p.badgeColor, p.badge)
    ]);

    var h3 = el('h3', SERIF + 'font-weight:400;font-size:clamp(1.5rem,2.4vw,2rem);margin:0;letter-spacing:-0.01em', [
      p.name + ' ',
      txt('span', 'color:' + p.color + ';display:inline-block', '→', { class: 'arrow' })
    ]);

    var info = el('div', 'display:flex;flex-direction:column;gap:12px;flex:1', [
      head, h3,
      txt('p', 'margin:0;font-size:13.5px;line-height:1.7;color:#A8A29E;max-width:52ch', p.desc),
      txt('div', MONO + 'font-size:12px;color:#F4F2EF;border-left:2px solid ' + p.color + ';padding-left:12px;line-height:1.6;max-width:52ch', p.metric),
      tags, links
    ]);

    var left = el('div', 'flex:1;min-width:min(340px,100%);display:flex;gap:clamp(14px,2vw,28px)', [
      txt('div', SERIF + 'font-size:clamp(2rem,3.4vw,3rem);line-height:1;color:#6E6862;min-width:1.6em', p.num, { class: 'num' }),
      info
    ]);

    var termLines = el('div', 'padding:12px 16px;' + MONO + 'font-size:11.5px;line-height:1.9',
      p.term.map(function (ln) { return txt('div', 'color:' + ln.c + ';white-space:pre-wrap', ln.t); }));
    var termCard = el('div', 'height:220px;position:relative;border:1px solid #2A2826;border-radius:10px;overflow:hidden;background:#08090c', [
      el('div', 'position:absolute;inset:0;display:flex;flex-direction:column', [
        el('div', 'display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:1px solid #1A1917', [
          el('span', 'width:8px;height:8px;border-radius:50%;background:#2A2826'),
          el('span', 'width:8px;height:8px;border-radius:50%;background:#2A2826'),
          el('span', 'width:8px;height:8px;border-radius:50%;background:#2A2826'),
          txt('span', MONO + 'font-size:10px;color:#8E8882;margin-left:6px', '~/' + p.name)
        ]),
        termLines
      ])
    ]);
    var rightChildren = [];
    if (ARCH[p.name]) rightChildren.push(buildArch(ARCH[p.name]));
    rightChildren.push(
      el('div', ARCH[p.name] ? 'margin-top:10px' : '', [termCard]),
      txt('div', MONO + 'font-size:9.5px;letter-spacing:0.1em;color:#837D77;margin-top:8px;text-transform:uppercase',
        'fig. ' + p.fig + (ARCH[p.name] ? ' — architecture · live output' : ' — live output'))
    );
    var right = el('div', 'width:min(420px,100%);align-self:center', rightChildren);

    projMount.appendChild(el('article',
      '--pc:' + p.color + ';display:flex;flex-direction:' + p.dir + ';flex-wrap:wrap;gap:clamp(20px,3vw,44px);padding:44px 0;border-bottom:1px solid #2A2826',
      [left, right], { class: 'proj' }));
  });

  /* ───────────────────────── engineering briefs ───────────────────────── */

  var briefMount = document.getElementById('jt-briefs');
  if (briefMount && briefMount.children.length === 0) BRIEFS.forEach(function (b) {
    var corners = ['top:-1px;left:-1px;border-top:1px solid #8E8882;border-left:1px solid #8E8882',
      'top:-1px;right:-1px;border-top:1px solid #8E8882;border-right:1px solid #8E8882',
      'bottom:-1px;left:-1px;border-bottom:1px solid #8E8882;border-left:1px solid #8E8882',
      'bottom:-1px;right:-1px;border-bottom:1px solid #8E8882;border-right:1px solid #8E8882'
    ].map(function (s) { return el('span', 'position:absolute;width:14px;height:14px;' + s); });

    var flowChips = el('div', 'display:flex;align-items:center;flex-wrap:wrap;gap:10px');
    b.flow.forEach(function (f) {
      var wrap = el('span', 'display:inline-flex;align-items:center;gap:10px', [
        txt('span', '--chip-b:' + f.b + ';--chip-c:' + f.c, f.t, { class: 'flow-chip' })
      ]);
      if (f.arrow) {
        wrap.appendChild(el('span', 'color:#3D3A37;display:inline-flex;align-items:center;gap:3px', [
          el('span', 'width:4px;height:4px;border-radius:50%;background:' + f.c + ';animation:jt-blink 2s ease-in-out infinite'),
          document.createTextNode('→')
        ]));
      }
      flowChips.appendChild(wrap);
    });

    function sectionCell(s) {
      return el('div', '', [
        txt('div', MONO + 'font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:' + b.color + ';margin-bottom:8px', s.label),
        txt('p', 'margin:0;font-size:13.5px;line-height:1.7;color:#A8A29E;text-wrap:pretty', s.text)
      ]);
    }
    // outcome-first: Problem + Measured results stay visible; the deep spec
    // (architecture, safeguards, approval points…) lives behind an expander.
    var KEY_LABELS = ['Problem', 'Measured results'];
    var keySections = b.sections.filter(function (s) { return KEY_LABELS.indexOf(s.label) !== -1; });
    var deepSections = b.sections.filter(function (s) { return KEY_LABELS.indexOf(s.label) === -1; });

    var visibleGrid = el('div', 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:24px 44px;border-top:1px solid #2A2826;padding-top:24px',
      keySections.map(sectionCell));

    var deepGrid = el('div', 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:24px 44px;padding-top:20px',
      deepSections.map(sectionCell));
    var stackLine = el('div', 'margin-top:26px;padding-top:20px;border-top:1px dashed #2A2826;' + MONO + 'font-size:12px;color:#8E8882', [
      document.createTextNode('stack — '),
      txt('span', 'color:#F4F2EF', b.stack)
    ]);
    var summary = el('summary', '', [
      el('span', 'color:' + b.color, [document.createTextNode('▸')], { class: 'chev' }),
      document.createTextNode('view full spec — ' + deepSections.length + ' more sections')
    ]);
    var more = el('details', 'border-top:1px solid #2A2826;margin-top:24px', [summary, deepGrid, stackLine], { class: 'brief-more' });

    briefMount.appendChild(el('article', 'position:relative;background:#0C0C0E;border:1px solid #2A2826;padding:clamp(26px,4vw,44px)',
      corners.concat([
        txt('div', 'position:absolute;top:14px;right:18px;' + MONO + 'font-size:9.5px;letter-spacing:0.14em;color:#837D77;text-transform:uppercase;white-space:nowrap', 'spec ' + b.num + ' · rev A'),
        el('div', 'display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;padding-bottom:8px', [
          txt('span', MONO + 'font-size:12px;color:' + b.color, b.num),
          txt('h3', SERIF + 'font-weight:400;font-size:clamp(1.6rem,2.6vw,2.1rem);margin:0;letter-spacing:-0.01em;flex:1;min-width:240px', b.title),
          txt('span', MONO + 'font-size:11px;color:#8E8882', b.repo)
        ]),
        el('p', 'border-left:2px solid ' + b.color + ';padding-left:16px', [document.createTextNode(b.outcome)], { class: 'brief-outcome' }),
        el('div', 'padding:18px 20px 14px;background:#08090c;border:1px solid #1A1917;margin-bottom:8px', [flowChips]),
        txt('div', MONO + 'font-size:9.5px;letter-spacing:0.1em;color:#837D77;text-transform:uppercase;margin-bottom:24px', 'fig. ' + b.fig + ' — system flow, left to right'),
        visibleGrid,
        more
      ]), { class: 'rise' }));
  });

  /* ───────────────────────── services + timeline ───────────────────────── */

  var svcMount = document.getElementById('jt-services');
  if (svcMount && svcMount.children.length === 0) SERVICES.forEach(function (s) {
    svcMount.appendChild(el('article', '', [
      el('span', 'width:34px;height:3px;border-radius:2px;background:' + s.color),
      txt('h3', SERIF + 'font-weight:400;font-size:1.4rem;margin:0;color:#09090B', s.name),
      txt('p', 'margin:0;font-size:13.5px;line-height:1.7;color:#57534E;flex:1', s.desc),
      el('div', MONO + 'font-size:11.5px;line-height:1.8;color:#57534E', s.items.map(function (it) {
        return el('div', '', [txt('span', 'color:' + s.color, '→'), document.createTextNode(' ' + it)]);
      })),
      el('div', MONO + 'font-size:11px;color:#6B6560;border-top:1px dashed #DDD6CE;padding-top:12px', [
        document.createTextNode('proof: '),
        txt('span', 'color:#09090B', s.proof)
      ]),
      txt('a', 'font-size:13px;font-weight:700;color:#0e7490', 'Full details →', { href: s.href })
    ], { class: 'svc-card' }));
  });

  var tlMount = document.getElementById('jt-timeline');
  if (tlMount && tlMount.children.length === 0) TIMELINE.forEach(function (w) {
    tlMount.appendChild(el('div', 'flex:1;min-width:min(200px,100%);display:flex;flex-direction:column;gap:10px;position:relative;padding-right:24px', [
      el('div', 'display:flex;align-items:center;gap:10px', [
        el('span', 'width:10px;height:10px;border-radius:50%;background:' + w.color + ';flex-shrink:0;animation:jt-nodepulse 3.2s ease-in-out infinite;animation-delay:' + w.delay),
        el('span', 'flex:1;height:1px;background:#DDD6CE')
      ]),
      txt('div', MONO + 'font-size:11px;color:#57534E', w.week),
      txt('div', 'font-size:13.5px;font-weight:600;color:#09090B', w.name),
      txt('div', 'font-size:12.5px;line-height:1.6;color:#6B6560', w.desc)
    ]));
  });

  /* ───────────────────────── field notes ───────────────────────── */

  var notesMount = document.getElementById('jt-notes');
  if (notesMount && notesMount.children.length === 0) NOTES.forEach(function (n) {
    notesMount.appendChild(el('a', 'display:flex;flex-wrap:wrap;align-items:baseline;gap:clamp(14px,2vw,28px);padding:30px 0;border-bottom:1px solid #2A2826', [
      txt('span', MONO + 'font-size:11px;color:#837D77;min-width:5.5em', n.date),
      el('span', 'flex:1;min-width:min(300px,100%)', [
        txt('span', 'display:block;' + SERIF + 'font-size:clamp(1.3rem,2vw,1.7rem);letter-spacing:-0.01em', n.title),
        txt('span', 'display:block;font-size:13px;line-height:1.6;color:#8E8882;margin-top:6px;max-width:64ch', n.dek)
      ]),
      txt('span', MONO + 'font-size:11px;color:' + n.color + ';white-space:nowrap', n.read + ' · read →')
    ], { href: n.href, class: 'note-row' }));
  });

  /* ───────────────────────── scrollspy nav ───────────────────────── */

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('nav a.nav-link[href^="#"]'));
  if (navLinks.length && 'IntersectionObserver' in window) {
    var sectionFor = {}; // section id → nav link
    navLinks.forEach(function (a) { sectionFor[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.remove('active'); });
        var link = sectionFor[en.target.id];
        if (link) link.classList.add('active');
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(sectionFor).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) spy.observe(sec);
    });
  }

  /* ───────────────────────── section reveals (cross-browser) ───────────────────────── */

  // defense in depth: clear any reveal state that leaked into static HTML
  document.querySelectorAll('.rise-pre').forEach(function (n) { n.classList.remove('rise-pre'); });
  // SMIL packets ignore prefers-reduced-motion — remove baked ones outright
  if (REDUCED) document.querySelectorAll('.pkt').forEach(function (n) { n.remove(); });
  if (!REDUCED && 'IntersectionObserver' in window) {
    var riseEls = document.querySelectorAll('.rise');
    var riseIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('rise-in');
          riseIO.unobserve(en.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
    riseEls.forEach(function (n) {
      var rect = n.getBoundingClientRect();
      if (rect.top < window.innerHeight) return; // already in view — never hide visible content
      n.classList.add('rise-pre');
      riseIO.observe(n);
    });
  }

  /* ───────────────────────── self-proof strip ───────────────────────── */

  var selfProof = document.getElementById('jt-selfproof');
  if (selfProof && window.fetch) {
    fetch('proof/scorecard.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (sc) {
        if (!sc || !sc.totals) return;
        var gateNames = Object.keys(sc.gates || {});
        var greenGates = gateNames.filter(function (k) { return sc.gates[k].green; }).length;
        var when = sc.generatedAt ? sc.generatedAt.slice(0, 10) : '';
        var detail = document.getElementById('jt-selfproof-detail');
        detail.textContent = sc.totals.passed + ' checks passed' +
          (sc.totals.skipped ? ' (' + sc.totals.skipped + ' honest-skip)' : '') +
          ' · ' + greenGates + '/' + gateNames.length +
          ' gates green · smoke + a11y on desktop & mobile · ' + when +
          (sc.commit && sc.commit !== 'uncommitted' ? ' @ ' + sc.commit : '') +
          ' · regenerate: ' + sc.command;
        if (!sc.totals.green) {
          selfProof.style.borderColor = 'rgba(244,63,94,0.4)';
          selfProof.style.background = 'rgba(244,63,94,0.05)';
        }
        selfProof.hidden = false;
      })
      .catch(function () { /* strip stays hidden — never fake green */ });
  }

  /* ───────────────────────── numbers count-up ───────────────────────── */

  var countEls = document.querySelectorAll('[data-countup]');
  if (countEls.length) {
    var animateCount = function (n) {
      var target = parseInt(n.getAttribute('data-countup'), 10);
      var suffix = n.getAttribute('data-suffix') || '';
      var step = 0, steps = 28;
      var iv = setInterval(function () {
        step++;
        var e = 1 - Math.pow(1 - step / steps, 3);
        n.textContent = Math.round(target * e) + suffix;
        if (step >= steps) clearInterval(iv);
      }, 34);
    };
    if (REDUCED || !('IntersectionObserver' in window)) {
      countEls.forEach(function (n) {
        n.textContent = n.getAttribute('data-countup') + (n.getAttribute('data-suffix') || '');
      });
    } else {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { animateCount(en.target); cio.unobserve(en.target); }
        });
      }, { threshold: 0.6 });
      countEls.forEach(function (n) { cio.observe(n); });
    }
  }

  /* ───────────────────────── toast + copy email ───────────────────────── */

  var toastEl = document.getElementById('jt-toast');
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }
  var EMAIL = 'hello@sageideas.dev';
  function copyEmail() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(EMAIL).then(
        function () { toast('email copied — ' + EMAIL); },
        function () { toast(EMAIL); }
      );
    } else { toast(EMAIL); }
  }
  var copyBtn = document.getElementById('jt-copy-email');
  if (copyBtn) copyBtn.addEventListener('click', copyEmail);

  /* ───────────────────────── command palette ───────────────────────── */

  var palette = document.getElementById('jt-palette');
  if (palette) {
    var pInput = palette.querySelector('input');
    var pItems = palette.querySelector('.items');
    var ACTIONS = [
      { label: 'Go to Project index', k: 'section', run: function () { location.hash = '#work'; } },
      { label: 'Go to Engineering briefs', k: 'section', run: function () { location.hash = '#briefs'; } },
      { label: 'Go to Field notes', k: 'section', run: function () { location.hash = '#notes'; } },
      { label: 'Go to Services', k: 'section', run: function () { location.hash = '#services'; } },
      { label: 'Go to About', k: 'section', run: function () { location.hash = '#about'; } },
      { label: 'Go to Contact', k: 'section', run: function () { location.hash = '#contact'; } },
      { label: 'Copy email address', k: 'action', run: copyEmail },
      { label: 'Download résumé (PDF)', k: 'action', run: function () { location.href = 'assets/Jason-Teixeira-Resume.pdf'; } },
      { label: 'Book a call', k: 'link', run: function () { location.hash = '#contact'; } },
      { label: 'Open GitHub profile', k: 'link', run: function () { window.open('https://github.com/JasonTeixeira', '_blank', 'noopener'); } },
      { label: 'Open LinkedIn', k: 'link', run: function () { window.open('https://www.linkedin.com/in/jason-teixeira', '_blank', 'noopener'); } },
      { label: 'Read all field notes', k: 'link', run: function () { location.href = 'field-notes.html'; } },
      { label: 'Switch to: Hire me', k: 'mode', run: function () { setFunnel('hire'); toast('viewing as: hiring'); } },
      { label: 'Switch to: Work with me', k: 'mode', run: function () { setFunnel('client'); toast('viewing as: client'); } }
    ];
    var filtered = ACTIONS;
    var sel = 0;
    var lastFocus = null;

    function renderPalette() {
      pItems.innerHTML = '';
      filtered.forEach(function (a, i) {
        var row = document.createElement('div');
        row.className = 'item' + (i === sel ? ' sel' : '');
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', i === sel ? 'true' : 'false');
        var lbl = document.createElement('span');
        lbl.textContent = a.label;
        var kind = document.createElement('span');
        kind.className = 'k';
        kind.textContent = a.k;
        row.appendChild(lbl);
        row.appendChild(kind);
        row.addEventListener('click', function () { runAction(a); });
        row.addEventListener('mousemove', function () {
          if (sel !== i) { sel = i; renderPalette(); }
        });
        pItems.appendChild(row);
      });
    }
    function openPalette() {
      lastFocus = document.activeElement;
      filtered = ACTIONS; sel = 0;
      pInput.value = '';
      palette.classList.add('open');
      renderPalette();
      pInput.focus();
    }
    function closePalette() {
      palette.classList.remove('open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function runAction(a) { closePalette(); a.run(); }

    pInput.addEventListener('input', function () {
      var q = pInput.value.toLowerCase();
      filtered = ACTIONS.filter(function (a) { return a.label.toLowerCase().indexOf(q) !== -1; });
      sel = 0;
      renderPalette();
    });
    pInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, filtered.length - 1); renderPalette(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); renderPalette(); }
      else if (e.key === 'Enter' && filtered[sel]) { e.preventDefault(); runAction(filtered[sel]); }
    });
    palette.querySelector('.backdrop').addEventListener('click', closePalette);
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      else if (e.key === 'Escape' && palette.classList.contains('open')) closePalette();
    });
    var openBtn = document.getElementById('jt-palette-open');
    if (openBtn) openBtn.addEventListener('click', openPalette);
  }

  /* ───────────────────────── analytics (production only) ───────────────────────── */

  // Vercel Web Analytics — loaded dynamically so local/CI runs stay 404-free.
  if (/\.sageideas\.dev$/.test(location.hostname)) {
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    var vaScript = document.createElement('script');
    vaScript.defer = true;
    vaScript.src = '/_vercel/insights/script.js';
    document.head.appendChild(vaScript);
  }

  function track(name, data) {
    if (typeof window.va === 'function') window.va('event', { name: name, data: data || {} });
  }
  document.addEventListener('click', function (e) {
    var evtEl = e.target.closest && e.target.closest('[data-evt]');
    if (evtEl) track(evtEl.getAttribute('data-evt'));
    var resume = e.target.closest && e.target.closest('a[href$="Jason-Teixeira-Resume.pdf"]');
    if (resume) track('resume-download');
  });
  document.addEventListener('toggle', function (e) {
    if (e.target.classList && e.target.classList.contains('brief-more') && e.target.open) track('brief-expand');
    if (e.target.classList && e.target.classList.contains('faq') && e.target.open) track('faq-open');
  }, true);

  /* ───────────────────────── contact form ───────────────────────── */

  var form = document.getElementById('jt-contact-form');
  if (form) {
    var statusEl = document.getElementById('jt-form-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var fields = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        message: form.elements.message.value.trim(),
        website: form.elements.website.value
      };
      statusEl.textContent = 'sending…';
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      }).then(function (r) {
        if (r.ok) {
          form.reset();
          statusEl.textContent = '';
          toast('sent — I read every one. talk soon.');
          track('contact-submit', { via: 'api' });
        } else {
          throw new Error('api ' + r.status);
        }
      }).catch(function () {
        // delivery not configured or network issue — never lose the lead:
        // hand off to the visitor's mail client with everything prefilled
        statusEl.textContent = 'opening your email app instead…';
        track('contact-submit', { via: 'mailto-fallback' });
        location.href = 'mailto:' + EMAIL +
          '?subject=' + encodeURIComponent('Portfolio inquiry — ' + fields.name) +
          '&body=' + encodeURIComponent(fields.message + '\n\n— ' + fields.name + ' (' + fields.email + ')');
      });
    });
  }

  /* ───────────────────────── year ───────────────────────── */

  document.querySelectorAll('[data-year]').forEach(function (n) {
    n.textContent = String(new Date().getFullYear());
  });
})();
