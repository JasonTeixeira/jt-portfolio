# Production readiness

Checklist for taking the Scope Studio → proposal → deposit → portal pipeline from "works" to "production-grade." DONE items ship in this repo with no external account needed; TODO items need an owner-held account (Sentry, an uptime monitor, Upstash, Supabase Pro) and are documented here so wiring them is a config change, not a redesign.

## Health check — DONE ✓

`GET /api/health` (`api/health.js`) reports which subsystems are **configured**, as booleans only — never a secret value, key prefix, or error string that could leak one:

```json
{
  "ok": true,
  "ts": "2026-08-24T00:00:00.000Z",
  "subsystems": {
    "llm": false,
    "supabase": false,
    "stripe": false,
    "stripe_webhook": false,
    "resend": false,
    "admin": false,
    "nurture": false,
    "site_url": false
  }
}
```

Always 200 on `GET` (405 on anything else) — it's a probe, not a business endpoint, so "not wired yet" is a normal state, not an HTTP error.

Point an uptime monitor at it (see below), and use it as the first step of any wiring check: after setting env vars in Vercel, hit `/api/health` before running the live E2E script — if `subsystems.supabase` is still `false`, the env var didn't take (wrong environment, typo, or a deploy that hasn't picked it up yet).

Covered by `tests/unit/api-health.test.mjs`.

## Monitoring & alerting — TODO (needs accounts)

**Sentry** (error tracking). Add the dependency and env var, then guard every function so a missing DSN is a silent no-op (never a hard dependency):

```bash
npm install @sentry/node
```

```js
// lib/sentry.mjs
let _inited = false;
export async function captureError(err, context = {}) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // no DSN configured — no-op, never throws
  try {
    const Sentry = await import('@sentry/node');
    if (!_inited) { Sentry.init({ dsn, tracesSampleRate: 0 }); _inited = true; }
    Sentry.captureException(err, { extra: context });
  } catch { /* never let telemetry break the request */ }
}
```

```js
// in any api/*.js handler
import { captureError } from '../lib/sentry.mjs';
try {
  // ...
} catch (err) {
  await captureError(err, { route: 'proposal-checkout' });
  return res.status(200).json({ ok: false, skipped: true });
}
```

Set `SENTRY_DSN` in Vercel (Production only, or Production + Preview) once you have a project. `tracesSampleRate: 0` keeps this error-only — flip it up if you want performance tracing later.

**Uptime monitor.** UptimeRobot or BetterStack free tier, two checks:
- `GET /api/health` — alerts if the API layer itself is down or a subsystem silently drops from configured to unconfigured (env var got removed).
- `GET /` (homepage) — alerts on a full site outage independent of the API.

**Stripe webhook failures.** Stripe Dashboard → Developers → Webhooks → your endpoint → enable email alerts on delivery failure. This catches the case `/api/health` cannot: the endpoint is configured (`stripe_webhook: true`) but Stripe itself is failing to deliver events (wrong URL, expired secret, 5xx from us).

**Nurture cron digest.** Already implemented — see `docs/NURTURE.md` §3 rule D: the daily cron only emails you when there's something to report (pending drafts, sends, or errors), which doubles as a partial heartbeat. For true uptime monitoring of the cron process itself, rely on Vercel's cron execution logs, not the digest email.

## Rate limiting — TODO

The in-memory `Map` throttles (`api/chat.js`, `api/lead.js`, `api/proposal.js`, `api/proposal-checkout.js`, `api/scope.js`) are **no-ops on Vercel serverless** — every cold start gets a fresh `Map`, and concurrent invocations don't share one at all. They only slow down a single warm instance hammered in a tight loop; they do not protect against real abuse.

Swap to a shared store. `@vercel/kv` (Upstash Redis under the hood) is the natural fit since this already deploys to Vercel:

```bash
npm install @vercel/kv
```

```js
// lib/ratelimit.mjs
import { kv } from '@vercel/kv';

export function isEnabled() { return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN); }

// Fixed-window counter. Fails OPEN (never blocks a request) if KV is
// unreachable — availability over strictness for a marketing/lead-gen site.
export async function limited(key, { max, windowSeconds }) {
  if (!isEnabled()) return false;
  try {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, windowSeconds);
    return count > max;
  } catch {
    return false;
  }
}
```

```js
// in api/proposal-checkout.js, replacing the in-memory throttled(req) check
import { limited } from '../lib/ratelimit.mjs';
const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
if (await limited(`rl:proposal-checkout:${ip}`, { max: 20, windowSeconds: 60 })) {
  return res.status(429).json({ ok: false, error: 'slow_down' });
}
```

Apply the same pattern to the other public POST endpoints: `/api/scope`, `/api/lead`, `/api/proposal`, `/api/proposal-checkout`, `/api/chat`, `/api/contract`, `/api/portal`. Keep the existing in-memory `Map` checks in place as a free first-pass filter (cheap, catches the worst single-instance loops) and layer KV on top rather than ripping them out — belt and suspenders, and `limited()` fails open so KV being down never turns into an outage.

## Deliverability — TODO (hard gate before enabling nurture)

Verify the Resend sending domain (SPF, DKIM, DMARC) **before** flipping `NURTURE_ENABLED=true`. Sending unauthenticated mail at volume is how a domain lands in spam/blocklists — and once that happens, transactional email (proposal links, receipts, portal links) degrades too, not just nurture. See `docs/NURTURE.md` §4 (kill switch) and §6 (deliverability gate) for the full checklist and rollout sequencing.

## The live E2E test — DONE ✓ (script), run manually

`scripts/e2e-moneypath.mjs` exercises the real deployed pipeline stage by stage: health → scope event → draft proposal → admin approve → client-visible proposal → Stripe checkout session. It never hardcodes secrets — you supply the admin token as a flag or env var, same as any operator credential.

```bash
node scripts/e2e-moneypath.mjs --url https://agency.sageideas.dev --admin-token "$SCOPE_ADMIN_TOKEN"
```

Against a dormant deployment (Supabase not yet wired) it stops cleanly after the health check with `back-half dormant — wire Supabase to run the full path` and exits `0` — there's nothing to test yet, and that's not a failure.

Once Supabase + Stripe are wired, it runs the full path and, on success, prints a Stripe Checkout URL plus the one step it cannot automate — the actual card charge:

```bash
# complete the printed URL with the Stripe test card 4242 4242 4242 4242, then:
node scripts/e2e-moneypath.mjs --url https://agency.sageideas.dev --verify-paid <publicId>
```

`--verify-paid` confirms the webhook actually fired end-to-end: `checkout.session.completed` → `markPaidIfUnpaid` → `deposit_paid` status → project created → portal token issued → receipt/portal email sent (`api/stripe-webhook.js`).

## Backups / DR — TODO (needs Supabase Pro)

Enable Point-in-Time Recovery (PITR) on the Supabase project and **test a restore** — an untested backup is not a backup. Data that matters, in order of how bad losing it would be:

1. `scope_proposals` — firm price, deposit, acceptance name/IP/timestamp, Stripe session/payment-intent ids. This is the money and legal-acceptance record.
2. `scope_projects` / `scope_milestones` — portal token, delivery/approval state for active client work.
3. `scope_contracts` — sent/accepted contract records.
4. `scope_prospects` / `scope_events` / `scope_plans` — marketing/pipeline history; regenerable-ish but expensive to lose.
5. `scope_nurture_sends` — dedupe ledger; losing it risks duplicate nurture sends on restore, not data loss per se.

## CI — DONE ✓

`.github/workflows/*.yml` already runs on every push/PR to `main`: unit tests (`npm run test:unit`), Playwright smoke + a11y (desktop & mobile), and a Lighthouse budget gate. Dependabot (`.github/dependabot.yml`, added alongside this doc) now files weekly PRs for npm and GitHub Actions dependency updates, grouped so dev-dependency bumps don't spam separate PRs.

## Summary

| Area | Status |
|---|---|
| Health/status endpoint | DONE ✓ — `/api/health` |
| Dependency scanning | DONE ✓ — Dependabot, weekly |
| Live E2E money-path script | DONE ✓ — `scripts/e2e-moneypath.mjs`, run manually |
| CI (unit + Playwright + Lighthouse) | DONE ✓ — already wired |
| Error tracking (Sentry) | TODO — needs `SENTRY_DSN` |
| Uptime monitoring | TODO — needs UptimeRobot/BetterStack account |
| Stripe webhook failure alerts | TODO — flip on in Stripe Dashboard |
| Durable rate limiting | TODO — needs `@vercel/kv` (Upstash) |
| Resend domain auth (SPF/DKIM/DMARC) | TODO — hard gate before `NURTURE_ENABLED=true` |
| Backups / DR | TODO — needs Supabase Pro PITR + a tested restore |
