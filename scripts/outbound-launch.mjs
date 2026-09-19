#!/usr/bin/env node
/**
 * scripts/outbound-launch.mjs — attach your inboxes to a campaign and launch it, from the CLI.
 *
 * Completes the CLI pipeline: outbound:smb (source) → outbound:push (campaign + leads) →
 * outbound:launch (attach inboxes + go). Sending itself then runs on Instantly's warmed inboxes.
 *
 * Env: INSTANTLY_API_KEY (run with --env-file=.env).
 *
 * Usage:
 *   node --env-file=.env scripts/outbound-launch.mjs --campaign <id>            # attach + verify (stays paused)
 *   node --env-file=.env scripts/outbound-launch.mjs --campaign <id> --go       # attach + ACTIVATE (starts sending)
 *   node --env-file=.env scripts/outbound-launch.mjs --campaign <id> --pause    # pause a running campaign
 */

import { isEnabled, listAccounts, attachAccounts, activateCampaign, pauseCampaign } from '../lib/instantly.mjs';

function arg(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; }
const has = (name) => process.argv.includes(name);

async function main() {
  if (!isEnabled()) { console.error('INSTANTLY_API_KEY not set — run with --env-file=.env'); process.exit(1); }
  const campaign = arg('--campaign');
  if (!campaign) { console.error('need --campaign <id>'); process.exit(1); }
  const daily = Number(arg('--daily')) || 50;

  if (has('--pause')) {
    const p = await pauseCampaign(campaign);
    console.log(p.ok ? '⏸️  campaign paused.' : `pause failed: ${p.error}`);
    return;
  }

  // Attach every active inbox in the workspace to the campaign.
  const acc = await listAccounts();
  if (!acc.ok) { console.error('could not list inboxes:', acc.error); process.exit(1); }
  const emails = (acc.data.items || []).filter((a) => a.status === 1).map((a) => a.email);
  if (!emails.length) { console.error('no active inboxes found — buy/connect inboxes in Instantly first.'); process.exit(1); }

  const at = await attachAccounts(campaign, emails, daily);
  if (!at.ok) { console.error('attach failed:', at.error, at.detail || ''); process.exit(1); }
  console.log(`✓ attached ${emails.length} inboxes · daily cap ${daily}/day (${Math.round(daily / emails.length)}/inbox)`);
  emails.forEach((e) => console.log(`    • ${e}`));

  if (has('--go')) {
    const a = await activateCampaign(campaign);
    console.log(a.ok ? '\n🚀 campaign ACTIVE — proposals are now sending from your warmed inboxes.\n' : `\nactivate failed: ${a.error}\n`);
  } else {
    console.log('\n✓ attached and ready — still PAUSED. Add --go to start sending.\n');
  }
}

main().catch((e) => { console.error('[launch] fatal', e); process.exit(1); });
