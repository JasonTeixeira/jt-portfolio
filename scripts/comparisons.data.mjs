/**
 * comparisons.data.mjs — "X vs Y" tool comparison metadata for the Learn library.
 *
 * build-compare.mjs renders:
 *   compare.html            the comparison hub (all matchups by category)
 *   compare/<slug>.html     one page per matchup (Article schema)
 *
 * The body (intro, comparison table, pick-A / pick-B, honest take) lives in
 * scripts/compare-bodies.json, drafted to the house voice and, critically, to
 * STABLE architectural facts (open-source vs commercial, self-host vs SaaS,
 * code-first vs UI-first, what each is best for) rather than volatile pricing or
 * version specifics. Related matchups + cornerstone up-link derive from `cat`.
 */

export const CATS = {
  evaluation: { label: 'Eval frameworks', accent: '#22d3ee', pillar: 'learn-llm-evaluation.html', pillarName: 'LLM Evaluation & Quality', cornerstone: { t: 'LLM Evaluation Metrics Explained', href: 'docs-llm-evaluation-metrics.html' } },
  observability: { label: 'Eval platforms & observability', accent: '#e879f9', pillar: 'learn-ai-in-ci.html', pillarName: 'AI Testing in CI/CD', cornerstone: { t: 'The CI eval gate, explained', href: 'guide-eval-gate.html' } },
  safety: { label: 'Guardrails & safety', accent: '#f43f5e', pillar: 'learn-llm-evaluation.html', pillarName: 'LLM Evaluation & Quality', cornerstone: { t: 'Adversarial probes, explained', href: 'guide-probes.html' } },
  rag: { label: 'RAG frameworks', accent: '#a78bfa', pillar: 'learn-rag-retrieval.html', pillarName: 'RAG & Retrieval Quality', cornerstone: { t: 'RAG evaluation guide', href: 'rag-evaluation-guide.html' } },
  testing: { label: 'Test automation', accent: '#F59E0B', pillar: 'learn-test-automation.html', pillarName: 'Test Automation & QA', cornerstone: { t: 'Reduce test flakiness', href: 'reduce-test-flakiness.html' } },
  automation: { label: 'Workflow automation', accent: '#34d399', pillar: 'learn-workflow-automation.html', pillarName: 'AI Workflow Automation', cornerstone: { t: 'AI workflow automation', href: 'services/ai-workflow-automation.html' } },
};

// Each matchup: slug, the two tool names (a, b), category, and a one-line gloss.
export const COMPARISONS = [
  // ── Eval frameworks ──
  { slug: 'promptfoo-vs-deepeval', a: 'Promptfoo', b: 'DeepEval', cat: 'evaluation', gloss: 'Two open-source LLM eval frameworks: config-and-CLI-first versus pytest-style.' },
  { slug: 'promptfoo-vs-ragas', a: 'Promptfoo', b: 'RAGAS', cat: 'evaluation', gloss: 'A general-purpose eval runner versus a RAG-specific metric library.' },
  { slug: 'ragas-vs-deepeval', a: 'RAGAS', b: 'DeepEval', cat: 'evaluation', gloss: 'RAG-focused metrics versus a broad, pytest-style metric suite.' },
  { slug: 'openai-evals-vs-promptfoo', a: 'OpenAI Evals', b: 'Promptfoo', cat: 'evaluation', gloss: 'The OpenAI eval registry versus a config-driven, model-agnostic runner.' },
  { slug: 'giskard-vs-promptfoo', a: 'Giskard', b: 'Promptfoo', cat: 'evaluation', gloss: 'Automated vulnerability scanning versus explicit test cases you write.' },
  { slug: 'trulens-vs-ragas', a: 'TruLens', b: 'RAGAS', cat: 'evaluation', gloss: 'Feedback-function instrumentation versus ready-made RAG metrics.' },
  { slug: 'confident-ai-vs-braintrust', a: 'Confident AI', b: 'Braintrust', cat: 'evaluation', gloss: 'The DeepEval cloud platform versus a general eval-and-logging platform.' },
  // ── Eval platforms & observability ──
  { slug: 'langsmith-vs-braintrust', a: 'LangSmith', b: 'Braintrust', cat: 'observability', gloss: 'LangChain’s tracing-and-eval platform versus a dev-first eval platform.' },
  { slug: 'langsmith-vs-langfuse', a: 'LangSmith', b: 'Langfuse', cat: 'observability', gloss: 'A hosted platform versus an open-source, self-hostable one.' },
  { slug: 'braintrust-vs-langfuse', a: 'Braintrust', b: 'Langfuse', cat: 'observability', gloss: 'A commercial eval platform versus open-source observability you can host.' },
  { slug: 'arize-phoenix-vs-langsmith', a: 'Arize Phoenix', b: 'LangSmith', cat: 'observability', gloss: 'Open-source tracing you run yourself versus a hosted platform.' },
  { slug: 'humanloop-vs-promptlayer', a: 'Humanloop', b: 'PromptLayer', cat: 'observability', gloss: 'Two prompt-management and logging platforms, compared.' },
  { slug: 'wandb-weave-vs-braintrust', a: 'W&B Weave', b: 'Braintrust', cat: 'observability', gloss: 'Weights & Biases’ LLM tooling versus a purpose-built eval platform.' },
  { slug: 'patronus-ai-vs-galileo', a: 'Patronus AI', b: 'Galileo', cat: 'observability', gloss: 'Two commercial LLM evaluation-and-safety platforms, compared.' },
  // ── Guardrails & safety ──
  { slug: 'guardrails-ai-vs-nemo-guardrails', a: 'Guardrails AI', b: 'NeMo Guardrails', cat: 'safety', gloss: 'Output validation versus programmable conversation rails.' },
  { slug: 'lakera-guard-vs-rebuff', a: 'Lakera Guard', b: 'Rebuff', cat: 'safety', gloss: 'A commercial injection-defense API versus an open-source detector.' },
  // ── RAG frameworks ──
  { slug: 'langchain-vs-llamaindex', a: 'LangChain', b: 'LlamaIndex', cat: 'rag', gloss: 'A broad LLM app framework versus a data-and-retrieval-focused one.' },
  // ── Test automation ──
  { slug: 'playwright-vs-cypress', a: 'Playwright', b: 'Cypress', cat: 'testing', gloss: 'Multi-browser, multi-language automation versus a JS-first, in-browser experience.' },
  { slug: 'playwright-vs-selenium', a: 'Playwright', b: 'Selenium', cat: 'testing', gloss: 'A modern, auto-waiting framework versus the long-standing WebDriver standard.' },
  // ── Workflow automation ──
  { slug: 'n8n-vs-zapier', a: 'n8n', b: 'Zapier', cat: 'automation', gloss: 'Open-source, self-hostable automation versus a no-code SaaS with a huge app catalog.' },
  { slug: 'n8n-vs-make', a: 'n8n', b: 'Make', cat: 'automation', gloss: 'Developer-leaning, self-hostable automation versus a visual SaaS builder.' },
];

export const COMPARE_SLUGS = COMPARISONS.map((c) => c.slug);
