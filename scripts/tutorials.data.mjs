/**
 * tutorials.data.mjs — the "how to build" tutorial series for the Learn library.
 *
 * Tutorials render through the DOCS generator (build-docs.mjs) so they inherit its
 * code blocks, on-this-page TOC, ⌘K search, and HowTo schema. docs.data.mjs imports
 * TUTORIAL_PAGES + TUTORIAL_NAV_ITEMS and merges them into PAGES + NAV, so each
 * tutorial becomes docs-<slug>.html. The step content lives in tutorial-bodies.json,
 * drafted (and code-reviewed) to the house voice. A body-less tutorial renders a
 * short placeholder, never a blank page.
 */
import { readFileSync } from 'node:fs';

let BODIES = {};
try { BODIES = JSON.parse(readFileSync('scripts/tutorial-bodies.json', 'utf8')); } catch { BODIES = {}; }

// Pillar anchors reused across tutorials (learn page + human name + cornerstone up-link).
const P = {
  eval: { pillar: 'learn-llm-evaluation.html', name: 'LLM Evaluation & Quality', corner: { t: 'LLM Evaluation Metrics Explained', href: 'docs-llm-evaluation-metrics.html' } },
  ci: { pillar: 'learn-ai-in-ci.html', name: 'AI Testing in CI/CD', corner: { t: 'The CI eval gate, explained', href: 'guide-eval-gate.html' } },
  rag: { pillar: 'learn-rag-retrieval.html', name: 'RAG & Retrieval Quality', corner: { t: 'RAG evaluation guide', href: 'rag-evaluation-guide.html' } },
  agents: { pillar: 'learn-agent-reliability.html', name: 'AI Agent Reliability', corner: { t: 'AI agent testing', href: 'ai-agent-testing.html' } },
  safety: { pillar: 'learn-llm-evaluation.html', name: 'LLM Evaluation & Quality', corner: { t: 'Adversarial probes, explained', href: 'guide-probes.html' } },
  testing: { pillar: 'learn-test-automation.html', name: 'Test Automation & QA', corner: { t: 'Reduce test flakiness', href: 'reduce-test-flakiness.html' } },
};

// 16 tutorials. lead = the on-page hook; summary = placeholder + a hint to the drafting pass.
export const TUTORIALS = [
  { slug: 'build-llm-eval-gate-ci', p: 'ci', tool: 'Promptfoo', title: 'How to Build an LLM Eval Gate in CI with Promptfoo', desc: 'A step-by-step guide to adding an automated eval gate that blocks a release when your LLM feature regresses, using Promptfoo and GitHub Actions.', lead: 'Wire a real quality gate into CI so a bad prompt change fails the build instead of reaching your users.', summary: 'Add a Promptfoo eval gate to CI that blocks a merge when quality drops.' },
  { slug: 'build-golden-set', p: 'eval', tool: 'any framework', title: 'How to Build a Golden Set for LLM Regression Testing', desc: 'How to assemble, structure, and grow a golden set of test cases so you can tell whether a change to your LLM feature made it better or worse.', lead: 'Build the fixed set of known-good cases that turns "it feels better" into a number you can trust.', summary: 'Assemble and grow a golden set of cases for LLM regression testing.' },
  { slug: 'add-human-approval-checkpoint', p: 'ci', tool: 'a queue + webhook', title: 'How to Add a Human-Approval Checkpoint to an AI Pipeline', desc: 'How to insert a human-in-the-loop approval step into an automated AI workflow so risky actions wait for a person before they run.', lead: 'Put a person at the one point where an AI decision needs a human to say yes.', summary: 'Insert a human-in-the-loop approval step before risky AI actions.' },
  { slug: 'write-adversarial-probes', p: 'safety', tool: 'Promptfoo / custom', title: 'How to Write Adversarial Probes for Prompt Injection Testing', desc: 'How to write a battery of adversarial probes that try to jailbreak or inject your LLM feature, and measure how often they get through.', lead: 'Attack your own feature on purpose, so an attacker cannot be the first to find the hole.', summary: 'Write adversarial probes that test for prompt injection and jailbreaks.' },
  { slug: 'evaluate-rag-pipeline', p: 'rag', tool: 'RAGAS', title: 'How to Evaluate a RAG Pipeline End-to-End with RAGAS', desc: 'A practical walkthrough of scoring a retrieval-augmented pipeline end to end: faithfulness, answer relevancy, context precision, and recall.', lead: 'Measure both halves of a RAG system, so you know whether a wrong answer is a retrieval bug or a generation bug.', summary: 'Score a RAG pipeline end to end with RAGAS metrics.' },
  { slug: 'nightly-llm-regression-github-actions', p: 'ci', tool: 'GitHub Actions', title: 'How to Set Up a Nightly LLM Regression Suite in GitHub Actions', desc: 'How to run your LLM eval suite on a schedule in GitHub Actions and get alerted when quality drifts overnight.', lead: 'Catch slow quality drift while you sleep, with a scheduled eval run and an alert.', summary: 'Run an LLM eval suite nightly in GitHub Actions with alerts.' },
  { slug: 'version-golden-datasets', p: 'eval', tool: 'git', title: 'How to Version Golden Datasets Like Code', desc: 'How to keep your eval datasets under version control so every score is reproducible and every change to the set is reviewed.', lead: 'Treat your test set like code: tracked, reviewed, and tied to a version, so a score always means something.', summary: 'Keep eval datasets under version control for reproducible scores.' },
  { slug: 'test-tool-call-accuracy', p: 'agents', tool: 'pytest', title: 'How to Build a Tool-Call Accuracy Test Harness for AI Agents', desc: 'How to test that an agent calls the right tool with the right arguments, with a small harness you can run in CI.', lead: 'Check that your agent reaches for the correct tool with the correct arguments, every time.', summary: 'Build a harness that tests an agent picks the right tool and arguments.' },
  { slug: 'test-multi-turn-conversations', p: 'agents', tool: 'a test script', title: 'How to Test Multi-Turn Agent Conversations', desc: 'How to test a conversation over many turns, including memory and context, instead of a single request and response.', lead: 'Test the whole conversation, not just one reply, so state and memory bugs surface before users hit them.', summary: 'Test multi-turn agent conversations, including memory and state.' },
  { slug: 'add-llm-observability', p: 'ci', tool: 'Langfuse / Phoenix', title: 'How to Add Open-Source LLM Observability (Langfuse or Phoenix)', desc: 'How to add self-hosted tracing to an LLM app so you can see every prompt, response, and score in production.', lead: 'See what your LLM app is actually doing in production, with open-source tracing you host yourself.', summary: 'Add self-hosted LLM observability with Langfuse or Phoenix.' },
  { slug: 'build-quality-ratchet', p: 'ci', tool: 'a CI check', title: 'How to Build a Quality Ratchet That Blocks Regressions', desc: 'How to build a ratchet so today’s eval score becomes tomorrow’s floor, and quality can only go up.', lead: 'Make quality a one-way door: the gate stores the last good score and refuses anything worse.', summary: 'Build a ratchet where the last good score becomes the new floor.' },
  { slug: 'playwright-ai-generated-ui', p: 'testing', tool: 'Playwright', title: 'How to Run Playwright Tests Against an AI-Generated UI', desc: 'How to write resilient Playwright tests for a UI that an AI generates or changes, without chasing brittle selectors.', lead: 'Test a UI that keeps changing under you, with Playwright tests that lean on roles and text instead of fragile selectors.', summary: 'Write resilient Playwright tests for an AI-generated or changing UI.' },
  { slug: 'detect-hallucinations-production', p: 'rag', tool: 'a grounding check', title: 'How to Detect Hallucinations Automatically in Production Logs', desc: 'How to run an automated grounding check over production traffic so hallucinations get flagged instead of shipped.', lead: 'Flag confident-but-wrong answers in production automatically, by checking each claim against its sources.', summary: 'Detect hallucinations in production by grounding answers against sources.' },
  { slug: 'red-team-chatbot-suite', p: 'safety', tool: 'a probe suite', title: 'How to Build a Red-Team Test Suite for a Customer-Facing Chatbot', desc: 'How to assemble a repeatable red-team suite for a customer-facing chatbot, covering injection, jailbreaks, and off-brand answers.', lead: 'Give your chatbot a standing set of attacks it has to survive before every release.', summary: 'Build a repeatable red-team suite for a customer-facing chatbot.' },
  { slug: 'wire-eval-gate-deploy', p: 'ci', tool: 'GitHub / Vercel', title: 'How to Wire an Eval Gate into a GitHub or Vercel Deploy Pipeline', desc: 'How to make an eval gate an actual deploy blocker in a GitHub or Vercel pipeline, so a failing eval stops the release.', lead: 'Turn your eval from a report nobody reads into a check that can stop a deploy.', summary: 'Make an eval gate a real deploy blocker in GitHub or Vercel.' },
  { slug: 'structure-ai-monorepo', p: 'eval', tool: 'a repo layout', title: 'How to Structure a Monorepo for an AI Product Plus Eval Suite', desc: 'A practical layout for an AI product monorepo that keeps app code, prompts, eval datasets, and the eval suite organized and testable.', lead: 'Lay out an AI product repo so prompts, datasets, and evals have a real home instead of scattering.', summary: 'Structure an AI product monorepo with app, prompts, datasets, and evals.' },
];

// Convert one drafted body to docs blocks. Shape of a body:
//   { intro, prereqs:[str], steps:[{heading, prose, code:{file,content}|null}], gotchas:[str], result }
function blocksFor(spec) {
  const b = BODIES[spec.slug];
  const ref = P[spec.p];
  if (!b) return [['p', `${spec.summary} <span style="color:var(--faint)">(full tutorial coming soon)</span>`]];
  const out = [['p', b.intro]];
  if (Array.isArray(b.prereqs) && b.prereqs.length) { out.push(['h', 'Before you start']); out.push(['ul', b.prereqs]); }
  for (const s of (b.steps || [])) {
    if (s.heading) out.push(['h', s.heading]);
    if (s.prose) out.push(['p', s.prose]);
    if (s.code && s.code.content) out.push(['code', s.code.file || 'example', s.code.content]);
  }
  if (Array.isArray(b.gotchas) && b.gotchas.length) { out.push(['h', 'Watch out for']); out.push(['ul', b.gotchas]); }
  if (b.result) { out.push(['h', 'What you built']); out.push(['p', b.result]); }
  out.push(['proof', [[ref.corner.t, ref.corner.href], ['The Learn library', 'learn.html']]]);
  out.push(['cta', 'Want this built into your pipeline?', 'Get a free mini-eval on your live AI feature, or book a call to have it wired in properly.']);
  return out;
}

// Ready-to-merge PAGES entries + NAV items for docs.data.mjs.
export const TUTORIAL_PAGES = Object.fromEntries(TUTORIALS.map((spec) => [spec.slug, {
  title: spec.title.replace(/^How to /, ''),
  cat: 'How-to guides',
  desc: spec.desc,
  lead: spec.lead,
  schema: 'howto',
  blocks: blocksFor(spec),
}]));

export const TUTORIAL_NAV_ITEMS = TUTORIALS.map((spec) => ({ slug: spec.slug }));
export const TUTORIAL_SLUGS = TUTORIALS.map((spec) => spec.slug);
// Pillar map exposed so Learn pillars can link the relevant tutorials.
export const TUTORIAL_PILLARS = Object.fromEntries(TUTORIALS.map((spec) => [spec.slug, P[spec.p].pillar]));
