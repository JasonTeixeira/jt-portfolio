/**
 * articles.data.mjs — supporting cluster articles (essays) for the Learn library.
 *
 * Articles render through the docs pipeline (like the cornerstones + tutorials): they
 * are merged into PAGES via ARTICLE_PAGES so they generate as docs-<slug>.html, are
 * searchable, and carry TechArticle schema. They are deliberately NOT added to the docs
 * sidebar (there are too many); they are reached from their Learn pillar, from internal
 * links, and from ⌘K search. Bodies live in article-bodies.json.
 */
import { readFileSync } from 'node:fs';

let BODIES = {};
try { BODIES = JSON.parse(readFileSync('scripts/article-bodies.json', 'utf8')); } catch { BODIES = {}; }

const P = {
  eval: { pillar: 'learn-llm-evaluation.html', name: 'LLM Evaluation & Quality', corner: { t: 'LLM Evaluation Metrics Explained', href: 'docs-llm-evaluation-metrics.html' } },
  rag: { pillar: 'learn-rag-retrieval.html', name: 'RAG & Retrieval Quality', corner: { t: 'RAG Evaluation Metrics Explained', href: 'docs-rag-evaluation-metrics.html' } },
  agents: { pillar: 'learn-agent-reliability.html', name: 'AI Agent Reliability', corner: { t: 'AI agent testing', href: 'ai-agent-testing.html' } },
  ci: { pillar: 'learn-ai-in-ci.html', name: 'AI Testing in CI/CD', corner: { t: 'Eval Gates: The Missing CI Step', href: 'docs-eval-gates-ci.html' } },
  testing: { pillar: 'learn-test-automation.html', name: 'Test Automation & QA', corner: { t: 'Reduce test flakiness', href: 'reduce-test-flakiness.html' } },
  ship: { pillar: 'learn-shipping-ai.html', name: 'Shipping AI Safely', corner: { t: 'AI feature launch checklist', href: 'checklist.html' } },
  automation: { pillar: 'learn-workflow-automation.html', name: 'AI Workflow Automation', corner: { t: 'AI workflow automation', href: 'services/ai-workflow-automation.html' } },
  landscape: { pillar: 'learn-tool-landscape.html', name: 'Tools & Landscape', corner: { t: 'Tool comparisons', href: 'compare.html' } },
};

export const ARTICLES = [
  // ── LLM Evaluation ──
  { slug: 'llm-as-judge-explained', p: 'eval', title: 'LLM-as-a-Judge: How It Works and When It Fails', desc: 'How to use a strong model to grade another model at scale, the biases that quietly wreck it, and how to calibrate a judge you can trust.', lead: 'Using a model to grade a model is the highest-leverage move in eval, and the easiest to get quietly wrong.', summary: 'How LLM-as-judge works, its biases, and how to calibrate one you can trust.' },
  { slug: 'eval-scores-vs-production', p: 'eval', title: 'Why Your LLM Eval Scores Do Not Match Production', desc: 'The gap between a 94 percent eval score and unhappy users, why it happens, and how to close it by feeding production back into your golden set.', lead: 'Your eval says 94 percent and your users are unhappy. Both can be true, and the reason matters.', summary: 'Why eval scores diverge from production reality and how to close the gap.' },
  { slug: 'testing-vs-evaluating-llms', p: 'eval', title: 'Testing vs Evaluating an LLM: What Is the Difference', desc: 'Testing checks for a right answer; evaluation scores a fuzzy one. Knowing which you need decides your whole approach to LLM quality.', lead: 'One checks a right answer, the other scores a fuzzy one. Confusing them is why teams measure the wrong thing.', summary: 'The difference between testing and evaluating an LLM, and when to use each.' },
  { slug: 'how-often-run-llm-evals', p: 'eval', title: 'How Often Should You Re-Run Your LLM Evals', desc: 'A practical cadence for LLM evaluation: what runs on every change, what runs nightly, and what runs before a release.', lead: 'Run evals too rarely and regressions slip through; too often and the bill and the noise pile up.', summary: 'A practical cadence for when to run LLM evals: per-change, nightly, pre-release.' },
  // ── RAG ──
  { slug: 'why-rag-hallucinates', p: 'rag', title: 'Why Your RAG Pipeline Hallucinates and How to Fix It', desc: 'Most RAG hallucinations are a retrieval problem wearing a generation mask. How to find the real cause and fix it.', lead: 'A RAG system that makes things up is usually failing retrieval, not generation. Here is how to tell and how to fix it.', summary: 'The real causes of RAG hallucination and how to fix each one.' },
  { slug: 'rag-chunking-strategies', p: 'rag', title: 'Chunking Strategies for RAG, Compared', desc: 'Fixed-size, sentence, and semantic chunking compared, with how each affects retrieval quality and when to reach for it.', lead: 'How you slice documents into chunks quietly decides whether retrieval works. Here are the options and the tradeoffs.', summary: 'Fixed, sentence, and semantic chunking compared for RAG retrieval quality.' },
  { slug: 'hybrid-vs-vector-search', p: 'rag', title: 'Hybrid Search vs Pure Vector Search for RAG', desc: 'When keyword search plus vector search beats vectors alone, and how hybrid retrieval fixes the exact-match blind spot.', lead: 'Pure vector search has a blind spot for exact terms and names. Hybrid search is usually the cheap fix.', summary: 'When hybrid search beats pure vector search for RAG, and why.' },
  { slug: 'rag-vs-fine-tuning', p: 'rag', title: 'RAG vs Fine-Tuning: When to Use Each', desc: 'RAG adds knowledge, fine-tuning changes behavior. A clear decision framework for which one your problem actually needs.', lead: 'RAG teaches the model what to know; fine-tuning teaches it how to act. Most teams reach for the wrong one first.', summary: 'A decision framework for choosing RAG, fine-tuning, or both.' },
  // ── Agents ──
  { slug: 'why-ai-agents-fail', p: 'agents', title: 'Why AI Agents Fail in Production', desc: 'The failure modes that only show up once an agent takes real actions, and how to catch them before launch.', lead: 'An agent that demos perfectly can still fall apart in production. These are the failure modes to test for first.', summary: 'The production failure modes of AI agents and how to catch them early.' },
  { slug: 'agent-trajectory-evaluation', p: 'agents', title: 'Agent Trajectory Evaluation: Testing More Than the Answer', desc: 'Why grading only an agent final answer hides the bugs, and how to score the whole path it took to get there.', lead: 'An agent can reach the right answer through a broken path. Trajectory evaluation grades the path, not just the destination.', summary: 'How to evaluate the whole path an agent takes, not just its final answer.' },
  { slug: 'non-deterministic-ai-testing', p: 'agents', title: 'How to Test AI Systems That Give Different Answers Each Run', desc: 'Non-determinism breaks naive tests. How to build evals that separate real regressions from normal model variance.', lead: 'The same input can give a different answer every run. Here is how to test something that will not sit still.', summary: 'How to test non-deterministic AI without chasing noise.' },
  { slug: 'ai-agent-reliability-standard', p: 'agents', title: 'How Reliable Should an AI Agent Actually Be', desc: 'What "reliable enough" means for an agent, how to set a real bar, and why the answer depends on what the agent can do.', lead: 'The right reliability bar for an agent depends entirely on the blast radius of its worst action.', summary: 'How to set a real reliability bar for an AI agent, tied to its blast radius.' },
  // ── CI/CD ──
  { slug: 'shift-left-testing-ai', p: 'ci', title: 'Shift-Left Testing for AI: Catch Regressions Before Merge', desc: 'How to move AI quality checks earlier in the pipeline so a bad change fails at the pull request instead of in production.', lead: 'The earlier a regression fails, the cheaper it is. For AI features, that means an eval on every pull request.', summary: 'How to move AI quality checks earlier, to the pull request.' },
  { slug: 'canary-releases-ai', p: 'ci', title: 'Canary Releases for AI Models: A Practical Playbook', desc: 'How to roll a new model or prompt out to a slice of traffic first, watch the metrics, and roll back fast if it regresses.', lead: 'Ship a new model to one percent of traffic before all of it. Here is how to run a canary for AI.', summary: 'A practical playbook for canary-releasing AI models and prompts.' },
  { slug: 'slos-for-ai-features', p: 'ci', title: 'Setting SLOs for AI Features: What Good Enough Means', desc: 'How to define service-level objectives for a fuzzy AI feature so the whole team agrees on what "working" means.', lead: 'You cannot manage what you will not define. SLOs turn "the AI feels off" into a number the team agrees on.', summary: 'How to set service-level objectives for AI features.' },
  { slug: 'ai-incident-postmortem', p: 'ci', title: 'The AI Incident Post-Mortem, With a Real Example', desc: 'A template for post-mortems on AI failures, and a worked example of tracing a hallucinated answer back to its root cause.', lead: 'When an AI feature fails a user, a good post-mortem turns the embarrassment into a permanent test case.', summary: 'A post-mortem template for AI incidents, with a worked example.' },
  // ── Test Automation ──
  { slug: 'ai-in-test-automation', p: 'testing', title: 'How AI Is Changing Test Automation: Real vs Hype', desc: 'An honest look at where AI genuinely helps test automation, where it does not, and what to be skeptical of.', lead: 'AI test-automation demos are dazzling and half of it is smoke. Here is the part that actually holds up.', summary: 'An honest read on where AI helps test automation and where it is hype.' },
  { slug: 'test-automation-roi', p: 'testing', title: 'Test Automation ROI: How to Calculate It for Leadership', desc: 'A simple, honest model for the return on test automation you can put in front of a decision-maker.', lead: 'Leadership funds test automation when it sees a number, not a principle. Here is how to build that number honestly.', summary: 'A simple, honest ROI model for test automation.' },
  { slug: 'visual-regression-testing', p: 'testing', title: 'Visual Regression Testing: Tools and Best Practices', desc: 'How to catch unintended visual changes automatically, the tools that do it, and how to keep the tests from crying wolf.', lead: 'A CSS change can break a layout no functional test will ever notice. Visual regression testing is how you catch it.', summary: 'How visual regression testing works, the tools, and how to avoid flaky diffs.' },
  { slug: 'meaningful-test-coverage', p: 'testing', title: 'Test Coverage Metrics That Actually Matter', desc: 'Why the coverage percentage on your dashboard can be high and meaningless, and what to measure instead.', lead: 'One hundred percent coverage can still miss every bug that matters. Here is what to measure instead of a number.', summary: 'Why coverage percentage misleads, and the metrics that actually matter.' },
  // ── Shipping AI Safely ──
  { slug: 'ship-ai-without-breaking-trust', p: 'ship', title: 'How to Ship an AI Feature Without Breaking User Trust', desc: 'The handful of guardrails, disclosures, and fallbacks that keep an AI feature from quietly eroding user trust.', lead: 'Users forgive a slow feature. They do not forgive one that confidently lied to them. Here is how to protect that trust.', summary: 'Guardrails, disclosures, and fallbacks that protect user trust in AI features.' },
  { slug: 'passing-tests-isnt-proof', p: 'ship', title: 'Passing Tests Is Not Proof: What Done Means for an AI Feature', desc: 'Why a green test suite is a necessary but weak signal for AI, and what a real definition of done looks like.', lead: 'Green tests mean the code ran, not that the feature is good. For AI, done needs a higher bar.', summary: 'Why green tests are not proof for AI, and a real definition of done.' },
  { slug: 'demo-works-production-fails', p: 'ship', title: 'When Your AI Works in Demo but Fails in Production', desc: 'The predictable reasons an AI feature that dazzled in the demo falls apart on real traffic, and how to close the gap.', lead: 'The demo used your ten favorite inputs. Production uses the ten thousand you never imagined. That gap is the whole problem.', summary: 'Why AI features pass the demo but fail in production, and how to close it.' },
  { slug: 'build-vs-buy-llm', p: 'ship', title: 'Build vs Buy: LLM API vs Fine-Tuning Your Own', desc: 'A clear framework for deciding between a hosted LLM API and training or fine-tuning your own model, by cost, control, and risk.', lead: 'Almost everyone should start with an API. Here is the honest framework for when that stops being true.', summary: 'A framework for choosing between an LLM API and your own model.' },
  // ── Workflow Automation ──
  { slug: 'what-is-ai-workflow-automation', p: 'automation', title: 'AI Workflow Automation: What It Actually Means', desc: 'Beyond the buzzword: what AI workflow automation really is, what it is good at, and where it quietly goes wrong.', lead: 'The phrase is everywhere and means almost nothing. Here is what AI workflow automation actually is, minus the hype.', summary: 'What AI workflow automation really means, its strengths and failure points.' },
  { slug: 'automate-support-triage', p: 'automation', title: 'How to Automate Support Triage With an LLM, Safely', desc: 'How to route and prioritize support tickets with an LLM without letting it make decisions it should not, using a human-in-the-loop design.', lead: 'An LLM is great at sorting support tickets and dangerous at answering them unsupervised. Here is the safe split.', summary: 'How to automate support triage with an LLM without letting it go off the rails.' },
  { slug: 'ai-automation-failure-modes', p: 'automation', title: 'AI Automation Failure Modes: What Breaks in Production', desc: 'The specific ways AI-powered automations fail once they meet real, messy input, and the guardrails that contain each one.', lead: 'AI automations do not fail loudly. They fail quietly, at scale, on the inputs nobody tested. Here is what to watch for.', summary: 'The failure modes of AI automations in production, and how to contain them.' },
  { slug: 'automation-roi-framework', p: 'automation', title: 'Is This Automation Worth Building? An ROI Framework', desc: 'A simple framework for deciding whether an automation will actually pay off, before you spend a week building it.', lead: 'Most automations that get built should not have been. Here is the five-minute check that tells you before you start.', summary: 'A simple framework for deciding if an automation is worth building.' },
  // ── Tools & Landscape ──
  { slug: 'state-of-llm-eval-tools-2026', p: 'landscape', title: 'The State of LLM Evaluation Tools in 2026', desc: 'A map of the LLM evaluation tool landscape in 2026: the categories, how they overlap, and how to think about picking from them.', lead: 'The LLM eval tool space is crowded and confusing. This is the map: the categories, the overlaps, and how to choose.', summary: 'A 2026 map of the LLM evaluation tool landscape and how to navigate it.' },
  { slug: 'open-source-vs-commercial-eval', p: 'landscape', title: 'Open-Source vs Commercial LLM Eval Platforms', desc: 'What you actually get, and give up, when you choose an open-source eval stack versus a commercial platform.', lead: 'Open-source eval tools are free until you count your own time. Here is the honest trade against a commercial platform.', summary: 'The real trade-off between open-source and commercial LLM eval platforms.' },
  { slug: 'best-llm-observability-tools', p: 'landscape', title: 'The Best LLM Observability Tools in 2026', desc: 'What LLM observability is, why you need it, and how the leading open-source and commercial options actually differ.', lead: 'You cannot fix what you cannot see. LLM observability is how you watch a model in production. Here are the real options.', summary: 'What LLM observability is and how the 2026 tools compare.' },
  { slug: 'best-open-source-llm-eval-frameworks', p: 'landscape', title: 'The Best Open-Source LLM Eval Frameworks in 2026', desc: 'A practical roundup of the open-source frameworks for evaluating LLM apps, what each is best at, and how to pick.', lead: 'You can build a serious eval practice without paying for anything. These are the open-source frameworks worth knowing.', summary: 'A roundup of the best open-source LLM eval frameworks and what each is best at.' },
];

function blocksFor(spec) {
  const b = BODIES[spec.slug];
  const ref = P[spec.p];
  if (!b) return [['p', `${spec.summary} <span style="color:var(--faint)">(full article coming soon)</span>`]];
  const out = [['p', b.intro]];
  for (const s of (b.sections || [])) {
    if (s.heading) out.push(['h', s.heading]);
    for (const para of String(s.body || '').split(/\n\n+/).map((x) => x.trim()).filter(Boolean)) out.push(['p', para]);
  }
  if (b.keyTakeaway) out.push(['note', b.keyTakeaway]);
  if (b.closing) { out.push(['h', 'The bottom line']); out.push(['p', b.closing]); }
  out.push(['proof', [[ref.corner.t, ref.corner.href], [`${ref.name} pillar`, ref.pillar], ['The Learn library', 'learn.html']]]);
  out.push(['cta', 'Want this on your product, not just in theory?', 'Get a free mini-eval on your live AI feature, or book a call to talk it through.']);
  return out;
}

export const ARTICLE_PAGES = Object.fromEntries(ARTICLES.map((spec) => [spec.slug, {
  title: spec.title,
  cat: P[spec.p].name,
  desc: spec.desc,
  lead: spec.lead,
  blocks: blocksFor(spec),
}]));

export const ARTICLE_SLUGS = ARTICLES.map((spec) => spec.slug);
export const ARTICLE_PILLARS = Object.fromEntries(ARTICLES.map((spec) => [spec.slug, P[spec.p].pillar]));
