#!/usr/bin/env node
/**
 * demo-links.mjs — turns your scored shortlist into personalized demo links +
 * ready-to-send openers. This is the bridge: score-leads.mjs finds the right 20,
 * this arms you to reach them with a demo built for THEIR business.
 *
 * Each prospect gets a link like:
 *   https://agency.sageideas.dev/automations/?biz=Riverline+Water+Damage
 * which personalizes the whole demo page to their name.
 *
 * Input:  outreach/shortlist.csv  (from score-leads.mjs; falls back to the example)
 * Output: outreach/demo-outreach.md  (per-prospect link + 3-touch opener)
 *
 * Usage: node scripts/demo-links.mjs [shortlist.csv] [--site=https://...]
 * No dependencies.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './score-leads.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTREACH = resolve(ROOT, 'outreach');

function main(argv) {
  const args = argv.slice(2);
  const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')));
  const site = (flags.site || 'https://agency.sageideas.dev').replace(/\/$/, '');
  const input = args.find((a) => !a.startsWith('--'))
    || (existsSync(`${OUTREACH}/shortlist.csv`) ? `${OUTREACH}/shortlist.csv` : `${OUTREACH}/leads-raw.example.csv`);
  if (!existsSync(input)) { console.error(`✗ input not found: ${input}`); process.exit(1); }

  const rows = parseCsv(readFileSync(input, 'utf8'));
  if (rows.length < 2) { console.error('✗ no data rows'); process.exit(1); }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (names) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iBiz = col(['business', 'name']);
  const iCity = col(['city']);
  const iNotes = col(['notes', 'contact']);
  if (iBiz < 0) { console.error('✗ no business/name column found'); process.exit(1); }

  const out = ['# Demo outreach — personalized links + openers\n',
    '> Each link opens the Sage Automations demo personalized to that business.',
    '> Fill {{GAP}} after you call their line / test their form. Send by hand from Gmail.\n'];
  let n = 0;
  for (const r of rows.slice(1)) {
    const biz = (r[iBiz] || '').trim();
    if (!biz) continue;
    n++;
    const city = iCity >= 0 ? (r[iCity] || '').trim() : '';
    const nicheQ = flags.niche ? `&niche=${encodeURIComponent(flags.niche)}` : '';
    const link = `${site}/automations/?biz=${encodeURIComponent(biz)}${nicheQ}`;
    const first = biz.split(/\s+/)[0];
    out.push(`## ${n}. ${biz}${city ? ' · ' + city : ''}`);
    if (iNotes >= 0 && r[iNotes]) out.push(`Contact: ${r[iNotes].trim()}`);
    out.push(`Demo link: ${link}`);
    out.push('');
    out.push('**Touch 1 — email/DM:**');
    out.push(`> Subject: a job ${first} is probably losing every week`);
    out.push('>');
    out.push(`> Hey — I called your line and {{GAP: e.g. it went to voicemail after 5 rings}}. For a ${city ? city + ' ' : ''}shop that's a booked job going to whoever picks up first. I built a 60-second demo showing exactly how to fix it, personalized for ${biz}: ${link} — worth a look?`);
    out.push('');
    out.push('**Touch 2 (day 3, other channel):** "Did that demo make sense for ' + first + '? Happy to set it up live on your actual number."');
    out.push('**Touch 3 (day 7, call):** "Sent you a demo of your after-hours line last week — got 10 min this week?"');
    out.push('\n---\n');
  }
  writeFileSync(`${OUTREACH}/demo-outreach.md`, out.join('\n'));
  console.log(`\n  ${n} prospects → outreach/demo-outreach.md`);
  console.log(`  Each has a personalized demo link + 3-touch opener.`);
  console.log(`  NEXT: call each line to fill {{GAP}}, then send touch 1 by hand.\n`);
}

main(process.argv);
