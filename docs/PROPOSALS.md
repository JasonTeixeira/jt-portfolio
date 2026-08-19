# Proposals & Deposits — Operator Guide

The money path: a visitor scopes a build in Scope Studio, submits their email, a
draft proposal is created automatically, Jason approves it from the admin
console, the client sees a priced proposal and pays a deposit via Stripe, and
a webhook books the project. This doc is the operator runbook for setting
that up and running it.

## Environment variables

Set these on the jt-portfolio Vercel project (or `.env.local` for local dev).
Everything degrades gracefully when unset — see "Degrade behavior" below.

| Var | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key. `sk_test_…` in dev/staging, `sk_live_…` in production. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the `/api/stripe-webhook` endpoint (see below). |
| `SCOPE_ADMIN_TOKEN` | Bearer token that gates the operator console (`/proposal-admin`) and the approve endpoint. Fails closed if unset — no token, no access. |
| `SITE_URL` | Public base URL used to build links in emails and Stripe redirect URLs (e.g. `https://agency.sageideas.dev`). Falls back to that value if unset. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Reused from Scope Studio persistence (`docs/SUPABASE.md`). Same project, same service-role key — proposals live in the same database. |
| `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` | Reused from lead notification. Used to email Jason when a proposal drafts and to email the client when it's approved. |

## Database setup

The proposal tables (`scope_proposals`, `scope_projects`) are additions to the
existing schema file:

1. Open the sageideas Supabase project's SQL editor.
2. Copy the entire contents of `supabase/scope_schema.sql` (it's additive —
   `create table if not exists`, safe to re-run) and execute it.
3. That creates `scope_proposals` (one row per draft/approved/paid proposal,
   keyed by an unguessable `public_id`) and `scope_projects` (one row per paid
   proposal, unique on `proposal_id` for idempotency). Both have RLS enabled
   with no policies — deny-all-anon; only the service-role key (server-side)
   can read or write them.

## The money path

1. **Draft** — After a visitor submits their email in Scope Studio
   (`assets/scope-studio.mjs`), the client fires a background `POST
   /api/proposal` with their capability-key selection. The server re-derives
   the price band from those keys (never trusts a client-sent total), creates
   a `draft_pending` row, and emails Jason a link to approve it.
2. **Approve** — Jason opens `/proposal-admin?key=SCOPE_ADMIN_TOKEN`, reviews
   the draft (price, scope note, expiry), and approves it. That calls `POST
   /api/proposal-approve`, which flips the row to `approved` and emails the
   client their proposal link.
3. **Client review** — The client opens `/proposal?id=PUBLIC_ID`
   (`assets/proposal.mjs`). It renders scope, price, and terms from
   `GET /api/proposal?publicId=…`. Draft proposals are invisible to clients
   (404); only `approved`, `deposit_paid`, and `expired` states render.
4. **Deposit** — The client accepts terms and clicks pay. `POST
   /api/proposal-checkout` records acceptance (name, timestamp, IP, terms
   version) and creates a Stripe Checkout session for the deposit amount,
   reusing an open session if one already exists.
5. **Webhook** — Stripe calls `POST /api/stripe-webhook` on
   `checkout.session.completed`. The handler marks the proposal paid
   (idempotent — `markPaidIfUnpaid` only transitions once) and creates the
   `scope_projects` row (also idempotent via a unique index on
   `proposal_id`), then emails both Jason and the client.

## Admin console

URL shape: `https://agency.sageideas.dev/proposal-admin?key=SCOPE_ADMIN_TOKEN`

The token is read from the URL's `key` query param (or an `x-admin-token`
header for API calls) and checked with a constant-time comparison
(`lib/admin-auth.mjs`). No token, or a mismatched one → "Not authorized." with
no partial data leaked.

## Registering the Stripe webhook

1. In the Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://agency.sageideas.dev/api/stripe-webhook`.
3. Events to send: `checkout.session.completed` and `charge.dispute.created`.
4. After creating it, open the endpoint and copy the **Signing secret**
   (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

## Local webhook testing

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and
   `stripe login`.
2. Run the dev server, then in a second terminal:
   ```
   stripe listen --forward-to localhost:PORT/api/stripe-webhook
   ```
   This prints a `whsec_…` value — set that as `STRIPE_WEBHOOK_SECRET` for
   local testing (it's different from the production endpoint's secret).
3. Walk the money path locally: draft a proposal → approve it in
   `/proposal-admin` → open `/proposal?id=…` → accept & pay with the Stripe
   **test card** `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
4. Confirm the CLI shows the forwarded `checkout.session.completed` event and
   that the proposal flips to `deposit_paid` in Supabase.

## Go-live checklist

- [ ] Swap `STRIPE_SECRET_KEY` from `sk_test_…` to `sk_live_…`.
- [ ] Register the **live-mode** webhook endpoint in the Stripe Dashboard and
      set `STRIPE_WEBHOOK_SECRET` to its (different) live signing secret.
- [ ] Pick a strong, random `SCOPE_ADMIN_TOKEN` (it's the only thing gating
      the operator console) and store it somewhere other than chat history.
- [ ] Confirm `SITE_URL` points at the real production domain (it's baked
      into email links and Stripe redirect URLs).

## Degrade behavior

Every step is designed to fail soft, never crash, never leak. Persistence
(`SUPABASE_URL`/`SUPABASE_SERVICE_KEY`) unset → all `POST` endpoints return
`200 { ok: false, skipped: true }` and `GET /api/proposal` returns `404`.
Stripe unset → checkout returns `200 { ok: false, skipped: true, reason:
'payments_off' }`. Admin token unset or wrong → `401`, fail-closed. The
static/no-backend case (no Vercel functions at all) looks identical to the
client: fetches fail, the client falls back to its offline copy.

## Known limitations (v1 debt)

- **Admin console auth is a URL-borne token, not a login.** `SCOPE_ADMIN_TOKEN`
  travels in the URL query string (`?key=…`) rather than behind a real
  authentication flow, and that same token is emailed to the operator's own
  inbox as part of the "new proposal to approve" notification. Acceptable for
  a single-operator v1; would need a real login before adding more operators.
- **Balance collection is not automated.** The remaining balance after the
  deposit is recorded (`balance_cents`) but invoiced and collected manually —
  no automated second charge.
- **No PDF generation.** Proposals are web-only; there's no downloadable or
  emailable PDF of the scope/price/terms.
- **No Stripe Tax.** Checkout sessions don't compute or collect tax.
- **No refunds UI.** Refunds (deposit refundable before work begins, per the
  terms copy) are handled manually in the Stripe Dashboard, not from the
  admin console.

These are deferred per the original spec (§12) — intentional v1 scope cuts,
not oversights.
