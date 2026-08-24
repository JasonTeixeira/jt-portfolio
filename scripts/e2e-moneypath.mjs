#!/usr/bin/env node
/**
 * e2e-moneypath.mjs — operator-run, live end-to-end verifier for the money
 * path: scope event → draft proposal → admin approve → client view →
 * checkout session. It exercises the REAL deployed API (no mocks), stage by
 * stage, and prints PASS/FAIL per stage.
 *
 * It never hardcodes secrets — the admin token is a CLI flag / env var you
 * supply, same as any other operator credential.
 *
 * USAGE
 *   node scripts/e2e-moneypath.mjs --url https://agency.sageideas.dev --admin-token <SCOPE_ADMIN_TOKEN>
 *
 *   # after completing the returned Checkout URL with the Stripe test card:
 *   node scripts/e2e-moneypath.mjs --url https://agency.sageideas.dev --verify-paid <publicId>
 *
 * FLAGS
 *   --url <base>          site base URL (required)
 *   --admin-token <token> value for SCOPE_ADMIN_TOKEN (required for the full path)
 *   --verify-paid <id>    check a previously-created proposal's publicId flipped to deposit_paid
 */

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--url') a.url = next();
    else if (k === '--admin-token') a.adminToken = next();
    else if (k === '--verify-paid') a.verifyPaid = next();
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));

if (!args.url) {
  console.error('✗ --url is required, e.g. --url https://agency.sageideas.dev');
  process.exit(1);
}

const BASE = args.url.replace(/\/$/, '');
const C = { g: '\x1b[32m', r: '\x1b[31m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m', y: '\x1b[33m' };

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? `${C.g}PASS${C.x}` : `${C.r}FAIL${C.x}`;
  console.log(`  ${mark}  ${name}${detail ? `  ${C.d}${detail}${C.x}` : ''}`);
}

async function callJson(path, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const r = await fetch(`${BASE}${path}`, { ...opts, signal: ctrl.signal });
    let body = null;
    try { body = await r.json(); } catch { /* non-JSON body */ }
    return { status: r.status, ok: r.ok, body };
  } finally {
    clearTimeout(t);
  }
}

/* ---------- --verify-paid mode ---------- */
async function verifyPaid(publicId) {
  console.log(`\n${C.b}Verify paid — ${publicId}${C.x}\n`);
  try {
    const r = await callJson(`/api/proposal?publicId=${encodeURIComponent(publicId)}`);
    const status = r.body && r.body.proposal && r.body.proposal.status;
    record('proposal flipped to deposit_paid', r.ok && status === 'deposit_paid', `status=${status || '(none)'}`);
  } catch (e) {
    record('proposal flipped to deposit_paid', false, e instanceof Error ? e.message : String(e));
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n  ${C.b}${results.length - failed}/${results.length} passed${C.x}\n`);
  process.exit(failed ? 1 : 0);
}

if (args.verifyPaid) {
  await verifyPaid(args.verifyPaid);
}

/* ---------- full stage-by-stage run ---------- */
console.log(`\n${C.b}Money-path E2E — ${BASE}${C.x}\n`);

// Stage 0: health
let health = null;
try {
  const r = await callJson('/api/health');
  health = r.body && r.body.subsystems;
  record('GET /api/health', r.ok && Boolean(health), health ? JSON.stringify(health) : `status=${r.status}`);
} catch (e) {
  record('GET /api/health', false, e instanceof Error ? e.message : String(e));
}

if (!health || !health.supabase) {
  console.log(`\n  ${C.y}back-half dormant — wire Supabase to run the full path${C.x}\n`);
  process.exit(0);
}

if (!args.adminToken) {
  console.error(`\n${C.r}✗ --admin-token is required once Supabase is wired (needed for proposal-admin / proposal-approve).${C.x}\n`);
  process.exit(1);
}

const prospectId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let publicId = null;
let proposalRowId = null;

// Stage 1: create a prospect event
try {
  const r = await callJson('/api/scope', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prospectId, type: 'started', email: 'e2e@example.com', segment: 'ai-product' }),
  });
  record('POST /api/scope (create prospect event)', r.ok && r.body && r.body.ok !== false, `status=${r.status}`);
} catch (e) {
  record('POST /api/scope (create prospect event)', false, e instanceof Error ? e.message : String(e));
}

// Stage 2: draft a proposal
try {
  const r = await callJson('/api/proposal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prospectId,
      email: 'e2e@example.com',
      plan: { keys: ['chatbot'], segment: 'ai-product', totalBand: [4000, 9000] },
    }),
  });
  publicId = r.body && r.body.publicId;
  record('POST /api/proposal (draft)', r.ok && r.body && r.body.ok === true && Boolean(publicId), publicId ? `publicId=${publicId}` : `status=${r.status} body=${JSON.stringify(r.body)}`);
} catch (e) {
  record('POST /api/proposal (draft)', false, e instanceof Error ? e.message : String(e));
}

// Stage 3: find the draft via admin list, approve it
if (publicId) {
  try {
    const r = await callJson('/api/proposal-admin?list=1', {
      headers: { 'x-admin-token': args.adminToken },
    });
    const list = (r.body && r.body.list) || [];
    const row = list.find((p) => p.public_id === publicId);
    proposalRowId = row && row.id;
    record('GET /api/proposal-admin?list=1 (locate draft)', r.ok && Boolean(proposalRowId), proposalRowId ? `id=${proposalRowId}` : `status=${r.status} not found in ${list.length} rows`);
  } catch (e) {
    record('GET /api/proposal-admin?list=1 (locate draft)', false, e instanceof Error ? e.message : String(e));
  }
}

if (proposalRowId) {
  try {
    const r = await callJson('/api/proposal-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': args.adminToken },
      body: JSON.stringify({ id: proposalRowId }),
    });
    record('POST /api/proposal-approve', r.ok && r.body && r.body.ok === true, `status=${r.status}`);
  } catch (e) {
    record('POST /api/proposal-approve', false, e instanceof Error ? e.message : String(e));
  }
}

// Stage 4: client-facing GET now returns the approved proposal
if (publicId) {
  try {
    const r = await callJson(`/api/proposal?publicId=${encodeURIComponent(publicId)}`);
    const status = r.body && r.body.proposal && r.body.proposal.status;
    record('GET /api/proposal (approved, client-visible)', r.ok && status === 'approved', `status=${status || '(none)'}`);
  } catch (e) {
    record('GET /api/proposal (approved, client-visible)', false, e instanceof Error ? e.message : String(e));
  }
}

// Stage 5: create a checkout session
let checkoutUrl = null;
if (publicId) {
  try {
    const r = await callJson('/api/proposal-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId, acceptName: 'E2E Test', agreed: true }),
    });
    checkoutUrl = r.body && r.body.url;
    record('POST /api/proposal-checkout (Stripe session)', r.ok && r.body && r.body.ok === true && Boolean(checkoutUrl), checkoutUrl ? 'url returned' : `status=${r.status} body=${JSON.stringify(r.body)}`);
  } catch (e) {
    record('POST /api/proposal-checkout (Stripe session)', false, e instanceof Error ? e.message : String(e));
  }
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n  ${C.b}${results.length - failed}/${results.length} passed${C.x}\n`);

if (checkoutUrl) {
  console.log(`${C.y}Manual step required — the actual card payment + webhook cannot be automated:${C.x}`);
  console.log(`  1. Complete checkout here with the Stripe test card 4242 4242 4242 4242 (any future expiry, any CVC):`);
  console.log(`     ${checkoutUrl}`);
  console.log(`  2. Then re-run to confirm the webhook fired (checkout.session.completed → deposit_paid → project → portal email):`);
  console.log(`     node scripts/e2e-moneypath.mjs --url ${args.url} --verify-paid ${publicId}\n`);
}

process.exit(failed ? 1 : 0);
