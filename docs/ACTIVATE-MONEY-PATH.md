# Activate the money path

One runbook to take agency.sageideas.dev from "funnel is built but dark" to "can take a
real deposit today." Everything in code is already built, tested (141 unit + smoke green),
and security-reviewed. What's left is **operator config only** — keys, one SQL file, one
webhook. Nothing here requires a code change.

The flow you're lighting up:

```
scope studio → AI qualification → proposal draft → you approve (/proposal-admin)
  → client views (/proposal) → Stripe deposit → webhook → client portal + auto-contract
  → (optional) nurture follow-up emails
```

## Current state

Check any time: `curl -s https://agency.sageideas.dev/api/health`

```
llm:true  resend:true  admin:true  site_url:true      ← already live
supabase:false  stripe:false  stripe_webhook:false    ← the money path (this doc)
nurture:false                                          ← optional, gated (step F)
```

Every subsystem fails **soft** when off (returns `{skipped:true}`, never a 500), so the
site stays at Lighthouse 100 while dark. Setting the keys is what turns each `false` → `true`.

---

## A. Database (once)

1. Open the **sageideas** Supabase project → SQL editor.
2. Paste the entire contents of [`supabase/scope_schema.sql`](../supabase/scope_schema.sql) and run it.
   - Additive + idempotent (`create table if not exists`, `add column if not exists`) — safe to re-run.
   - Creates all 9 `scope_*` tables with **RLS on and no policies = deny-all to anon**; the
     server uses the service-role key which bypasses RLS. Nothing is publicly readable.

> Requires the Supabase project to be **active**. Free tier auto-pauses idle projects — a
> paused DB = a payment funnel that sleeps. Upgrade the org to Pro (~$25/mo) for a dedicated,
> always-on project if it isn't already. (This is the one recurring cost gating the back-half.)

## B. Environment variables (Vercel → jt-portfolio → Settings → Environment Variables)

Set these, then redeploy (env changes apply on next build). **Exact names — the code reads
these verbatim; a typo'd name silently stays dormant.**

| Var | Value | Where to get it |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | `eyJ…` (service_role secret) | Supabase → Project Settings → API → **service_role** secret. Server-only — never ships to the browser. |
| `STRIPE_SECRET_KEY` | `sk_test_…` (test first) | Stripe → Developers → API keys |
| `SCOPE_ADMIN_TOKEN` | a long random string | Generate one (e.g. `openssl rand -hex 32`). This is the **only** gate on `/proposal-admin` — make it strong. |
| `SITE_URL` | `https://agency.sageideas.dev` | (already set — leave it) |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO` | — | (already set — leave them) |

> Not `SUPABASE_SERVICE_ROLE_KEY`. Not `KV_REST_API_*`. The code reads `SUPABASE_SERVICE_KEY`.

## C. Stripe webhook

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**.
2. Endpoint URL: `https://agency.sageideas.dev/api/stripe-webhook`
3. Events to send — exactly these two (the handler only acts on these):
   - `checkout.session.completed`
   - `charge.dispute.created`
4. Copy the endpoint's **Signing secret** (`whsec_…`) → set `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy.

## D. Verify BEFORE taking real money

1. **Health:** `curl -s https://agency.sageideas.dev/api/health` — confirm `supabase`,
   `stripe`, `stripe_webhook`, `resend`, `admin`, `site_url` are all `true`.
2. **End-to-end (test mode):**
   ```bash
   node scripts/e2e-moneypath.mjs --url https://agency.sageideas.dev --admin-token "$SCOPE_ADMIN_TOKEN"
   ```
   Drives scope → draft → approve → client view → checkout, then prints a Stripe Checkout URL.
3. **Pay it** with test card `4242 4242 4242 4242` (any future expiry / any CVC / any ZIP).
4. **Confirm the webhook flipped it:**
   ```bash
   node scripts/e2e-moneypath.mjs --url https://agency.sageideas.dev --verify-paid <publicId>
   ```
   Asserts the proposal moved to `deposit_paid`. If it did, the whole close→cash→deliver
   chain works.

## E. Go live (switch from test to real charges)

1. Swap `STRIPE_SECRET_KEY` → `sk_live_…`.
2. Register a **separate live-mode** webhook endpoint (same URL, same two events) and set
   `STRIPE_WEBHOOK_SECRET` to its **live** signing secret (it's different from the test one).
3. Redeploy. Re-run step D against a small real card once if you want end-to-end proof, then refund it.

You can now take deposits.

---

## F. Nurture follow-up (optional — keep OFF until deliverability is clean)

Do **not** enable this until sending mail lands in inboxes, or you'll train spam filters
against your domain.

1. Verify the sending domain in Resend; set `RESEND_FROM` to that domain; configure
   **SPF + DKIM + DMARC**; send a test that lands in the inbox (not spam).
2. Set `CRON_SECRET` (Vercel Cron passes it automatically as `Authorization: Bearer`).
3. Only then set `NURTURE_ENABLED=true` (must equal the exact string `true`).

The daily cron (`0 14 * * *`, in `vercel.json`) then sends ≤1 gentle, idempotent, one-click-
unsubscribable touch per due prospect. Kill switch: unset `NURTURE_ENABLED` (or set anything
but `true`).

## Hardening (recommended, not required for first payment)

- **Durable rate limiting:** set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
  (free Upstash DB) — the limiter switches to shared Redis automatically. See `docs/PRODUCTION.md`.
- **Error tracking:** `SENTRY_DSN` (silent no-op when unset).
- **Uptime + webhook alerts:** point an uptime monitor at `/api/health`; enable Stripe's
  webhook-delivery-failure email alerts (the webhook always ACKs 200 to avoid retry storms,
  so a transient DB error won't be visible in `/api/health` — the Stripe alert catches it;
  writes are idempotent, so a manual replay from the Stripe dashboard self-heals).

## What only you can do (I can't)

Billing upgrades, grabbing secret keys from dashboards, setting Vercel env, and registering
the Stripe webhook are all account-gated to you. Everything else — schema, code, tests,
verify script — is done and waiting.
