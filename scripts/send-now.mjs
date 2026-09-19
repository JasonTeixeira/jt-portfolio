#!/usr/bin/env node
/**
 * scripts/send-now.mjs — send the first-touch proposal to a small batch of sourced leads NOW,
 * from the main (reputation-aged) domain, so it actually lands. For starting/testing while the
 * Instantly fleet warms. Records each send so the daily cron never double-sends, and includes a
 * working unsubscribe + the postal address (CAN-SPAM). Keep the batch small — this rides the
 * transactional domain, so it's for a first taste, not volume (volume goes through the fleet).
 *
 * Run:  node --env-file=.env.local --env-file=.env scripts/send-now.mjs --limit 12
 */

import { isEnabled as dbEnabled, outboundCandidates, recordSend, ensureUnsubToken } from '../lib/nurture-db.mjs';
import { outbound1Email, STEP } from '../assets/nurture-core.mjs';
import { sendClient, isEnabled as mailEnabled } from '../lib/notify.mjs';

const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
const argv = process.argv.slice(2);
const LIMIT = argv.includes('--limit') ? Math.max(1, Number(argv[argv.indexOf('--limit') + 1]) || 12) : 12;

async function main() {
  if (!mailEnabled()) { console.error('RESEND_API_KEY not set — run with --env-file=.env.local'); process.exit(1); }
  if (!dbEnabled()) { console.error('SUPABASE_* not set — run with --env-file=.env.local'); process.exit(1); }

  const now = new Date().toISOString();
  const c = await outboundCandidates(now);
  if (!c.ok) { console.error('read failed:', c.error); process.exit(1); }
  const cands = (c.data || [])
    .filter((x) => !(x.sends || []).some((s) => s.step === STEP.OUTBOUND_1)) // not already sent touch 1
    .slice(0, LIMIT);
  if (!cands.length) { console.log('No un-sent outbound leads to send to.'); return; }

  console.log(`[send] sending the first proposal to ${cands.length} leads from your main domain…\n`);
  let sent = 0; let failed = 0;
  for (const { prospect } of cands) {
    // Claim the step first (idempotent) so a re-run or the cron can't double-send.
    const rec = await recordSend({ prospect_id: prospect.id, step: STEP.OUTBOUND_1 });
    if (!rec.ok || rec.recorded === false) continue;
    const tok = await ensureUnsubToken(prospect.id);
    if (!tok.ok || !tok.token) { continue; }
    const unsubscribeUrl = `${SITE}/api/unsubscribe?token=${encodeURIComponent(tok.token)}`;
    const mail = outbound1Email({ prospect, siteUrl: SITE, unsubscribeUrl });
    const r = await sendClient({ to: prospect.email, subject: mail.subject, text: mail.text, html: mail.html, headers: mail.headers });
    if (r.ok) { sent += 1; console.log(`  ✓ ${prospect.email} — ${prospect.company || prospect.name || ''}`); }
    else { failed += 1; console.error(`  ✗ ${prospect.email} — ${r.error || r.reason || 'failed'}`); }
  }
  console.log(`\n✓ sent ${sent} proposals${failed ? ` (${failed} failed/suppressed)` : ''}. Replies land in hello@sageideas.dev.`);
  console.log('  Each recipient can unsubscribe; follow-ups are handled by the cron once NURTURE_ENABLED.\n');
}

main().catch((e) => { console.error('[send] fatal', e); process.exit(1); });
