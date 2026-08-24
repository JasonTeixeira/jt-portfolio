# Client Portal + Contracts — Operator Guide

Once a deposit is paid, the client gets a private portal to track delivery —
milestones, approvals, payment status — and a tailored contract generated
from their approved proposal that they review and accept online. This doc is
the operator runbook for that delivery layer. It sits downstream of
`docs/PROPOSALS.md` (scope → proposal → deposit) — start there if you need
the money path first.

> ⚠️ **Legal caveat — read this before generating a contract.** Generated
> contracts (SOW/MSA) are **drafting templates, not executed legal advice**.
> They fill in scope, fees, and dates from the proposal — nothing is invented
> — but neither party should treat a generated document as final. **Both
> parties should have it reviewed by counsel before signing.** This caveat
> is also rendered on every contract page the client sees
> (`CONTRACT_CAVEAT` in `assets/contract-core.mjs`) — it is not optional and
> should never be removed.

## The flow

1. **Deposit paid** — Stripe webhook (`api/stripe-webhook.js`) flips the
   proposal to `deposit_paid`, creates the `scope_projects` row, and calls
   `ensurePortalToken(projectId)` to mint (or reuse) a random portal token.
   The client's receipt email includes their portal link:
   `${SITE_URL}/portal.html?id=<portal_token>`.
2. **Operator generates the contract** — from `/proposal-admin.html?key=…`,
   open the paid proposal and click **Generate SOW** and/or **Generate MSA**.
   Each builds the document from the proposal's own numbers (client name,
   project name, scoped keys, deposit/balance/total in cents) via
   `buildSow`/`buildMsa` in `assets/contract-core.mjs` — no figures are
   typed in by hand or invented. The contract is created in `draft` status
   (invisible to the client).
3. **Operator sends it** — click **Send to client**. This flips the contract
   to `sent` and emails the client the link:
   `${SITE_URL}/contract.html?id=<public_id>`.
4. **Operator seeds milestones** — in the same proposal's **Milestones**
   card, add rows (title, deliverables, amount, sequence, due date) via
   **Add milestone**. As work finishes, click **Mark delivered** on each one.
5. **Client reviews and acts** — on `portal.html?id=<portal_token>` the
   client sees their plan, the milestone timeline, and payment summary; on a
   `delivered` milestone they can type their name and click **Approve
   delivery**. On `contract.html?id=<public_id>` they read the full
   document (with the caveat banner always visible), then type their name,
   check "I have read and agree," and click **Accept agreement**.

```
deposit paid ──► portal link emailed ──► operator generates SOW/MSA
                                              │
                                              ▼
                                        operator sends contract
                                              │
                     ┌────────────────────────┴───────────────────────┐
                     ▼                                                ▼
        operator seeds + delivers milestones            client reviews + accepts contract
                     │                                                │
                     ▼                                                ▼
        client approves delivered milestones             contract.status = accepted
```

## Operator steps (admin console)

All calls from `proposal-admin.html` carry the `x-admin-token` header — every
action below fails closed (401) without a valid `SCOPE_ADMIN_TOKEN`.

1. Open `https://agency.sageideas.dev/proposal-admin.html?key=SCOPE_ADMIN_TOKEN`.
2. Click into a proposal that's at least `deposit_paid` (contracts and
   milestones only make sense once there's a project).
3. **Generate SOW** / **Generate MSA** → `POST /api/contract-generate`
   `{proposalId, kind}` → creates a draft contract, returns its client link.
4. **Send to client** → `POST /api/contract-send` `{id}` → flips the
   contract to `sent`, emails the client the `contract.html` link.
5. **Add milestone** → `POST /api/milestone` `{projectId, title,
   deliverables, amountCents, seq, dueAt}` → appears in the client portal
   immediately as `pending`.
6. **Mark delivered** (per milestone) → `POST /api/milestone`
   `{id, action:'deliver'}` → flips to `delivered`, which unlocks the
   client's **Approve delivery** control on that row.

## Client experience

- **`portal.html?id=<portal_token>`** — the project's plan (itemized from the
  scoped catalog keys, display-only), the milestone timeline with status
  badges (`pending → in_progress → delivered → approved`), an approve
  control on any `delivered` milestone, the deposit-paid/balance-due
  summary, and — once a contract has been sent — a link to it.
- **`contract.html?id=<public_id>`** — the full SOW or MSA text, the legal
  caveat banner, and (if not yet accepted) a name + checkbox + **Accept
  agreement** control. Once accepted, the page shows the acceptance
  confirmation instead of the form. Print-clean (`@media print`) so the
  client can save it as a PDF.
- Both pages are `noindex`, unguessable-token-gated, and degrade to a calm
  "isn't available" state (never a broken page) for a missing/bad/dormant
  id — see `#portal-root` / `#contract-root` in each `.mjs`.

## Env vars

Nothing new — this reuses the same switchboard as the rest of the pipeline
(`docs/SYSTEM.md` §4):

| Var | What it turns on here |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | `scope_projects.portal_token`, `scope_milestones`, `scope_contracts` persistence. Absent ⇒ every portal/contract/milestone endpoint 200-skips (`{ok:false,skipped:true}`), pages show "isn't available." |
| `SCOPE_ADMIN_TOKEN` | Gates `/api/contract-generate`, `/api/contract-send`, `/api/milestone` writes, and the proposal-admin UI. Absent/mismatched ⇒ 401 fail-closed. |
| `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` | The portal-link line in the deposit receipt email, and the "your contract is ready" email on send. Absent ⇒ emails skip silently (operator still sees the link in the admin console). |
| `SITE_URL` | Builds the absolute `portal.html`/`contract.html` links in emails. Falls back to `https://agency.sageideas.dev`. |

## Dormant → live

This layer is **schema-gated, not code-gated** — the endpoints and pages
already ship and degrade cleanly with Supabase off. To make it live:

1. Re-run `supabase/scope_schema.sql` in the Supabase SQL editor — it's
   additive (`create table if not exists` / `alter table … add column if not
   exists`), safe to re-run, and includes the `portal_token` column on
   `scope_projects` plus the new `scope_milestones` and `scope_contracts`
   tables (RLS enabled, deny-all-anon, service-role key only).
2. Confirm `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` are set (same project as
   the rest of Scope Studio/proposals — no separate project needed).
3. Everything above activates automatically on the next deploy: the webhook
   starts minting portal tokens, and the admin console's Generate/Send/
   Milestone controls start writing instead of 200-skipping.

## Testing it

```bash
npm run test:unit          # pure logic: contract-core, portal-db degrade-shapes
npm run lint
npx playwright test tests/smoke.spec.js --project=desktop
```

Full path once Supabase is live: pay a deposit (test card
`4242 4242 4242 4242` per `docs/PROPOSALS.md`) → confirm the portal link in
the client's receipt email → open `/proposal-admin.html?key=…` → generate +
send a contract → add + deliver a milestone → open the client's
`portal.html?id=…` and approve the milestone → open `contract.html?id=…`
and accept it → confirm both flip status in Supabase.

## Related docs

- `docs/PROPOSALS.md` — the money path upstream of this (scope → proposal →
  deposit).
- `docs/SYSTEM.md` — the full pipeline map, env switchboard, and dormant→live
  checklist.
- `docs/SUPABASE.md` — schema/persistence setup shared by every stage.
