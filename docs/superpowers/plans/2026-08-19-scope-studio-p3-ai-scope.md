# Scope Studio — Plan 3: Conversational AI Scope + Qualification + Voice & Humanity

> **Status:** SHIPPED — merged to main. Checklists below are historical.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a conversational AI path to `/build.html` that scopes a visitor's project *by talking with them* — grounded so it only ever selects real capability keys (never invents prices), assesses fit honestly (qualification + graceful disqualification), sounds unmistakably like Jason (Voice & Humanity), and drives the SAME live blueprint + plan the questionnaire already builds. Degradation-safe: with no LLM env, `/build.html` shows today's questionnaire exactly as-is.

**Architecture:** A new `scope` persona/mode in the existing `/api/chat` (DeepSeek) returns **structured JSON** — `{ reply, done, selection:[{key,why,confidence}], segment, flags, qualification }` — never prose prices. The server **validates every key against the rate card** (drops unknowns) and strips any `$`/number from `reply` (defense-in-depth). The client renders a chat UI that feeds `selection` → the existing `computePlan(keys)` → `window.__renderScopePlan` (blueprint + plan). The questionnaire remains as the deterministic fallback and an always-available "prefer to click?" alternative. Transcript + events persist via the Plan 2 `/api/scope` spine.

**Tech Stack:** Vercel serverless (`/api/chat`, ESM), DeepSeek via existing `LLM_*` env, vanilla client (reuse `agent.js` chat patterns), `node --test` + Playwright. Grounding data = `assets/scope-core.mjs` (RATE_CARD/QUESTIONS).

**Spec:** `docs/superpowers/specs/2026-08-18-scope-studio-design.md` — §2 (grounding), §5, §6.1 (SCOPE_PROMPT), §7 (trust/eval), §7.5 (Voice & Humanity, HARD REQUIREMENT).

## Global Constraints

- **The LLM never emits prices, totals, or capabilities outside the rate card.** It returns capability *keys* only; the server drops any key not in `CARD_BY_KEY` and strips `$`/digits-as-money from `reply`. Numbers come only from `computePlan`. (Spec §2.)
- **Degradation-safe.** No `LLM_*` env (or `/api/chat` 501) → the questionnaire is the whole experience; the chat UI shows a graceful "chat's offline, use the questions" state. No console error, ever. Lighthouse stays 100.
- **Voice & Humanity (§7.5) is a hard gate.** `SCOPE_PROMPT` encodes it verbatim: radical AI transparency (never impersonate a human — open with "This is Jason's AI…"), Jason's first-person voice, EQ-first, graceful-no, banned phrases (no "I'd be happy to help!", exclamation spam, corporate verbs, em-dash/rule-of-three/"actually" tics), always an escape hatch to the real Jason. A robotic/salesy/impersonating tone blocks enabling the AI path.
- **Qualification is honest.** Genuine non-fits get a kind, specific "this probably isn't for you, and here's who is" — never a hard sell.
- **Server-only keys; existing tests green; zero console errors; Lighthouse 100.**

---

### Task 1: `SCOPE_PROMPT` + `scope` mode in `/api/chat` (structured, grounded, price-safe)

**Files:**
- Modify: `api/chat.js`
- Create: `tests/unit/scope-mode.test.mjs`

**Interfaces:**
- Produces: `POST /api/chat { mode:'scope', messages }` → `{ ok, reply, done, selection:[{key,why,confidence}], segment, flags, qualification }`. Exports a pure `sanitizeScopeReply(text)` (strips $-amounts) and `filterSelection(selection, validKeys)` (drops keys not in the rate card) for unit testing.

- [ ] **Step 1: Write the failing test** (the pure grounding guards — testable without the LLM):

```js
// tests/unit/scope-mode.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeScopeReply, filterSelection } from '../../api/chat.js';
import { RATE_CARD } from '../../assets/scope-core.mjs';

test('sanitizeScopeReply strips dollar amounts (LLM must never price)', () => {
  assert.equal(sanitizeScopeReply('That runs about $4,000 to $9k.'), 'That runs about that we can scope on a call.'.replace(/\s+/g,' ') === sanitizeScopeReply('x') ? sanitizeScopeReply('That runs about $4,000 to $9k.') : sanitizeScopeReply('That runs about $4,000 to $9k.')); // see note
  const out = sanitizeScopeReply('Roughly $4,000–$9k for that.');
  assert.ok(!/\$\s?\d/.test(out), 'no $-amount remains: ' + out);
});
test('filterSelection drops keys not in the rate card (anti-hallucination)', () => {
  const valid = new Set(RATE_CARD.map((c) => c.key));
  const sel = filterSelection([{ key: 'llm-eval', why: 'x', confidence: 0.9 }, { key: 'not-real', why: 'y', confidence: 0.5 }], valid);
  assert.deepEqual(sel.map((s) => s.key), ['llm-eval']);
});
```
*(Implementer: make `sanitizeScopeReply` replace any `$`-amount token like `$4,000`, `$9k`, `$4k–$9k` with a neutral phrase such as "(scoped on a call)". Keep the test asserting the invariant `!/\$\s?\d/.test(out)`, and simplify the first assertion to just that invariant — the pseudo line above is a reminder, not literal.)*

- [ ] **Step 2: Run — fails** (exports missing).

- [ ] **Step 3: Implement** in `api/chat.js`:
  - Add `SCOPE_PROMPT` to the `PROMPTS` map under key `scope`, and a larger `MAX_OUT.scope` (~500), temperature ~0.4. The prompt: encode Voice & Humanity §7.5 verbatim; instruct the model to (a) converse warmly as Jason's AI, one question at a time; (b) after enough signal, return ONLY a JSON object `{ reply, done, selection:[{key,why,confidence}], segment, flags, qualification:{fit:'strong'|'maybe'|'poor', reasons:[]} }` using the provider's JSON mode; (c) choose `key`s ONLY from this explicit list (inject `RATE_CARD.map(c=>c.key+': '+c.name).join('\n')` into the prompt); (d) NEVER output a price/number as money.
  - Export `sanitizeScopeReply(text)` (regex strip `$`-amounts → "(scoped on a call)") and `filterSelection(selection, validKeys)`.
  - In the handler `scope` branch: call the provider with JSON mode, parse, then `reply = sanitizeScopeReply(parsed.reply)` and `selection = filterSelection(parsed.selection, validKeySet)` before returning. If parse fails, return `{ ok:true, reply:<plain text>, selection:[] }` (never 500).
  - Keep 501 behavior when `!LLM configured`.

- [ ] **Step 4: Run — passes.** `node --test tests/unit/` green.

- [ ] **Step 5: Commit.** `git commit -m "feat(scope): grounded price-safe 'scope' chat mode + Voice&Humanity prompt"`

---

### Task 2: Golden-set eval harness (gate the AI before it goes live)

**Files:**
- Create: `evals/scope-golden.json` (10–15 sample discovery messages → expected capability keys + expected qualification tier)
- Create: `scripts/eval-scope.mjs` (scores a run; callable against the live endpoint)
- Create: `docs/SCOPE-EVAL.md` (how Jason runs it before enabling the AI path)

**Interfaces:** Produces a repeatable score (selection precision/recall + qualification accuracy). Because CI can't call the live LLM deterministically, the CI test validates the harness + golden data shape; the *scoring against the live model* is an operator gate (documented), not a CI gate.

- [ ] **Step 1:** Write `evals/scope-golden.json` — cases like `{ id, messages:[{role:'user',content:'we ship an LLM feature with no evals'}], expectKeys:['llm-eval','ci-gate'], expectFit:'strong' }`.
- [ ] **Step 2:** Write a unit test asserting every golden `expectKeys` entry is a real rate-card key and each case is well-formed. Run — fails.
- [ ] **Step 3:** Implement `scripts/eval-scope.mjs` (POST each case's messages to a target `/api/chat` scope endpoint, compare returned `selection` keys to `expectKeys` → precision/recall; compare `qualification.fit`; print a scorecard + pass/fail vs a threshold, default F1 ≥ 0.8). Implement `docs/SCOPE-EVAL.md`.
- [ ] **Step 4:** Run the unit test — passes (golden data valid). (The live scoring run is Jason's gate.)
- [ ] **Step 5:** Commit. `git commit -m "feat(scope): golden-set eval harness + operator gate doc"`

---

### Task 3: Client AI chat UI on /build.html (drives the same blueprint)

**Files:**
- Modify: `build.html` (a chat panel + a "chat / questions" toggle)
- Create: `assets/scope-chat.mjs` (the chat controller)
- Modify: `assets/scope-studio.mjs` (expose a hook to apply an external key selection to the plan/blueprint)
- Modify: `tests/smoke.spec.js`

**Interfaces:**
- Consumes: `/api/chat` scope mode (Task 1), `window.__renderScopePlan` + `computePlan` (existing).
- Produces: a chat UI (`#scope-chat`) that, on each AI turn, applies `selection` keys → recomputes the plan → updates the blueprint/HUD/plan. A toggle switches between "Talk it through" (chat) and "Quick questions" (the existing questionnaire). Both feed the same `renderPlan`.

- [ ] **Step 1: Write a smoke test** — the chat panel exists, the toggle switches modes, and with no `/api/chat` (static server) the chat shows a graceful offline state while the questionnaire still works, zero console errors (use the same narrow filter for the expected `/api/chat` resource error).
- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Implement** — reuse `agent.js` chat conventions (message list, typewriter, send box). On send: POST `{mode:'scope', messages}` (fire the request; on 501/offline show "The AI's offline right now — use the quick questions instead" and reveal the questionnaire). On a successful turn: append `reply`, and call the exposed hook to apply `selection` keys to the plan (map keys → set the equivalent answers or feed keys straight to `computePlan` and render). Persist the transcript via `/api/scope` `appendConversation` (fire-and-forget). Keep it reduced-motion + a11y clean (labelled input, live region for messages).
- [ ] **Step 4: Run — passes.** Full suite green.
- [ ] **Step 5: Commit.** `git commit -m "feat(scope): conversational AI chat that drives the live blueprint (questionnaire fallback)"`

---

### Task 4: Qualification + graceful disqualification UI

**Files:**
- Modify: `assets/scope-chat.mjs`, `assets/site.css`
- Modify: `tests/smoke.spec.js`

**Interfaces:** Consumes `qualification:{fit,reasons}` from Task 1. Produces: a fit signal in the UI; for `fit:'poor'`, a kind, specific "this probably isn't the right fit, and here's who is" panel instead of pushing the plan — with the escape hatch to Jason still present.

- [ ] **Step 1–5 (TDD):** test that a mocked `fit:'poor'` response renders the disqualification panel (not a hard CTA) and still shows "talk to Jason"; a `fit:'strong'` shows a confidence cue on the plan. Implement + style + commit.

---

### Task 5: Wire Voice & Humanity tone gate + persistence + a11y/Lighthouse + ship

**Files:**
- Modify: `assets/scope-chat.mjs`, `build.html`, `docs/SCOPE-EVAL.md`
- Modify: `tests/smoke.spec.js`

- [ ] Confirm the transcript persists (`/api/scope` `appendConversation`, fire-and-forget) + events (`started`/`plan_built` still fire).
- [ ] Add the always-visible "This is Jason's AI — talk to Jason directly" transparency line to the chat header (Voice & Humanity).
- [ ] a11y: chat input labelled, messages in an `aria-live="polite"` region, focus management on open; reduced-motion respected.
- [ ] Feature-flag: the AI chat path is only *shown* when a small runtime check says the endpoint is live (e.g., the chat panel defaults to the questionnaire and offers "Talk it through" which probes on first use) — so a not-configured deploy never shows a broken chat. Document that Jason enables it after the eval gate passes.
- [ ] Run full suite + Lighthouse `/build.html` (100/100/100/100). Commit + push (prod-safe: degradation-guaranteed).

---

## Self-Review
- Grounding (§2): Task 1 filterSelection + sanitizeScopeReply, unit-tested. ✓
- SCOPE_PROMPT (§6.1) + Voice & Humanity (§7.5): Task 1 prompt + Task 5 transparency line + tone gate. ✓
- Eval (§7): Task 2 (operator-gated; CI validates shape). ✓
- Chat UI driving the plan (§5) + questionnaire fallback: Task 3. ✓
- Qualification/disqualification: Task 4. ✓
- Degradation-safe + Lighthouse: Tasks 3 + 5. ✓
- **Dependency note:** the AI path needs the existing `LLM_*` env (DeepSeek) already configured in prod (Atlas uses it). CI/static has no LLM → questionnaire fallback. The live golden-eval + tone review are Jason's gates before turning the AI path on.

## Execution Handoff
Subagent-driven. Note: Tasks 3–4 are UI-heavy (visual iteration) — the controller should screenshot-verify those, not rely on blind subagents. Merge is prod-safe but a shared-branch push → confirm at the gate.
