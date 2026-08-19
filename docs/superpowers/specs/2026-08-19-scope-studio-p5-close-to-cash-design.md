# Scope Studio — Plan 5: Close → Cash (Design Spec)

**Status:** approved design, 2026-08-19
**Extends:** `2026-08-18-scope-studio-design.md` (P1 core), P2 persistence, P3 AI scope.
**Goal:** Turn a completed scope into a firm, human-approved proposal that a client can accept and pay a deposit on — safely, with a real agreement, and degrade-clean when unconfigured.

---

## 1. Product flow (the money path)

```
scope complete (keys + totalBand, dollars)
 → client submits email (existing /api/lead)  ── plan present ──▶ create DRAFT proposal
      firm_cents = midpoint(totalBand)·100   (server-computed, never from the LLM)
      deposit_cents = firm_cents · deposit_pct (default 0.30)
      Resend emails JASON an admin approve-link + the lead
 → /proposal-admin?key=…            (Jason only, token-gated)
      list pipeline · open draft · edit firm price / deposit% / scope note / expiry
      → Approve  ⇒ status=approved, client emailed the proposal link
 → /proposal?id=<public_id>          (the client)
      firm scope (itemized SOW) + price + deposit + full terms
      → type name + agree to terms + "Accept & pay deposit"
 → /api/proposal-checkout            (records acceptance intent, creates Stripe session)
 → Stripe Checkout (deposit only; test card 4242 4242 4242 4242)
 → /api/stripe-webhook               (signature-verified, idempotent)
      checkout.session.completed ⇒ status=deposit_paid, project row created,
      Jason + client notified.  charge.dispute.created ⇒ Jason notified.
```

**Grounding / price-safety (same discipline as scope):** the firm number is computed
server-side from `computePlan(keys).totalBand`. The LLM never touches money. Jason may
override the firm number in the admin console (human authority), but the client-facing
number and the Stripe amount always come from the persisted proposal row — **the client
never sends a price**. Amount clamps guard fat-finger admin edits.

## 2. Global constraints (carry into every task)

- ESM only (`"type":"module"`, Node ≥22). Vercel serverless funcs are `export default async function handler(req,res)`.
- **Money units:** `computePlan`/`totalBand`/`scope_plans.total_*` are **DOLLARS**. `scope_proposals.*_cents` and Stripe are **CENTS**. Convert at the boundary; never mix.
- **Degrade-safe, never 5xx from missing config.** DB/Stripe/Resend absent ⇒ endpoints return a clean `200` (mirroring `api/scope.js` `{ok:false,skipped:true,reason:'not_configured'}`), or for the client proposal page a graceful "not available yet" state. This keeps console + Lighthouse clean. Exception: signature/validation *failures* (bad Stripe signature, malformed body, bad admin token) return real 4xx.
- **Never trust client money.** All amounts read from the DB row server-side.
- **Voice & Humanity (§7.5 of P3 spec):** all client-facing copy (proposal page, terms, emails) is Jason first-person, plain, no banned tics (no em-dash clause-joins, no rule-of-three, no "actually/genuinely/Honestly"), transparent that automation is involved, always an escape hatch (talk to Jason). Terms read like a human wrote them.
- **RLS:** new tables `enable row level security` with **no policies** (deny-all-anon; service role bypasses). Server-only keys.
- Design system: exact JT dark tokens (see `build.html` `:root`), `assets/site.css`. Client proposal page is a *document* (clarity), not the interactive configurator. Print-clean.
- All new user-facing text via `textContent` (XSS-safe), never `innerHTML` with dynamic data.

## 3. New env vars

| Var | Purpose | Absent ⇒ |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe API (test `sk_test_…` now, live later) | checkout/webhook skip (200) |
| `STRIPE_WEBHOOK_SECRET` | verify webhook signatures | webhook 400 on any signed call; skip if truly unset |
| `SCOPE_ADMIN_TOKEN` | gate the admin console + admin APIs | admin APIs 401 (fail closed) |
| `SITE_URL` | absolute base for email/redirect links | default `https://agency.sageideas.dev` |

Existing reused: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO`.

## 4. Data model — append to `supabase/scope_schema.sql`

```sql
create table if not exists scope_proposals (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,           -- unguessable client URL slug (>=128 bits)
  prospect_id uuid references scope_prospects(id) on delete set null,
  keys text[] not null default '{}',        -- capability keys (scope snapshot)
  segment text,
  band_lo int, band_hi int,                 -- dollars, from computePlan totalBand at draft time
  firm_cents int not null,                  -- server-computed midpoint; admin-editable
  deposit_pct numeric not null default 0.30,
  deposit_cents int not null,
  balance_cents int not null,               -- recorded; collection is a later plan
  currency text not null default 'usd',
  scope_note text,                          -- Jason's optional note on the offer
  terms_version text not null,
  status text not null default 'draft_pending', -- draft_pending|approved|deposit_paid|expired|declined
  accepted_name text,                       -- captured at checkout (acceptance artifact)
  accepted_at timestamptz,
  accept_ip text,
  accept_terms_version text,
  stripe_session_id text,
  stripe_payment_intent text,
  client_email text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz
);
create table if not exists scope_projects (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references scope_proposals(id) on delete cascade,
  prospect_id uuid references scope_prospects(id) on delete set null,
  status text not null default 'kickoff',
  created_at timestamptz not null default now()
);
create unique index if not exists scope_proposals_public on scope_proposals(public_id);
create index if not exists scope_proposals_status on scope_proposals(status);
create unique index if not exists scope_projects_proposal on scope_projects(proposal_id); -- one project per proposal (idempotency)
alter table scope_proposals enable row level security;
alter table scope_projects enable row level security;
-- no policies: deny-all-anon; service role bypasses RLS.
```

New `scope_events.type` values used (free text, no enum change needed): `proposal_drafted`,
`proposal_approved`, `proposal_viewed`, `proposal_accepted`, `deposit_paid`, `dispute_opened`.

## 5. Pure core — `assets/proposal-core.mjs` (shared browser+node, unit-tested)

```
DEPOSIT_PCT_DEFAULT = 0.30
PROPOSAL_STATUS = { DRAFT:'draft_pending', APPROVED:'approved', PAID:'deposit_paid', EXPIRED:'expired', DECLINED:'declined' }
TERMS_VERSION = '2026-08-19'
TERMS = [ {heading, body}, … ]   // real SOW: Scope included, Out of scope, Revisions (2 rounds),
                                 // Timeline, Payment (deposit + balance on delivery), IP (transfers on final payment),
                                 // Cancellation, Taxes (exclusive; client responsible), Validity (expires_at)

firmCentsFromBand([lo,hi])      → Math.round((lo+hi)/2) * 100        // dollars→cents, integer
depositCents(firmCents, pct)    → Math.round(firmCents * pct)
balanceCents(firmCents, depCents) → firmCents - depCents
clampFirmCents(cents, [lo,hi])  → { cents, clamped }  // clamp into [lo*100*0.5, hi*100*2]; floor 5000 ($50)
publicId()                      → base62 of 16 random bytes via globalThis.crypto.getRandomValues (node22+browser)
money(cents, currency='usd')    → '$3,600' display helper
isExpired(row, nowIso)          → boolean
```

All functions pure and deterministic (except `publicId` which is explicitly the randomness
boundary). No `Date.now()` inside pure math funcs used by tests; callers pass timestamps.

## 6. Gateways

### `lib/proposal-db.mjs` (mirror `lib/scope-db.mjs`)
```
isEnabled()                         // reuse scope-db env (SUPABASE_URL + SUPABASE_SERVICE_KEY)
createProposal(row)                 → {ok,data|skipped|error}   // insert scope_proposals
getProposalByPublicId(publicId)     → {ok,data}                 // single row or null
getProposalById(id)                 → {ok,data}
updateProposal(id, patch)           → {ok,data}                 // .update().eq('id',id).select()
markPaidIfUnpaid(id, {session,intent,paidAtIso}) → {ok, transitioned:boolean}
                                     // .update(status=paid,…).eq('id',id).neq('status','deposit_paid').select()
                                     // transitioned = returned rows length===1  (webhook idempotency)
createProjectOnce(proposalId, prospectId) → {ok, created:boolean}
                                     // insert; on unique-violation (project already exists) created=false, ok=true
listProposals({status?, limit=50})  → {ok,data}                 // newest first, admin pipeline
```
Disabled/without-env shape identical to scope-db: `{ ok:false, skipped:true }`. Never throws.

### `lib/stripe.mjs` (env-guarded)
```
isEnabled()                         // Boolean(process.env.STRIPE_SECRET_KEY)
createCheckoutSession({ amountCents, currency, productName, publicId, proposalId, customerEmail, successUrl, cancelUrl })
                                     → { ok, url, id } | { ok:false, skipped }   // mode:'payment', one line_item,
                                     // metadata:{ proposalId, publicId }, payment_intent_data.metadata same
retrieveSession(id)                 → { ok, session } | skipped
constructEvent(rawBody, signature)  → verified event  // throws on bad sig; requires STRIPE_WEBHOOK_SECRET
```
Uses the `stripe` npm package (add to dependencies). Lazy `import`/instantiate so absence of
key never crashes module load.

### `lib/notify.mjs` (shared Resend, degrade-safe — does NOT modify existing lead.js sender)
```
isEnabled()                         // Boolean(process.env.RESEND_API_KEY)
sendOperator({ subject, text })     → {ok|skipped}   // to RESEND_TO, from RESEND_FROM
sendClient({ to, subject, text, replyTo }) → {ok|skipped}
```
No key ⇒ `{ok:false,skipped:true}`. Never throws. Same REST shape lead.js uses.

## 7. Endpoints (each: method guard 405; degrade-safe; throttle where public)

- **`POST /api/proposal`** — create draft. Body `{ prospectId, plan:{keys,segment,total|totalBand}, email? }`.
  Validate (pure `validate(body)` export, reused by tests). Compute `band=totalBand`,
  `firm=firmCentsFromBand(band)`, `deposit=depositCents(firm, DEPOSIT_PCT_DEFAULT)`,
  `public_id=publicId()`, `terms_version=TERMS_VERSION`, `expires_at=+14d` (caller passes now).
  `createProposal(...)`; `appendEvent(type:'proposal_drafted')`; `notify.sendOperator` with the
  admin link `${SITE_URL}/proposal-admin?key=…` **(do NOT put the token in the email body plaintext beyond the link Jason needs; the link is the token — acceptable v1, noted as debt)** and the lead summary.
  Disabled ⇒ 200 `{ok:false,skipped:true}`. Requires an existing prospect only best-effort.
  **`GET /api/proposal?publicId=…`** — client read. Returns ONLY whitelisted fields when
  `status ∈ {approved, deposit_paid, expired, declined}`; a `draft_pending` proposal returns
  404 (invisible to client). Whitelisted: `{ public_id, status, keys, segment, firm_cents,
  deposit_cents, balance_cents, currency, scope_note, terms_version, expires_at, paid_at }`.
  On read of an approved+past-expiry row, report status `expired`. Fires `proposal_viewed` event
  (best-effort) on approved reads. Never returns admin token, ids, emails, ip, stripe secrets.

- **Trigger from `api/lead.js` (additive, guarded):** in the existing `isEnabled() && prospectId`
  block, when `plan` has `Array.isArray(plan.keys) && plan.keys.length`, ALSO create the draft
  via a single internal call path (call `POST /api/proposal` logic by importing a shared
  `draftFromLead()` helper, OR inline createProposal). Chosen: **client calls `POST /api/proposal`
  itself right after a successful `/api/lead`** (keeps shipped lead.js untouched, lowest
  regression risk, independently testable). `assets/scope-studio.mjs` `onLeadSubmit`: after
  lead resolves ok, `fetch('/api/proposal', {…})` fire-and-forget, then show a "your proposal is
  on its way — Jason reviews every one, you'll get it shortly" confirmation. `.catch(()=>{})`.

- **`POST /api/proposal-approve`** — admin. Header `x-admin-token` (constant-time compare vs
  `SCOPE_ADMIN_TOKEN`; missing/wrong ⇒ 401, no body leak). Body `{ id, firmCents?, depositPct?,
  scopeNote?, expiresAt? }`. Re-clamp `firmCents` via `clampFirmCents(firmCents, [band_lo,band_hi])`;
  recompute deposit/balance from the (possibly edited) firm + pct. Set `status='approved'`,
  `approved_at=now`. `appendEvent('proposal_approved')`. **Client-notify (not optional):**
  `notify.sendClient({ to: client_email, subject, text with ${SITE_URL}/proposal?id=public_id })`.
  Disabled ⇒ 200 skip. Only `draft_pending`→`approved` (idempotent no-op if already approved).

- **`GET /api/proposal-admin`** — admin, token-gated. `?list=1` ⇒ `listProposals()` (pipeline).
  `?id=…` ⇒ full row for the console (all fields). 401 without valid token.

- **`POST /api/proposal-checkout`** — body `{ publicId, acceptName, agreed:true }`. Load row by
  public_id. Guard: must be `status='approved'` and not expired and `agreed===true` and
  `acceptName` non-empty (2..120 chars) ⇒ else 409/400. **Record acceptance intent** on the row:
  `accepted_name`, `accepted_at=now`, `accept_ip` (x-forwarded-for), `accept_terms_version`.
  Idempotent session: if `stripe_session_id` exists, `retrieveSession`; if still `open`, return
  its url; else create new. `createCheckoutSession({ amountCents: deposit_cents, currency,
  productName:'Project deposit', publicId, proposalId:id, customerEmail:client_email,
  successUrl:`${SITE_URL}/proposal?id=${publicId}&paid=1`, cancelUrl:`${SITE_URL}/proposal?id=${publicId}` })`.
  Store `stripe_session_id`. `appendEvent('proposal_accepted')`. Return `{ ok:true, url }`.
  Stripe disabled ⇒ 200 `{ok:false,skipped:true}` and the client shows "payment isn't enabled yet, talk to Jason".

- **`POST /api/stripe-webhook`** — `export const config = { api: { bodyParser: false } }`. Collect
  RAW body (`for await (const chunk of req)`), read `stripe-signature` header, `constructEvent`
  (bad/absent signature ⇒ 400, but if `STRIPE_WEBHOOK_SECRET` unset ⇒ 200 skip so a misconfigured
  env never errors). Handle:
  - `checkout.session.completed`: `proposalId = event.data.object.metadata.proposalId`;
    `markPaidIfUnpaid(...)`; if `transitioned` ⇒ `createProjectOnce`, `appendEvent('deposit_paid')`,
    `notify.sendOperator` + `notify.sendClient` (receipt + next steps). If not transitioned, ack 200 (dup).
  - `charge.dispute.created`: `appendEvent('dispute_opened')` + `notify.sendOperator` (manual handling). ack 200.
  - other events: ack 200 ignore.
  Always ack 200 on handled/ignored; only signature failure is 4xx.

## 8. Client page — `proposal.html` + `assets/proposal.mjs`

- URL `/proposal?id=<public_id>`. On load, `fetch('/api/proposal?publicId=…')`.
- States (all copy Voice-compliant, `textContent`):
  - **not found / draft / disabled** → calm "This proposal isn't available. Talk to Jason." + book link.
  - **approved** → itemized SOW rendered from `computePlan(keys, segment)` (pure import from
    `scope-core.mjs`, display only) grouped by phase; **price block** from server `firm_cents` /
    `deposit_cents` / `balance_cents` (via `money()`); full `TERMS`; expiry line; acceptance form:
    text input (full name) + checkbox ("I agree to the terms above") + "Accept & pay deposit".
    Submit → `POST /api/proposal-checkout` → `window.location = url`. Disabled/skip → escape-hatch copy.
  - **deposit_paid** (or `?paid=1`) → "Deposit received. Here's what happens next." + balance line + contact.
  - **expired** → "This proposal has expired. Talk to Jason to refresh it."
- Print CSS (`@media print`) so the client can save/forward a clean PDF to finance.
- Design: JT dark tokens; the SOW is the hero (clarity), price block is the signature element.
- a11y: labelled form controls, focus-visible, reduced-motion respected, contrast ≥ 4.5.

## 9. Admin console — `proposal-admin.html` + `assets/proposal-admin.mjs`

- URL `/proposal-admin?key=<token>`. Reads `key` from URL, sends as `x-admin-token` on every API call.
- No/blank key or 401 ⇒ "Not authorized." No data rendered.
- **Pipeline list** (`GET …?list=1`): rows with status chip, firm price, client email, age. Summary
  counts (drafts pending / approved-unpaid / paid) — the thin cockpit fold-in.
- **Detail**: editable firm price (dollars ⇄ cents), deposit % , scope note, expiry; live-recompute
  deposit/balance; **Approve** (POST approve); **Copy client link**. Shows acceptance + payment state.
- Token is v1 debt (URL-borne). Documented. Fail-closed server-side.

## 10. Security surface (security-reviewer MUST review)

1. Stripe webhook signature verification; reject unsigned/invalid (400). Idempotent transition + one-project unique index.
2. Admin endpoints: `crypto.timingSafeEqual` (length-guarded) vs `SCOPE_ADMIN_TOKEN`; fail closed; never echo token.
3. Amounts server-side only; client cannot set price/amount; admin edits clamped.
4. `public_id` ≥128-bit random; drafts invisible to public GET; public read field-whitelist (no ids/emails/ip/secrets).
5. Checkout only for `approved`, unexpired, agreed acceptance; acceptance artifact stored (name/ts/ip/terms_version).
6. Throttle public POSTs (proposal create, checkout) via the existing per-instance Map pattern.
7. RLS deny-all; service key server-only; no secret reaches the client.
8. Dispute webhook → operator notify (no silent money loss).

## 11. Testing / verification

- **Unit (`node --test tests/unit/**/*.mjs`):** proposal-core math (firmCentsFromBand, depositCents,
  balanceCents, clampFirmCents bounds, isExpired, publicId length/charset/uniqueness-ish);
  proposal-db disabled-shape (`{ok:false,skipped:true}`); stripe.isEnabled false-without-env;
  notify disabled-shape; each endpoint's `validate()`/token-check pure export; webhook idempotency
  logic (markPaid transition boolean) via a stubbed db; public-read field whitelist.
- **Stripe test-mode E2E:** with `sk_test_…` + a webhook secret via Stripe CLI `stripe listen
  --forward-to localhost/api/stripe-webhook`, run draft→approve→checkout→pay(4242)→webhook→paid.
  For CI/local-without-Stripe, verify the webhook handler with a **synthetically signed** event
  using `stripe.webhooks.generateTestHeaderString` (test secret) so idempotency + transition are
  proven without the network.
- **Playwright smoke (`tests/`):** `proposal.html` with no backend (static host) shows the graceful
  "not available" state and logs no uncaught console error (extend the existing `/api/(scope|chat)$`
  ignore to include `/api/proposal$`). `proposal-admin.html` with no key shows "Not authorized".
- **a11y:** axe pass on both new pages.
- **Prod Lighthouse:** 100/100/100/100 on `proposal.html` (navigation, no interaction ⇒ no POST).

## 12. Out of scope (named, deferred to later plans)

Balance/final-payment **collection** automation (we record `balance_cents` and can draft an invoice
later); real server-side PDF generation (we ship print CSS now); Stripe Tax integration (terms state
the stance now); proper operator auth/login (token is v1 debt); refunds UI; multi-currency;
full delivery/project-ops workspace.

## 13. File manifest

Create: `assets/proposal-core.mjs`, `lib/proposal-db.mjs`, `lib/stripe.mjs`, `lib/notify.mjs`,
`api/proposal.js`, `api/proposal-approve.js`, `api/proposal-admin.js`, `api/proposal-checkout.js`,
`api/stripe-webhook.js`, `proposal.html`, `assets/proposal.mjs`, `proposal-admin.html`,
`assets/proposal-admin.mjs`, `docs/PROPOSALS.md`, unit tests under `tests/unit/`.
Modify: `supabase/scope_schema.sql` (append tables), `assets/scope-studio.mjs` (post-lead draft
trigger + confirmation), `tests/smoke.spec.js` (console-ignore + proposal-page smoke),
`package.json` (add `stripe` dep). Do NOT modify `api/lead.js` internals (trigger is client-side).
