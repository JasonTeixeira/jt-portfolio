#!/usr/bin/env node
/**
 * scripts/outbound-push.mjs — push sourced leads into an Instantly campaign, from the CLI.
 *
 * Creates a campaign with the human 3-touch sequence (merge-tagged with each lead's tailored
 * proposal) and loads every outbound lead from the CRM. After this, you connect domains+inboxes
 * in Instantly once, warm ~2 weeks, and it sends on autopilot. No UI clicking to run outreach.
 *
 * Env: INSTANTLY_API_KEY + SUPABASE_* (run with --env-file=.env.local --env-file=.env).
 *
 * Usage:
 *   node --env-file=.env.local --env-file=.env scripts/outbound-push.mjs
 *   ... scripts/outbound-push.mjs --tier A --name "HVAC — TX"   # filter + name the campaign
 */

import { isEnabled as instEnabled, createCampaign, addLead } from '../lib/instantly.mjs';
import { isEnabled as dbEnabled, listProspects } from '../lib/scope-db.mjs';

const CTA = 'https://agency.sageideas.dev/automations/';
const SIG = '\n\n— Jason Teixeira\nSage Ideas LLC · Orlando, FL';

// The human 3-touch sequence. {{pitch}} is each lead's tailored opener; {{automations}} the
// recommended set; {{website_cta}} the /automations/ link. Instantly appends the unsubscribe.
const SEQUENCE = [
  { delay: 0, subject: 'a thought for {{companyName}}',
    body: `{{pitch}}\n\nFor a business like yours that usually looks like: {{automations}}.\n\nI'm not after a call — if you're ever curious, you can see it and get a no-cost breakdown on your own time: {{website_cta}}\n\nIf it's not for you, no worries at all — just reply if a question ever comes up.${SIG}` },
  { delay: 3, subject: 'following up gently',
    body: `Just circling back once in case my note got buried — I know how it goes.\n\n{{pitch}}\n\nNo pressure and nothing to buy — if you're curious, take a look whenever it suits you: {{website_cta}}\n\nOr just reply here.${SIG}` },
  { delay: 4, subject: "that's all from me",
    body: `I'll leave you to it — I won't keep emailing.\n\nIf a day ever comes where {{automations}} would take something off your plate, the door's open — no cost, no call, whenever it suits you: {{website_cta}}\n\nEither way, I hope business is good. Take care.${SIG}` },
];

function parseArgs(argv) {
  const a = { tier: null, name: null, limit: 5000 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--tier') a.tier = String(argv[++i] || '').toUpperCase();
    else if (argv[i] === '--name') a.name = argv[++i];
    else if (argv[i] === '--limit') a.limit = Math.max(1, Number(argv[++i]) || 5000);
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!instEnabled()) { console.error('INSTANTLY_API_KEY not set.'); process.exit(1); }
  if (!dbEnabled()) { console.error('SUPABASE_* not set — run with --env-file=.env.local --env-file=.env'); process.exit(1); }

  // Pull the sourced cold leads (with their tailored proposals) from the CRM.
  const r = await listProspects({ limit: args.limit });
  if (!r.ok) { console.error('CRM read failed:', r.error); process.exit(1); }
  const leads = (r.data || []).filter((p) => {
    const q = p.qualification || {};
    if (q.source !== 'outbound' || !p.email) return false;
    if (args.tier && q.tier !== args.tier) return false;
    return true;
  });
  if (!leads.length) { console.error('No outbound leads in the CRM. Run outbound:smb first.'); process.exit(1); }

  const name = args.name || `Sage Automations — Outreach ${new Date().toISOString().slice(0, 10)}`;
  console.log(`[push] creating campaign "${name}" with a 3-touch human sequence…`);
  const c = await createCampaign(name, SEQUENCE);
  if (!c.ok) { console.error('campaign create failed:', c.error, c.detail || ''); process.exit(1); }
  const campaignId = c.data.id;
  console.log(`[push] campaign ${campaignId} created · loading ${leads.length} leads…\n`);

  let added = 0; let failed = 0;
  for (const p of leads) {
    const q = p.qualification || {};
    const firstName = String(p.name || '').trim().split(/\s+/)[0] || '';
    const automations = Array.isArray(q.automations) ? q.automations.map((a) => a.name).join(', ') : 'AI automation';
    const res = await addLead(campaignId, {
      email: p.email, firstName, company: p.company || p.name,
      custom: { pitch: q.opener || '', automations, website_cta: CTA },
    });
    if (res.ok) { added += 1; } else { failed += 1; if (failed <= 3) console.error(`  lead ${p.email} failed: ${res.error} ${res.detail || ''}`); }
  }

  console.log(`\n✓ ${added} leads loaded into campaign ${campaignId}${failed ? ` (${failed} failed)` : ''}`);
  console.log('  Next (one-time, in Instantly): connect domains + inboxes, turn on warmup (~2 weeks),');
  console.log('  then activate the campaign. After that it sends on autopilot — all future runs are CLI.\n');
}

main().catch((e) => { console.error('[push] fatal', e); process.exit(1); });
