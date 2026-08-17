# Mini-Eval Production Process

**Goal:** produce one credible, honest mini-evaluation of a prospect's public AI
feature in under an hour, then send it as the first touch of an outreach
sequence. This is the wedge — a free proof-of-work sample that demonstrates the
eval discipline the way a staff engineer would want to receive it: specific,
reproducible, and free of hype.

Target time: **45–55 minutes.** If it's taking two hours, the scope crept —
pull back to 15–20 probes.

---

## The eight steps

### (a) Pick a target — 5 min

- Choose a company shipping an LLM feature that a real user can reach without
  paying or signing a contract: a website chatbot, a support/help agent, a
  "ask our docs" RAG assistant, or a public generator.
- Prefer a target where the failure surface *matters to the business* — money
  (pricing/refunds), safety, or brand voice. That's where findings land hardest.
- Confirm the interface is genuinely public and that normal use doesn't violate
  visible terms. If it's gated, paid, or clearly off-limits, pick another.

### (b) Identify stated purpose / scope — 5 min

- Read what the feature *says it's for* — the intro message, the placeholder
  text, the surrounding page copy, any "this assistant can help with…" note.
- Write it down in one sentence. This becomes the yardstick for Faithfulness,
  Refusal, and Scope. If there's no stated scope, record that — undefined scope
  is itself a finding.
- Note what it grounds against (its own docs? a knowledge base? nothing stated?)
  so grounding failures can be checked against real source material.

### (c) Run 15–20 probes against the LIVE feature — 20–25 min

- Work through the dimensions in `RUBRIC.md`, using the coverage map to allocate
  probes to what the feature actually does.
- **Capture every transcript verbatim** — copy the exact prompt you sent and the
  exact response you got. Screenshot as backup. Timestamp the run.
- When something fails, **immediately re-probe it** with a second phrasing to
  confirm it reproduces. Log reproduced vs. flaky.
- Stay inside the public interface. One reasonable pass per probe. No abusive
  volume, no rate-limit hammering, no denial-of-service phrasing.

### (d) Score into the pass/fail table — 5 min

- For each dimension: **PASS**, **FAIL**, or **N/A (not observable)**.
- A dimension is FAIL if it has a reproduced failing probe. Note the probe count
  and a one-line reason.
- Resist inflation. If grounding held on every probe you ran, it's a PASS — say
  so plainly. Naming what works is what makes the failures credible.

### (e) Pull the 3 most instructive failures — 5 min

- Not the three worst — the three most *instructive*: the ones that best show a
  category of risk and would most clearly be caught by a gate.
- For each, assemble: verbatim prompt → verbatim response → one tight paragraph
  on why it's a problem and what a correct response looked like.
- If you found fewer than three real, reproduced failures, **report fewer.**
  Never pad the count. "Two findings and a clean bill on the rest" is a stronger,
  more honest report than three thin ones.

### (f) Write "What I'd gate before release" — 5 min

- Translate findings into 2–4 concrete gates: the specific evals that, wired
  into CI, would have blocked each failure from shipping.
- Frame them as engineering, not sales: "a faithfulness judge on pricing answers
  with the published policy as ground truth" — the kind of thing their own team
  would nod at.

### (g) Render the report — 3 min

- Fill `report-template.md` (or `report-template.html` for a branded PDF) with
  the real scorecard, the three transcripts, the gates, and the honest
  "what's already strong" section.
- Proof-read the transcripts against your captures — a fabricated or mis-quoted
  transcript destroys the entire premise.

### (h) Send as outreach touch 1 — 2 min

- The report *is* the opener. The email is a two-line cover: what it is, that
  it's independent and free, and an offer to walk through it.
- The soft close points to the $750 audit (credited toward any build). No hard
  pitch in touch 1 — the report does the selling by being good.

---

## Pre-send checklist

- [ ] Target's AI feature is genuinely public; testing it doesn't violate visible ToS
- [ ] Stated purpose/scope written down in one sentence
- [ ] 15–20 probes run against the **live** feature this week
- [ ] Every transcript captured **verbatim** (+ screenshot, + timestamp)
- [ ] Every reported failure **reproduced** with a second phrasing
- [ ] Scorecard filled: each dimension PASS / FAIL / N/A with a one-line note
- [ ] 3 (or fewer) most instructive failures written up, verbatim
- [ ] No single failure described as if it were systemic
- [ ] "What's already strong" section is real, not a courtesy
- [ ] 2–4 concrete CI gates named
- [ ] Prices correct: $750 audit (credited), pilot from $2,500, build from $9,500
- [ ] Report re-read once as if I were the receiving engineer — does it read as
      findings, not a brochure?

---

## The "never do" list

- **Never fabricate a transcript.** Not a word, not a number. If you didn't
  observe it live, it does not go in the report. This is the whole brand.
- **Never overstate a single failure as systemic.** "This probe failed" — not
  "your bot hallucinates." 18 probes prove a failure *exists*, not how often.
- **Never test in a way that violates ToS or abuses rate limits.** No
  credential attacks, no scraping internal endpoints, no denial-of-service
  phrasing, no automated flooding. Only the public, intended interface, at
  normal human volume.
- **Never test a private, paid, or gated surface** you weren't invited to test.
- **Never send a report with a failure you couldn't reproduce** as if it were
  confirmed. Flaky is logged as flaky, or dropped.
- **Never name the model vendor or guess the stack.** The finding is about the
  feature's behavior, not "they must be using X."
- **Never pad to three findings.** Fewer honest findings beat three thin ones.
- **Never claim statistical coverage.** It's a probe, not a sample. Say so.
