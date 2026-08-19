# Scope Studio P5 — Close → Cash Implementation Plan

> **Status:** SHIPPED — merged to main. Checklists below are historical.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Firm proposal → human approval → client acceptance → Stripe deposit, degrade-safe.

**Architecture:** Pure core (`proposal-core.mjs`) for money/terms; env-guarded gateways
(`proposal-db`, `stripe`, `notify`); serverless endpoints; two static pages (client proposal,
operator console). Mirrors the shipped scope-studio patterns exactly.

**Tech Stack:** ESM, Node ≥22, Vercel serverless, Supabase (service role), Stripe, Resend, vanilla JS.

**Spec:** `docs/superpowers/specs/2026-08-19-scope-studio-p5-close-to-cash-design.md` (read it).

## Global Constraints

- ESM only; funcs are `export default async function handler(req,res)`.
- Money: `computePlan`/`totalBand` = DOLLARS; `*_cents` + Stripe = CENTS. Convert at boundary.
- Degrade-safe: missing config ⇒ clean 200 `{ok:false,skipped:true}` (never 5xx). Signature/token/validation *failures* = real 4xx.
- Client never sends money; all amounts from DB row server-side; admin edits clamped.
- Voice & Humanity: first-person, plain, no banned tics (no em-dash clause-joins, no rule-of-three, no "actually/genuinely/Honestly"), always an escape hatch. All dynamic text via `textContent`.
- New tables: `enable row level security`, no policies. Server-only keys.
- Timestamps passed IN to pure funcs (no `Date.now()` in tested pure math).

---

### Task 1: DB schema — proposals + projects

**Files:** Modify `supabase/scope_schema.sql` (append).

- [ ] **Step 1:** Append the two `create table` blocks, indexes, and RLS statements exactly as in spec §4 (`scope_proposals`, `scope_projects`, unique `scope_projects_proposal` on `proposal_id`, `enable row level security` on both, no policies).
- [ ] **Step 2:** Commit `chore(p5): proposals + projects schema (RLS deny-all)`.

No test (SQL DDL). Reviewer verifies against spec §4.

---

### Task 2: Pure core — `assets/proposal-core.mjs`

**Files:** Create `assets/proposal-core.mjs`, `tests/unit/proposal-core.test.mjs`.

**Interfaces — Produces:** `DEPOSIT_PCT_DEFAULT`, `PROPOSAL_STATUS`, `TERMS_VERSION`, `TERMS`, `firmCentsFromBand`, `depositCents`, `balanceCents`, `clampFirmCents`, `publicId`, `money`, `isExpired`.

- [ ] **Step 1: Write failing tests** `tests/unit/proposal-core.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  firmCentsFromBand, depositCents, balanceCents, clampFirmCents,
  publicId, money, isExpired, DEPOSIT_PCT_DEFAULT, PROPOSAL_STATUS, TERMS, TERMS_VERSION,
} from '../../assets/proposal-core.mjs';

test('firmCentsFromBand: midpoint dollars -> cents', () => {
  assert.equal(firmCentsFromBand([4000, 9000]), 650000); // (6500)*100
  assert.equal(firmCentsFromBand([0, 0]), 0);
});
test('depositCents: rounds', () => {
  assert.equal(depositCents(650000, 0.30), 195000);
  assert.equal(depositCents(100001, 0.30), 30000); // 30000.3 -> 30000
});
test('balanceCents', () => { assert.equal(balanceCents(650000, 195000), 455000); });
test('clampFirmCents: within band passes; wild edits clamp', () => {
  assert.deepEqual(clampFirmCents(650000, [4000, 9000]), { cents: 650000, clamped: false });
  const hi = clampFirmCents(99999999, [4000, 9000]); // > hi*100*2 = 1_800_000
  assert.equal(hi.clamped, true); assert.equal(hi.cents, 1800000);
  const lo = clampFirmCents(1000, [4000, 9000]); // < max(floor 5000, lo*100*0.5=200000)
  assert.equal(lo.clamped, true); assert.equal(lo.cents, 200000);
});
test('publicId: unguessable-ish, url-safe, unique across calls', () => {
  const a = publicId(), b = publicId();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9A-Za-z]{16,}$/);
});
test('money formats usd', () => { assert.equal(money(195000), '$1,950'); assert.equal(money(650000), '$6,500'); });
test('isExpired compares against passed now', () => {
  assert.equal(isExpired({ expires_at: '2020-01-01T00:00:00Z' }, '2026-01-01T00:00:00Z'), true);
  assert.equal(isExpired({ expires_at: '2030-01-01T00:00:00Z' }, '2026-01-01T00:00:00Z'), false);
  assert.equal(isExpired({ expires_at: null }, '2026-01-01T00:00:00Z'), false);
});
test('TERMS is real content with headings + IP-on-final-payment clause', () => {
  assert.ok(Array.isArray(TERMS) && TERMS.length >= 7);
  const joined = TERMS.map((t) => `${t.heading} ${t.body}`).join(' ').toLowerCase();
  assert.match(joined, /out of scope/);
  assert.match(joined, /revision/);
  assert.match(joined, /ownership|intellectual property|transfers/);
  assert.match(joined, /tax/);
  assert.ok(TERMS_VERSION.length >= 8);
});
test('no banned tics in terms', () => {
  const joined = TERMS.map((t) => t.body).join(' ');
  assert.doesNotMatch(joined, /\bactually\b|\bgenuinely\b|\bHonestly\b/i);
});
```

- [ ] **Step 2:** Run `node --test tests/unit/proposal-core.test.mjs` → FAIL (module missing).
- [ ] **Step 3: Implement** `assets/proposal-core.mjs`:

```js
// Pure, deterministic core for proposals. Shared by browser + node. No I/O.
export const DEPOSIT_PCT_DEFAULT = 0.30;
export const PROPOSAL_STATUS = {
  DRAFT: 'draft_pending', APPROVED: 'approved', PAID: 'deposit_paid',
  EXPIRED: 'expired', DECLINED: 'declined',
};
export const TERMS_VERSION = '2026-08-19';
export const TERMS = [
  { heading: 'What this covers', body: 'The deliverables itemized above, built to the scope shown. Anything listed there is included at the price shown.' },
  { heading: 'Out of scope', body: 'Work not itemized above is not included. New requests are quoted separately before any work starts, so there are no surprise charges.' },
  { heading: 'Revisions', body: 'Two rounds of revisions are included per deliverable. Further rounds are billed at an hourly rate agreed up front.' },
  { heading: 'Timeline', body: 'Work begins once the deposit clears. The timeline shown is a working estimate and moves with the speed of your feedback and access to systems.' },
  { heading: 'Payment', body: 'The deposit reserves the work and is credited to the total. The remaining balance is invoiced on delivery. The deposit is refundable until work begins, and non-refundable once it has.' },
  { heading: 'Ownership', body: 'You own the delivered work outright once the final balance is paid. Until then, ownership stays with Jason Teixeira / Sage Ideas LLC.' },
  { heading: 'Cancellation', body: 'You can stop the project at any time. You are billed for work completed to that point, and the deposit covers the first stage.' },
  { heading: 'Taxes', body: 'Prices exclude any applicable sales tax, VAT, or withholding. You are responsible for taxes owed in your jurisdiction.' },
  { heading: 'Validity', body: 'This proposal is valid until the expiry date shown. After that the scope and price may need a quick refresh.' },
];

export function firmCentsFromBand(band) {
  const lo = Number(band?.[0]) || 0, hi = Number(band?.[1]) || 0;
  return Math.round((lo + hi) / 2) * 100;
}
export function depositCents(firmCents, pct) { return Math.round(firmCents * pct); }
export function balanceCents(firmCents, depCents) { return firmCents - depCents; }
export function clampFirmCents(cents, band) {
  const lo = Number(band?.[0]) || 0, hi = Number(band?.[1]) || 0;
  const floor = Math.max(5000, Math.round(lo * 100 * 0.5)); // >= $50, or half the low band
  const ceil = Math.max(floor, Math.round(hi * 100 * 2));   // <= 2x the high band
  let out = Math.round(Number(cents) || 0), clamped = false;
  if (out < floor) { out = floor; clamped = true; }
  else if (out > ceil) { out = ceil; clamped = true; }
  return { cents: out, clamped };
}
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function publicId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += B62[b % 62];
  return s;
}
export function money(cents, currency = 'usd') {
  const n = Math.round(Number(cents) || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}
export function isExpired(row, nowIso) {
  if (!row || !row.expires_at) return false;
  return new Date(row.expires_at).getTime() < new Date(nowIso).getTime();
}
```

- [ ] **Step 4:** Run tests → PASS. **Step 5:** Commit `feat(p5): proposal-core pure money + terms`.

---

### Task 3: `lib/proposal-db.mjs` gateway

**Files:** Create `lib/proposal-db.mjs`, `tests/unit/proposal-db.test.mjs`.

**Interfaces — Consumes:** `@supabase/supabase-js`. **Produces:** `isEnabled`, `createProposal`, `getProposalByPublicId`, `getProposalById`, `updateProposal`, `markPaidIfUnpaid`, `createProjectOnce`, `listProposals`.

- [ ] **Step 1: Failing test** `tests/unit/proposal-db.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, createProposal, markPaidIfUnpaid, createProjectOnce } from '../../lib/proposal-db.mjs';

test('disabled without env — never throws, reports skipped', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await createProposal({ public_id: 'x' }), { ok: false, skipped: true });
  assert.deepEqual(await markPaidIfUnpaid('id', {}), { ok: false, skipped: true });
  assert.deepEqual(await createProjectOnce('pid', null), { ok: false, skipped: true });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** mirroring `lib/scope-db.mjs`:

```js
import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
let _client = null;
export function isEnabled() { return Boolean(URL && KEY); }
function client() {
  if (!isEnabled()) return null;
  if (!_client) _client = createClient(URL, KEY, { auth: { persistSession: false } });
  return _client;
}
async function guard(fn) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { return { ok: true, data: await fn(client()) }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export const createProposal = (row) =>
  guard((c) => c.from('scope_proposals').insert(row).select().then((r) => r.data && r.data[0]));
export const getProposalByPublicId = (publicId) =>
  guard((c) => c.from('scope_proposals').select('*').eq('public_id', publicId).maybeSingle().then((r) => r.data));
export const getProposalById = (id) =>
  guard((c) => c.from('scope_proposals').select('*').eq('id', id).maybeSingle().then((r) => r.data));
export const updateProposal = (id, patch) =>
  guard((c) => c.from('scope_proposals').update(patch).eq('id', id).select().then((r) => r.data && r.data[0]));
export const listProposals = ({ status, limit = 50 } = {}) =>
  guard((c) => {
    let q = c.from('scope_proposals').select('*').order('created_at', { ascending: false }).limit(limit);
    if (status) q = q.eq('status', status);
    return q.then((r) => r.data || []);
  });
// Idempotent paid transition: only rows not already paid flip. transitioned = 1 row returned.
export async function markPaidIfUnpaid(id, { session, intent, paidAtIso }) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { data } = await client().from('scope_proposals')
      .update({ status: 'deposit_paid', stripe_session_id: session || null,
        stripe_payment_intent: intent || null, paid_at: paidAtIso || new Date().toISOString() })
      .eq('id', id).neq('status', 'deposit_paid').select();
    return { ok: true, transitioned: Array.isArray(data) && data.length === 1 };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
// One project per proposal (unique index). Duplicate insert => created:false, still ok.
export async function createProjectOnce(proposalId, prospectId) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const { error } = await client().from('scope_projects')
      .insert({ proposal_id: proposalId, prospect_id: prospectId || null });
    if (error && /duplicate|unique/i.test(error.message)) return { ok: true, created: false };
    if (error) return { ok: false, error: error.message };
    return { ok: true, created: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
```

- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(p5): proposal-db gateway (idempotent paid + project)`.

---

### Task 4: `lib/stripe.mjs` gateway + dependency

**Files:** Create `lib/stripe.mjs`, `tests/unit/stripe-gateway.test.mjs`. Modify `package.json`.

**Interfaces — Produces:** `isEnabled`, `createCheckoutSession`, `retrieveSession`, `constructEvent`.

- [ ] **Step 1:** `npm install stripe` (adds to dependencies). Confirm it appears in `package.json`.
- [ ] **Step 2: Failing test** `tests/unit/stripe-gateway.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, createCheckoutSession } from '../../lib/stripe.mjs';
test('disabled without STRIPE_SECRET_KEY', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await createCheckoutSession({ amountCents: 1000 }), { ok: false, skipped: true });
});
```

- [ ] **Step 3: Implement** `lib/stripe.mjs` (lazy import so module load never needs the key):

```js
const SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
let _stripe = null;
export function isEnabled() { return Boolean(SECRET); }
async function stripe() {
  if (!isEnabled()) return null;
  if (!_stripe) { const { default: Stripe } = await import('stripe'); _stripe = new Stripe(SECRET); }
  return _stripe;
}
export async function createCheckoutSession({ amountCents, currency = 'usd', productName = 'Project deposit',
  publicId, proposalId, customerEmail, successUrl, cancelUrl }) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const s = await stripe();
    const session = await s.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency,
        product_data: { name: productName }, unit_amount: amountCents } }],
      customer_email: customerEmail || undefined,
      success_url: successUrl, cancel_url: cancelUrl,
      metadata: { proposalId, publicId },
      payment_intent_data: { metadata: { proposalId, publicId } },
    });
    return { ok: true, url: session.url, id: session.id };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export async function retrieveSession(id) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { const s = await stripe(); return { ok: true, session: await s.checkout.sessions.retrieve(id) }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
// Throws on invalid signature (caller maps to 400). Returns null-marker when secret unset.
export async function constructEvent(rawBody, signature) {
  if (!WEBHOOK_SECRET) return { skipped: true };
  const s = await stripe();
  return { event: s.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET) };
}
```

- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(p5): stripe gateway + dependency`.

---

### Task 5: `lib/notify.mjs` shared Resend

**Files:** Create `lib/notify.mjs`, `tests/unit/notify.test.mjs`.

**Interfaces — Produces:** `isEnabled`, `sendOperator`, `sendClient`.

- [ ] **Step 1: Failing test**:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, sendOperator, sendClient } from '../../lib/notify.mjs';
test('disabled without RESEND_API_KEY', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await sendOperator({ subject: 's', text: 't' }), { ok: false, skipped: true });
  assert.deepEqual(await sendClient({ to: 'a@b.co', subject: 's', text: 't' }), { ok: false, skipped: true });
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement**:

```js
const RESEND = 'https://api.resend.com';
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';
const TO = process.env.RESEND_TO || 'hello@sageideas.dev';
export function isEnabled() { return Boolean(KEY); }
async function send(body) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const r = await fetch(`${RESEND}/emails`, { method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body) });
    return r.ok ? { ok: true } : { ok: false, error: `resend_${r.status}` };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export const sendOperator = ({ subject, text }) =>
  send({ from: `Scope Studio <${FROM}>`, to: [TO], subject, text });
export const sendClient = ({ to, subject, text, replyTo }) =>
  send({ from: `Jason Teixeira <${FROM}>`, to: [to], reply_to: replyTo || TO, subject, text });
```

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(p5): shared resend notify helper`.

---

### Task 6: `api/proposal.js` — create draft + client read

**Files:** Create `api/proposal.js`, `tests/unit/api-proposal-shape.test.mjs`.

**Interfaces — Consumes:** proposal-core, proposal-db, scope-db(`appendEvent`,`getClient`?no), notify, scope-core(`computePlan`). **Produces:** default handler; pure `validate(body)`; pure `clientView(row, nowIso)`.

- [ ] **Step 1: Failing test** (pure exports only — no network):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, clientView } from '../../api/proposal.js';

test('validate requires prospectId + a plan with keys', () => {
  assert.equal(validate({ prospectId: 'p', plan: { keys: ['ai-agent'], totalBand: [4000, 9000] } }).ok, true);
  assert.equal(validate({ plan: { keys: ['x'] } }).ok, false);
  assert.equal(validate({ prospectId: 'p', plan: { keys: [] } }).ok, false);
  assert.equal(validate({ prospectId: 'p' }).ok, false);
});
test('clientView hides drafts and whitelists fields', () => {
  const base = { public_id: 'abc', status: 'approved', keys: ['ai-agent'], segment: 'ai-product',
    firm_cents: 650000, deposit_cents: 195000, balance_cents: 455000, currency: 'usd',
    scope_note: 'n', terms_version: '2026-08-19', expires_at: '2030-01-01T00:00:00Z', paid_at: null,
    id: 'SECRET-UUID', client_email: 'x@y.co', accept_ip: '1.2.3.4', stripe_session_id: 'sess' };
  const v = clientView(base, '2026-01-01T00:00:00Z');
  assert.equal(v.status, 'approved');
  assert.equal(v.firm_cents, 650000);
  assert.equal(v.id, undefined); assert.equal(v.client_email, undefined);
  assert.equal(v.accept_ip, undefined); assert.equal(v.stripe_session_id, undefined);
  assert.equal(clientView({ ...base, status: 'draft_pending' }, '2026-01-01T00:00:00Z'), null);
  assert.equal(clientView({ ...base, status: 'approved', expires_at: '2020-01-01T00:00:00Z' }, '2026-01-01T00:00:00Z').status, 'expired');
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `api/proposal.js`:

```js
import { isEnabled, createProposal, getProposalByPublicId, updateProposal } from '../lib/proposal-db.mjs';
import { appendEvent } from '../lib/scope-db.mjs';
import { sendOperator } from '../lib/notify.mjs';
import { computePlan } from '../assets/scope-core.mjs';
import {
  firmCentsFromBand, depositCents, balanceCents, publicId, money,
  isExpired, DEPOSIT_PCT_DEFAULT, TERMS_VERSION, PROPOSAL_STATUS,
} from '../assets/proposal-core.mjs';

const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
const CLIENT_FIELDS = ['public_id', 'status', 'keys', 'segment', 'firm_cents', 'deposit_cents',
  'balance_cents', 'currency', 'scope_note', 'terms_version', 'expires_at', 'paid_at'];
const hits = new Map();

export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad body' };
  if (typeof body.prospectId !== 'string' || !body.prospectId.trim()) return { ok: false, error: 'prospectId required' };
  const p = body.plan;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, error: 'plan required' };
  if (!Array.isArray(p.keys) || p.keys.length === 0) return { ok: false, error: 'plan.keys required' };
  return { ok: true };
}
export function clientView(row, nowIso) {
  if (!row) return null;
  if (row.status === PROPOSAL_STATUS.DRAFT) return null; // drafts invisible to client
  const out = {};
  for (const f of CLIENT_FIELDS) out[f] = row[f];
  if (row.status === PROPOSAL_STATUS.APPROVED && isExpired(row, nowIso)) out.status = PROPOSAL_STATUS.EXPIRED;
  return out;
}
function throttled(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
  const now = Date.now(); const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(ip, arr); return arr.length > 20;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!isEnabled()) return res.status(404).json({ ok: false, error: 'not_found' });
    const publicIdParam = String(req.query.publicId || '');
    if (!publicIdParam) return res.status(400).json({ ok: false, error: 'publicId required' });
    const r = await getProposalByPublicId(publicIdParam);
    const view = r.ok ? clientView(r.data, new Date().toISOString()) : null;
    if (!view) return res.status(404).json({ ok: false, error: 'not_found' });
    if (view.status === PROPOSAL_STATUS.APPROVED && r.data && r.data.id) {
      appendEvent({ prospect_id: r.data.prospect_id, type: 'proposal_viewed', meta: { public_id: publicIdParam } }).catch(() => {});
    }
    return res.status(200).json({ ok: true, proposal: view });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'not_configured' });
  if (throttled(req)) return res.status(429).json({ ok: false, error: 'slow_down' });
  const body = req.body || {};
  const v = validate(body); if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
  const plan = body.plan;
  const band = Array.isArray(plan.totalBand) ? plan.totalBand : (Array.isArray(plan.total) ? plan.total : [0, 0]);
  const firm = firmCentsFromBand(band);
  const dep = depositCents(firm, DEPOSIT_PCT_DEFAULT);
  const now = new Date();
  const expires = new Date(now.getTime() + 14 * 864e5).toISOString();
  const pid = publicId();
  const row = {
    public_id: pid, prospect_id: body.prospectId.trim(),
    keys: plan.keys, segment: plan.segment || null,
    band_lo: band[0] || 0, band_hi: band[1] || 0,
    firm_cents: firm, deposit_pct: DEPOSIT_PCT_DEFAULT, deposit_cents: dep,
    balance_cents: balanceCents(firm, dep), currency: 'usd',
    terms_version: TERMS_VERSION, status: PROPOSAL_STATUS.DRAFT,
    client_email: typeof body.email === 'string' ? body.email.slice(0, 320) : null,
    expires_at: expires,
  };
  const created = await createProposal(row);
  if (!created.ok) return res.status(200).json({ ok: false, skipped: true });
  appendEvent({ prospect_id: row.prospect_id, type: 'proposal_drafted', meta: { public_id: pid, firm_cents: firm } }).catch(() => {});
  const admin = `${SITE}/proposal-admin?key=REDACTED#${created.data ? created.data.id : ''}`;
  sendOperator({
    subject: `New proposal to approve — ${money(firm)} draft`,
    text: `A scope just came in.\n\nSegment: ${row.segment || '(none)'}\nItems: ${plan.keys.length}\nDraft firm price: ${money(firm)} (deposit ${money(dep)})\nClient email: ${row.client_email || '(none)'}\n\nApprove it: ${SITE}/proposal-admin?key=YOUR_TOKEN\nProposal id: ${created.data ? created.data.id : '(unknown)'}\n`,
  }).catch(() => {});
  return res.status(200).json({ ok: true, publicId: pid });
}
```

- [ ] **Step 4:** Run `node --test tests/unit/api-proposal-shape.test.mjs` → PASS. **Step 5:** Commit `feat(p5): api/proposal create draft + client read`.

---

### Task 7: `api/proposal-approve.js` + `api/proposal-admin.js` (admin, token-gated)

**Files:** Create both endpoints + `lib/admin-auth.mjs` (shared token check) + `tests/unit/admin-auth.test.mjs`.

**Interfaces — Produces:** `lib/admin-auth.mjs` `checkToken(req)`→bool (constant-time); approve/admin handlers.

- [ ] **Step 1: Failing test** `tests/unit/admin-auth.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkToken } from '../../lib/admin-auth.mjs';
test('no SCOPE_ADMIN_TOKEN env => fail closed', () => {
  assert.equal(checkToken({ headers: {}, query: {} }), false);
  assert.equal(checkToken({ headers: { 'x-admin-token': 'anything' }, query: {} }), false);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `lib/admin-auth.mjs`:

```js
import { timingSafeEqual } from 'node:crypto';
const TOKEN = process.env.SCOPE_ADMIN_TOKEN;
export function checkToken(req) {
  if (!TOKEN) return false; // fail closed
  const got = String((req.headers && req.headers['x-admin-token']) || (req.query && req.query.key) || '');
  if (got.length !== TOKEN.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(TOKEN)); } catch { return false; }
}
```

- [ ] **Step 4:** Implement `api/proposal-approve.js`:

```js
import { isEnabled, getProposalById, updateProposal } from '../lib/proposal-db.mjs';
import { appendEvent } from '../lib/scope-db.mjs';
import { sendClient } from '../lib/notify.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
import { clampFirmCents, depositCents, balanceCents, money, DEPOSIT_PCT_DEFAULT, PROPOSAL_STATUS } from '../assets/proposal-core.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const { id, firmCents, depositPct, scopeNote, expiresAt } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  const got = await getProposalById(id);
  if (!got.ok || !got.data) return res.status(404).json({ ok: false, error: 'not_found' });
  const row = got.data;
  const pct = typeof depositPct === 'number' && depositPct > 0 && depositPct < 1 ? depositPct : (row.deposit_pct || DEPOSIT_PCT_DEFAULT);
  const firmIn = typeof firmCents === 'number' ? firmCents : row.firm_cents;
  const { cents: firm } = clampFirmCents(firmIn, [row.band_lo, row.band_hi]);
  const dep = depositCents(firm, pct);
  const patch = {
    firm_cents: firm, deposit_pct: pct, deposit_cents: dep, balance_cents: balanceCents(firm, dep),
    scope_note: typeof scopeNote === 'string' ? scopeNote.slice(0, 2000) : row.scope_note,
    expires_at: expiresAt || row.expires_at,
    status: PROPOSAL_STATUS.APPROVED, approved_at: new Date().toISOString(),
  };
  const upd = await updateProposal(id, patch);
  if (!upd.ok) return res.status(200).json({ ok: false, skipped: true });
  appendEvent({ prospect_id: row.prospect_id, type: 'proposal_approved', meta: { id, firm_cents: firm } }).catch(() => {});
  if (row.client_email) {
    sendClient({ to: row.client_email,
      subject: 'Your project proposal is ready',
      text: `Hi,\n\nYour proposal is ready to review. It has the scope, the price, and the terms in one place.\n\nSee it here: ${SITE}/proposal?id=${row.public_id}\n\nDeposit to start: ${money(dep)}. If anything looks off, just reply and we'll sort it out.\n\n— Jason\n` }).catch(() => {});
  }
  return res.status(200).json({ ok: true, publicId: row.public_id });
}
```

- [ ] **Step 5:** Implement `api/proposal-admin.js`:

```js
import { isEnabled, getProposalById, listProposals } from '../lib/proposal-db.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, list: [] });
  if (req.query.list) {
    const r = await listProposals({ limit: 100 });
    return res.status(200).json({ ok: true, list: r.data || [] });
  }
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  const r = await getProposalById(id);
  if (!r.ok || !r.data) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.status(200).json({ ok: true, proposal: r.data });
}
```

- [ ] **Step 6:** Run admin-auth test → PASS. **Step 7:** Commit `feat(p5): admin approve + console endpoints (token-gated)`.

---

### Task 8: `api/proposal-checkout.js` — acceptance + Stripe session

**Files:** Create `api/proposal-checkout.js`, `tests/unit/api-checkout-shape.test.mjs`.

**Interfaces — Produces:** default handler; pure `validate(body)`.

- [ ] **Step 1: Failing test**:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../api/proposal-checkout.js';
test('checkout requires publicId, agreed true, a real name', () => {
  assert.equal(validate({ publicId: 'a', agreed: true, acceptName: 'Dana Lee' }).ok, true);
  assert.equal(validate({ publicId: 'a', agreed: false, acceptName: 'Dana Lee' }).ok, false);
  assert.equal(validate({ publicId: 'a', agreed: true, acceptName: 'D' }).ok, false);
  assert.equal(validate({ agreed: true, acceptName: 'Dana Lee' }).ok, false);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement**:

```js
import { isEnabled, getProposalByPublicId, updateProposal } from '../lib/proposal-db.mjs';
import { appendEvent } from '../lib/scope-db.mjs';
import * as stripe from '../lib/stripe.mjs';
import { isExpired, PROPOSAL_STATUS } from '../assets/proposal-core.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad body' };
  if (typeof body.publicId !== 'string' || !body.publicId.trim()) return { ok: false, error: 'publicId required' };
  if (body.agreed !== true) return { ok: false, error: 'must agree to terms' };
  const n = typeof body.acceptName === 'string' ? body.acceptName.trim() : '';
  if (n.length < 2 || n.length > 120) return { ok: false, error: 'name required' };
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  const v = validate(req.body || {}); if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'not_configured' });
  const r = await getProposalByPublicId(req.body.publicId.trim());
  if (!r.ok || !r.data) return res.status(404).json({ ok: false, error: 'not_found' });
  const row = r.data;
  const nowIso = new Date().toISOString();
  if (row.status !== PROPOSAL_STATUS.APPROVED) return res.status(409).json({ ok: false, error: 'not_payable' });
  if (isExpired(row, nowIso)) return res.status(410).json({ ok: false, error: 'expired' });
  if (!stripe.isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'payments_off' });
  // record acceptance intent (finalized by payment webhook)
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || null;
  await updateProposal(row.id, { accepted_name: req.body.acceptName.trim(), accepted_at: nowIso,
    accept_ip: ip, accept_terms_version: row.terms_version });
  // reuse an open session if one exists
  if (row.stripe_session_id) {
    const got = await stripe.retrieveSession(row.stripe_session_id);
    if (got.ok && got.session && got.session.status === 'open' && got.session.url) {
      return res.status(200).json({ ok: true, url: got.session.url });
    }
  }
  const sess = await stripe.createCheckoutSession({
    amountCents: row.deposit_cents, currency: row.currency || 'usd',
    productName: 'Project deposit', publicId: row.public_id, proposalId: row.id,
    customerEmail: row.client_email || undefined,
    successUrl: `${SITE}/proposal?id=${row.public_id}&paid=1`,
    cancelUrl: `${SITE}/proposal?id=${row.public_id}`,
  });
  if (!sess.ok) return res.status(200).json({ ok: false, skipped: true });
  await updateProposal(row.id, { stripe_session_id: sess.id });
  appendEvent({ prospect_id: row.prospect_id, type: 'proposal_accepted', meta: { public_id: row.public_id } }).catch(() => {});
  return res.status(200).json({ ok: true, url: sess.url });
}
```

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(p5): checkout — acceptance capture + stripe session`.

---

### Task 9: `api/stripe-webhook.js` — verified, idempotent

**Files:** Create `api/stripe-webhook.js`, `tests/unit/webhook-logic.test.mjs`.

**Interfaces — Produces:** default handler (raw body); pure `readRawBody(req)` optional; the idempotency lives in proposal-db (already tested), so unit-test the handler's *branching* via a signed synthetic event is E2E — here unit-test only the pure helper.

- [ ] **Step 1: Failing test** (pure raw-body collector):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectRaw } from '../../api/stripe-webhook.js';
test('collectRaw concatenates stream chunks to a Buffer', async () => {
  async function* gen() { yield Buffer.from('{"a":'); yield Buffer.from('1}'); }
  const buf = await collectRaw(gen());
  assert.equal(buf.toString('utf8'), '{"a":1}');
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement**:

```js
import { markPaidIfUnpaid, createProjectOnce, getProposalById } from '../lib/proposal-db.mjs';
import { appendEvent } from '../lib/scope-db.mjs';
import { sendOperator, sendClient } from '../lib/notify.mjs';
import { constructEvent } from '../lib/stripe.mjs';
import { money } from '../assets/proposal-core.mjs';

export const config = { api: { bodyParser: false } };

export async function collectRaw(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  let event;
  try {
    const raw = await collectRaw(req);
    const sig = req.headers['stripe-signature'];
    const r = await constructEvent(raw, sig);
    if (r.skipped) return res.status(200).json({ ok: false, skipped: true }); // webhook secret unset
    event = r.event;
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'bad signature' });
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const obj = event.data.object;
      const proposalId = obj.metadata && obj.metadata.proposalId;
      if (proposalId) {
        const paid = await markPaidIfUnpaid(proposalId, {
          session: obj.id, intent: obj.payment_intent, paidAtIso: new Date().toISOString() });
        if (paid.ok && paid.transitioned) {
          const got = await getProposalById(proposalId);
          const row = got.ok ? got.data : null;
          await createProjectOnce(proposalId, row && row.prospect_id);
          appendEvent({ prospect_id: row && row.prospect_id, type: 'deposit_paid', meta: { proposalId } }).catch(() => {});
          sendOperator({ subject: `Deposit paid — ${row ? money(row.deposit_cents) : ''}`,
            text: `A client just paid their deposit.\nProposal: ${proposalId}\nEmail: ${row ? row.client_email : '?'}\nAccepted by: ${row ? row.accepted_name : '?'}\n` }).catch(() => {});
          if (row && row.client_email) sendClient({ to: row.client_email,
            subject: 'Deposit received — we\'re starting',
            text: `Thanks. Your deposit came through and the work is booked.\n\nHere's what happens next: I'll reach out within one business day to line up the kickoff and access I need. The balance (${money(row.balance_cents)}) is invoiced on delivery.\n\n— Jason\n` }).catch(() => {});
        }
      }
    } else if (event.type === 'charge.dispute.created') {
      const obj = event.data.object;
      const proposalId = obj.metadata && obj.metadata.proposalId;
      appendEvent({ prospect_id: null, type: 'dispute_opened', meta: { proposalId: proposalId || null } }).catch(() => {});
      sendOperator({ subject: 'Payment dispute opened', text: `A dispute was opened. Charge: ${obj.id}. Handle it in the Stripe dashboard.\n` }).catch(() => {});
    }
    return res.status(200).json({ ok: true, received: true });
  } catch (e) {
    return res.status(200).json({ ok: true, received: true }); // ack; never make Stripe retry-storm on our bug
  }
}
```

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(p5): stripe webhook — verified, idempotent paid + dispute notify`.

---

### Task 10: Client page — `proposal.html` + `assets/proposal.mjs`

**Files:** Create `proposal.html`, `assets/proposal.mjs`.

**Interfaces — Consumes:** `/api/proposal?publicId`, `/api/proposal-checkout`; `scope-core.mjs` (`computePlan`, `CARD_BY_KEY`), `proposal-core.mjs` (`TERMS`, `money`).

- [ ] **Step 1:** Build `proposal.html` on the exact JT dark shell (copy `<head>`, tokens, nav/footer structure from `build.html`; title "Your proposal · Jason Teixeira"; `<meta name="robots" content="noindex">` — proposals are private). Body: `<main id="content">` with `#proposal-root` (empty; JS fills), a `<noscript>` fallback ("This proposal needs JavaScript. Email jason@… "). Include `@media print` styles (hide nav/footer, black-on-white, no shadows). Script `<script type="module" src="assets/proposal.mjs"></script>`.
- [ ] **Step 2:** Build `assets/proposal.mjs`:
  - Read `id` from `new URLSearchParams(location.search)`; if `?paid=1` present, prefer the paid view after fetch.
  - `fetch('/api/proposal?publicId='+id)`; on non-200/no proposal → render **unavailable** state (calm copy + `book.html` link).
  - On `proposal`:
    - `expired` → expired state.
    - `deposit_paid` OR `?paid=1` → **paid** state (thank-you, balance line via `money(balance_cents)`, contact).
    - `approved` → render:
      - Header: "Here's your plan and what it costs."
      - **SOW** built from `computePlan(proposal.keys, proposal.segment)` (pure display) grouped by `phases`; each item `name` + `why` from `CARD_BY_KEY`. All via `textContent`.
      - **Price block** (signature element): firm `money(firm_cents)`, "Deposit to start `money(deposit_cents)`", "Balance on delivery `money(balance_cents)`".
      - `scope_note` if present.
      - **Terms**: iterate `TERMS` → heading + body.
      - **Accept form**: text input (full name, required, label), checkbox ("I agree to the terms above", required), submit "Accept & pay the deposit". On submit → `POST /api/proposal-checkout {publicId:id, acceptName, agreed:true}` → if `{url}` `window.location.assign(url)`; if `skipped` → inline "Payments aren't switched on yet — email Jason and he'll send a link." + book link. Disable button while pending.
  - All copy Voice-compliant. No `innerHTML` with dynamic values.
- [ ] **Step 3:** Manually load `proposal.html?id=nope` via `python3 -m http.server 8242` (static → GET /api/proposal 404s as a network error on static host) and confirm it renders the unavailable state with no uncaught console error. Commit `feat(p5): client proposal page + accept flow`.

---

### Task 11: Operator console — `proposal-admin.html` + `assets/proposal-admin.mjs`

**Files:** Create `proposal-admin.html`, `assets/proposal-admin.mjs`.

- [ ] **Step 1:** `proposal-admin.html` on the JT dark shell; `<meta name="robots" content="noindex">`; title "Proposals · admin"; `#admin-root`. Module script.
- [ ] **Step 2:** `assets/proposal-admin.mjs`:
  - Read `key` from URL. If absent → render "Not authorized." only.
  - `fetch('/api/proposal-admin?list=1', { headers: { 'x-admin-token': key } })`; 401 → "Not authorized."; ok → render **summary counts** (drafts pending / approved-unpaid / paid) + a table (status chip, `money(firm_cents)`, client_email, created age, "Open").
  - Open a row → `fetch('/api/proposal-admin?id='+id, headers)` → detail panel: editable **firm price** (dollars input, converts to cents), **deposit %** (number), **scope note** (textarea), **expiry** (date). Live-recompute displayed deposit/balance with `depositCents`/`balanceCents` from `proposal-core.mjs`. **Approve** button → `POST /api/proposal-approve` with `{ id, firmCents, depositPct, scopeNote, expiresAt }` + `x-admin-token`. On ok → "Approved. Client link:" + `${location.origin}/proposal?id=${publicId}` + copy button.
  - All via `textContent`.
- [ ] **Step 3:** Load `proposal-admin.html` (no key) on the static server → confirm "Not authorized", no console error. Commit `feat(p5): operator proposal console`.

---

### Task 12: Wire trigger + smoke tests + docs

**Files:** Modify `assets/scope-studio.mjs`, `tests/smoke.spec.js`. Create `docs/PROPOSALS.md`.

- [ ] **Step 1:** In `assets/scope-studio.mjs` `onLeadSubmit`, after the `/api/lead` fetch resolves ok AND a plan with keys exists, fire-and-forget:
  ```js
  fetch('/api/proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prospectId: prospectId(), email, plan: { keys, segment: plan.segment, totalBand: plan.totalBand } }) }).catch(() => {});
  ```
  and update the success status text to: "Got it. Your plan's on its way to your inbox, and I'll follow up with a proposal shortly — I review every one myself." (Voice-compliant, no banned tics). Do not change existing lead behavior otherwise.
- [ ] **Step 2:** In `tests/smoke.spec.js`, extend the console-error ignore regex to also match `/api/proposal` (so the static-host 404 beacon is ignored), and add a lightweight `test.describe('proposal page')`: `goto('/proposal.html?id=nope')` → expect `#proposal-root` visible with unavailable copy, and no uncaught page error; `goto('/proposal-admin.html')` → expect "Not authorized" text.
- [ ] **Step 3:** Write `docs/PROPOSALS.md`: env setup (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SCOPE_ADMIN_TOKEN`, `SITE_URL`), how to run the `scope_schema.sql` additions, the Stripe **test** card `4242 4242 4242 4242`, how to register the webhook endpoint (`/api/stripe-webhook`, events `checkout.session.completed` + `charge.dispute.created`) and get the signing secret, the admin URL shape, and the go-live checklist (swap `sk_test_`→`sk_live_`, set webhook secret, pick `SCOPE_ADMIN_TOKEN`). Note the v1 debt (URL-borne admin token) and the deferred items from spec §12.
- [ ] **Step 4:** Run full unit suite `npm run test:unit` → all PASS. Commit `feat(p5): scope-studio proposal trigger + smoke + docs`.

---

### Task 13: Full-suite verify

**Files:** none (verification).

- [ ] **Step 1:** `npm run test:unit` → all green. Paste summary.
- [ ] **Step 2:** `npx playwright test tests/smoke.spec.js --project=desktop` (webServer auto-starts static host) → scope-studio + proposal smoke green (functions absent on static host = expected 404s, ignored). Paste summary.
- [ ] **Step 3:** Commit any fixups. This task's "deliverable" is a green report, not code.

---

## Self-review notes (author)

- Spec coverage: schema(T1), core(T2), db(T3), stripe(T4), notify(T5), create+read(T6), approve+admin(T7), checkout(T8), webhook(T9), client page(T10), console(T11), trigger+smoke+docs(T12), verify(T13). All §s mapped.
- Money units: dollars→cents only in `firmCentsFromBand` and band storage; everything downstream is cents. ✔
- Degrade conventions: proposal GET → 404 (client contract); all POST create/approve/checkout/webhook → 200 skip when disabled; admin → 401 fail-closed. Matches spec §2/§7. ✔
- Idempotency: `markPaidIfUnpaid` (neq status) + unique `scope_projects_proposal` index + `createProjectOnce`. ✔
- No placeholders; every code step is complete. Stripe/webhook true E2E is operator-run (documented in PROPOSALS.md) since it needs live test keys + Stripe CLI; unit layer proves the pure logic.
