# Scope Studio P4 — Nurture Implementation Plan

> **Status:** SHIPPED — merged to main. Checklists below are historical.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Automated, gentle, dormant-until-wired follow-up on cold leads/proposals.

**Architecture:** Pure rules+templates (`nurture-core.mjs`); env-guarded gateway (`nurture-db.mjs`); a Vercel-Cron tick (`api/cron/nurture.js`); one-click unsubscribe + operator suppress endpoints; a static confirmation page. Mirrors shipped scope-studio/proposal patterns.

**Tech Stack:** ESM, Node ≥22, Vercel serverless + Cron, Supabase (service role), Resend.

**Spec:** `docs/superpowers/specs/2026-08-19-scope-studio-p4-nurture-design.md` (read it).

## Global Constraints

- ESM only; funcs `export default async function handler(req,res)`.
- Degrade-safe: missing config ⇒ clean 200 `{ok:false,skipped:true}`; auth failures ⇒ real 401.
- **Kill switch default OFF:** send nothing unless `process.env.NURTURE_ENABLED === 'true'`.
- Idempotent sends via unique indexes (re-run/double-fire = no-op).
- Voice: first-person, plain, one real reason to reopen, escape hatch, unsubscribe footer. **No banned tics** (no em-dash clause-joiner, no rule-of-three for effect, never "actually/genuinely/Honestly").
- New tables/cols: `enable row level security`, no policies.
- Timestamps passed INTO pure funcs (no `Date.now()` in tested pure logic).

---

### Task 1: Schema — nurture columns + sends table

**Files:** Modify `supabase/scope_schema.sql` (append).

- [ ] **Step 1:** Append exactly the block from spec §6 (the three `alter table scope_prospects add column if not exists …`, the `scope_nurture_sends` table, the two partial unique indexes + the prospect index, `enable row level security`, no policies).
- [ ] **Step 2:** Commit `chore(p4): nurture columns + sends table (RLS deny-all)`.

---

### Task 2: `lib/notify.mjs` — optional headers on sendClient

**Files:** Modify `lib/notify.mjs`; create `tests/unit/notify-headers.test.mjs`.

**Interfaces — Produces:** `sendClient({to,subject,text,replyTo,headers})` (additive `headers`).

- [ ] **Step 1: Failing test** `tests/unit/notify-headers.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendClient, sendOperator, isEnabled } from '../../lib/notify.mjs';
test('still degrade-safe with headers arg', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await sendClient({ to: 'a@b.co', subject: 's', text: 't', headers: { 'List-Unsubscribe': '<u>' } }), { ok: false, skipped: true });
  assert.deepEqual(await sendOperator({ subject: 's', text: 't' }), { ok: false, skipped: true });
});
```

- [ ] **Step 2:** Run → FAIL (only if the current `sendClient` signature rejects — it will pass degrade-safe already, but run to confirm the header path is wired). Then implement.
- [ ] **Step 3: Implement** — read `lib/notify.mjs`, change `send(body)` callers so `sendClient` merges `headers` into the Resend payload:

```js
export const sendClient = ({ to, subject, text, replyTo, headers }) =>
  send({ from: `Jason Teixeira <${FROM}>`, to: [to], reply_to: replyTo || TO, subject, text, ...(headers ? { headers } : {}) });
```
Leave `send`, `sendOperator`, `isEnabled` unchanged.

- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(p4): notify sendClient accepts custom headers`.

---

### Task 3: Pure core — `assets/nurture-core.mjs`

**Files:** Create `assets/nurture-core.mjs`, `tests/unit/nurture-core.test.mjs`.

**Interfaces — Produces:** `DUE`, `SEND_CAP`, `STEP`, `isSendable`, `hoursBetween`, `leadDue`, `dueStepForProposal`, `leadEmail`, `unpaidEmail`, `expiringEmail`, `listUnsubHeaders`.

- [ ] **Step 1: Write failing tests** `tests/unit/nurture-core.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DUE, SEND_CAP, STEP, isSendable, hoursBetween, leadDue, dueStepForProposal,
  leadEmail, unpaidEmail, expiringEmail, listUnsubHeaders,
} from '../../assets/nurture-core.mjs';

const NOW = '2026-08-19T12:00:00Z';
const hoursAgo = (h) => new Date(new Date(NOW).getTime() - h * 3600e3).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);
const daysAhead = (d) => new Date(new Date(NOW).getTime() + d * 864e5).toISOString();

test('isSendable respects unsubscribe + suppress', () => {
  assert.equal(isSendable({}), true);
  assert.equal(isSendable({ unsubscribed: true }), false);
  assert.equal(isSendable({ nurture_suppressed: true }), false);
});
test('leadDue: engaged + email + no proposal + >=48h + sendable + not already sent', () => {
  const base = { stage: 'engaged', email: 'a@b.co', updated_at: hoursAgo(50), unsubscribed: false, nurture_suppressed: false };
  assert.equal(leadDue(base, false, new Set(), NOW), true);
  assert.equal(leadDue(base, true, new Set(), NOW), false);            // has a proposal
  assert.equal(leadDue({ ...base, updated_at: hoursAgo(10) }, false, new Set(), NOW), false); // too fresh
  assert.equal(leadDue({ ...base, email: '' }, false, new Set(), NOW), false); // no email
  assert.equal(leadDue({ ...base, unsubscribed: true }, false, new Set(), NOW), false);
  assert.equal(leadDue(base, false, new Set([STEP.LEAD]), NOW), false); // already sent
  assert.equal(leadDue({ ...base, stage: 'new' }, false, new Set(), NOW), false);
});
test('dueStepForProposal: only approved+unexpired; C>B; B2>B1; sentSteps exclude', () => {
  const appr = (d) => ({ status: 'approved', approved_at: daysAgo(d), expires_at: daysAhead(20) });
  assert.equal(dueStepForProposal(appr(1), new Set(), NOW), null);                 // <3d
  assert.equal(dueStepForProposal(appr(3), new Set(), NOW), STEP.UNPAID_1);        // >=3d
  assert.equal(dueStepForProposal(appr(9), new Set(), NOW), STEP.UNPAID_2);        // >=8d
  assert.equal(dueStepForProposal(appr(9), new Set([STEP.UNPAID_2]), NOW), STEP.UNPAID_1); // 2 sent -> 1 still due? no: send first unsent
  assert.equal(dueStepForProposal(appr(9), new Set([STEP.UNPAID_1, STEP.UNPAID_2]), NOW), null);
  assert.equal(dueStepForProposal({ status: 'draft_pending', approved_at: null, expires_at: daysAhead(20) }, new Set(), NOW), null);
  assert.equal(dueStepForProposal({ status: 'approved', approved_at: daysAgo(5), expires_at: daysAgo(1) }, new Set(), NOW), null); // expired
  // expiring within 3d takes priority over an unpaid step
  assert.equal(dueStepForProposal({ status: 'approved', approved_at: daysAgo(5), expires_at: daysAhead(2) }, new Set(), NOW), STEP.EXPIRING);
  assert.equal(dueStepForProposal({ status: 'approved', approved_at: daysAgo(5), expires_at: daysAhead(2) }, new Set([STEP.EXPIRING]), NOW), STEP.UNPAID_1);
});
test('email builders: non-empty, carry unsubscribe url + List-Unsubscribe header, no banned tics', () => {
  const U = 'https://x/api/unsubscribe?token=abc';
  const emails = [
    leadEmail({ prospect: { email: 'a@b.co' }, hasPlan: true, siteUrl: 'https://x', unsubscribeUrl: U }),
    leadEmail({ prospect: { email: 'a@b.co' }, hasPlan: false, siteUrl: 'https://x', unsubscribeUrl: U }),
    unpaidEmail({ proposal: { public_id: 'pid' }, step: STEP.UNPAID_1, siteUrl: 'https://x', unsubscribeUrl: U }),
    unpaidEmail({ proposal: { public_id: 'pid' }, step: STEP.UNPAID_2, siteUrl: 'https://x', unsubscribeUrl: U }),
    expiringEmail({ proposal: { public_id: 'pid', expires_at: '2026-09-01T00:00:00Z' }, siteUrl: 'https://x', unsubscribeUrl: U }),
  ];
  for (const e of emails) {
    assert.ok(e.subject && e.subject.length > 3);
    assert.ok(e.text.includes(U));
    assert.equal(e.headers['List-Unsubscribe'], `<${U}>`);
    assert.equal(e.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.doesNotMatch(e.text, /\bactually\b|\bgenuinely\b|\bHonestly\b/i);
    assert.doesNotMatch(e.text, / — /); // no em-dash clause-joiner
  }
});
test('SEND_CAP is a sane positive integer', () => { assert.ok(Number.isInteger(SEND_CAP) && SEND_CAP > 0); });
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** `assets/nurture-core.mjs`:

```js
// Pure nurture rules + email templates. Shared browser+node. No I/O.
export const DUE = { LEAD_HOURS: 48, UNPAID_1_DAYS: 3, UNPAID_2_DAYS: 8, EXPIRING_WITHIN_DAYS: 3, DRAFT_STALE_HOURS: 24 };
export const SEND_CAP = 200;
export const STEP = { LEAD: 'lead_no_proposal', UNPAID_1: 'proposal_unpaid_1', UNPAID_2: 'proposal_unpaid_2', EXPIRING: 'proposal_expiring' };

export function isSendable(p) { return Boolean(p) && !p.unsubscribed && !p.nurture_suppressed; }
export function hoursBetween(aIso, bIso) { return (new Date(bIso).getTime() - new Date(aIso).getTime()) / 3600e3; }

export function leadDue(prospect, hasProposal, sentSteps, nowIso) {
  if (!prospect || prospect.stage !== 'engaged') return false;
  if (!prospect.email) return false;
  if (hasProposal) return false;
  if (!isSendable(prospect)) return false;
  if (sentSteps && sentSteps.has(STEP.LEAD)) return false;
  if (!prospect.updated_at) return false;
  return hoursBetween(prospect.updated_at, nowIso) >= DUE.LEAD_HOURS;
}

export function dueStepForProposal(proposal, sentSteps, nowIso) {
  if (!proposal || proposal.status !== 'approved') return null;
  const now = new Date(nowIso).getTime();
  if (proposal.expires_at && new Date(proposal.expires_at).getTime() < now) return null; // expired
  const sent = sentSteps || new Set();
  // C: expiring within window takes priority
  if (proposal.expires_at) {
    const hrsToExpiry = (new Date(proposal.expires_at).getTime() - now) / 3600e3;
    if (hrsToExpiry > 0 && hrsToExpiry <= DUE.EXPIRING_WITHIN_DAYS * 24 && !sent.has(STEP.EXPIRING)) return STEP.EXPIRING;
  }
  if (!proposal.approved_at) return null;
  const ageDays = (now - new Date(proposal.approved_at).getTime()) / 864e5;
  if (ageDays >= DUE.UNPAID_1_DAYS && !sent.has(STEP.UNPAID_1)) return STEP.UNPAID_1;
  if (ageDays >= DUE.UNPAID_2_DAYS && !sent.has(STEP.UNPAID_2)) return STEP.UNPAID_2;
  return null;
}

export function listUnsubHeaders(unsubscribeUrl) {
  return { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}
function footer(unsubscribeUrl) { return `\n\nNot interested in these? Unsubscribe: ${unsubscribeUrl}`; }

export function leadEmail({ prospect, hasPlan, siteUrl, unsubscribeUrl }) {
  const subject = hasPlan ? 'Want me to turn your plan into a firm quote?' : 'Want me to map out what a build would look like?';
  const body = hasPlan
    ? `Hi,\n\nYou put together a plan on my site a couple of days back. Want me to turn it into a firm scope and price? It takes me a few minutes, and you get a real number to work with.\n\nStart here: ${siteUrl}/build.html\nOr if it's easier, book a short call: ${siteUrl}/book.html`
    : `Hi,\n\nYou grabbed something from my site recently. If you have a project in mind, I can map out what it would take and what it would cost, with no obligation.\n\nScope it here: ${siteUrl}/build.html\nOr book a short call: ${siteUrl}/book.html`;
  return { subject, text: body + footer(unsubscribeUrl) + `\n\n— Jason`, headers: listUnsubHeaders(unsubscribeUrl) };
}

export function unpaidEmail({ proposal, step, siteUrl, unsubscribeUrl }) {
  const link = `${siteUrl}/proposal.html?id=${proposal.public_id}`;
  const first = step === STEP.UNPAID_1;
  const subject = first ? 'Any questions on your proposal?' : 'Still here when you\'re ready';
  const body = first
    ? `Hi,\n\nI sent your proposal a few days ago. Any questions before you decide? Happy to jump on a quick call or answer over email.\n\nYour proposal: ${link}`
    : `Hi,\n\nStill holding your slot. If the timing is off, no pressure at all, just let me know and I'll set it aside.\n\nYour proposal: ${link}`;
  return { subject, text: body + footer(unsubscribeUrl) + `\n\n— Jason`, headers: listUnsubHeaders(unsubscribeUrl) };
}

export function expiringEmail({ proposal, siteUrl, unsubscribeUrl }) {
  const link = `${siteUrl}/proposal.html?id=${proposal.public_id}`;
  let dateStr = '';
  if (proposal.expires_at) {
    const d = new Date(proposal.expires_at);
    if (!Number.isNaN(d.getTime())) dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  const subject = 'Your proposal expires soon';
  const body = `Hi,\n\nQuick heads-up. Your proposal expires${dateStr ? ` on ${dateStr}` : ' soon'}. After that the scope and price may need a refresh.\n\nIf you want to move ahead, here it is: ${link}`;
  return { subject, text: body + footer(unsubscribeUrl) + `\n\n— Jason`, headers: listUnsubHeaders(unsubscribeUrl) };
}
```

- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(p4): nurture-core rules + email templates`.

---

### Task 4: Gateway — `lib/nurture-db.mjs`

**Files:** Create `lib/nurture-db.mjs`, `tests/unit/nurture-db.test.mjs`.

**Interfaces — Produces:** `isEnabled`, `leadCandidates`, `unpaidProposals`, `expiringProposals`, `staleDrafts`, `sentStepsForProposal`, `sentStepsForProspect`, `recordSend`, `ensureUnsubToken`, `setUnsubscribedByToken`, `setSuppressed`.

- [ ] **Step 1: Failing test** `tests/unit/nurture-db.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, recordSend, setSuppressed, leadCandidates } from '../../lib/nurture-db.mjs';
test('disabled without env — never throws, reports skipped', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await recordSend({ prospect_id: 'p', step: 'x' }), { ok: false, skipped: true });
  assert.deepEqual(await setSuppressed('p'), { ok: false, skipped: true });
  assert.deepEqual(await leadCandidates('2026-01-01T00:00:00Z'), { ok: false, skipped: true });
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `lib/nurture-db.mjs`:

```js
import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
let _c = null;
export function isEnabled() { return Boolean(URL && KEY); }
function client() { if (!isEnabled()) return null; if (!_c) _c = createClient(URL, KEY, { auth: { persistSession: false } }); return _c; }
async function guard(fn) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { return { ok: true, data: await fn(client()) }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
function randToken() {
  const b = new Uint8Array(16); globalThis.crypto.getRandomValues(b);
  const A = '0123456789abcdefghijklmnopqrstuvwxyz'; let s = ''; for (const x of b) s += A[x % 36]; return s;
}

export async function leadCandidates(nowIso) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const c = client();
    const cutoff = new Date(new Date(nowIso).getTime() - 48 * 3600e3).toISOString();
    const { data: prospects } = await c.from('scope_prospects').select('*')
      .eq('stage', 'engaged').eq('unsubscribed', false).eq('nurture_suppressed', false)
      .not('email', 'is', null).lte('updated_at', cutoff).limit(500);
    const list = prospects || [];
    if (!list.length) return { ok: true, data: [] };
    const ids = list.map((p) => p.id);
    const { data: props } = await c.from('scope_proposals').select('prospect_id').in('prospect_id', ids);
    const withProposal = new Set((props || []).map((r) => r.prospect_id));
    const { data: plans } = await c.from('scope_plans').select('prospect_id').in('prospect_id', ids);
    const withPlan = new Set((plans || []).map((r) => r.prospect_id));
    const out = list.filter((p) => !withProposal.has(p.id)).map((p) => ({ prospect: p, hasPlan: withPlan.has(p.id) }));
    return { ok: true, data: out };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export const unpaidProposals = () =>
  guard((c) => c.from('scope_proposals').select('*, scope_prospects(unsubscribed,nurture_suppressed)')
    .eq('status', 'approved').not('client_email', 'is', null).limit(500).then((r) => r.data || []));
export const expiringProposals = (nowIso) =>
  guard((c) => {
    const soon = new Date(new Date(nowIso).getTime() + 3 * 864e5).toISOString();
    return c.from('scope_proposals').select('*, scope_prospects(unsubscribed,nurture_suppressed)')
      .eq('status', 'approved').gt('expires_at', nowIso).lte('expires_at', soon).limit(500).then((r) => r.data || []);
  });
export const staleDrafts = (nowIso) =>
  guard((c) => {
    const cutoff = new Date(new Date(nowIso).getTime() - 24 * 3600e3).toISOString();
    return c.from('scope_proposals').select('id,public_id,firm_cents,client_email,prospect_id,created_at')
      .eq('status', 'draft_pending').lte('created_at', cutoff).limit(200).then((r) => r.data || []);
  });
export const sentStepsForProposal = (proposalId) =>
  guard((c) => c.from('scope_nurture_sends').select('step').eq('proposal_id', proposalId)
    .then((r) => new Set((r.data || []).map((x) => x.step))));
export const sentStepsForProspect = (prospectId) =>
  guard((c) => c.from('scope_nurture_sends').select('step').eq('prospect_id', prospectId).is('proposal_id', null)
    .then((r) => new Set((r.data || []).map((x) => x.step))));
export async function recordSend({ prospect_id, proposal_id, step }) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { error } = await client().from('scope_nurture_sends')
      .insert({ prospect_id: prospect_id || null, proposal_id: proposal_id || null, step });
    if (error && /duplicate|unique/i.test(error.message)) return { ok: true, recorded: false };
    if (error) return { ok: false, error: error.message };
    return { ok: true, recorded: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export async function ensureUnsubToken(prospectId) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const c = client();
    const { data } = await c.from('scope_prospects').select('unsubscribe_token').eq('id', prospectId).maybeSingle();
    if (data && data.unsubscribe_token) return { ok: true, token: data.unsubscribe_token };
    const token = randToken();
    await c.from('scope_prospects').update({ unsubscribe_token: token }).eq('id', prospectId);
    return { ok: true, token };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export async function setUnsubscribedByToken(token) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_prospects').update({ unsubscribed: true }).eq('unsubscribe_token', token).select('id');
    return { ok: true, matched: Array.isArray(data) && data.length > 0 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export const setSuppressed = (prospectId) =>
  guard((c) => c.from('scope_prospects').update({ nurture_suppressed: true }).eq('id', prospectId).then(() => true));
```

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(p4): nurture-db gateway (idempotent sends + suppression)`.

---

### Task 5: `api/unsubscribe.js` + `api/suppress.js`

**Files:** Create both; create `tests/unit/api-unsub-suppress.test.mjs`.

**Interfaces — Produces:** default handlers. Reuse `lib/admin-auth.mjs` `checkToken`.

- [ ] **Step 1: Failing test**:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import unsubscribe from '../../api/unsubscribe.js';
import suppress from '../../api/suppress.js';
function mockRes() { return { code: 0, body: null, headers: {}, status(c){this.code=c;return this;}, json(b){this.body=b;return this;}, setHeader(k,v){this.headers[k]=v;}, redirect(u){this.code=302;this.redirected=u;return this;} }; }
test('suppress fails closed without admin token', async () => {
  const res = mockRes();
  await suppress({ method: 'GET', headers: {}, query: { prospect: 'p' } }, res);
  assert.equal(res.code, 401);
});
test('unsubscribe never errors on unknown token (degrade-safe 200/redirect)', async () => {
  const res = mockRes();
  await unsubscribe({ method: 'POST', headers: {}, query: { token: 'nope' }, body: {} }, res);
  assert.ok(res.code === 200);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `api/unsubscribe.js`:

```js
import { isEnabled, setUnsubscribedByToken } from '../lib/nurture-db.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  const token = String((req.query && req.query.token) || '');
  if (isEnabled() && token) { try { await setUnsubscribedByToken(token); } catch {} }
  // One-click POST (RFC 8058) wants a plain 200; GET is a human click -> confirmation page.
  if (req.method === 'POST') return res.status(200).json({ ok: true });
  res.setHeader('Location', `${SITE}/unsubscribe.html?done=1`);
  return res.status(302).end ? res.status(302).end() : res.status(302).json({ ok: true });
}
```

- [ ] **Step 4:** Implement `api/suppress.js`:

```js
import { isEnabled, setSuppressed } from '../lib/nurture-db.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const prospect = String((req.query && req.query.prospect) || '');
  if (!prospect) return res.status(400).json({ ok: false, error: 'prospect required' });
  await setSuppressed(prospect);
  return res.status(200).json({ ok: true, suppressed: prospect });
}
```

- [ ] **Step 5:** Run → PASS. **Step 6:** Commit `feat(p4): unsubscribe (one-click) + operator suppress endpoints`.

---

### Task 6: `api/cron/nurture.js` — the tick

**Files:** Create `api/cron/nurture.js`, `tests/unit/api-cron-nurture.test.mjs`.

**Interfaces — Produces:** default handler; pure `authorized(req)`.

- [ ] **Step 1: Failing test**:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { authorized } from '../../api/cron/nurture.js';
function mockRes() { return { code: 0, body: null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;}, setHeader(){} }; }
test('authorized: fail-closed without CRON_SECRET env', () => {
  assert.equal(authorized({ headers: { authorization: 'Bearer anything' } }), false);
});
test('handler 401 without valid cron auth', async () => {
  const res = mockRes();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.code, 401);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `api/cron/nurture.js`:

```js
import { timingSafeEqual } from 'node:crypto';
import * as db from '../../lib/nurture-db.mjs';
import { sendClient, sendOperator } from '../../lib/notify.mjs';
import {
  SEND_CAP, STEP, isSendable, leadDue, dueStepForProposal,
  leadEmail, unpaidEmail, expiringEmail, listUnsubHeaders,
} from '../../assets/nurture-core.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
const CRON = process.env.CRON_SECRET;

export function authorized(req) {
  if (!CRON) return false; // fail closed
  const got = String((req.headers && req.headers.authorization) || '');
  const want = `Bearer ${CRON}`;
  if (got.length !== want.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(want)); } catch { return false; }
}
function unsubUrl(token) { return `${SITE}/api/unsubscribe?token=${encodeURIComponent(token)}`; }

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (process.env.NURTURE_ENABLED !== 'true') return res.status(200).json({ ok: true, skipped: true, reason: 'disabled' });
  if (!db.isEnabled()) return res.status(200).json({ ok: true, skipped: true, reason: 'not_configured' });
  const now = new Date().toISOString();
  let sent = 0, due = 0, errors = 0;
  const cap = () => sent >= SEND_CAP;

  async function fire({ prospect, proposal, step, email }) {
    due++;
    if (cap()) return;
    try {
      const tok = await db.ensureUnsubToken(prospect.id);
      if (!tok.ok || !tok.token) return;
      const built = email(unsubUrl(tok.token));
      const r = await sendClient({ to: prospect.email || proposal.client_email, subject: built.subject, text: built.text, headers: built.headers });
      if (r.ok) { await db.recordSend({ prospect_id: prospect.id, proposal_id: proposal ? proposal.id : null, step }); sent++; }
    } catch { errors++; }
  }

  // A — leads with no proposal
  try {
    const leads = await db.leadCandidates(now);
    for (const { prospect, hasPlan } of (leads.data || [])) {
      if (cap()) break;
      const steps = await db.sentStepsForProspect(prospect.id);
      if (!leadDue(prospect, false, steps.data || new Set(), now)) continue;
      await fire({ prospect, proposal: null, step: STEP.LEAD,
        email: (u) => leadEmail({ prospect, hasPlan, siteUrl: SITE, unsubscribeUrl: u }) });
    }
  } catch { errors++; }

  // B + C — approved proposals (unpaid reminders + expiry). unpaidProposals covers both; expiry handled by dueStepForProposal.
  try {
    const props = await db.unpaidProposals();
    for (const p of (props.data || [])) {
      if (cap()) break;
      const prospect = { id: p.prospect_id, email: p.client_email,
        unsubscribed: p.scope_prospects && p.scope_prospects.unsubscribed,
        nurture_suppressed: p.scope_prospects && p.scope_prospects.nurture_suppressed };
      if (!isSendable(prospect)) continue;
      const steps = await db.sentStepsForProposal(p.id);
      const step = dueStepForProposal(p, steps.data || new Set(), now);
      if (!step) continue;
      const email = step === STEP.EXPIRING
        ? (u) => expiringEmail({ proposal: p, siteUrl: SITE, unsubscribeUrl: u })
        : (u) => unpaidEmail({ proposal: p, step, siteUrl: SITE, unsubscribeUrl: u });
      await fire({ prospect, proposal: p, step, email });
    }
  } catch { errors++; }

  // D — operator digest: stale drafts + run summary (also the heartbeat)
  try {
    const stale = await db.staleDrafts(now);
    const drafts = stale.data || [];
    if (drafts.length || sent || errors) {
      const lines = drafts.map((d) => `• ${d.client_email || '(no email)'} — proposal ${d.id} — stop: ${SITE}/api/suppress?key=YOUR_TOKEN&prospect=${d.prospect_id}`);
      await sendOperator({ subject: `Nurture ran: ${sent} sent, ${drafts.length} drafts waiting`,
        text: `Nurture tick complete.\nSent: ${sent}\nDue: ${due}\nErrors: ${errors}\n\nProposals waiting for your approval (>24h):\n${lines.join('\n') || '(none)'}\n` });
    }
  } catch { errors++; }

  return res.status(200).json({ ok: true, sent, due, errors, capped: cap() });
}
```

- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(p4): nurture cron tick (auth + kill-switch + sequences + digest)`.

---

### Task 7: Wiring — page, cron config, operator suppress link, smoke, docs

**Files:** Create `unsubscribe.html`, `docs/NURTURE.md`. Modify `vercel.json`, `api/proposal.js`, `tests/smoke.spec.js`.

- [ ] **Step 1:** `unsubscribe.html` — JT dark shell (copy head/tokens/nav/footer from `proposal.html`), `<meta name="robots" content="noindex">`, title "Unsubscribed · Jason Teixeira". Body `#unsub-root` with static copy: heading "You're unsubscribed." + "You won't get follow-ups from me. If that was a mistake, email hello@sageideas.dev and I'll fix it." A tiny inline module reads `?done=1` only to confirm (optional); no fetch. Keep it fully static/self-contained.
- [ ] **Step 2:** `vercel.json` — read it, add (merge, do not clobber existing keys):
```json
"crons": [{ "path": "/api/cron/nurture", "schedule": "0 14 * * *" }]
```
- [ ] **Step 3:** `api/proposal.js` operator alert — read the `sendOperator({...})` in the POST handler; append a per-prospect suppress link to its `text` so Jason can stop follow-ups straight from the alert:
```
Stop follow-ups for this prospect: ${SITE}/api/suppress?key=YOUR_TOKEN&prospect=${row.prospect_id}
```
(Use the literal `YOUR_TOKEN` placeholder in the code string exactly like the admin-link pattern — never interpolate the real token.) Additive one-line change to the text only.
- [ ] **Step 4:** `tests/smoke.spec.js` — extend the console-ignore regex to also match `/api/(cron|unsubscribe|suppress)`. Add a `test.describe('unsubscribe page')`: `goto('/unsubscribe.html?done=1')` → expect page text contains "unsubscribed" and no uncaught error.
- [ ] **Step 5:** `docs/NURTURE.md` — write it per spec §14, INCLUDING the HARD deliverability go-live gate (verify sending domain in Resend, set `RESEND_FROM`, configure SPF/DKIM/DMARC), env setup, sequences/cadence, kill switch, unsubscribe + List-Unsubscribe, operator suppress, cron schedule, dormant posture, and the measurement query note.
- [ ] **Step 6:** Run `npm run test:unit` → all pass. Commit `feat(p4): unsubscribe page + cron config + operator suppress link + smoke + docs`.

---

### Task 8: Full-suite verify

- [ ] **Step 1:** `npm run test:unit` → all green; paste summary.
- [ ] **Step 2:** `npx playwright test tests/smoke.spec.js --project=desktop` → green; paste summary.
- [ ] **Step 3:** Commit any fixups. Deliverable is a green report.

---

## Self-review notes (author)

- Spec coverage: schema(T1), notify headers(T2), core(T3), db(T4), unsubscribe+suppress(T5), cron(T6), page+config+wiring+docs(T7), verify(T8). All §s mapped. Fold-ins: suppress valve (T4 setSuppressed + T5 suppress + T7 links), List-Unsubscribe (T3 headers + T2 notify), Sequence-A precision (T4 leadCandidates excludes any proposal + hasPlan branch in T3), heartbeat/measurement (T6 digest + scope_nurture_sends).
- Degrade/auth conventions: cron 401 fail-closed + kill-switch 200-skip; unsubscribe always 200/302; suppress 401 fail-closed; all DB-off → 200 skip. Matches spec.
- Idempotency: unique partial indexes + recordSend duplicate handling; per-run SEND_CAP; per-item try/catch.
- No banned tics in template copy (asserted by test). No placeholders; every code step complete. Live cron E2E deferred to operator (documented).
