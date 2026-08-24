# SYSTEM — how the funnel actually works (operator map)

The single map of the whole acquisition → close → nurture pipeline. What each
stage does, the data flow, every env var and what it turns on, what's dormant vs
live, and how to test it. This is the "how everything works" reference and the
activation runbook.

> No secrets live in this file — only env var **names**. Real values live in
> Vercel and your private vault.

---

## 1. The pipeline at a glance

```
VISITOR ARRIVES (agency.sageideas.dev)
   │
   ├─ Scope Studio (build.html) ──────────────────────────────┐
   │    • Quick questions  → deterministic plan (scope-core)   │
   │    • "Talk it through" → AI bot (api/chat scope mode)      │
   │        - grounded: model emits capability KEYS only        │
   │        - server computes all $ from RATE_CARD              │
   │        - qualifies (strong/maybe/poor) + graceful no       │
   │        - eval-harnessed (evals/chatbot + scripts/eval-*)   │
   │                                                             ▼
   ├─ AI Front Desk demo (front-desk.html) ──► lead / book     LEAD
   │    • voice + text receptionist (api/chat receptionist)     │  email captured
   │                                                             │  (/api/lead)
   ├─ Book a call (book.html) ──► Cal.com or contact form       │
   │                                                             ▼
   │                                                        PROSPECT (Supabase: scope_prospects)
   │                                                             │
   │                              draft proposal (/api/proposal) ▼
   │                                    server-priced from keys  DRAFT PROPOSAL
   │                                    Jason emailed to approve │  (scope_proposals, status=draft_pending)
   │                                                             ▼
   │        /proposal-admin.html?key=TOKEN  ──► Jason approves   APPROVED
   │                                    (edits firm price)       │  (status=approved, client emailed)
   │                                                             ▼
   │        /proposal.html?id=PUBLIC_ID  ──► client accepts+pays DEPOSIT
   │                                    Stripe Checkout          │  (Stripe → /api/stripe-webhook,
   │                                                             ▼   verified+idempotent → status=deposit_paid)
   │                                                        PROJECT (scope_projects)
   │                                                             │
   │        portal link emailed (portal_token) ──────────────────▼
   │        /portal.html?id=TOKEN  ──► client tracks delivery   DELIVERY
   │             • operator generates SOW/MSA + seeds/           │  (scope_milestones,
   │               delivers milestones in /proposal-admin        │   scope_contracts)
   │             • client approves delivered milestones          ▼
   │        /contract.html?id=PUBLIC_ID  ──► client accepts CONTRACT ACCEPTED
   │             the tailored SOW/MSA
   │
   └─ NURTURE (daily Vercel Cron → /api/cron/nurture)
        • lead, no proposal (48h) → nudge
        • proposal unpaid (day 3, day 8) → reminders
        • proposal expiring (T-3d) → heads-up
        • operator digest → stale drafts + run summary to Jason
        • one-click unsubscribe (/api/unsubscribe) + operator suppress (/api/suppress)
```

## 2. The three grounding/safety guarantees (never regress these)

1. **No price from the model.** The scope bot emits capability KEYS only; the deterministic `RATE_CARD` in `assets/scope-core.mjs` supplies every dollar via `computePlan()`. `api/chat.js` strips `$`-amounts + money-words from every client-facing field (`sanitizeScopeReply` + `deVoiceTic`), and drops any key not on the rate card (`filterSelection`).
2. **No client-set price reaches Stripe.** `/api/proposal` re-derives the band server-side via `serverBand()` → `computePlan(keys)`; the client-sent `totalBand` is ignored. Stripe charges `deposit_cents` from the persisted, admin-approved row.
3. **Never 5xx a visitor.** Every endpoint degrades to a clean 2xx/4xx when unconfigured (dormant), so console + Lighthouse stay clean and the questionnaire fallback always works.

## 3. Stage-by-stage

| Stage | Files | What activates it |
|---|---|---|
| Scope Studio (deterministic) | `build.html`, `assets/scope-studio.mjs`, `assets/scope-core.mjs` | always on (client-side) |
| Scope bot (conversational) | `api/chat.js` (scope mode), `assets/scope-chat.mjs` | `LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL` |
| Bot eval harness | `assets/chatbot-evals.mjs`, `scripts/eval-chatbot.mjs`, `evals/chatbot/*` | operator-run (needs LLM live) |
| Voice/text receptionist | `front-desk.html` + `api/chat.js` (receptionist mode) | same `LLM_*` |
| Lead capture | `api/lead.js`, `lib/scope-db.mjs`, `lib/notify.mjs` | `SUPABASE_*` (persist) + `RESEND_*` (email) |
| Proposal create/read | `api/proposal.js`, `lib/proposal-db.mjs` | `SUPABASE_*` |
| Proposal approve/admin | `api/proposal-approve.js`, `api/proposal-admin.js`, `lib/admin-auth.mjs` | `SCOPE_ADMIN_TOKEN` + `SUPABASE_*` |
| Client proposal + accept | `proposal.html`, `assets/proposal.mjs` | `SUPABASE_*` |
| Checkout (deposit) | `api/proposal-checkout.js`, `lib/stripe.mjs` | `STRIPE_SECRET_KEY` |
| Webhook (paid → project) | `api/stripe-webhook.js` | `STRIPE_WEBHOOK_SECRET` |
| Delivery: client portal | `portal.html`, `assets/portal.mjs`, `api/portal.js`, `lib/portal-db.mjs` | `SUPABASE_*` |
| Delivery: milestones (operator) | `api/milestone.js`, admin's Milestones card in `assets/proposal-admin.mjs` | `SCOPE_ADMIN_TOKEN` + `SUPABASE_*` |
| Delivery: contracts (SOW/MSA) | `assets/contract-core.mjs`, `api/contract-generate.js`, `api/contract-send.js`, `api/contract.js`, `contract.html`, `assets/contract.mjs` | `SCOPE_ADMIN_TOKEN` (generate/send) + `SUPABASE_*` |
| Nurture cron | `api/cron/nurture.js`, `assets/nurture-core.mjs`, `lib/nurture-db.mjs` | `NURTURE_ENABLED=true` + `CRON_SECRET` + `SUPABASE_*` + `RESEND_*` |
| Unsubscribe / suppress | `api/unsubscribe.js`, `api/suppress.js`, `unsubscribe.html` | `SUPABASE_*` (+ `SCOPE_ADMIN_TOKEN` for suppress) |

Schema: `supabase/scope_schema.sql` (`scope_prospects`, `scope_plans`, `scope_conversations`, `scope_events`, `scope_proposals`, `scope_projects` + `portal_token`, `scope_milestones`, `scope_contracts`, `scope_nurture_sends`). RLS: deny-all-anon; the server uses the service-role key only.

## 4. Env vars — the master switchboard

| Var | Turns on | Absent ⇒ |
|---|---|---|
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | the AI bot + voice/text receptionist | chat returns 501 → questionnaire fallback |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | persistence + proposals + nurture data | endpoints 200-skip; proposal admin empty |
| `SCOPE_ADMIN_TOKEN` | the admin console + suppress endpoint | admin/suppress fail-closed 401 |
| `SITE_URL` | absolute links in emails/redirects | defaults to `https://agency.sageideas.dev` |
| `STRIPE_SECRET_KEY` | deposit checkout | checkout 200-skip |
| `STRIPE_WEBHOOK_SECRET` | verified paid webhook | webhook 200-skip (can't confirm payments) |
| `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` | operator + client emails | emails skip silently |
| `NURTURE_ENABLED` (`'true'`) | nurture sends | cron 200-skip (default OFF) |
| `CRON_SECRET` | authorize the nurture cron | cron 401 fail-closed |

**Status as of last activation:** `LLM_*`, `RESEND_*`, `SCOPE_ADMIN_TOKEN`, `SITE_URL`, `CRON_SECRET` are set. **Missing (the money back-half):** `SUPABASE_*` + `STRIPE_*`. `NURTURE_ENABLED` intentionally OFF until a verified sending domain + real leads.

The delivery layer (portal + milestones + contracts, `docs/PORTAL.md`) adds no new switchboard vars — it reuses `SUPABASE_*` (persistence), `SCOPE_ADMIN_TOKEN` (operator generate/send/milestone writes), `RESEND_*` (portal-link + contract-ready emails), and `SITE_URL` (the links themselves) exactly as above.

## 5. Dormant → live activation checklist

1. **Supabase** (dedicated "Sage Ideas Agency" project, Pro so it never auto-pauses): run `supabase/scope_schema.sql` → set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`.
2. **Stripe** (test first): set `STRIPE_SECRET_KEY` (`sk_test_…`); add a webhook endpoint `/api/stripe-webhook` for `checkout.session.completed` + `charge.dispute.created` → set `STRIPE_WEBHOOK_SECRET`.
3. **Deliverability** (hard gate before nurture): verify the sending domain in Resend (SPF/DKIM/DMARC), point `RESEND_FROM` at it. See `docs/NURTURE.md`.
4. **Cal.com:** replace `YOUR-CAL-USERNAME/intro` in `book.html`.
5. **Nurture on (last):** `NURTURE_ENABLED=true`.
6. Redeploy after any env change (env applies to the next deploy).

## 6. How to test the pipeline (the commands)

```bash
# unit + smoke
npm run test:unit          # pure logic: money math, validators, degrade-shapes
npm run lint
npx playwright test tests/smoke.spec.js --project=desktop

# chatbot red-team + golden (needs LLM live on the target)
node scripts/eval-chatbot.mjs --url https://agency.sageideas.dev   # expect 11/11

# live endpoint health (dormant = clean degrade / fail-closed)
#   /api/chat scope single + multi-turn → 200
#   /api/proposal-admin, /api/cron/nurture, /api/suppress → 401 (fail-closed)
#   /api/proposal GET, /api/scope, /api/lead → 200
#   /api/proposal-checkout → 400 on bad body
```

Full money-path test once Supabase+Stripe are live: scope a plan → submit email (row in `scope_prospects` + `scope_proposals`, operator email) → approve in `/proposal-admin.html?key=…` → open `/proposal.html?id=…` → pay with `4242 4242 4242 4242` → webhook flips to `deposit_paid`, `scope_projects` row created.

## 7. Related operator docs
- `docs/PROPOSALS.md` — proposal/deposit flow + go-live.
- `docs/PORTAL.md` — delivery layer: client portal, milestones, auto-generated contracts (+ legal caveat).
- `docs/NURTURE.md` — sequences, deliverability gate, cron.
- `docs/CHATBOT-EVAL.md` — the bot's own eval harness.
- `docs/SUPABASE.md` — schema/persistence setup.
- Private vault: activation runbook, sales kit, outreach playbook.
