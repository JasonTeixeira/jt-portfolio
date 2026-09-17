/**
 * glossary.data.mjs — the term metadata for the Learn glossary.
 *
 * build-glossary.mjs renders:
 *   glossary.html            the glossary hub (index of all terms, DefinedTermSet schema)
 *   glossary/<slug>.html     one indexable page per term (DefinedTerm schema)
 *
 * The ~350-word body for each term lives in scripts/glossary-bodies.json (drafted to a
 * strict human-appeal voice, then polished). This file holds only structure:
 *   slug, term, aka (optional), cat, gloss (one-line summary used on the hub + meta).
 * Related terms and "see also" are derived from `cat` at build time (same-category
 * siblings + the category's cornerstone), so the cluster mesh forms automatically.
 */

// Each category maps to a pillar (for the up-link) + an accent + its cornerstone anchor.
export const CATS = {
  evaluation: { label: 'Evaluation', accent: '#22d3ee', pillar: 'learn-llm-evaluation.html', pillarName: 'LLM Evaluation & Quality', cornerstone: { t: 'LLM Evaluation Metrics Explained', href: 'docs-llm-evaluation-metrics.html' } },
  rag: { label: 'RAG & Retrieval', accent: '#a78bfa', pillar: 'learn-rag-retrieval.html', pillarName: 'RAG & Retrieval Quality', cornerstone: { t: 'RAG evaluation guide', href: 'rag-evaluation-guide.html' } },
  safety: { label: 'Safety', accent: '#f43f5e', pillar: 'learn-llm-evaluation.html', pillarName: 'LLM Evaluation & Quality', cornerstone: { t: 'Adversarial probes, explained', href: 'guide-probes.html' } },
  agents: { label: 'Agents', accent: '#8FA0FF', pillar: 'learn-agent-reliability.html', pillarName: 'AI Agent Reliability', cornerstone: { t: 'AI agent testing', href: 'ai-agent-testing.html' } },
  ci: { label: 'CI / CD', accent: '#10b981', pillar: 'learn-ai-in-ci.html', pillarName: 'AI Testing in CI/CD', cornerstone: { t: 'The CI eval gate, explained', href: 'guide-eval-gate.html' } },
  ops: { label: 'Operations', accent: '#F59E0B', pillar: 'learn-tool-landscape.html', pillarName: 'Tools & Landscape', cornerstone: { t: 'LLM Evaluation Metrics Explained', href: 'docs-llm-evaluation-metrics.html' } },
};

// 52 terms. gloss = a plain one-liner (hub subtitle + meta description fallback + a hint
// to the drafting pass). Keep gloss human and concrete.
export const TERMS = [
  // ── Evaluation ──
  { slug: 'golden-set', term: 'Golden set', aka: 'Golden dataset', cat: 'evaluation', gloss: 'A fixed set of example inputs with known-good answers you grade every new version against.' },
  { slug: 'llm-as-judge', term: 'LLM-as-a-judge', cat: 'evaluation', gloss: 'Using a strong model to grade another model’s answers against a rubric, at a scale humans can’t.' },
  { slug: 'eval-harness', term: 'Eval harness', cat: 'evaluation', gloss: 'The plumbing that runs your test cases through a model and scores the answers automatically.' },
  { slug: 'semantic-similarity', term: 'Semantic similarity', cat: 'evaluation', gloss: 'Scoring how close two pieces of text are in meaning, not in exact wording.' },
  { slug: 'f1-score', term: 'F1 score', cat: 'evaluation', gloss: 'A single number that balances catching everything against not crying wolf.' },
  { slug: 'rubric-based-grading', term: 'Rubric-based grading', cat: 'evaluation', gloss: 'Grading answers against explicit written criteria instead of a gut-feel score.' },
  { slug: 'pairwise-comparison', term: 'Pairwise comparison', cat: 'evaluation', gloss: 'Asking “which of these two answers is better?” instead of scoring each in isolation.' },
  { slug: 'elo-rating', term: 'Elo rating', cat: 'evaluation', gloss: 'Ranking models the way chess ranks players: by who beats whom, head to head.' },
  { slug: 'perplexity', term: 'Perplexity', cat: 'evaluation', gloss: 'A measure of how surprised a language model is by a piece of text.' },
  { slug: 'synthetic-data-generation', term: 'Synthetic data generation', cat: 'evaluation', gloss: 'Using a model to invent realistic test cases when you don’t have enough real ones.' },
  { slug: 'eval-dataset-versioning', term: 'Eval dataset versioning', cat: 'evaluation', gloss: 'Treating your test set like code: tracked, reviewed, and tied to a version.' },
  { slug: 'eval-driven-development', term: 'Eval-driven development', aka: 'EDD', cat: 'evaluation', gloss: 'Writing the eval before the feature, so “done” means “passes the eval”.' },
  { slug: 'prompt-regression-testing', term: 'Prompt regression testing', cat: 'evaluation', gloss: 'Re-running old cases after a prompt change to make sure nothing quietly broke.' },
  { slug: 'model-card', term: 'Model card', cat: 'evaluation', gloss: 'A short spec sheet describing what a model is for, how it was tested, and its limits.' },
  // ── RAG & Retrieval ──
  { slug: 'rag', term: 'RAG', aka: 'Retrieval-augmented generation', cat: 'rag', gloss: 'Fetching relevant documents first, then letting the model answer using them.' },
  { slug: 'faithfulness', term: 'Faithfulness', aka: 'Groundedness', cat: 'rag', gloss: 'Whether an answer is actually supported by the sources it was given.' },
  { slug: 'context-precision', term: 'Context precision', cat: 'rag', gloss: 'Of the chunks you retrieved, how many were actually relevant.' },
  { slug: 'context-recall', term: 'Context recall', cat: 'rag', gloss: 'Whether the chunk that held the answer was retrieved at all.' },
  { slug: 'answer-relevancy', term: 'Answer relevancy', cat: 'rag', gloss: 'Whether the answer actually addresses the question that was asked.' },
  { slug: 'chunking-strategy', term: 'Chunking strategy', cat: 'rag', gloss: 'How you slice documents into pieces small enough to retrieve and feed to a model.' },
  { slug: 'hybrid-search', term: 'Hybrid search', cat: 'rag', gloss: 'Combining keyword search with meaning-based search to retrieve better context.' },
  { slug: 'reranker', term: 'Reranker', cat: 'rag', gloss: 'A second pass that re-sorts retrieved chunks so the most useful ones come first.' },
  { slug: 'query-rewriting', term: 'Query rewriting', cat: 'rag', gloss: 'Rephrasing a user’s messy question into one that retrieves better.' },
  { slug: 'agentic-rag', term: 'Agentic RAG', cat: 'rag', gloss: 'RAG that can decide to search again, search differently, or use a tool before answering.' },
  { slug: 'embedding-drift', term: 'Embedding drift', cat: 'rag', gloss: 'When your search index slowly falls out of sync with the model that reads it.' },
  // ── Safety ──
  { slug: 'hallucination', term: 'Hallucination', cat: 'safety', gloss: 'When a model states something false with complete confidence.' },
  { slug: 'prompt-injection', term: 'Prompt injection', cat: 'safety', gloss: 'Hidden instructions in user input or documents that hijack what the model does.' },
  { slug: 'jailbreak', term: 'Jailbreak', cat: 'safety', gloss: 'Tricking a model into ignoring its own safety rules.' },
  { slug: 'red-teaming', term: 'Red teaming', cat: 'safety', gloss: 'Deliberately attacking your own AI system to find how it fails before someone else does.' },
  { slug: 'adversarial-testing', term: 'Adversarial testing', cat: 'safety', gloss: 'Testing with inputs designed to break the model, not the happy path.' },
  { slug: 'guardrails', term: 'Guardrails', cat: 'safety', gloss: 'Checks around a model that block bad inputs or outputs before they cause harm.' },
  { slug: 'toxicity-scoring', term: 'Toxicity scoring', cat: 'safety', gloss: 'Automatically rating output for hostility, slurs, or other harmful content.' },
  { slug: 'bias-evaluation', term: 'Bias evaluation', cat: 'safety', gloss: 'Checking whether a model treats similar people or groups differently.' },
  { slug: 'pii-leakage', term: 'PII leakage', cat: 'safety', gloss: 'When a model repeats personal data it should have kept to itself.' },
  // ── Agents ──
  { slug: 'agent-trajectory-evaluation', term: 'Agent trajectory evaluation', cat: 'agents', gloss: 'Grading the whole path an agent took, not just its final answer.' },
  { slug: 'tool-call-accuracy', term: 'Tool-call accuracy', cat: 'agents', gloss: 'Whether an agent calls the right tool with the right arguments.' },
  { slug: 'function-calling-evaluation', term: 'Function-calling evaluation', cat: 'agents', gloss: 'Testing that a model produces valid, correct calls to your functions.' },
  { slug: 'task-completion-rate', term: 'Task completion rate', cat: 'agents', gloss: 'How often an agent actually finishes the job it was given.' },
  { slug: 'multi-turn-evaluation', term: 'Multi-turn evaluation', cat: 'agents', gloss: 'Testing a conversation over many back-and-forth turns, not one reply.' },
  { slug: 'structured-output-validation', term: 'Structured output validation', cat: 'agents', gloss: 'Checking that a model’s JSON (or other format) is valid and matches your schema.' },
  // ── CI/CD ──
  { slug: 'ci-quality-gate', term: 'CI quality gate', aka: 'Eval gate', cat: 'ci', gloss: 'An automated check that blocks a release if quality drops below a threshold.' },
  { slug: 'ratchet', term: 'Ratchet', cat: 'ci', gloss: 'A gate that only lets quality go up: today’s score becomes tomorrow’s floor.' },
  { slug: 'flake', term: 'Flake', aka: 'Flaky test', cat: 'ci', gloss: 'A test that passes and fails on the same code, for no real reason.' },
  { slug: 'golden-run-evidence', term: 'Golden-run evidence', cat: 'ci', gloss: 'The saved, verifiable record of a test run you can show instead of just claiming it passed.' },
  { slug: 'canary-prompt', term: 'Canary prompt', cat: 'ci', gloss: 'A known input you run constantly to catch a regression the moment it appears.' },
  { slug: 'shadow-deployment', term: 'Shadow deployment', cat: 'ci', gloss: 'Running a new version alongside the old one on real traffic, without users seeing it.' },
  { slug: 'champion-challenger', term: 'Champion-challenger', cat: 'ci', gloss: 'Keeping the current best model in charge until a challenger proves it’s better.' },
  // ── Operations ──
  { slug: 'human-in-the-loop', term: 'Human-in-the-loop', aka: 'HITL', cat: 'ops', gloss: 'Putting a person at the point where an AI decision needs a human to approve it.' },
  { slug: 'model-drift', term: 'Model drift', cat: 'ops', gloss: 'When a model’s accuracy quietly decays because the world changed, not the model.' },
  { slug: 'non-determinism', term: 'Non-determinism', cat: 'ops', gloss: 'Why the same prompt can give you a different answer every time you run it.' },
  { slug: 'temperature', term: 'Temperature', cat: 'ops', gloss: 'The dial that controls how random or predictable a model’s output is.' },
  { slug: 'llm-gateway', term: 'LLM gateway', aka: 'Model router', cat: 'ops', gloss: 'A single doorway in front of many models that handles routing, limits, and logging.' },
];

export const TERM_SLUGS = TERMS.map((t) => t.slug);
