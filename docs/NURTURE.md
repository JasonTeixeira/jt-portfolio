# Nurture (Subsystem C)

Automated, low-volume follow-up emails for leads and proposals that would otherwise go cold. One daily cron tick evaluates state, sends at most one due touch per prospect/proposal, and records it. Dormant until deliberately enabled — ships live and sends nothing by default.

Design spec: `docs/superpowers/specs/2026-08-19-scope-studio-p4-nurture-design.md`.

## 1. Env setup

| Var | Purpose | Absent ⇒ |
|---|---|---|
| `NURTURE_ENABLED` | must equal the string `'true'` to send anything | cron runs, sends nothing, returns `{ok:true, skipped:true, reason:'disabled'}` |
| `CRON_SECRET` | authorizes `GET/POST /api/cron/nurture`; compared against `Authorization: Bearer <secret>` (Vercel Cron sends this automatically) | cron endpoint returns 401 (fail-closed) |

Reused (already configured for proposals/leads):
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO`, `SITE_URL`, `SCOPE_ADMIN_TOKEN`.

Set both new vars in the Vercel project (Production + Preview as needed). Missing `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` also degrades the cron to a 200 skip, independent of the kill switch.

## 2. Applying the schema

The nurture tables/columns live in `supabase/scope_schema.sql`, appended to the existing scope schema. Apply it the same way you apply the rest of that file — run it against the Supabase project (SQL editor or `psql`/migration tool, whichever this repo already uses for `scope_schema.sql`). It is idempotent (`if not exists` / `add column if not exists`), so re-running it is safe.

What it adds:

- `scope_prospects.unsubscribed boolean not null default false`
- `scope_prospects.nurture_suppressed boolean not null default false`
- `scope_prospects.unsubscribe_token text`
- `scope_nurture_sends` table (`prospect_id`, `proposal_id`, `step`, `sent_at`), with unique partial indexes so a step can be sent at most once per proposal (or once per prospect for lead-scoped touches) — this is what makes re-runs and double-fires no-ops.
- RLS enabled on `scope_nurture_sends` with no policies (deny-all-anon; only the service-role key used by `lib/nurture-db.mjs` can read/write it).

## 3. Sequences and cadence

One tick per day evaluates four rules. Each rule sends a given step at most once, ever, per prospect or proposal (enforced by `sentSteps` lookups + the unique DB indexes).

| Key | Rule | Touch |
|---|---|---|
| A `lead_no_proposal` | prospect `stage='engaged'`, has email, sendable, `updated_at` ≥48h ago, and no proposal row exists for them (any status, including `draft_pending`) | copy branches on whether a `scope_plans` row exists: "turn your plan into a firm quote" vs. "want me to map out a build?" — links to `/build.html` + book |
| B1 `proposal_unpaid_1` | proposal `status='approved'`, not expired, has `client_email`, sendable, `approved_at` ≥3 days ago | "any questions before you decide?" → proposal link |
| B2 `proposal_unpaid_2` | same, `approved_at` ≥8 days ago | a second, lower-pressure nudge → proposal link |
| C `proposal_expiring` | `status='approved'`, `expires_at` within the next 3 days | heads-up that the quote expires on a given date → proposal link |
| D (operator digest) | `draft_pending` proposals older than 24h, plus the run summary | email to **you** (`RESEND_TO`): how many proposals are waiting, per-prospect one-click suppress links, and the tick's `sent`/`due`/`errors` counts |

Only the first unsent due step fires per run — a 9-day-unpaid proposal that has never been touched sends B1 today and B2 on the next run, giving natural spacing instead of a burst. C takes priority over B1/B2 when both are due. Sequences B/C stop automatically the moment a proposal's status leaves `approved` (paid, expired, etc.). D has no unsubscribe concerns (it goes to you, not a prospect) and doubles as the cron heartbeat — it fires whenever there's something to report, even zero sends, so a silent cron is visible.

## 4. Kill switch

Nothing sends unless `NURTURE_ENABLED === 'true'` (exact string match). This is checked first, after auth, on every tick. Leave it unset (or anything other than `'true'`) to deploy the whole subsystem — schema, cron, endpoints, pages — without a single email going out. Flip it only after the deliverability gate below is satisfied.

## 5. Unsubscribe and operator suppress

**Prospect-facing unsubscribe:**
- Every nurture email ends with a plain-text unsubscribe line pointing at `GET /api/unsubscribe?token=<per-prospect token>`.
- Every nurture email also carries `List-Unsubscribe: <url>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (RFC 8058 one-click), required for Gmail/Yahoo bulk-sender deliverability — mailbox providers can unsubscribe the recipient without them ever opening the email.
- `GET /api/unsubscribe?token=…` sets `unsubscribed=true` and 302-redirects to `unsubscribe.html?done=1`; `POST` (what mail clients use for the one-click header) returns `{ok:true}` directly. Both are idempotent and always return success — an unknown token is a silent no-op, never an error that leaks whether a token is valid.
- `unsubscribe.html` is a static, self-contained confirmation page (no fetch calls — the endpoint already did the work before redirecting here).

**Operator suppress (manual valve for the reply blind-spot):**
- `GET /api/suppress?key=<SCOPE_ADMIN_TOKEN>&prospect=<id>` sets `nurture_suppressed=true` for that prospect. Admin-token gated (same check as `proposal-admin.html`), 401 on a bad/missing key.
- A suppress link (with the literal placeholder `YOUR_TOKEN` in the source — swap in the real `SCOPE_ADMIN_TOKEN` value when reading the email, never hardcode it) is included in:
  - the "new proposal to approve" operator alert (`api/proposal.js`), so you can kill follow-ups for a prospect the moment they reply to you directly, and
  - the daily digest (rule D), one link per stale draft.
- The engine excludes any prospect with `unsubscribed OR nurture_suppressed` from every sequence (`isSendable` in `assets/nurture-core.mjs`).

## 6. Cron schedule

Configured in `vercel.json`:

```json
"crons": [{ "path": "/api/cron/nurture", "schedule": "0 14 * * *" }]
```

Runs once daily at 14:00 UTC. Vercel Cron calls the endpoint with `Authorization: Bearer <CRON_SECRET>` automatically — no manual trigger needed once deployed with `CRON_SECRET` set. To test manually, replicate that header against the deployed URL (do not test against production without the kill switch off, unless you intend to send real mail).

## 7. Deliverability go-live gate — HARD requirement before enabling

**Do not set `NURTURE_ENABLED=true` in production until all of the following are done.** Automated mail sent from an unverified or misconfigured domain lands in spam and burns sender reputation for every future email from that domain — including the manual operator/client mail this repo already sends via `lib/notify.mjs`.

1. **Verify the sending domain in Resend.** Add and verify the domain you intend to send from (Resend dashboard → Domains). Do not send nurture mail from an unverified domain or a shared/default sandbox address.
2. **Set `RESEND_FROM` to an address on that verified domain.** It must match the domain you just verified — a mismatch defeats the point of verification.
3. **Configure SPF, DKIM, and DMARC** on that domain, using the DNS records Resend provides during verification. All three, not just one — SPF and DKIM alone still leave you exposed to inconsistent enforcement without a DMARC policy.
4. **Send a handful of test emails to real inboxes you control** (Gmail, a corporate/O365 address if available) after DNS propagates, and confirm they land in the inbox, not spam, before flipping the kill switch for real prospects.
5. Only after 1–4 are confirmed, set `NURTURE_ENABLED=true`.

Until this gate is cleared, keep `NURTURE_ENABLED` unset. The subsystem is designed to ship dormant specifically so this gate can be cleared on your schedule, not the deploy's.

## 8. Measuring lift

Every send is recorded in `scope_nurture_sends` (`prospect_id`, `proposal_id`, `step`, `sent_at`). To see whether a touch correlates with downstream action, join it against the tables that already record prospect/proposal activity:

- **Lead → view/plan after a nurture touch:** join `scope_nurture_sends` (`step = 'lead_no_proposal'`) to `scope_events` on `prospect_id`, filtering `scope_events` to events after `sent_at`, to see whether a nudged lead came back and built a plan or started a proposal.
- **Proposal → paid after a reminder:** join `scope_nurture_sends` (`step in ('proposal_unpaid_1','proposal_unpaid_2','proposal_expiring')`) to `scope_proposals` on `proposal_id`, comparing `sent_at` to `paid_at` — a `paid_at` shortly after a send is a candidate for attributed lift (not proof of causation, but a useful signal at this volume).
- **Digest effectiveness:** compare `scope_nurture_sends` counts to how many `draft_pending` proposals got approved within a day or two of a digest email, using `scope_proposals.created_at`/`status` history.

There is no built-in dashboard for this (explicitly out of scope — see the design spec §15); run these as ad hoc queries against Supabase when you want a read on whether the sequences are earning their keep.
