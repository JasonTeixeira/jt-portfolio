#!/usr/bin/env node
/**
 * scripts/deliverability-preflight.mjs — is email actually ready to send?
 *
 * Run this before relying on the plan-delivery email or turning on cold outbound. It checks,
 * against the LIVE Resend API, that:
 *   1. RESEND_API_KEY is set.
 *   2. RESEND_FROM (transactional: scoped plans, receipts, nurture) is set, isn't the
 *      resend.dev sandbox, and its domain is VERIFIED in Resend (SPF/DKIM/DMARC in place).
 *   3. OUTBOUND_FROM (cold outreach) is set to a DISTINCT domain, also verified — so cold
 *      volume can't damage the transactional domain's reputation.
 *
 * Exit code: 0 if transactional email is send-ready (outbound gaps are warnings, not fails),
 * 1 if the transactional path is broken. Prints exactly what to fix.
 *
 *   node scripts/deliverability-preflight.mjs
 */

const RESEND = 'https://api.resend.com';

function domainOf(from) {
  // Accept "Name <x@domain>" or a bare "x@domain".
  const m = String(from || '').match(/@([^\s>]+)/);
  return m ? m[1].toLowerCase() : null;
}

async function listDomains(key) {
  try {
    const r = await fetch(`${RESEND}/domains`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { ok: false, error: `resend_${r.status}` };
    const j = await r.json();
    return { ok: true, domains: Array.isArray(j && j.data) ? j.data : [] };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

const PASS = '✓'; const WARN = '⚠'; const FAIL = '✗';

async function main() {
  let hardFail = false;
  const line = (mark, msg) => console.log(`  ${mark} ${msg}`);
  console.log('\nDeliverability preflight — agency.sageideas.dev\n');

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    line(FAIL, 'RESEND_API_KEY is not set — no email can send at all.');
    console.log('\n  Fix: set RESEND_API_KEY in Vercel (Resend dashboard → API Keys).\n');
    process.exit(1);
  }
  line(PASS, 'RESEND_API_KEY is set.');

  const dl = await listDomains(key);
  if (!dl.ok) {
    line(WARN, `couldn't list Resend domains (${dl.error}) — check the key's permissions.`);
  }
  const verified = new Set((dl.domains || []).filter((d) => d.status === 'verified').map((d) => String(d.name).toLowerCase()));
  const known = new Map((dl.domains || []).map((d) => [String(d.name).toLowerCase(), d.status]));
  if (dl.ok) line(PASS, `Resend knows ${dl.domains.length} domain(s); verified: ${[...verified].join(', ') || '(none)'}.`);

  // ── Transactional sender (RESEND_FROM) ──
  const rf = process.env.RESEND_FROM;
  const rfDomain = domainOf(rf);
  if (!rf || (rfDomain && rfDomain.includes('resend.dev'))) {
    line(FAIL, `RESEND_FROM is ${rf ? 'the resend.dev sandbox' : 'unset'} — visitors will NOT receive their scoped plan.`);
    console.log('     Fix: verify sageideas.dev in Resend, then set RESEND_FROM="Jason Teixeira <hello@sageideas.dev>".');
    hardFail = true;
  } else if (dl.ok && !verified.has(rfDomain)) {
    line(FAIL, `RESEND_FROM domain "${rfDomain}" is ${known.get(rfDomain) || 'NOT in Resend'} — mail will spam-folder or bounce.`);
    console.log(`     Fix: add + verify ${rfDomain} in Resend (SPF/DKIM/DMARC), then redeploy.`);
    hardFail = true;
  } else {
    line(PASS, `transactional sender ${rfDomain} is verified — scoped plans + receipts will deliver.`);
  }

  // ── Cold outbound sender (OUTBOUND_FROM) — warnings only ──
  const of = process.env.OUTBOUND_FROM;
  const ofDomain = domainOf(of);
  if (!of) {
    line(WARN, 'OUTBOUND_FROM is unset — cold outreach would send from the transactional domain (reputation risk).');
    console.log('     Recommended: authenticate a separate subdomain (e.g. mail.sageideas.dev) and set OUTBOUND_FROM to it.');
  } else if (ofDomain === rfDomain) {
    line(WARN, `OUTBOUND_FROM shares the transactional domain (${ofDomain}) — cold bounces could hurt receipts/plans.`);
    console.log('     Recommended: use a distinct subdomain for cold volume.');
  } else if (dl.ok && !verified.has(ofDomain)) {
    line(WARN, `OUTBOUND_FROM domain "${ofDomain}" is ${known.get(ofDomain) || 'NOT in Resend'} — verify it before cold sending.`);
  } else {
    line(PASS, `outbound sender ${ofDomain} is verified and distinct — safe for cold sequences.`);
  }

  console.log(hardFail
    ? `\n${FAIL} Transactional email is NOT send-ready. Fix the ✗ items above.\n`
    : `\n${PASS} Transactional email is send-ready.${of ? '' : ' (Set OUTBOUND_FROM before turning on cold outbound.)'}\n`);
  process.exit(hardFail ? 1 : 0);
}

main().catch((e) => { console.error('[preflight] fatal', e); process.exit(1); });
