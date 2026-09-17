# Content Architecture & Keyword Bank — agency.sageideas.dev

**Prepared for:** solo AI+QA engineering agency, positioning "I ship AI features, then I prove they work"
**Goal:** ~100k organic sessions/mo in 12–18 months by becoming a reference destination for the AI-builder audience (not just an agency-services SEO play)
**Status:** approved direction — build the reference hub + all four content engines, sequenced against this map.

---

## 0. Honest reality check before the plan

100k/mo will **not** come from the deep LLM-eval niche alone. Terms like "golden set LLM," "eval gate CI," "agent trajectory evaluation" are real, high-intent, and nearly uncontested — but collectively they're a low-thousands-per-month ceiling even fully ranked. To reach 100k you need two additional demand pools layered on top of the niche-authority core:

- **Pillar 5 (classic test automation/QA)** — "playwright vs cypress," "flaky tests," "test automation" have genuine five/six-figure monthly search volume, just heavy competition (BrowserStack, LambdaTest, Testim, freeCodeCamp).
- **Pillar 7 (AI workflow automation)** — "n8n vs zapier," "ai automation for small business" — large volume, non-engineer audience, competitive but very winnable with real build-log content this operator can produce from actual client work.

The niche pillars (1–4, 8) are the **authority and conversion engine** (high intent, low competition, the people who become clients). The broad pillars (5, 6, 7) are the **traffic engine** (volume, harder, slower, necessary for the 100k target). Plan accordingly — don't over-invest in glossary-only content and expect six figures of traffic from it.

---

## 1. Pillar/Cluster Strategy

### P1 — LLM Evaluation & Quality Engineering
**Audience:** AI/ML engineers, applied-AI teams shipping LLM features who need to know if their app actually works.
**Intent:** Informational → commercial ("how do I evaluate my LLM app," "which eval framework").
**Why this brand:** This *is* the brand's core service (`services/llm-evaluation-qa.html`) and the site already has real assets (eval-method doc, 4 animated guides, RAG guide). Cornerstone pillar.

### P2 — RAG Systems & Retrieval Evaluation
**Audience:** Engineers building retrieval-augmented apps (support bots, internal knowledge assistants, doc Q&A).
**Intent:** Informational/how-to, high frustration-driven search ("why is my RAG hallucinating").
**Why this brand:** Existing `rag-evaluation-guide.html` and `services/ai-product-build.html` RAG work give real experience to draw from — not theory.

### P3 — AI Agent & Multi-Step Workflow Reliability
**Audience:** Teams building agentic/tool-using LLM systems (2026's fastest-growing build category).
**Intent:** Informational, emerging category — low current volume, will compound over 12–18 months.
**Why this brand:** Directly adjacent to `services/ai-workflow-automation.html` and the QA identity; almost no incumbent content treats "agent testing" as a discipline yet — genuine white space.

### P4 — AI Testing in CI/CD (Eval Gates & Regression)
**Audience:** Platform/DevOps-minded engineers who want AI quality treated like code quality.
**Intent:** How-to, implementation-stage (MOFU/BOFU).
**Why this brand:** The single most differentiated idea on the site (eval gate, golden set, human approval, ratchet, "no fake green") — it's the brand's actual methodology, not generic content.

### P5 — Software Test Automation & QA Engineering
**Audience:** Traditional QA engineers, SDETs, eng leads evaluating test tooling — broader than AI, but the entry ramp for people who'll later need AI testing.
**Intent:** Commercial/comparison, high volume, high competition.
**Why this brand:** The "QA" half of the positioning (`services/test-automation-ci.html`, `services/security-hardening.html`) needs its own credibility base independent of AI hype — also the volume engine.

### P6 — Shipping AI Features Safely (Product/Eng Leadership)
**Audience:** Founders, EMs, product leads deciding whether/how to add AI — less technical-implementation, more risk/ROI framing.
**Intent:** TOFU awareness, feeds the whole funnel.
**Why this brand:** Matches `services/ai-product-build.html`, `case-studies.html`, `roi.html` — this pillar is the on-ramp that turns "curious founder" into "reads the eval-gate guide next."

### P7 — AI Workflow & Business Process Automation
**Audience:** Operators, small-business owners, ops leads — non-engineers automating support/sales/ops with AI.
**Intent:** Commercial, "can I automate X," high volume.
**Why this brand:** Matches `services/ai-workflow-automation.html`, `automations/index.html`, `automations/niches.html`, `outreach/*` case work already on the site. Biggest single volume opportunity outside the QA niche.

### P8 — Tool Landscape & Comparisons (cross-cutting)
**Audience:** Anyone evaluating what to actually buy/adopt across P1–P5.
**Intent:** Commercial/transactional, high conversion despite modest volume.
**Why this brand:** The operator has hands-on experience with the real tools (Promptfoo is already a blog topic) — these pages convert because the author has actually used the stack, unlike most SEO-farmed comparison content.

---

## 2. Content Bank (~144 items)

Legend — **Intent:** Info / Comm(ercial) / Trans(actional) · **Funnel:** TOFU/MOFU/BOFU · **Priority:** Quick-win (low competition, 3–6mo) / Long-game (competitive, 9–18mo)

### 2.1 Programmatic Glossary Expansion (40 new terms + split the existing 12)

**Action first:** the 12 terms currently living as anchors inside one page (`docs-glossary.html#golden-set` etc.) should each become its own indexable URL (`/glossary/golden-set`) with the anchor page becoming a hub/index that links out. Anchors don't get indexed as distinct pages; this is currently invisible demand.

Existing 12 to split into own URLs: golden set, LLM-as-judge, faithfulness/groundedness, hallucination, prompt injection, jailbreak, CI quality gate, ratchet, flake, golden-run evidence, human-in-the-loop, RAG.

40 new terms: eval harness, context precision, context recall, answer relevancy, semantic similarity scoring, embedding drift, chunking strategy, prompt regression testing, canary prompt*, shadow deployment (AI), red teaming (LLM), adversarial testing (AI), guardrails (AI), toxicity scoring, bias evaluation (LLM), PII leakage detection, perplexity, exact match / F1 (QA eval), multi-turn evaluation, agent trajectory evaluation*, tool-call accuracy, function-calling evaluation, task completion rate (AI agent), synthetic data generation (evals), model drift / concept drift, champion-challenger testing, eval dataset versioning, rubric-based grading, pairwise comparison (LLM eval), elo rating (model eval), non-determinism (LLM variance), temperature (sampling), eval-driven development (EDD)*, model card, structured output validation, hybrid search, reranker, query rewriting, agentic RAG, LLM gateway / model routing.

\* = term-coining opportunities (near-zero competition; own the definitional page). Build a `/glossary/` hub linking all 52 terms with `DefinedTerm`/`DefinedTermSet` schema.

### 2.2 "X vs Y" Tool Comparison Series (22 items)
Promptfoo vs DeepEval · Promptfoo vs RAGAS · RAGAS vs DeepEval · LangSmith vs Braintrust · LangSmith vs Langfuse · Braintrust vs Langfuse · Arize Phoenix vs LangSmith · TruLens vs RAGAS · Giskard vs Promptfoo · Humanloop vs PromptLayer · OpenAI Evals vs Promptfoo · Guardrails AI vs NeMo Guardrails · Lakera Guard vs Rebuff · Patronus AI vs Galileo · LangChain vs LlamaIndex (RAG, long-game) · W&B Weave vs Braintrust · Confident AI vs Braintrust · Playwright vs Cypress 2026 (long-game) · Playwright vs Selenium (long-game) · n8n vs Zapier for AI automations (long-game, high vol) · n8n vs Make.com (long-game) · Best Open-Source LLM Eval Frameworks 2026 (listicle).

### 2.3 "How to Build" Tutorial Series — repo-backed, code-native (16 items)
**Cannibalization guard:** guides (`guide-*.html`) = conceptual "how it works" (animated, TOFU); tutorials = long-form code walkthrough "how to build it yourself" (repo snippets, MOFU/BOFU). Cross-link guide → tutorial; do not restate guide titles verbatim.

Eval gate in CI with Promptfoo · Golden set for regression testing · Human-approval checkpoint · Adversarial probes for prompt injection · Evaluate a RAG pipeline end-to-end (RAGAS + custom) · Nightly LLM regression suite in GitHub Actions · Version golden datasets like code · Tool-call accuracy harness for agents · Test multi-turn agent conversations · Open-source LLM observability (Langfuse/Phoenix) · Quality ratchet that blocks regressions · Playwright against AI-generated UI · Detect hallucinations in production logs · Red-team suite for a customer chatbot · Wire an eval gate into a GitHub/Vercel deploy · Monorepo structure for AI product + eval suite.

### 2.4–2.11 Supporting cluster pieces
- **P1 LLM Eval (8):** metrics hub (cornerstone), LLM-as-judge, eval-vs-production, testing vs evaluating, cadence, 25-item checklist, best frameworks 2026, best observability tools 2026.
- **P2 RAG (10):** RAG metrics hub, hallucination fix, chunking comparison, hybrid vs vector, choose a reranker, RAG vs fine-tuning (long-game), best vector DBs (long-game), agentic RAG, citation accuracy, query rewriting/decomposition.
- **P3 Agents (8):** why agents fail in prod, trajectory eval, tool-calling reliability, multi-agent handoffs, non-determinism testing, agent guardrails guide, reliability "nines," memory/state failures.
- **P4 CI/CD (8):** eval gates (missing CI step), shift-left for AI, block deploy on regression, canary releases, blue-green for LLM, SLOs for AI, incident post-mortem template, cost-per-eval.
- **P5 Test Automation (8):** AI changing test automation, LLM-generated Playwright tests, flaky tests root cause (long-game), test automation ROI, visual regression (long-game), API testing for AI backends, QA pipeline for small teams, coverage metrics that matter (long-game).
- **P6 Ship Safely (8):** ship without breaking trust, launch checklist, "passing tests isn't proof," demo-works-prod-fails, build vs buy LLM API (long-game), cost to build/maintain AI feature, rollback plan, hiring an AI QA engineer.
- **P7 Automation (8):** what AI workflow automation actually means (long-game, high vol), automate support triage, AI front desk / lead qual, 5 automations to ship in a week (long-game), human-approval step, failure modes, automation ROI framework, RAG internal knowledge bots.
- **P8 Landscape (2):** State of LLM Eval Tools 2026 (cornerstone, quarterly refresh), open-source vs commercial eval platforms.

### 2.12 Case studies / brand-voice (6)
Hallucination caught before shipping · eval gate's first 30 days · support-triage before/after · 18-agent audit gauntlet (extends existing note) · freelance vs agency vs in-house · "What 'No Fake Green' means" (brand anchor).

---

## 3. Linkable-Asset / Infographic Ideas (exploit the code-native SVG diagram engine)

1. **AI Eval Metric Cheat Sheet** — visual matrix of every metric → "use this when…" Cheapest, highest embed likelihood.
2. **Anatomy of an Eval Gate** — embeddable pipeline widget (distinct from `guide-eval-gate.html`), built for embedding in *other* sites.
3. **RAG Failure Taxonomy** — failure-mode classification backed by anonymized real patterns (original-data angle → citable).
4. **Hallucination Detection Decision Tree** — interactive flowchart of detection methods by use case/budget.
5. **AI Agent Reliability Benchmark** — same N tasks across agent stacks, published pass-rate + trajectory diagrams (run honestly, re-run periodically; never fabricate).
6. **CI/CD for AI diagram library** — embeddable code-generated pipeline diagrams, free with attribution.
7. **Flaky Test Cost Calculator** — team size × runs/day × re-run cost → $/month wasted (roi.html pattern).
8. **Golden Set Sizing Calculator** — traffic + cadence → recommended set size with a visual curve.
9. **State of AI Incidents annual report** — timeline + taxonomy of public AI failures; PR/backlink potential; public-record only.
10. **Eval Framework Feature Matrix** — living quarterly grid (Promptfoo/DeepEval/RAGAS/LangSmith/Braintrust/Langfuse/TruLens/Giskard); canonical embeddable reference feeding §2.2.

---

## 4. Prioritized 90-Day Starter Set (18 pieces)

1. LLM Evaluation Metrics Explained (P1 hub) — internal-link spine first.
2. RAG Evaluation Metrics Explained (P2 hub).
3. Eval Gates: The Missing CI Step for AI Features (P4 anchor, most on-brand).
4. Glossary hub page + first 15 terms — fastest to produce, builds link density.
5. Promptfoo vs DeepEval.
6. Promptfoo vs RAGAS.
7. How to Build an LLM Eval Gate in CI with Promptfoo (flagship tutorial).
8. How to Evaluate a RAG Pipeline End-to-End.
9. LLM-as-a-Judge: How It Works and When It Fails.
10. Why Your RAG Pipeline Is Hallucinating.
11. Why AI Agents Fail in Production.
12. AI Eval Metric Cheat Sheet (linkable asset #1).
13. AI Feature Launch Checklist for Product Teams (extends checklist.html).
14. Playwright vs Cypress in 2026 (long-game, start now).
15. n8n vs Zapier for AI Automations (long-game, highest volume, longest runway).
16. Case Study: Catching a Hallucination Before It Shipped.
17. Test Automation ROI: How to Calculate It for Leadership.
18. The State of LLM Evaluation Tools in 2026: A Landscape Map (long-game, start month one).

---

## 5. Capture & Distribution by Content Type

| Content type | Primary conversion mechanism |
|---|---|
| Glossary pages | No hard CTA — sidebar soft CTA + related-term links + site search. Volume play. |
| Pillar hub pages | Newsletter signup + content-upgrade PDF + fan-out links into clusters. |
| How-to tutorials | Link to the real GitHub repo + newsletter + soft CTA into `services/llm-evaluation-qa.html`. |
| Tool comparisons | "Not sure which fits your stack? Book a 20-min call" + inline checklist magnet. |
| Case studies | Book-a-call + cross-link to `roi.html`. |
| Linkable assets | Embed code w/ required attribution backlink; treat backlinks as the KPI, not conversions. |
| Original-data studies | PR/outreach on publish, capture email for next edition, no hard sell. |
| Listicles | Internal links into the comparison pages + one bottom CTA. |
| Founder-voice notes | Newsletter is the primary capture; light CTAs. |

---

**i18n:** Spanish/Portuguese mirrors exist under `es/` and `pt/`; new content follows the `build-i18n.mjs` pipeline once English is validated.
