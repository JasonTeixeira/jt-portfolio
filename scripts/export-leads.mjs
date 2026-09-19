#!/usr/bin/env node
/**
 * scripts/export-leads.mjs — export sourced leads to a CSV for Instantly / Smartlead / any
 * cold-email platform, so our engine does the SOURCING (Places + Hunter + tailored proposals —
 * the hard, valuable part) and a warmed inbox FLEET does the high-volume SENDING.
 *
 * Every column becomes a merge variable in the sending platform (e.g. {{pitch}}, {{automations}}),
 * so the tailored per-business proposal our engine wrote goes out at scale, personalized.
 *
 * Writes to backups/ (gitignored — the file contains prospect PII). Reads the CRM via SUPABASE_*.
 *
 * Usage:
 *   node --env-file=.env.local scripts/export-leads.mjs                 # all outbound leads
 *   node --env-file=.env.local scripts/export-leads.mjs --tier A        # only tier-A (highest close)
 *   node --env-file=.env.local scripts/export-leads.mjs --min-score 70 --limit 2000
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { isEnabled, listProspects } from '../lib/scope-db.mjs';

function parseArgs(argv) {
  const a = { tier: null, minScore: 0, limit: 5000 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--tier') a.tier = String(argv[++i] || '').toUpperCase();
    else if (argv[i] === '--min-score') a.minScore = Number(argv[++i]) || 0;
    else if (argv[i] === '--limit') a.limit = Math.max(1, Number(argv[++i]) || 5000);
  }
  return a;
}

// RFC-4180 CSV cell (quote + escape embedded quotes/newlines).
function cell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = ['email', 'first_name', 'company_name', 'phone', 'vertical', 'tier', 'score', 'pitch', 'automations', 'website_cta'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!isEnabled()) {
    console.error('SUPABASE_* not set — run with: node --env-file=.env.local scripts/export-leads.mjs');
    process.exit(1);
  }
  const r = await listProspects({ limit: args.limit });
  if (!r.ok) { console.error('read failed:', r.error); process.exit(1); }

  const rows = (r.data || []).filter((p) => {
    const q = p.qualification || {};
    if (q.source !== 'outbound') return false;               // sourced cold leads only
    if (args.tier && q.tier !== args.tier) return false;
    if ((q.score || 0) < args.minScore) return false;
    return Boolean(p.email);
  });

  const lines = [HEADERS.join(',')];
  for (const p of rows) {
    const q = p.qualification || {};
    const firstName = String(p.name || '').trim().split(/\s+/)[0] || '';
    const automations = Array.isArray(q.automations) ? q.automations.map((a) => a.name).join('; ') : '';
    lines.push([
      cell(p.email), cell(firstName), cell(p.company || p.name), cell(q.phone),
      cell(q.vertical), cell(q.tier), cell(q.score), cell(q.opener), cell(automations),
      cell('https://agency.sageideas.dev/automations/'),
    ].join(','));
  }

  mkdirSync('backups', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const path = `backups/leads-${args.tier || 'all'}-${stamp}.csv`;
  writeFileSync(path, lines.join('\n'));
  console.log(`\n✓ exported ${rows.length} leads → ${path}`);
  console.log('  Import this CSV into Instantly/Smartlead. Use {{pitch}} + {{automations}} as merge');
  console.log('  variables in your email, and {{website_cta}} for the /automations/ link.\n');
}

main().catch((e) => { console.error('[export] fatal', e); process.exit(1); });
