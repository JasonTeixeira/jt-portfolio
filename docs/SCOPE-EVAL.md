# Scope Studio golden-set eval — operator gate

The Scope Studio AI ("scope" mode on `/api/chat`) is the highest-trust surface
on the site: it's a live LLM having a discovery conversation with a
prospect, proposing capability keys from the real rate card, and rendering a
qualification verdict. Before that path goes live for real visitors, it has
to pass this eval. This is **your** gate, run by hand — CI cannot run it
for you.

## Why this isn't a CI gate

CI can't call the live LLM deterministically: the provider, the model, and
non-zero temperature all mean the same golden set can score differently run
to run, and there's no committed API key for CI to use anyway. So the split
is:

- **CI-gated** (`tests/unit/scope-eval.test.mjs`, runs on every push): the
  golden data itself is well-formed, every `expectKeys` entry is a real
  `assets/scope-core.mjs` `RATE_CARD` key (so a typo in the golden set can
  never quietly pass), and the scoring math (`precisionRecallF1`) is correct
  on hand-computed examples.
- **Operator-gated** (this doc): actually running the golden set against the
  live model and reading the scorecard is on you, before you flip the AI
  scope path on for real traffic.

## Running it

**1. Point it at something real.** Either run the app locally with the LLM
env vars set (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` — see
`api/chat.js`), or just point `--url` at the deployed site, which already
has those set in Vercel:

```bash
# local
vercel dev
node scripts/eval-scope.mjs

# deployed
node scripts/eval-scope.mjs --url https://agency.sageideas.dev/api/chat
```

**2. Read the scorecard.** Each of the 14 golden cases (`evals/scope-golden.json`)
sends one realistic prospect message and scores the returned `selection`
against the `expectKeys` for that case (precision/recall/F1), plus whether
`qualification.fit` matched `expectFit`. You'll see something like:

```
Scope Studio golden-set eval
14 cases · target: https://agency.sageideas.dev/api/chat · threshold: mean F1 >= 0.8

  llm-feature-no-evals             F1 100%  fit ✓
  hallucinating-support-bot        F1 100%  fit ✓
  ...
  poor-fit-hobby-project           F1 100%  fit ✓

  Selection scoring
  mean precision: 92.3%
  mean recall:    89.1%
  mean F1:        90.4%  (threshold 80%)

  Qualification scoring
  fit accuracy:   13/14 (92.9%)

  PASS — mean F1 90.4% >= 80% threshold
```

**3. Only enable the AI path if both of these are true:**

- **The scorecard passes** — mean F1 ≥ 0.8 (adjust with `--threshold` if you
  deliberately want a stricter bar; don't loosen it to force a pass).
- **A manual Voice & Humanity tone read passes.** The eval harness scores
  *what* the AI selected, not *how it sounds*. Have an actual conversation
  with it (a few of the golden-set prompts, plus something adversarial) and
  check it against `SCOPE_PROMPT` in `api/chat.js` §7.5: does it open with
  radical transparency, sound like Jason in first person (not a corporate
  bot), show real EQ, ever slip a dollar figure, ever claim to be human? The
  eval can't grade tone — you have to.

If either check fails, do not flip the AI scope path live. Fix the prompt
or the grounding logic in `api/chat.js`, re-run, re-read.

## Flags

| Flag          | Default                          | What it does                                    |
|---------------|-----------------------------------|--------------------------------------------------|
| `--url`       | `http://localhost:3000/api/chat`  | Target `/api/chat` endpoint                       |
| `--golden`    | `evals/scope-golden.json`         | Path to the golden case file                      |
| `--threshold` | `0.8`                             | Minimum mean F1 to pass (exit 0 vs exit 1)        |

## Exit codes

- `0` — scorecard printed, mean F1 ≥ threshold.
- `1` — scorecard printed and mean F1 < threshold, **or** the endpoint was
  unreachable (script prints a clear message and exits non-zero — it never
  crashes with a stack trace, so it's safe to wire into a manual pre-flight
  checklist).

## Extending the golden set

Add cases to `evals/scope-golden.json` as real conversations surface new
buyer situations. Every `expectKeys` entry must be a real key from
`assets/scope-core.mjs`'s `RATE_CARD` — the unit test
(`tests/unit/scope-eval.test.mjs`) will fail the build if it isn't, which is
the point: it's the one thing CI *can* guarantee about this eval.
