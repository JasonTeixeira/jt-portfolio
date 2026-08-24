# Client Portal + Auto-Contracts (Plan 6) — Design Spec

**Status:** approved, 2026-08-23
**Extends:** the proposal/deposit system (Plan 5) + the vault legal suite.
**Goal:** the institutional delivery layer — after a client pays a deposit, they get (1) a premium **client portal** showing their project's milestones, deliverables, approvals, and payment status, and (2) a **contract auto-generated from their proposal** (SOW/MSA filled with their real scope) that they view and accept online. Dormant-safe: ships live, activates only when Supabase is wired.

---

## 1. The flow

```
deposit paid (Plan 5) ──► scope_projects row + portal_token
   │  client emailed a portal link: /portal.html?id=<portal_token>
   ▼
CLIENT PORTAL (portal.html)  — token-gated, read-mostly
   • project status + the plan they bought
   • MILESTONES (seq, title, deliverables, status, amount) with an "Approve" action per delivered milestone
   • payment status (deposit paid, balance due)
   • their CONTRACT (view + accept)
   │
   ▼  operator side (proposal-admin, token-gated)
JASON: generate contract from a proposal · seed/edit milestones · mark a milestone "delivered"
   │
   ▼
CONTRACT (contract.html?id=<contract_public_id>)  — client views the tailored SOW/MSA, types name + agrees → recorded acceptance
```

## 2. Grounding / safety guarantees (carry from Plan 5)
- **Degrade-safe, never 5xx:** every endpoint returns a clean 2xx/4xx when Supabase is absent (dormant). Admin/operator endpoints fail-closed 401 without `SCOPE_ADMIN_TOKEN`.
- **No client-set money:** milestone amounts + contract price come from the persisted proposal/admin, never client input. The client can only *approve* a milestone, never set its value.
- **Acceptance artifact:** contract acceptance records name + timestamp + IP + terms_version (dispute-proof, same as the proposal accept).
- **Tokens unguessable:** `portal_token` and `contract public_id` are ≥128-bit random. Drafts/unsent contracts are invisible to the client.
- **RLS deny-all-anon; service-role only.** XSS: all dynamic text via `textContent`.
- **Legal caveat baked in:** the generated contract renders a visible "template — not legal advice; both parties should have counsel review" line, and the code/docs repeat it. This is a drafting aid, not executed legal counsel.

## 3. Data — append to `supabase/scope_schema.sql`
```sql
alter table scope_projects add column if not exists portal_token text;
create unique index if not exists scope_projects_portal on scope_projects(portal_token) where portal_token is not null;

create table if not exists scope_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references scope_projects(id) on delete cascade,
  seq int not null default 0,
  title text not null,
  deliverables text,                 -- freeform / newline-separated
  amount_cents int not null default 0,
  status text not null default 'pending',   -- pending | in_progress | delivered | approved
  due_at timestamptz,
  delivered_at timestamptz,
  approved_at timestamptz,
  approved_name text,
  created_at timestamptz not null default now()
);
create index if not exists scope_milestones_project on scope_milestones(project_id, seq);

create table if not exists scope_contracts (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,     -- unguessable client URL slug
  proposal_id uuid references scope_proposals(id) on delete set null,
  project_id uuid references scope_projects(id) on delete set null,
  kind text not null default 'sow',   -- sow | msa
  body jsonb not null,                -- the filled contract snapshot (sections/values at generation time)
  terms_version text not null,
  status text not null default 'draft',  -- draft | sent | accepted | declined
  client_email text,
  accepted_name text,
  accepted_at timestamptz,
  accept_ip text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at2 timestamptz
);
create unique index if not exists scope_contracts_public on scope_contracts(public_id);
alter table scope_milestones enable row level security;
alter table scope_contracts enable row level security;
-- deny-all-anon; service role bypasses.
```

## 4. Pure core — `assets/contract-core.mjs` (unit-tested)
```
CONTRACT_TERMS_VERSION = '2026-08-23'
CONTRACT_CAVEAT = 'This is a drafting template generated from your proposal, not executed legal advice. Both parties should have it reviewed by counsel before signing.'
publicId()                              // reuse the base62 random from proposal-core (or import it)
buildSow({ clientName, clientEmail, projectName, keys, segment, firmCents, depositCents, balanceCents, milestones, nowIso })
     → { kind:'sow', sections:[{heading, body}], meta:{...} }   // fills the SOW template from proposal data; deliverables derived from computePlan(keys) items
buildMsa({ clientName, nowIso })        → { kind:'msa', sections:[...] }   // the umbrella terms (from the vault MSA), client-name filled
money(cents)                            // display
```
The section text is the vault legal suite (MSA/SOW), parameterized. No prices invented — all from the passed proposal figures.

## 5. Gateways — `lib/portal-db.mjs` (degrade-safe `{ok,skipped}`)
```
isEnabled()                             // reuse SUPABASE_* 
getProjectByPortalToken(token)          // project + its proposal (for the plan/price)
ensurePortalToken(projectId)            // generate+persist if null; returns token
listMilestones(projectId)
upsertMilestone(row)                    // operator
approveMilestone(id, name)              // client: set status=approved, approved_at, approved_name — only if currently 'delivered'
markDelivered(id)                       // operator
createContract(row) / getContractByPublicId(id) / getContractsForProposal(proposalId)
sendContract(id) / acceptContract(id, {name, ip})   // accept only if status='sent'
```

## 6. Endpoints (ESM, degrade-safe, method-guarded)
- **`GET /api/portal?id=<portal_token>`** — client portal read. Returns whitelisted `{ project:{status}, plan:{keys,segment,firm_cents,deposit_cents,balance_cents,paid_at}, milestones:[{seq,title,deliverables,amount_cents,status,due_at}], contract:{public_id,status} }`. No ids/emails/ip/tokens leaked. 404 (200 `{ok:false}` body per client-page convention) if not found.
- **`POST /api/portal` action=approve_milestone** `{ portalToken, milestoneId, name }` — client approves a *delivered* milestone. Records approver name. 200.
- **`GET /api/contract?publicId=<id>`** — client contract read (only `status in sent/accepted`; draft → not found). Returns the `body` sections + status + caveat.
- **`POST /api/contract` action=accept** `{ publicId, name, agreed:true }` — records acceptance (name/at/ip/terms_version) if `status='sent'`. 200.
- **`POST /api/contract/generate`** (admin, token) `{ proposalId, kind }` — builds SOW/MSA from the proposal via contract-core, inserts `scope_contracts` (status draft), returns `{ publicId }`.
- **`POST /api/contract/send`** (admin) `{ id }` — status→sent, emails the client the link. 
- **`POST /api/milestone`** (admin) — upsert/mark-delivered milestones for a project.
- All admin actions: `checkToken` fail-closed 401. All degrade to 200-skip when DB off.

## 7. Client pages (premium, institutional design)
- **`portal.html` + `assets/portal.mjs`** — the client portal. `?id=<portal_token>`. A clean, premium dashboard: project header + status chip, a **milestone timeline** (seq, title, deliverables, status badges pending→in_progress→delivered→approved, amount), an **Approve** button on delivered milestones (records their name), a **payment summary** (deposit paid / balance due via `money()`), and a **contract** card (view/accept link). States: not-found (calm), dormant. `<meta noindex>`. Print-clean. This is the "wow" — make it feel like a top-tier client portal (Linear/Stripe-dashboard calibre) on the JT dark system.
- **`contract.html` + `assets/contract.mjs`** — `?id=<contract_public_id>`. Renders the tailored contract sections cleanly (SOW/MSA), the caveat banner, and an **accept** block (typed full name + "I agree" + Accept). On accept → POST → confirmation. Print/PDF-clean (`@media print`) so the client can save it. noindex.

## 8. Operator surface
Extend `proposal-admin.html` + `assets/proposal-admin.mjs` (already token-gated): on an approved/paid proposal's detail, add **"Generate SOW"** / **"Generate MSA"** (→ /api/contract/generate → shows the client link + a Send button), and a **Milestones** editor (add rows: title, deliverables, amount, due; "mark delivered" per row → /api/milestone). Keep it token-gated + textContent-safe.

## 9. Wire-in
On `deposit_paid` (Plan 5 webhook), also `ensurePortalToken(projectId)` and include the portal link `${SITE}/portal.html?id=<token>` in the client receipt email. (Additive to the existing webhook client email.)

## 10. Security surface (security-reviewer MUST review)
Admin fail-closed constant-time token; client can only approve *delivered* milestones and cannot set amounts; contract/milestone amounts server-persisted only; acceptance artifact stored; tokens ≥128-bit; drafts invisible; field-whitelist on all client reads; idempotent accept/approve; RLS deny-all; legal caveat present; no PII leak; XSS textContent-only.

## 11. Testing
Unit: contract-core (buildSow/buildMsa fill correctly, no invented price, caveat present, publicId); portal-db disabled-shape; each endpoint's pure `validate`/token-check; whitelist. Smoke: portal.html + contract.html with no backend → graceful unavailable, no console error (extend the ignore to `/api/(portal|contract|milestone)`). Live money/flow test is operator-run once Supabase is live (documented in docs/PORTAL.md).

## 12. Out of scope (named)
Real e-signature integration (DocuSign) — the click-accept + recorded artifact is v1; a true balance-invoice/payment collection UI (record only); file/deliverable uploads/storage; client login accounts (token-link is v1); real-time updates.

## 13. Files
Create: `assets/contract-core.mjs`, `lib/portal-db.mjs`, `api/portal.js`, `api/contract.js`, `api/contract-generate.js`, `api/contract-send.js`, `api/milestone.js`, `portal.html`, `assets/portal.mjs`, `contract.html`, `assets/contract.mjs`, `docs/PORTAL.md`, unit tests.
Modify: `supabase/scope_schema.sql`, `assets/proposal-admin.html`+`.mjs` (operator surface), `api/stripe-webhook.js` (portal token + link), `tests/smoke.spec.js`, `docs/SYSTEM.md` (add the delivery stage).
