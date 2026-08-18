# Scope Studio — Design Spec (Foundation: A + B + F)

**Date:** 2026-08-18
**Repo:** `~/code/active/jt-portfolio` (live: agency.sageideas.dev)
**Status:** Design — awaiting review before implementation plan
**Scope of THIS spec:** the foundation of the AI sales OS — Subsystem **A** (Scope Studio inbound funnel), **B** (Supabase persistence + pipeline + memory), and **F** (trust layer), designed to carry **C** (nurture/closer), **D** (outbound proposals), and **E** (operator cockpit) later without rework.

---

## 1. Goal & non-goals

**Goal.** A visitor can self-serve a genuinely useful, scoped engagement plan through a pleasant AI chat (or a no-AI questionnaire fallback), see an itemized visual plan with **indicative cost bands**, and hand off as a fully-qualified, persisted lead — so the one-person agency captures and begins closing deals with near-zero marginal effort per quote.

**In scope (foundation):**
- Chat-first funnel page (`/build.html`) with a live-building visual plan.
- Deterministic **rate card** config → all numbers come from a versioned file, never the LLM.
- Supabase persistence of prospects, conversations, plans, events.
- Returning-visitor memory (anonymous id → linked on email capture).
- Trust layer: eval harness on the scope AI, confidence signaling, qualification/disqualification, always-visible human handoff, guardrails.
- Shareable/bookmarkable plan link; lead capture with plan attached.

**Explicitly NOT in this spec (later subsystems / YAGNI):**
- Voice (phase 2).
- PDF proposal export (phase 2).
- Automated nurture sequences / objection-handling bot (Subsystem C).
- Outbound prospecting + auto-proposals (Subsystem D) — highest risk, built last.
- Operator cockpit UI (Subsystem E) — foundation only writes the data it will read.
- Autonomous contracting or payment.
- **Human layer (photo + one testimonial + founder note)** — deferred by Jason. The page reserves the slot (the hidden testimonial block already exists) so it drops in without rework. Note: this is the single highest human-appeal lever and the honest ceiling; when Jason provides a headshot + one real client quote, wire it in. His ElevenLabs cloned voice becomes the phase-2 voice mode.

**Success criteria:**
- Works fully with **no LLM configured** (deterministic questionnaire → identical plan output). Smoke tests run offline.
- Every dollar figure traces to `ratecard.js`, never to model output.
- Lighthouse 100/100/100/100 on `/build.html`; a11y clean; no console errors.
- Scope AI passes a golden-set eval (correct capability selection ≥ agreed threshold) before it goes live.
- A completed session persists a prospect + plan + conversation row in Supabase and notifies the operator.

---

## 2. The grounding principle (the core innovation)

The LLM **never emits prices, totals, or invented capabilities.** Its only structured responsibility:

1. Converse naturally to understand the visitor's business + problem.
2. Emit a structured selection: an array of **capability keys** (from the real catalog) + a one-line `why` per key + a `confidence` per key + optional `segment` + `flags` (unknowns needing discovery).

The **client** (and, for persistence, the server) then:
- Looks each key up in `ratecard.js` for `band`, `effort`, `phase`.
- Computes phase grouping + the summed indicative band + timeline.

Consequences: numbers are deterministic and editable in one file; the LLM's price-safety rule stays literally true; the selection is **eval-able** (golden conversation → expected key set); and a wrong band is a config edit, not a prompt-engineering session.

---

## 3. Architecture & data flow

```
/build.html  ──►  scopeStudio.js (client state machine)
     │                 │
     │                 ├─ AI path:  POST /api/chat {mode:'scope'} ──► DeepSeek ──► {keys[], why, confidence, flags}
     │                 ├─ Fallback: deterministic questionnaire ──► {keys[]}
     │                 │
     │                 ├─ ratecard.js (bands/effort/phase)  ──► computePlan(keys) ──► Plan
     │                 ├─ planViz (reuse transform diagram vocabulary) renders Plan live
     │                 └─ on milestones: POST /api/scope  (persist prospect/convo/plan/events)
     │                                        POST /api/lead (email operator + visitor, plan attached)
     ▼
Supabase (via server-only service key in /api functions)
```

- **Client** holds an anonymous `prospect_id` (localStorage, UUID). Never holds secrets.
- **All DB writes** go through new/extended `/api/*` serverless functions using `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (server env only). RLS denies all anon access; the service role is server-side.
- **Graceful degradation:** if `SUPABASE_*` or `LLM_*` env is absent (static host, CI), the page still runs the questionnaire → plan → mailto fallback. Persistence and AI are progressive enhancements, matching the site's existing "works on a static host" discipline.

---

## 4. Data model

### 4.1 Rate card — `assets/ratecard.js` (the editable source of truth)
Seeded from the 32 capabilities already in `services.html` `CAPS`. One record per capability:
```js
{
  key: 'llm-eval-harness',
  name: 'LLM evaluation harness',
  track: 'Eval & QA',
  band: [3500, 9000],        // indicative USD range — Jason tunes before launch
  effort: '~1–3 wks',
  phase: 'gate',             // audit | build | gate | operate  (drives phase grouping)
  why: 'Prove the AI feature works before customers do.'
}
```
- A top-level `DISCLAIMER` string + `bandHint` (e.g. "indicative; exact scope locked on a short call").
- A `SEGMENTS` map (service-business, AI-product, ops-automation, product-build) for framing/example selection — data only, no logic.
- Placeholders are clearly marked `// TODO(jason): tune` so tuning is a single-file pass.

### 4.2 Plan object (computed, never stored as prices from the LLM)
```
Plan = {
  prospectId, segment,
  items: [{ key, name, track, band, effort, phase, why, confidence }],
  phases: [{ phase, items[], band:[min,max] }],
  totalBand: [min,max],
  timeline: '~N–M weeks',
  flags: [ 'integration complexity unknown', ... ],   // discovery caveats
  createdAt
}
```
Encoded to URL as `/build#plan=<base64(keys+segment)>` for share/rehydrate (numbers recomputed from ratecard, so a stale share still reflects current pricing).

### 4.3 Supabase schema (server-written only; RLS: deny anon)
- `prospects` — `id (uuid, = client prospect_id)`, `email?`, `name?`, `company?`, `segment?`, `stage` (`new|scoped|engaged|won|lost`, default `new`), `qualification` (jsonb: fit score + reasons), `created_at`, `updated_at`.
- `conversations` — `id`, `prospect_id fk`, `transcript` (jsonb array), `mode`, `created_at`.
- `plans` — `id`, `prospect_id fk`, `keys` (text[]), `segment`, `total_band` (int4range or two ints), `flags` (jsonb), `created_at`.
- `events` — `id`, `prospect_id fk`, `type` (`started|questioned|plan_built|lead_captured|handoff_clicked`), `meta` (jsonb), `created_at`. (This is the funnel-analytics + future-cockpit substrate.)

Indexes on `prospect_id`, `stage`, `created_at`. No PII beyond what the visitor volunteers; email only on explicit capture.

---

## 5. The page — `/build.html` (chat-first, immersive)

**Layout:** two-column immersive surface (matches site design system: dark, Instrument Serif + JetBrains Mono, existing tokens).
- **Left:** guided AI chat (built on `agent.js` patterns — typewriter, chips) OR the questionnaire fallback in the same column.
- **Right:** the **live-building plan** — capability cards appear as they're selected, grouped by phase, each with its band + a confidence dot; a running **indicative total band** + timeline update in real time; the discovery `flags` show as honest caveats.

**Flow (state machine in `scopeStudio.js`):**
1. `intro` — one-line framing + segment pick (or AI infers it).
2. `discovery` — AI asks (or questionnaire presents) 4–7 questions; each answer may add/adjust keys.
3. `plan` — full plan rendered; visitor can toggle items (adjusts totals live).
4. `handoff` — "email me this plan & start the conversation" (lead capture) + shareable link + always-visible "talk to Jason directly" escape hatch.

**Reduced-motion / no-JS / no-LLM:** questionnaire path renders a static-friendly plan; the escape hatch + a booking link are always present.

---

## 6. Backend changes

### 6.1 `/api/chat` — add `scope` mode
- New persona `SCOPE_PROMPT`: warm discovery interviewer that follows the **§7.5 Voice & Humanity** rules verbatim (Jason's first-person voice, transparent that it's an AI, EQ-first, graceful-no); **must** return, after enough signal, a single JSON object `{ reply, done, selection:[{key,why,confidence}], segment, flags }` using the provider's JSON/structured-output mode. `reply` is the conversational turn; `selection` accumulates.
- Larger `max_tokens` for this mode; temperature ~0.4 (more deterministic).
- Validation: server drops any `key` not in the rate card (hard anti-hallucination gate) and strips any dollar figures from `reply` as defense-in-depth.

### 6.2 `/api/scope` (new) — persistence
- `POST { prospectId, event, transcript?, plan? }` → upserts `prospects`, appends `conversations`/`events`, inserts `plans`. Returns `{ ok }`. Idempotent per event where sensible. 501 if Supabase env absent (client continues statelessly).

### 6.3 `/api/lead` — extend
- Accept optional `plan` summary + `prospectId`; include the scoped plan in the operator email and link the lead to its `prospects` row. Keep existing Resend behavior + graceful mailto fallback.

---

## 7. Trust layer (F) — non-negotiable on this brand

- **Eval harness:** a golden set of ~15–25 sample discovery conversations → expected capability-key selections; scored for precision/recall on selection + "did it flag the right unknowns." Wired to the existing eval tooling; **must pass a threshold before the scope AI is enabled in prod** (feature-flag gate). This is also a public proof point: "even my sales assistant is eval-gated."
- **Confidence signaling:** each item shows a confidence dot; low-confidence items are visually marked "confirm on the call."
- **Discovery honesty:** `flags` surface what a rate card can't see (integration complexity, data readiness) so the band is never oversold. Copy: "indicative; exact scope locked on a short call."
- **Qualification / disqualification:** a light rubric (project-type fit, apparent budget signal, seriousness) writes a `qualification` object; genuine non-fits get an honest "this probably isn't for you, here's why" — on-brand, protects operator time, and builds trust.
- **Human escape hatch:** "talk to Jason directly" is present in every state; never a dead-end AI maze.
- **Guardrails:** LLM never emits prices (enforced server-side); IP rate-limit reused from `/api/chat`; PII minimized; Supabase RLS denies anon; service key server-only.

---

## 7.5 Voice & Humanity — HARD REQUIREMENT

Non-optional. An AI sales funnel done wrong is the least human thing on the internet (slick, eager, uncanny). This section is a gate: the scope AI ships only when its tone passes review against these rules, and `SCOPE_PROMPT` encodes them verbatim.

**Radical AI transparency (the core move).** Never pretend the bot is a human. Own it and own why, up front:
> "This is Jason's AI. It scopes your project so neither of us wastes time on a call that isn't a fit. Jason reads every plan it makes — skip straight to him anytime."
Pretending-to-be-human is a hard fail (uncanny + the reveal destroys trust). Transparency is itself the on-brand proof.

**Voice = Jason, first person, a smart friend who happens to be an expert — not a brand.**
- **Banned:** "I'd be happy to help!", "Great question!", "Let's dive in!", exclamation spam, corporate verbs (unlock / leverage / seamless / elevate), perfectly symmetrical enthusiasm, and the em-dash / rule-of-three / "actually/genuinely" tics already scrubbed from the site.
- **Required:** contractions, plain words, one idea per turn, a real opinion, occasional dry humor, and *specifics from the visitor's world reflected back*. Listens more than it pitches; consultative, never transactional.

**Emotional intelligence first.** Acknowledge their situation before scoping — e.g. "You've probably been burned by an 'AI solution' that was a demo and a prayer. Fair. Let's do this differently."

**Imperfection as warmth.** The AI states limits plainly: "I can't price this exactly without seeing your data — here's my honest range and why." Honest seams read human; seamless perfection reads fake.

**Graceful no.** Genuine non-fits get an honest, kind "this probably isn't for you, and here's who is." Telling someone not to buy is the most trust-building thing the funnel can do.

**Human micro-copy everywhere.** "thinking about your setup…" not "Loading…"; confirmation reads "Sent to Jason — he usually replies the same day, himself." A human sign-off.

**"Talk to Jason" as a warm invitation, present in every state** — framed as a positive choice, never a dead-end fallback.

**Restraint.** The AI is one clearly-labeled tool in a human's shop, not the shop. Human-written copy, the real face (when un-deferred), and human proof stay dominant on the page; the AI never crowds them out.

**Review gate:** before the AI path is enabled in prod, a tone pass confirms it sounds like Jason and is transparent about being an AI. A robotic, salesy, or human-impersonating reply blocks launch — same seriousness as the capability-selection eval.

## 8. Returning-visitor memory

- On first visit, client mints `prospect_id` (UUID, localStorage).
- All events persist under that id. On email capture, `prospects.email` is set → the anonymous history is now a named lead.
- On return, if `prospect_id` + a prior plan exist, the AI greets contextually ("welcome back — last time we scoped X; pick up there?"). No login required; email is the durable key for cross-device (phase 2).

---

## 9. Extensibility hooks (so C/D/E slot in without rework)

- **C (nurture/closer):** `events` + `prospects.stage` + persisted `plans` are exactly the substrate a follow-up engine reads; `SCOPE_PROMPT` structure generalizes to an objection-handling mode. No schema change expected.
- **D (outbound):** the same `computePlan(keys)` + plan renderer generate a proposal for a researched prospect; delivery is a separate, human-approval-gated service. Outbound writes the same `prospects`/`plans` tables with `source='outbound'`.
- **E (cockpit):** reads `prospects`/`conversations`/`plans`/`events` directly; the foundation's job is to write clean, queryable rows. Funnel analytics come free from `events`.

---

## 10. Testing strategy

- **Smoke (Playwright, offline):** questionnaire → plan builds → totals compute from ratecard → lead capture falls back to mailto → shareable link rehydrates → zero console errors. (Mirrors the site's existing offline-first test discipline.)
- **Unit:** `computePlan(keys)` math (phase grouping, band summing, timeline), URL encode/decode round-trip, ratecard integrity (every `CAPS` key has a card; every band is `[min≤max]`).
- **Eval:** golden-set selection scoring (§7), gated in CI.
- **Voice & Humanity review gate (§7.5):** before enabling the AI path in prod, a tone pass confirms replies sound like Jason (first person, plain, opinionated), are transparent about being an AI, and never impersonate a human. Robotic / salesy / impersonating replies block launch.
- **A11y + Lighthouse:** 100 targets on `/build.html`; SVG plan viz gets `role=img` + labels like the transform section.
- **Security:** confirm no service key reaches the client bundle; RLS denies anon reads/writes.

---

## 11. Security & privacy

- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — server env only, used exclusively in `/api/*`. Client uses none.
- RLS on all tables: deny anon; access only via service role server-side.
- Consent line at email capture (what you'll receive; how to opt out) — sets up CAN-SPAM/GDPR cleanliness that Subsystem D will require.
- Retain minimal PII; provide a delete path (phase 2 with the cockpit).

---

## 12. Build order (within the foundation)

1. `ratecard.js` seeded from `CAPS` + `computePlan()` + unit tests.
2. Plan URL encode/decode + plan viz (reuse transform vocabulary).
3. `/build.html` shell + questionnaire fallback (fully works offline) + smoke tests.
4. Supabase schema + `/api/scope` + `/api/lead` extension (persistence, still degrades to mailto).
5. `/api/chat` `scope` mode + client AI path + server-side key validation.
6. Trust layer: qualification rubric, confidence/flags UI, human handoff, eval golden set + CI gate.
7. Returning-visitor memory.
8. Lighthouse/a11y pass; feature-flag the AI path on behind the eval gate; ship.

Each step is independently shippable and testable.

---

## 13. Open questions / decisions deferred to review

- Page URL: `/build.html` (working name) vs `/scope.html` vs `/work-with-me.html`.
- Eval pass threshold (e.g. ≥0.8 selection F1) — set with Jason.
- Rate-card band values — Jason tunes the seeded placeholders before the AI path goes live.
- Segment list — confirm the 4 proposed segments match Jason's real buyer types.
- Whether the questionnaire fallback ships enabled from day 1 (recommended) or only as the no-LLM fallback.
