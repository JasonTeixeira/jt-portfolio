# Client Portal + Auto-Contracts (Plan 6) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** client portal (milestones/approvals/payment) + auto-generated tailored contracts, dormant-safe. **Spec:** `docs/superpowers/specs/2026-08-23-client-portal-contracts-design.md`.

## Global Constraints
- ESM, Node ≥22. Degrade-safe: missing Supabase ⇒ clean 200 `{ok:false,skipped:true}` (client GETs ⇒ 200 `{ok:false,reason}`); admin ⇒ 401 fail-closed. Never 5xx.
- No client-set money (milestone amounts/contract price server-persisted only; client can only APPROVE). Acceptance artifact recorded (name/at/ip/terms_version).
- Tokens ≥128-bit random; drafts invisible to client; client reads field-whitelisted. RLS deny-all. XSS: textContent only.
- Legal caveat visibly rendered on every contract.
- **These mirror Plan 5. Use the shipped files as exact patterns:** `lib/proposal-db.mjs` (gateway shape), `api/proposal.js` (client GET + validate + degrade), `api/proposal-admin.js`/`api/proposal-approve.js` (admin `checkToken` fail-closed), `proposal.html`+`assets/proposal.mjs` (client page states + accept), `assets/proposal-core.mjs` (pure money + publicId). Read them before writing the analogue.

---

### Task 1: Schema
Modify `supabase/scope_schema.sql` — append the block from spec §3 (portal_token on scope_projects + scope_milestones + scope_contracts + indexes + RLS). Commit `chore(p6): portal + milestones + contracts schema`.

---

### Task 2: `assets/contract-core.mjs` (pure) + tests
Create `assets/contract-core.mjs`, `tests/unit/contract-core.test.mjs`.

Import `publicId` + `money` from `./proposal-core.mjs` (reuse; don't duplicate). Import `computePlan`, `CARD_BY_KEY` from `./scope-core.mjs` for deriving deliverables from keys.

```js
import { publicId, money } from './proposal-core.mjs';
import { computePlan, CARD_BY_KEY } from './scope-core.mjs';

export const CONTRACT_TERMS_VERSION = '2026-08-23';
export const CONTRACT_CAVEAT = 'This is a drafting template generated from your proposal, not executed legal advice. Both parties should have it reviewed by counsel before signing.';
export { publicId, money };

// Deliverables derived from the catalog items the client scoped.
function deliverablesFromKeys(keys) {
  const plan = computePlan(Array.isArray(keys) ? keys : [], null);
  return plan.items.map((i) => ({ name: i.name, why: i.why }));
}

// Statement of Work, filled from the proposal. No invented figures — all passed in.
export function buildSow({ clientName, projectName, keys, firmCents, depositCents, balanceCents, nowIso }) {
  const items = deliverablesFromKeys(keys);
  const dList = items.length ? items.map((i) => `• ${i.name} — ${i.why}`).join('\n') : '• Scope as discussed and quoted.';
  return {
    kind: 'sow',
    sections: [
      { heading: 'Statement of Work', body: `This Statement of Work is between Sage Ideas LLC ("Consultant") and ${clientName || '[CLIENT]'} ("Client") for the project "${projectName || 'Engagement'}", dated ${nowIso.slice(0, 10)}.` },
      { heading: 'Scope & Deliverables', body: dList },
      { heading: 'Out of scope', body: 'Anything not listed above is not included and is quoted separately before any such work begins.' },
      { heading: 'Fees', body: `Total: ${money(firmCents)}. Deposit: ${money(depositCents)} (credited to the total, due before work begins). Balance: ${money(balanceCents)}, invoiced on delivery.` },
      { heading: 'Revisions', body: 'Two rounds of revisions per deliverable are included. Further rounds are billed at an hourly rate agreed in advance.' },
      { heading: 'Timeline', body: 'Work begins once the deposit clears. The timeline is a working estimate and moves with the speed of feedback and access to systems.' },
      { heading: 'Ownership', body: 'The delivered work transfers to Client on full payment of the balance. Until then, ownership stays with Consultant.' },
      { heading: 'Acceptance', body: 'Client has five business days after delivery of each milestone to accept or send specific written change requests; no response within that period means the milestone is accepted.' },
    ],
    meta: { clientName: clientName || null, firmCents, depositCents, balanceCents },
  };
}

// Master Services Agreement — the umbrella terms (client name filled).
export function buildMsa({ clientName, nowIso }) {
  return {
    kind: 'msa',
    sections: [
      { heading: 'Master Services Agreement', body: `This Agreement is between Sage Ideas LLC ("Consultant") and ${clientName || '[CLIENT]'} ("Client"), effective ${nowIso.slice(0, 10)}. It governs all Statements of Work between the parties.` },
      { heading: 'Independent contractor', body: 'Consultant is an independent contractor, responsible for its own taxes, insurance, and equipment. Nothing here creates an employment, partnership, or exclusive relationship.' },
      { heading: 'Confidentiality', body: 'Each party will use the other’s non-public information only to perform or receive the services, protect it with reasonable care, and not disclose it except to people bound by similar obligations. Obligations survive termination.' },
      { heading: 'Intellectual property', body: 'Deliverables created for Client transfer to Client on full payment. Consultant retains its pre-existing tools, frameworks, and general methods, and grants Client a license to use any that are embedded in a deliverable.' },
      { heading: 'Warranties', body: 'Consultant will perform in a professional and workmanlike manner. Except as stated, services and deliverables are provided as is; the results of any AI system are probabilistic by nature.' },
      { heading: 'Limitation of liability', body: 'Neither party is liable for indirect or consequential damages. Each party’s total liability under a Statement of Work will not exceed the fees paid under that Statement of Work.' },
      { heading: 'Term & termination', body: 'Either party may terminate for convenience on fifteen days’ written notice, or immediately for uncured material breach. On termination, Client pays for work performed through that date.' },
      { heading: 'Governing law', body: 'This Agreement is governed by the laws of the State of Illinois.' },
    ],
    meta: { clientName: clientName || null },
  };
}
```
Tests: `buildSow` fills fees from passed cents (assert money strings present, no other $), deliverables from a real key (use `chatbot`), caveat + version exported, `buildMsa` includes Illinois + client name, `publicId` re-exported works. Commit `feat(p6): contract-core (SOW/MSA fill from proposal)`.

---

### Task 3: `lib/portal-db.mjs` gateway + tests
Create mirroring `lib/proposal-db.mjs` EXACTLY (same `isEnabled`/`guard`/`{ok,skipped}` shape). Implement spec §5 functions. Key ones:
```js
export async function approveMilestone(id, name) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_milestones')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_name: (name || '').slice(0,120) })
      .eq('id', id).eq('status', 'delivered').select();   // only a DELIVERED milestone can be approved
    return { ok: true, approved: Array.isArray(data) && data.length === 1 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export async function acceptContract(id, { name, ip }) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_contracts')
      .update({ status: 'accepted', accepted_name: (name||'').slice(0,120), accepted_at: new Date().toISOString(), accept_ip: ip || null })
      .eq('id', id).eq('status', 'sent').select();        // only a SENT contract can be accepted
    return { ok: true, accepted: Array.isArray(data) && data.length === 1 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export async function ensurePortalToken(projectId) { /* like proposal-db.ensureUnsubToken: return existing scope_projects.portal_token or generate+persist a random base62 token */ }
```
Plus: `getProjectByPortalToken`, `listMilestones`, `upsertMilestone`, `markDelivered`, `createContract`, `getContractByPublicId`, `getContractsForProposal`, `sendContract`. Test disabled-shape (`{ok:false,skipped:true}`). Commit `feat(p6): portal-db gateway (milestones + contracts, guarded transitions)`.

---

### Task 4: `api/contract.js` + `api/contract-generate.js` + `api/contract-send.js` + tests
- `api/contract.js`: `GET ?publicId=` client read (only status sent/accepted → return `{body, kind, status, caveat: CONTRACT_CAVEAT}`; else 200 `{ok:false,reason:'not_found'}`); `POST` action=accept `{publicId,name,agreed}` → validate (name 2..120, agreed===true) → load by publicId → `acceptContract`. Mirror `api/proposal.js` degrade/whitelist. Export pure `validate`.
- `api/contract-generate.js`: `POST` admin (`checkToken` first, 401) `{proposalId, kind}` → load proposal (getProposalById) → build via `buildSow`/`buildMsa` → `createContract({public_id, proposal_id, project_id?, kind, body, terms_version, client_email, status:'draft'})` → 200 `{publicId}`. 200-skip when DB off.
- `api/contract-send.js`: `POST` admin `{id}` → `sendContract` (status→sent) → `notify.sendClient` the contract link `${SITE}/contract.html?id=<publicId>` → 200.
Unit-test the two pure `validate` exports + admin fail-closed. Commit `feat(p6): contract endpoints (generate/send/view/accept)`.

---

### Task 5: `api/portal.js` + `api/milestone.js` + tests
- `api/portal.js`: `GET ?id=<portal_token>` → `getProjectByPortalToken` → whitelisted client view (spec §6): project status, plan (from the joined proposal: keys/segment/firm/deposit/balance/paid_at), milestones (seq/title/deliverables/amount_cents/status/due_at — NO ids-except-milestone-id-needed-for-approve... include `id` for milestones so the client can approve, but nothing else sensitive), contract summary (public_id/status if sent+). Not found → 200 `{ok:false,reason}`. `POST` action=approve_milestone `{portalToken, milestoneId, name}` → verify the milestone belongs to that portal's project → `approveMilestone`. 
- `api/milestone.js`: `POST` admin (checkToken) — upsert a milestone `{projectId, id?, title, deliverables, amountCents, seq, dueAt}` or `{id, action:'deliver'}` → `markDelivered`. 200-skip when off.
Unit-test pure validates + admin fail-closed + the "approve only your own project's milestone" guard logic (pure helper). Commit `feat(p6): portal + milestone endpoints`.

---

### Task 6: `portal.html` + `assets/portal.mjs` — the client portal (PREMIUM)
Mirror `proposal.html` shell (JT dark, noindex, print CSS). `?id=<portal_token>` → `fetch('/api/portal?id=')`. States: unavailable (calm), dormant. On found, render a **premium institutional dashboard** (Linear/Stripe-calibre on the dark system):
- Header: project name + a status chip; the plan they bought (itemized from keys via `computePlan`, display-only).
- **Milestone timeline** — each: seq, title, deliverables, an amount (`money`), and a status badge (pending → in_progress → delivered → approved with distinct colors). On a `delivered` milestone, an **Approve** control: a name input + "Approve delivery" → `POST /api/portal` approve_milestone → on ok, badge flips to approved.
- **Payment summary** card: deposit paid (`money`), balance due (`money`).
- **Contract** card: if a sent/accepted contract exists, a link "View your agreement →" `contract.html?id=<public_id>` + its status.
All via `textContent`. Premium: generous spacing, clear hierarchy, subtle depth, status colors, a print-clean layout. This is the wow — make it feel like a real client portal. Add CSS to `assets/site.css`. Verify serve-200 + graceful unavailable on static host. Commit `feat(p6): client portal page (milestones, approvals, payment)`.

---

### Task 7: `contract.html` + `assets/contract.mjs` — client contract view + accept
Mirror `proposal.html`/`assets/proposal.mjs`. `?id=<contract public_id>` → `fetch('/api/contract?publicId=')`. Render the contract `body.sections` (heading + body, body may contain `\n` → render as lines via textContent, preserve line breaks with white-space CSS). A visible **caveat banner** (CONTRACT_CAVEAT). An **accept** block: full-name input + "I have read and agree" checkbox + "Accept agreement" → `POST /api/contract` accept → confirmation ("Agreement accepted on {date}."). `@media print` clean so they can save a PDF. noindex. States: unavailable/accepted/dormant. textContent only. Commit `feat(p6): client contract page (view + accept, print-clean)`.

---

### Task 8: Operator surface in `proposal-admin`
Modify `proposal-admin.html` + `assets/proposal-admin.mjs` (token-gated). On a proposal's detail panel add: **"Generate SOW" / "Generate MSA"** buttons → `POST /api/contract-generate` {proposalId, kind} with `x-admin-token` → show the returned client link + a **"Send to client"** button → `POST /api/contract-send` {id}. And a **Milestones** mini-editor: rows (title, deliverables, amount $, seq, due) → "Add/Save" → `POST /api/milestone` (with token); a "Mark delivered" per existing milestone. All textContent-safe, token on every call. Commit `feat(p6): operator contract-gen + milestone editor in admin`.

---

### Task 9: Webhook wire-in
Modify `api/stripe-webhook.js`: in the `deposit_paid` transition (after `createProjectOnce`), call `ensurePortalToken(projectId)` and include the portal link `${SITE}/portal.html?id=<token>` in the existing client receipt email text. Additive; guarded. Commit `feat(p6): email the client their portal link on deposit`.

---

### Task 10: Docs + smoke + verify
- `docs/PORTAL.md`: the delivery flow, the operator steps (generate contract, seed milestones, mark delivered), the client experience, the env (reuses SUPABASE/SCOPE_ADMIN_TOKEN/RESEND), the dormant→live note, and the **legal caveat** (contracts are drafting aids; attorney review required). 
- Update `docs/SYSTEM.md`: add a "Delivery (portal + contracts)" stage to the pipeline map + env table.
- `tests/smoke.spec.js`: extend the console-ignore to `/api/(portal|contract|milestone)`; add smoke that `portal.html?id=nope` + `contract.html?id=nope` render the unavailable state with no console error.
- Run `npm run test:unit` + `npm run lint` + `npx playwright test tests/smoke.spec.js --project=desktop` → all green. Commit `feat(p6): portal docs + smoke + system map`.

---

## Self-review
Spec coverage: schema(1), core(2), gateway(3), contract eps(4), portal/milestone eps(5), portal page(6), contract page(7), admin surface(8), webhook(9), docs+smoke(10). Money-safety: client approves only delivered milestones + cannot set amounts; contract price from proposal; acceptance recorded. Degrade/auth conventions mirror Plan 5. Legal caveat rendered. No placeholders; pure code full; endpoints/pages mirror in-repo Plan 5 files.
