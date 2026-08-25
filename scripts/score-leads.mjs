#!/usr/bin/env node
/**
 * score-leads.mjs — turns a raw Outscraper / Google Places CSV export into a
 * RANKED shortlist of the best-fit local-service prospects, plus drafted
 * openers, ready for the outreach tracker.
 *
 * The data source (Outscraper) gets you the list. This gets you the RIGHT 20.
 * It scores each business on the firmographic signals that predict a close
 * for the "AI Front Desk" offer, drops the disqualified, and ranks the rest.
 *
 * What it CANNOT know from a Maps export — and leaves for your manual pass on
 * the top 20 — is the two highest-value filters: does it run Google/LSA ads,
 * and does its phone actually leak (call it after hours). Those columns are
 * emitted blank on purpose, as your checklist. Firmographics narrow 300 → 20;
 * you verify ads + gap on those 20; then you send.
 *
 * Usage:
 *   node scripts/score-leads.mjs [input.csv] [--niche=restoration|hvac|all] [--top=20]
 *   # defaults: input outreach/leads-raw.csv (falls back to the .example),
 *   #           niche=all, top=20
 *
 * Outputs (gitignored — real prospect data):
 *   outreach/shortlist.csv  — ranked, in the outreach-tracker column format
 *   outreach/openers.md     — a 3-touch opener drafted per prospect
 *
 * No dependencies. CSV parsing + scoring are exported for unit testing.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTREACH = resolve(HERE, '..', 'outreach');

// ── ICP config (edit these to retarget) ────────────────────────────────────
export const NICHES = {
  restoration: {
    label: 'Restoration',
    keywords: ['restoration', 'water damage', 'fire damage', 'flood', 'mold',
      'mitigation', 'remediation', 'disaster', 'water removal', 'damage repair'],
  },
  hvac: {
    label: 'HVAC',
    keywords: ['hvac', 'heating', 'cooling', 'air conditioning', 'air condition',
      'furnace', 'ac repair', 'heat pump', 'climate control', 'heating & cooling'],
  },
};

// Review-count sweet spot: established enough to have money, small enough to be
// owner-run and feel the pain. Outside this band still scores, just lower.
const REVIEW_MIN = 8;
const REVIEW_MAX = 300;
const TOP_N_DEFAULT = 20;

// National chains / directories / aggregators — flagged, not auto-killed, since
// a local franchisee can still be a great client. You decide on review.
const CHAIN_HINTS = ['servpro', 'servicemaster', 'roto-rooter', 'rotorooter',
  'one hour', 'aire serv', 'mr. rooter', 'paul davis', 'yelp', 'angi',
  'homeadvisor', 'thumbtack', 'franchise'];

// ── tiny RFC4180-ish CSV parser (handles quotes, commas, newlines in fields) ─
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const s = text.replace(/^\uFEFF/, ''); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignore, handled by \n */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length && r.some((v) => v.trim() !== ''));
}

// Map raw headers to the canonical fields we score on. First unused header that
// contains one of the candidate substrings wins (priority order matters so
// e.g. "reviews_count" is claimed before "rating" can grab a *_rating_* header).
const FIELD_CANDIDATES = [
  ['business', ['name', 'business', 'company', 'title']],
  ['website', ['website', 'site', 'url', 'domain']],
  ['email', ['email', 'e-mail']],
  ['phone', ['phone', 'telephone', 'contact number']],
  ['reviews', ['reviews', 'review_count', 'reviews_count', 'user_ratings_total', 'num_reviews']],
  ['rating', ['rating', 'stars', 'avg_rating']],
  ['category', ['category', 'categories', 'type', 'subtypes', 'main_category']],
  ['city', ['city', 'locality']],
  ['state', ['state', 'region', 'province']],
  ['address', ['full_address', 'address', 'formatted_address']],
  ['facebook', ['facebook']],
  ['instagram', ['instagram']],
  ['linkedin', ['linkedin']],
];

export function detectColumns(headerRow) {
  const headers = headerRow.map((h) => h.trim().toLowerCase());
  const used = new Set();
  const map = {};
  for (const [field, cands] of FIELD_CANDIDATES) {
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      if (cands.some((c) => headers[i].includes(c))) { map[field] = i; used.add(i); break; }
    }
  }
  return map;
}

const get = (row, map, field) => (map[field] != null ? (row[map[field]] || '').trim() : '');
const hasVal = (v) => v != null && String(v).trim() !== '';
const num = (v) => { const n = parseInt(String(v).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : null; };

// ── the scoring rubric (transparent + additive) ─────────────────────────────
export function scoreRow(row, map, niches) {
  const business = get(row, map, 'business');
  const category = `${get(row, map, 'category')} ${business}`.toLowerCase();
  const website = get(row, map, 'website');
  const email = get(row, map, 'email');
  const phone = get(row, map, 'phone');
  const reviews = num(get(row, map, 'reviews'));
  const rating = parseFloat(get(row, map, 'rating')) || null;
  const social = [get(row, map, 'facebook'), get(row, map, 'instagram'), get(row, map, 'linkedin')].some(hasVal);

  // niche match (required)
  let matchedNiche = null;
  for (const key of niches) {
    if (NICHES[key].keywords.some((k) => category.includes(k))) { matchedNiche = key; break; }
  }

  const why = [];
  // Hard disqualifiers: not the niche, or unreachable + un-testable.
  if (!matchedNiche) return { score: 0, disqualified: 'off-niche', why: ['category does not match target niche'], niche: null, business, website, email, phone, reviews, rating };
  if (!hasVal(phone) && !hasVal(website) && !hasVal(email)) {
    return { score: 0, disqualified: 'unreachable', why: ['no phone, website, or email'], niche: matchedNiche, business, website, email, phone, reviews, rating };
  }

  let score = 30; why.push(`${NICHES[matchedNiche].label} match`);

  if (reviews != null && reviews >= REVIEW_MIN && reviews <= REVIEW_MAX) { score += 20; why.push(`${reviews} reviews (owner-run sweet spot)`); }
  else if (reviews != null && reviews > REVIEW_MAX) { score += 6; why.push(`${reviews} reviews (may be large/franchise)`); }
  else if (reviews != null) { score += 6; why.push(`${reviews} reviews (young/unproven)`); }

  if (hasVal(phone)) { score += 8; why.push('phone (gap-testable)'); }
  if (hasVal(website)) { score += 15; why.push('website (form-gap testable)'); }
  if (hasVal(email)) { score += 15; why.push('email (contactable at scale)'); }
  if (social) { score += 10; why.push('social (alt channel)'); }
  if (rating != null && rating >= 3.5 && rating <= 4.8) { score += 5; why.push(`${rating}★ (real, room to grow)`); }

  const isChain = CHAIN_HINTS.some((h) => business.toLowerCase().includes(h));
  if (isChain) { score -= 15; why.push('⚠ possible chain/franchise — verify it is locally owned'); }

  return { score: Math.max(0, score), disqualified: null, why, niche: matchedNiche, business, website, email, phone, reviews, rating, city: get(row, map, 'city'), state: get(row, map, 'state') };
}

export function rankLeads(rows, niches, topN) {
  if (!rows.length) return [];
  const map = detectColumns(rows[0]);
  const scored = rows.slice(1)
    .map((r) => scoreRow(r, map, niches))
    .filter((s) => !s.disqualified && s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// ── output writers ──────────────────────────────────────────────────────────
const csvCell = (v) => {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Matches the header of Agency Sales Kit/outreach-tracker.csv, with a leading
// Score/Why so the shortlist pastes straight under your tracker sheet.
const TRACKER_HEADER = ['Score', 'Why', 'Date Added', 'Business', 'Type', 'City', 'Contact',
  'Channel', 'Gap Found', 'Proof Sent', 'Stage', 'Last Touch', 'Next Action',
  'Next Action Date', 'Setup $', 'Retainer $/mo', 'Notes'];

function toTrackerCsv(leads, dateStr) {
  const lines = [TRACKER_HEADER.map(csvCell).join(',')];
  for (const l of leads) {
    lines.push([
      l.score, l.why.join('; '), dateStr, l.business, NICHES[l.niche].label,
      l.city || '', '', '', '', '', 'Sourced', '', 'Verify ads + test phone gap', '',
      '', '', [l.website, l.email, l.phone].filter(Boolean).join(' | '),
    ].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}

function toOpeners(leads) {
  const out = ['# Drafted openers — fill {{GAP}} after you test their line/form\n'];
  for (const l of leads) {
    const shortName = (l.business || 'there').split(/\s+/)[0];
    out.push(`## ${l.business}  (score ${l.score} · ${NICHES[l.niche].label}${l.city ? ' · ' + l.city : ''})`);
    out.push(`Contact: ${[l.website, l.email, l.phone].filter(Boolean).join('  ·  ') || '(find owner)'}`);
    out.push('');
    out.push(`**Touch 1 — email/DM (lead with the proof):**`);
    out.push(`> Subject: called ${shortName} after hours`);
    out.push(`>`);
    out.push(`> Hey — I called your line after hours and {{GAP: e.g. it went to voicemail / rang out}}. For a ${NICHES[l.niche].label.toLowerCase()} company that's a booked job going to whoever picks up first. I build an AI front desk that answers 24/7, qualifies, and books — and I test it so it never says the wrong thing to a customer. Want a 60-sec clip of what yours does today?`);
    out.push('');
    out.push(`**Touch 2 (day 3-4, other channel):** short nudge + the clip.`);
    out.push(`**Touch 3 (day 7, call):** "I sent over a clip of your after-hours line — worth 10 min?"`);
    out.push('\n---\n');
  }
  return out.join('\n');
}

// ── main ────────────────────────────────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')));
  const positional = args.filter((a) => !a.startsWith('--'));

  const input = positional[0]
    || (existsSync(`${OUTREACH}/leads-raw.csv`) ? `${OUTREACH}/leads-raw.csv` : `${OUTREACH}/leads-raw.example.csv`);
  const niches = (flags.niche && flags.niche !== 'all') ? [flags.niche] : Object.keys(NICHES);
  const topN = parseInt(flags.top, 10) || TOP_N_DEFAULT;

  if (!existsSync(input)) { console.error(`✗ input not found: ${input}`); process.exit(1); }
  for (const n of niches) if (!NICHES[n]) { console.error(`✗ unknown niche: ${n} (have: ${Object.keys(NICHES).join(', ')})`); process.exit(1); }

  const rows = parseCsv(readFileSync(input, 'utf8'));
  if (rows.length < 2) { console.error('✗ CSV has no data rows'); process.exit(1); }
  const total = rows.length - 1;
  const leads = rankLeads(rows, niches, topN);

  // Stamp with a passed-in date if present (scripts can't use Date.now under
  // some runners); default to today's ISO date otherwise.
  const dateStr = flags.date || new Date().toISOString().slice(0, 10);
  writeFileSync(`${OUTREACH}/shortlist.csv`, toTrackerCsv(leads, dateStr));
  writeFileSync(`${OUTREACH}/openers.md`, toOpeners(leads));

  console.log(`\n  scored ${total} rows → top ${leads.length} (niche: ${niches.join('+')})\n`);
  leads.slice(0, Math.min(leads.length, 20)).forEach((l, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${String(l.score).padStart(3)}] ${l.business}${l.city ? '  · ' + l.city : ''}`);
  });
  console.log(`\n  → outreach/shortlist.csv  (paste under your tracker)`);
  console.log(`  → outreach/openers.md     (fill {{GAP}} after testing each line)\n`);
  console.log(`  NEXT: on the top 20, verify each RUNS ADS (Google/LSA) + TEST THE PHONE.`);
  console.log(`        Those two manual checks are the real filter — the score just ranked the pool.\n`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main(process.argv);
