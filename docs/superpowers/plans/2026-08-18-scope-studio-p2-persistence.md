# Scope Studio — Plan 2: Persistence (Supabase spine) — Implementation Plan

> **Status:** SHIPPED — merged to main. Checklists below are historical.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Persist every scoping session (anonymous → named) into the **existing sageideas Supabase project**, so leads, plans, conversations, and funnel events become one queryable pipeline — the spine that C (nurture), D (outbound), and E (cockpit) all read. Ships **degradation-safe**: with no Supabase env set, the tool works exactly as today (mailto fallback, no persistence); the instant the env is present, persistence activates.

**Architecture:** All Supabase access is **server-side only**, inside new/extended `/api/*` serverless functions using `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (server env). The client holds an anonymous `prospect_id` (localStorage UUID) and POSTs events to `/api/scope`; it never sees a key. Tables are **namespaced `scope_*`** to coexist safely in the shared project. RLS denies all anon access. If env is absent, `/api/scope` returns 501 and the client silently continues (no user-visible failure).

**Tech Stack:** Vercel serverless (Node ESM, `@supabase/supabase-js`), the existing `assets/scope-studio.mjs` client, `node --test` + Playwright.

**Spec:** `docs/superpowers/specs/2026-08-18-scope-studio-design.md` (Subsystem B, §4.3, §6.2, §8, §11).

## Global Constraints

- **Server-side keys only.** `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` are read only in `/api/*`. The client bundle must contain neither. (Spec §11.)
- **Degradation-safe.** No Supabase env → `/api/scope` 501 → client continues with today's behavior. No user-visible error, ever. (Spec §3.)
- **Namespaced tables** `scope_prospects / scope_conversations / scope_plans / scope_events` to coexist in the shared sageideas project. **RLS deny-anon on all.**
- **No secret in git.** Env vars only; `.env*` gitignored. A `SUPABASE.md` documents the exact SQL + the two Vercel env vars for Jason.
- **No PII beyond volunteered.** Email only on explicit capture; a consent line at capture.
- **Existing tests stay green; Lighthouse 100; zero console errors.**

---

### Task 1: Supabase schema SQL + operator runbook (no code path yet)

**Files:**
- Create: `supabase/scope_schema.sql`
- Create: `docs/SUPABASE.md`

**Interfaces:** Produces the canonical table definitions Tasks 3-5 write to.

- [ ] **Step 1: Write the schema SQL.** `supabase/scope_schema.sql`:

```sql
-- Scope Studio persistence — namespaced to coexist in the shared sageideas project.
create extension if not exists "pgcrypto";

create table if not exists scope_prospects (
  id uuid primary key,                    -- equals the client's localStorage prospect_id
  email text,
  name text,
  company text,
  segment text,
  stage text not null default 'new',      -- new | scoped | engaged | won | lost
  qualification jsonb default '{}'::jsonb,
  source text default 'inbound',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists scope_plans (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references scope_prospects(id) on delete cascade,
  keys text[] not null default '{}',
  segment text,
  total_lo int, total_hi int,
  flags jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists scope_conversations (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references scope_prospects(id) on delete cascade,
  transcript jsonb not null default '[]'::jsonb,
  mode text,
  created_at timestamptz not null default now()
);
create table if not exists scope_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references scope_prospects(id) on delete cascade,
  type text not null,                     -- started | questioned | plan_built | lead_captured | handoff_clicked
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scope_plans_prospect on scope_plans(prospect_id);
create index if not exists scope_events_prospect on scope_events(prospect_id);
create index if not exists scope_prospects_stage on scope_prospects(stage);

-- RLS: deny anon entirely; only the service role (server-side) may touch these.
alter table scope_prospects enable row level security;
alter table scope_plans enable row level security;
alter table scope_conversations enable row level security;
alter table scope_events enable row level security;
-- (No policies created → anon/authed clients get zero access. Service role bypasses RLS.)
```

- [ ] **Step 2: Write `docs/SUPABASE.md`** — for Jason: "Run `supabase/scope_schema.sql` in the existing sageideas project's SQL editor. Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (service_role) to the jt-portfolio Vercel project env. That's it — persistence activates on next deploy." Include a one-paragraph note that the service key is server-only and never shipped to the client.

- [ ] **Step 3: Commit.**

```bash
git add supabase/scope_schema.sql docs/SUPABASE.md
git commit -m "feat(scope): Supabase schema + operator runbook (persistence, not yet wired)"
```

---

### Task 2: `lib/scope-db.mjs` — server-side Supabase gateway (env-guarded)

**Files:**
- Create: `lib/scope-db.mjs`
- Create: `tests/unit/scope-db.test.mjs`
- Modify: `package.json` (add `@supabase/supabase-js` dependency)

**Interfaces:**
- Produces: `isEnabled(): boolean` (true only if both env vars present); `getClient()` (memoized Supabase service client or null); `upsertProspect(row)`, `insertPlan(row)`, `appendEvent(row)`, `appendConversation(row)` — each a no-op returning `{ ok:false, skipped:true }` when `!isEnabled()`.

- [ ] **Step 1: Write the failing test** (env-absent path — the critical safety property):

```js
// tests/unit/scope-db.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, appendEvent } from '../../lib/scope-db.mjs';

test('disabled without env — never throws, reports skipped', async () => {
  // In CI there is no SUPABASE_URL/KEY, so the module must be inert.
  assert.equal(isEnabled(), false);
  const r = await appendEvent({ prospect_id: 'x', type: 'started' });
  assert.deepEqual(r, { ok: false, skipped: true });
});
```

- [ ] **Step 2: Run — fails** (`node --test tests/unit/scope-db.test.mjs`).

- [ ] **Step 3: Implement `lib/scope-db.mjs`:**

```js
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
let _client = null;

export function isEnabled() { return Boolean(URL && KEY); }
export function getClient() {
  if (!isEnabled()) return null;
  if (!_client) _client = createClient(URL, KEY, { auth: { persistSession: false } });
  return _client;
}
async function guard(fn) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { return { ok: true, data: await fn(getClient()) }; }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
export const upsertProspect = (row) => guard((c) => c.from('scope_prospects').upsert({ ...row, updated_at: new Date().toISOString() }).select().then((r) => r.data));
export const insertPlan = (row) => guard((c) => c.from('scope_plans').insert(row).then((r) => r.data));
export const appendEvent = (row) => guard((c) => c.from('scope_events').insert(row).then((r) => r.data));
export const appendConversation = (row) => guard((c) => c.from('scope_conversations').insert(row).then((r) => r.data));
```

- [ ] **Step 4: Run — passes.** (Optional: install `@supabase/supabase-js` so the import resolves in CI: `npm i @supabase/supabase-js`.)

- [ ] **Step 5: Commit.**

```bash
git add lib/scope-db.mjs tests/unit/scope-db.test.mjs package.json package-lock.json
git commit -m "feat(scope): env-guarded server-side Supabase gateway (inert without env)"
```

---

### Task 3: `/api/scope` endpoint — persist prospect/plan/event

**Files:**
- Create: `api/scope.js`
- Create: `tests/unit/api-scope-shape.test.mjs`

**Interfaces:**
- Consumes: `lib/scope-db.mjs` (Task 2).
- Produces: `POST /api/scope { prospectId, type, plan?, email? }` → validates, upserts prospect (+ email/segment when present), appends the event, and inserts a plan row when `plan` is provided. Returns `{ ok:true, skipped? }`. Returns 501 `{ ok:false, error:'not_configured' }` when `!isEnabled()`. 400 on bad body. Reuses the IP-throttle pattern from `api/chat.js`.

- [ ] **Step 1: Write a shape test** (validation is pure and testable without a live DB):

```js
// tests/unit/api-scope-shape.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../api/scope.js';   // export the pure validator

test('rejects missing prospectId or type', () => {
  assert.equal(validate({ type: 'started' }).ok, false);
  assert.equal(validate({ prospectId: 'a' }).ok, false);
});
test('accepts a well-formed event', () => {
  assert.equal(validate({ prospectId: 'a1b2', type: 'plan_built', plan: { keys: ['rag'] } }).ok, true);
});
test('rejects unknown event type', () => {
  assert.equal(validate({ prospectId: 'a', type: 'nope' }).ok, false);
});
```

- [ ] **Step 2: Run — fails.**

- [ ] **Step 3: Implement `api/scope.js`** — export a pure `validate(body)` plus the default handler that calls `scope-db`. Handler: `if (!isEnabled()) return res.status(501)...`; validate; `upsertProspect`; `appendEvent`; if `body.plan` `insertPlan`. Wrap DB calls so a DB error still returns 200 `{ ok:true }`-ish (never break the visitor's experience). Allowed `type` set = `started|questioned|plan_built|lead_captured|handoff_clicked`.

- [ ] **Step 4: Run — passes.**

- [ ] **Step 5: Commit.**

```bash
git add api/scope.js tests/unit/api-scope-shape.test.mjs
git commit -m "feat(scope): /api/scope persistence endpoint (501 without env, validated)"
```

---

### Task 4: Client wiring — anonymous prospect id + fire-and-forget events

**Files:**
- Modify: `assets/scope-studio.mjs`
- Modify: `tests/smoke.spec.js`

**Interfaces:**
- Consumes: `/api/scope` (Task 3).
- Produces: on first load the client mints/loads `prospect_id` (localStorage `scope_pid`); it POSTs `started` once, `plan_built` (debounced) with the plan's keys/segment/total on selection changes, and `handoff_clicked` when a handoff button is used. **All fire-and-forget** — `fetch(...).catch(()=>{})`; a failed/absent endpoint never affects the UI. No key ever in the client.

- [ ] **Step 1: Write a smoke test** proving persistence NEVER breaks the offline experience:

```js
// in tests/smoke.spec.js scope studio describe
test('persistence is fire-and-forget: /api/scope absent does not break the tool', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/build.html');                 // static server has no /api → 501/404
  await page.locator('.scope-opt[data-id="opt-eval"]').click();
  await expect(page.locator('#scope-plan')).toContainText('LLM evaluation harness');
  expect(errors).toEqual([]);                      // failed POST must not log a console error
});
```

- [ ] **Step 2: Run — fails** (until the fire-and-forget POST is added and proven not to error).

- [ ] **Step 3: Implement** — add a `track(type, extra)` helper: `const pid = localStorage.getItem('scope_pid') || (crypto.randomUUID && crypto.randomUUID()); localStorage.setItem('scope_pid', pid);` then `fetch('/api/scope', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prospectId: pid, type, ...extra })}).catch(()=>{});`. Call `track('started')` once at init; `track('plan_built', { plan: { keys, segment, total: plan.totalBand } })` (debounced ~600ms) in renderPlan when count>0; `track('handoff_clicked', {kind})` on the email/copy buttons. Guard `crypto.randomUUID` for old browsers (fallback to a Math.random-free timestamp+counter id derived once). **Important:** a 404/501 response is a resolved fetch (no console error); only a network failure logs — the `.catch` covers that.

- [ ] **Step 4: Run — passes.** Full `npx playwright test` green; `node --test tests/unit/` green.

- [ ] **Step 5: Commit.**

```bash
git add assets/scope-studio.mjs tests/smoke.spec.js
git commit -m "feat(scope): fire-and-forget prospect tracking (degradation-safe, no key in client)"
```

---

### Task 5: `/api/lead` — attach plan + link prospect; consent line

**Files:**
- Modify: `api/lead.js`
- Modify: `build.html` (consent microcopy at the handoff)
- Modify: `assets/scope-studio.mjs` (send prospectId + plan summary with the lead)

**Interfaces:**
- Consumes: `lib/scope-db.mjs`, `/api/scope` conventions.
- Produces: `/api/lead` also accepts `{ prospectId, plan }`; when Supabase is enabled it upserts the prospect's email + sets `stage='engaged'` + appends a `lead_captured` event; the operator email includes the scoped plan. Still returns `{ ok:true }` + keeps the mailto fallback. A one-line consent note appears near the handoff ("I'll email you the plan and may follow up about it — unsubscribe anytime").

- [ ] **Step 1: Write a validator test** for the extended lead body (email still required; prospectId/plan optional). Run — fails.
- [ ] **Step 2: Implement** the `api/lead.js` extension (guarded by `isEnabled()`; email send unchanged) + the client passing `prospectId` and a short plan summary + the consent microcopy in build.html.
- [ ] **Step 3: Run — passes.** Full suite green.
- [ ] **Step 4: Commit + push (deploy — degradation-safe, activates when env is set).**

```bash
git add api/lead.js build.html assets/scope-studio.mjs tests/smoke.spec.js
git commit -m "feat(scope): lead capture attaches plan + links prospect; consent line"
```

---

## Self-Review

- **Spec coverage:** §4.3 tables → Task 1; §6.2 `/api/scope` → Task 3; §6.3 `/api/lead` extension → Task 5; §8 memory (prospect_id) → Task 4; §11 security (server-only keys, RLS, consent) → Tasks 1-5. ✓
- **Degradation-safety** is asserted by an explicit test (Task 4 Step 1) — the single most important property. ✓
- **No key in client:** all DB access is in `lib/` + `api/`; the client only POSTs to `/api/scope` + `/api/lead`. ✓
- **Types:** `prospect_id`/`keys`/`total` shapes consistent across Tasks 1-5; `isEnabled/upsertProspect/insertPlan/appendEvent` names consistent Tasks 2→3→5. ✓
- **Activation is Jason's step** (run the SQL + set 2 Vercel env vars, per `docs/SUPABASE.md`) — the build ships dark and safe until then.

## Execution Handoff
Subagent-driven (recommended) — fresh subagent per task, review between, whole-branch review before merge. Merge/deploy is prod-safe (degradation-guaranteed) but still a shared-branch push → confirm with Jason at the gate.
