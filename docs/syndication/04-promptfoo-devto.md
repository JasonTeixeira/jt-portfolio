---
title: "LLM regression testing with Promptfoo in CI: the minimum viable gate"
published: true
canonical_url: https://agency.sageideas.dev/notes/promptfoo-ci-minimum-gate.html
tags: llm, testing, ai, cicd
---

Every LLM team I talk to has the same confession: prompt changes ship because they "seemed better" in a couple of manual checks. Nobody can prove the last change didn't make something else worse, because nothing is measuring. Here is the smallest setup that fixes that — one config file, one CI step, one afternoon.

**Step 1 — the golden set.** Collect 30 real inputs from logs or support tickets — real phrasing is weirder than anything you'll invent. For each, record the output your domain expert agrees is good. Commit them next to the code.

**Step 2 — the judge.** A minimal `promptfooconfig.yaml`:

```yaml
prompts:
  - file://prompts/support-answer.txt
providers:
  - anthropic:claude-sonnet-5
tests: file://golden/*.yaml
defaultTest:
  assert:
    - type: llm-rubric
      value: >-
        Faithful to the provided context, answers the actual
        question, no invented policies or prices.
    - type: cost
      threshold: 0.02
```

**Step 3 — the gate.** Promptfoo exits non-zero on failure, so CI needs exactly one honest step:

```yaml
- run: npx promptfoo eval --config promptfooconfig.yaml
  # non-zero exit = merge blocked. that's the whole gate.
```

A red eval that can't block a merge is a report, not a gate.

> Your first eval suite doesn't need to be good. It needs to exist, run in CI, and be allowed to say no.

**Don't want to start from scratch?** I open-sourced the whole thing as a template that runs green with ZERO API keys (mock provider included, swap one line for your real model): https://github.com/JasonTeixeira/llm-eval-gate

Full write-up + what I add when teams outgrow the minimum: https://agency.sageideas.dev/notes/promptfoo-ci-minimum-gate.html
