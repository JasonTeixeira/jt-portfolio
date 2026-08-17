<!--
  MINI-EVAL REPORT TEMPLATE (Markdown)
  Fill every {PLACEHOLDER} with real, verbatim findings from a live run.
  Delete any dimension row scored N/A only if it was genuinely not observable.
  Voice: engineer-to-engineer. Findings, not pitch. No hype. No fabricated transcripts.
  See PROCESS.md before filling. See report-template.html for the branded/PDF version.
-->

# Independent mini-evaluation — {TARGET_FEATURE_NAME}

**Target:** {TARGET_FEATURE_NAME} — {ONE_LINE_WHAT_IT_IS} ({PUBLIC_URL})
**Run:** {N_PROBES} probes, run live against the public interface on {DATE}
**By:** Jason Teixeira · Sage Ideas LLC · independent, unsolicited, no affiliation

> **Method (2 sentences).** I ran {N_PROBES} probes against your live
> {feature type} across eight failure dimensions — grounding, hallucination,
> prompt-injection, data leakage, refusal correctness, consistency, scope, and
> (where observable) cost/latency — capturing every transcript verbatim. This is
> a spot-check, not a statistical sample: a failing probe proves a failure mode
> *exists*, not how often it fires — that's what a full battery in CI measures.

---

## Scorecard

| Dimension | Probes | Result | Note |
|-----------|:------:|:------:|------|
| Faithfulness / Grounding     | {n} | {PASS/FAIL} | {one-line note} |
| Hallucination under pressure | {n} | {PASS/FAIL} | {one-line note} |
| Prompt-injection resistance  | {n} | {PASS/FAIL} | {one-line note} |
| PII / Data leakage           | {n} | {PASS/FAIL} | {one-line note} |
| Refusal correctness          | {n} | {PASS/FAIL} | {one-line note} |
| Consistency                  | {n} | {PASS/FAIL} | {one-line note} |
| Scope / Off-topic            | {n} | {PASS/FAIL} | {one-line note} |
| Cost / Latency               | {n} | {PASS/FAIL/N/A} | {one-line note or "not observable on public interface"} |

**Headline:** {e.g. "5 of 8 dimensions clean; 3 reproduced failures below, all
in the grounding/scope family."}

---

## Failure transcripts

The three most instructive failures. Each is verbatim and was reproduced with a
second phrasing before being reported.

### Finding 1 — {SHORT_TITLE} ({DIMENSION})

**Prompt (verbatim):**
> {EXACT_PROMPT_SENT}

**Response (verbatim):**
> {EXACT_RESPONSE_RECEIVED}

**Why it's a problem:** {2-4 sentences. What the correct/grounded answer was,
what the feature did instead, and the concrete business risk — wrong price
quoted, invented policy, guardrail dropped. State that it reproduced.}

---

### Finding 2 — {SHORT_TITLE} ({DIMENSION})

**Prompt (verbatim):**
> {EXACT_PROMPT_SENT}

**Response (verbatim):**
> {EXACT_RESPONSE_RECEIVED}

**Why it's a problem:** {2-4 sentences.}

---

### Finding 3 — {SHORT_TITLE} ({DIMENSION})

**Prompt (verbatim):**
> {EXACT_PROMPT_SENT}

**Response (verbatim):**
> {EXACT_RESPONSE_RECEIVED}

**Why it's a problem:** {2-4 sentences.}

<!-- If you found fewer than 3 reproduced failures, report fewer. Never pad. -->

---

## What I'd gate before release

The failures above aren't exotic — they're the kind a small eval suite catches
before a prompt or model change ships. Concretely, {2-4 gates}:

1. **{Gate name}** — {the specific eval, its ground truth, and the failure it
   blocks. e.g. "Faithfulness judge on pricing/refund answers, scored against
   your published policy as ground truth; a contradicting answer fails the PR."}
2. **{Gate name}** — {...}
3. **{Gate name}** — {...}

Each is a runner that executes on every pull request and blocks the merge on a
score below an agreed floor — so the regression stops at the gate, not in front
of a customer.

---

## What's already strong

Credibility runs both ways — here's what held up under the same probes:

- **{Dimension / behavior that passed}** — {specific, e.g. "every prompt-injection
  probe was refused in-role; it never dumped its instructions or dropped scope."}
- **{Dimension / behavior that passed}** — {specific.}
- **{Dimension / behavior that passed}** — {specific.}

{One honest closing line on the overall posture — e.g. "This is a solid feature
with a couple of grounding gaps that are entirely gate-able."}

---

## Where this goes next

This is ~{N_PROBES} probes in an afternoon, run by hand against your public
interface. A real engagement runs *hundreds* of these in your CI — versioned
against your actual source of truth, scored automatically, blocking the merge
when a change makes things worse. Happy to show you exactly how.

- **The $750 audit** maps your full failure surface across every dimension above,
  hands you a costed plan, and is **credited in full** toward any build.
- **Pilot from $2,500** — a minimum viable gate: golden traces, one judge, one
  CI step that can block a bad merge, live in weeks.
- **Build from $9,500** — the full eval battery, safety runners, ratcheting
  floors, runbook and handoff — owned by your team.

Reply here or grab a slot — I'll walk you through these findings and where the
rest of the failure surface likely sits.

---

*Independent mini-evaluation. Not affiliated with or endorsed by
{TARGET_COMPANY}. All transcripts captured verbatim from the live public
interface on {DATE}. A spot-check of {N_PROBES} probes is not a statistical
measure of failure rate. — Jason Teixeira, Sage Ideas LLC*
