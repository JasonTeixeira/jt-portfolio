# Scope Studio — Plan 4: Nurture (Subsystem C) Design Spec

**Status:** approved design, 2026-08-19
**Extends:** P1 core, P2 persistence, P3 AI scope, P5 close-to-cash.
**Goal:** Recover revenue from leads/proposals that would otherwise go cold, via a small number of gentle, genuinely-useful, automated follow-ups — safely, with real suppression and deliverability hygiene, dormant until wired.

---

## 1. Mechanism

Vercel Cron → one daily tick at `GET /api/cron/nurture`. It evaluates state, sends at most one due touch per prospect/proposal, records it (idempotent), and stops. No always-on server. Degrade-safe and gated behind an explicit kill switch, so it can ship live and send nothing until deliberately enabled.

## 2. Sequences (4 rules; each step sends at most once, ever)

| Key | Rule | Touch |
|---|---|---|
| A `lead_no_proposal` | prospect `stage='engaged'`, has email, sendable, `updated_at` ≥48h ago, and **no proposal row exists** for them (any status, incl. `draft_pending`) | copy branches: if a `scope_plans` row exists → "turn your plan into a firm quote"; else (bare report lead) → "want me to map out a build?" — link to `/build.html` + book |
| B1 `proposal_unpaid_1` | proposal `status='approved'`, not expired, has `client_email`, sendable, `approved_at` ≥3 days ago | "Any questions before you decide?" → `/proposal.html?id=…` |
| B2 `proposal_unpaid_2` | same + `approved_at` ≥8 days ago | "Still happy to talk it through, no pressure." → proposal link |
| C `proposal_expiring` | `status='approved'`, `expires_at` in (now, now+3d] | "Quick heads-up: expires on {date}." → proposal link |
| D (operator digest) | `draft_pending` proposals older than 24h, plus the run summary | email to **you** (RESEND_TO): "N proposals waiting for approval" + per-prospect one-click suppress links + "ran: sent X, due Y, errors Z" |

Evaluation order per proposal: send the first UN-sent due step (a 9-day-unpaid proposal with neither sent → B1 today, B2 next run — natural spacing). Sequences B/C stop automatically when status leaves `approved`. D is operator-facing (no unsubscribe concerns) and doubles as the cron heartbeat.

## 3. Fold-ins (from design review — all in scope)

- **Manual suppress valve** (reply blind-spot release): a `nurture_suppressed` flag; every operator email (Plan 5 new-proposal alert + this digest) carries a one-click, admin-token-gated suppress link `/api/suppress?key=SCOPE_ADMIN_TOKEN&prospect=ID`. The engine excludes `unsubscribed OR nurture_suppressed`.
- **`List-Unsubscribe` header** (RFC 8058 one-click) on every prospect email, plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Required for Gmail/Yahoo bulk-sender deliverability, not just the footer link.
- **Sequence-A precision:** exclude any prospect who has ANY proposal row (draft_pending included — a waiting prospect must never get a "want to scope something?" email; the operator digest D covers that state). Branch copy on `scope_plans` existence.
- **Heartbeat + measurement:** D includes the run summary; `scope_nurture_sends` links `proposal_id`/`prospect_id`/`step`/`sent_at` so touch→view→convert lift is queryable later.

## 4. Global constraints (carry into every task)

- ESM only, Node ≥22, Vercel funcs `export default async function handler(req,res)`.
- **Degrade-safe, never 5xx from missing config.** DB/Resend absent → clean 200 `{ok:false,skipped:true}`. Auth/token failures → real 401.
- **Kill switch default OFF:** send nothing unless `process.env.NURTURE_ENABLED === 'true'`.
- **Idempotent sends:** unique DB indexes make a re-run or double-fire a no-op — never double-email.
- **Voice & Humanity:** every prospect email is Jason first-person, plain, one genuine reason to reopen (never "just checking in"), an escape hatch, and an unsubscribe footer. **No banned tics** (no em-dash clause-joiner, no rule-of-three for effect, never "actually/genuinely/Honestly").
- New tables/columns: `enable row level security`, no policies (deny-all-anon; service role only). Server-only keys.
- Timestamps passed INTO pure functions (no `Date.now()` in tested pure logic).

## 5. New env vars

| Var | Purpose | Absent ⇒ |
|---|---|---|
| `NURTURE_ENABLED` | must equal `'true'` to send | cron runs but sends nothing (200 skip) |
| `CRON_SECRET` | authorize the cron endpoint (Vercel sends `Authorization: Bearer …`) | cron endpoint 401 (fail-closed) |

Reused: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO`, `SITE_URL`, `SCOPE_ADMIN_TOKEN`.

## 6. Data — append to `supabase/scope_schema.sql`

```sql
alter table scope_prospects add column if not exists unsubscribed boolean not null default false;
alter table scope_prospects add column if not exists nurture_suppressed boolean not null default false;
alter table scope_prospects add column if not exists unsubscribe_token text;

create table if not exists scope_nurture_sends (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references scope_prospects(id) on delete cascade,
  proposal_id uuid references scope_proposals(id) on delete cascade,
  step text not null,
  sent_at timestamptz not null default now()
);
-- Idempotency: one send per (proposal, step) for proposal-scoped touches, one per (prospect, step) for lead touches.
create unique index if not exists nurture_send_proposal on scope_nurture_sends(proposal_id, step) where proposal_id is not null;
create unique index if not exists nurture_send_prospect on scope_nurture_sends(prospect_id, step) where proposal_id is null;
create index if not exists nurture_send_prospect_all on scope_nurture_sends(prospect_id);
alter table scope_nurture_sends enable row level security;
-- no policies: deny-all-anon; service role bypasses.
```

## 7. Pure core — `assets/nurture-core.mjs` (shared browser+node, unit-tested)

```
DUE = { LEAD_HOURS:48, UNPAID_1_DAYS:3, UNPAID_2_DAYS:8, EXPIRING_WITHIN_DAYS:3, DRAFT_STALE_HOURS:24 }
SEND_CAP = 200
STEP = { LEAD:'lead_no_proposal', UNPAID_1:'proposal_unpaid_1', UNPAID_2:'proposal_unpaid_2', EXPIRING:'proposal_expiring' }

isSendable(prospect)                 → !prospect.unsubscribed && !prospect.nurture_suppressed
hoursBetween(aIso, bIso)             → number
leadDue(prospect, hasProposal, sentSteps, nowIso)
                                     → boolean  (engaged, email, !hasProposal, sendable, ≥48h since updated_at, LEAD not in sentSteps)
dueStepForProposal(proposal, sentSteps, nowIso)
                                     → STEP.* | null
                                       // status must be 'approved'; skip if expired; C if expires within 3d and EXPIRING unsent;
                                       // else B2 if ≥8d and UNPAID_2 unsent; else B1 if ≥3d and UNPAID_1 unsent; else null.
                                       // (C takes priority when both C and an unpaid step are due.)

// Email builders — pure, return { subject, text, headers }. `headers` includes List-Unsubscribe.
leadEmail({ prospect, hasPlan, siteUrl, unsubscribeUrl })
unpaidEmail({ proposal, step, siteUrl, unsubscribeUrl })
expiringEmail({ proposal, siteUrl, unsubscribeUrl })
listUnsubHeaders(unsubscribeUrl)     → { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
```

Every email `text` ends with a plain unsubscribe line ("Not interested in these? Unsubscribe: {unsubscribeUrl}"). No banned tics.

## 8. Gateway — `lib/nurture-db.mjs` (mirror scope-db; degrade-safe `{ok,skipped}`)

```
isEnabled()                          // reuse SUPABASE_URL + SUPABASE_SERVICE_KEY
leadCandidates(nowIso)               → { ok, data:[{ prospect, hasPlan }] }
                                       // engaged prospects w/ email, updated_at ≥48h, sendable, that have NO proposal row;
                                       // hasPlan = a scope_plans row exists for them.
unpaidProposals()                    → approved+unexpired proposals w/ client_email, joined prospect suppression flags
expiringProposals(nowIso)            → approved proposals with expires_at in (now, now+3d]
staleDrafts(nowIso)                  → draft_pending proposals older than 24h (for digest D)
sentStepsForProposal(proposalId)     → Set<string>
sentStepsForProspect(prospectId)     → Set<string>   // lead-scoped (proposal_id null)
recordSend({ prospect_id, proposal_id, step }) → { ok, recorded:boolean } // unique-violation ⇒ recorded:false (already sent), ok:true
ensureUnsubToken(prospectId)         → { ok, token }  // returns existing or generates+persists a random token
setUnsubscribedByToken(token)        → { ok, matched:boolean }
setSuppressed(prospectId)            → { ok }
```
Never throws; `{ok:false,skipped:true}` when unconfigured.

## 9. Endpoints

- **`GET|POST /api/cron/nurture`** — the tick.
  1. **Auth:** require `CRON_SECRET`; compare `req.headers.authorization` to `Bearer ${CRON_SECRET}` (constant-time). Missing/mismatch/unset-secret ⇒ 401. (Vercel Cron sends this header automatically.)
  2. **Kill switch:** `NURTURE_ENABLED !== 'true'` ⇒ 200 `{ok:true, skipped:true, reason:'disabled'}`.
  3. DB/Resend disabled ⇒ 200 skip.
  4. Gather A/B/C candidates; per candidate compute the due step via nurture-core; skip if already in sentSteps; `ensureUnsubToken`; build email (with List-Unsubscribe headers); `notify.sendClient`; `recordSend`; stop at `SEND_CAP`.
  5. D: `staleDrafts` + run summary ⇒ `notify.sendOperator` (with per-prospect suppress links) when there is anything to report.
  6. Per-candidate try/catch (one failure never aborts the run; count errors). Return `{ ok, sent, due, errors, capped }`.

- **`GET|POST /api/unsubscribe?token=…`** — one-click opt-out. `setUnsubscribedByToken`; always 200 (unknown token ⇒ 200, no leak). GET ⇒ 302 to `/unsubscribe.html?done=1`; POST (List-Unsubscribe one-click) ⇒ 200 `{ok:true}`. Idempotent.

- **`GET /api/suppress?key=…&prospect=…`** — operator stop-follow-ups. `checkToken` (reuse `lib/admin-auth.mjs`); 401 if bad. `setSuppressed(prospectId)`; 200 confirmation. DB disabled ⇒ 200 skip.

## 10. Pages

- **`unsubscribe.html`** — JT dark shell, `<meta name="robots" content="noindex">`. Reads `?done=1`; renders "You're unsubscribed. You won't get follow-ups from me." + a line to reach Jason if it was a mistake. Static, no fetch (the endpoint already did the work).

## 11. `lib/notify.mjs` extension (additive, backward-compatible)

`sendClient({ to, subject, text, replyTo, headers })` — pass an optional `headers` object straight into the Resend payload. Existing callers (no `headers`) unaffected. `sendOperator` unchanged.

## 12. Security surface (security-reviewer MUST review)

1. Cron auth fail-closed, constant-time; public callers cannot trigger sends.
2. Kill switch default off; half-configured env cannot blast.
3. Idempotent sends via unique indexes; per-run cap; per-item error isolation.
4. Unsubscribe token unguessable, one-click GET+POST, idempotent, no leak on unknown token.
5. Suppress endpoint admin-token gated (constant-time), fail-closed.
6. No PII leak in any response; degrade-safe 200s; service key server-only; RLS deny-all.
7. `List-Unsubscribe` correctness (real working URL).
8. Voice-compliant, non-spammy content; hard deliverability gate documented.

## 13. Testing / verification

- **Unit:** nurture-core (`leadDue`, `dueStepForProposal` boundaries at 48h/3d/8d/expiry-3d, status-must-be-approved, expired→null, sentSteps exclusion, C-over-B priority, `isSendable` unsub/suppress); email builders (subject/text non-empty, contains unsubscribe URL, `List-Unsubscribe` header present, **no banned tics / no em-dash clause-joins**); `SEND_CAP`. nurture-db disabled-shape. cron auth (401 without secret) + kill-switch (200-skip when `NURTURE_ENABLED!=='true'`). unsubscribe + suppress validate/auth.
- **Smoke (Playwright):** `unsubscribe.html?done=1` renders the confirmation with no uncaught console error; extend the console-ignore to `/api/(cron|unsubscribe|suppress)`.
- Live cron E2E is operator-run (documented in NURTURE.md).

## 14. Docs — `docs/NURTURE.md`

Env setup (`NURTURE_ENABLED`, `CRON_SECRET`, reused vars); the schema additions; the sequences + cadence; the kill switch; unsubscribe (link + List-Unsubscribe) and operator suppress; the Vercel Cron schedule; **the HARD deliverability go-live gate** (verify the sending domain in Resend, set `RESEND_FROM` to it, configure SPF/DKIM/DMARC — automated mail without this lands in spam and burns sender reputation); the dormant-until-wired posture; and the measurement note (how to query lift from `scope_nurture_sends` + `scope_events` later).

## 15. Out of scope (named, deferred)

Inbound reply auto-detection (the manual suppress valve covers the urgent need); post-deposit onboarding drip; send-time/timezone windows; SMS; a nurture analytics dashboard (data is recorded for later); resubscribe UI.

## 16. File manifest

Create: `assets/nurture-core.mjs`, `lib/nurture-db.mjs`, `api/cron/nurture.js`, `api/unsubscribe.js`, `api/suppress.js`, `unsubscribe.html`, `docs/NURTURE.md`, unit tests under `tests/unit/`.
Modify: `supabase/scope_schema.sql` (append), `lib/notify.mjs` (add `headers` to `sendClient`), `vercel.json` (add `crons`), `tests/smoke.spec.js` (console-ignore + unsubscribe smoke), and `api/proposal.js` (add the per-prospect suppress link to the operator alert email — additive).
