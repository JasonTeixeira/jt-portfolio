#!/usr/bin/env node
/**
 * scripts/source-smb.mjs — local-SMB outbound sourcer (Lane A: AI automation).
 *
 * Pipeline: Google Places (find businesses by trade × metro) → Hunter (domain → email) →
 *           ZeroBounce (verify) → AI-score (closeability + AI-front-desk opener) → CRM.
 *
 * Businesses with NO website are flagged separately (they're often the best automation
 * prospects but need a phone/SMS motion, not email) and not written to the email pipeline.
 *
 * Env (all gated — missing key degrades cleanly, never crashes):
 *   GOOGLE_PLACES_API_KEY  required — GCP key with Places API (New) enabled
 *   HUNTER_API_KEY         required for email — turns a business domain into a contact email
 *   ZEROBOUNCE_API_KEY     optional — verify before send
 *   LLM_*                  optional — AI closeability score + personalized opener
 *   SUPABASE_*             required to persist (dry-run works without it)
 *
 * Usage:
 *   node scripts/source-smb.mjs --vertical home-services --metros "Phoenix, AZ" --limit 50
 *   node scripts/source-smb.mjs --config icp/legal.json --dry-run
 */

import { readFileSync } from 'node:fs';
import { isEnabled as placesEnabled, searchBusinesses } from '../lib/places.mjs';
import { isEnabled as hunterEnabled, findEmail } from '../lib/hunter.mjs';
import { isEnabled as verifyEnabled, verifyEmail } from '../lib/lead-verify.mjs';
import { isEnabled as llmEnabled, scoreBusiness } from '../lib/lead-score.mjs';
import { isEnabled as dbEnabled, upsertOutboundProspect } from '../lib/scope-db.mjs';

// When no paid verifier is configured, drop emails Hunter is less confident about than this
// (0-100). Keeps deliverability safe for free. Tune via HUNTER_MIN_CONFIDENCE.
const MIN_HUNTER_CONFIDENCE = Number(process.env.HUNTER_MIN_CONFIDENCE) || 40;

// The AI front desk is delivered remotely, so geography is irrelevant to fulfillment — we
// source by VERTICAL nationwide. These are high-density US metros for maximum match volume;
// --metros "all" (or "nationwide") sweeps all of them, biggest markets first.
const TOP_METROS = [
  'Houston, TX', 'Dallas, TX', 'Phoenix, AZ', 'Los Angeles, CA', 'Chicago, IL',
  'Atlanta, GA', 'Miami, FL', 'Tampa, FL', 'Orlando, FL', 'San Antonio, TX',
  'Charlotte, NC', 'Denver, CO', 'Las Vegas, NV', 'Nashville, TN', 'Austin, TX',
  'Jacksonville, FL', 'Columbus, OH', 'Indianapolis, IN', 'San Diego, CA', 'Sacramento, CA',
];

function parseArgs(argv) {
  const a = { vertical: null, config: null, metros: null, limit: 50, minScore: 0, dryRun: false, verify: true };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === '--dry-run') a.dryRun = true;
    else if (k === '--no-verify') a.verify = false;
    else if (k === '--vertical') a.vertical = argv[++i];
    else if (k === '--config') a.config = argv[++i];
    else if (k === '--metros') a.metros = argv[++i];
    else if (k === '--limit') a.limit = Math.max(1, Number(argv[++i]) || 50);
    else if (k === '--min-score') a.minScore = Math.max(0, Number(argv[++i]) || 0);
  }
  return a;
}

function loadConfig(args) {
  const path = args.config || (args.vertical ? `icp/${args.vertical}.json` : null);
  let cfg = { queries: [], metros: [] };
  if (path) {
    try { cfg = { ...cfg, ...JSON.parse(readFileSync(path, 'utf8')) }; }
    catch (e) { console.error(`[smb] could not read ${path}: ${e.message}`); }
  }
  if (args.metros) {
    const m = args.metros.trim().toLowerCase();
    cfg.metros = (m === 'all' || m === 'nationwide')
      ? TOP_METROS
      : args.metros.split(';').map((s) => s.trim()).filter(Boolean);
  }
  // Config metros of ["nationwide"] / ["all"] also expand to the full metro sweep.
  if (cfg.metros.length === 1 && /^(all|nationwide)$/i.test(cfg.metros[0])) cfg.metros = TOP_METROS;
  return cfg;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!placesEnabled()) {
    console.log('\n⚠  GOOGLE_PLACES_API_KEY is not set — cannot source local businesses.\n');
    console.log('  1. GCP console → enable "Places API (New)" → create an API key');
    console.log('  2. export GOOGLE_PLACES_API_KEY=...  (and HUNTER_API_KEY for emails)');
    console.log('  3. re-run: node scripts/source-smb.mjs --vertical home-services --metros "Phoenix, AZ"\n');
    process.exit(0);
  }

  const cfg = loadConfig(args);
  if (!cfg.queries.length || !cfg.metros.length) {
    console.error('[smb] need queries + metros (via --vertical <name> / --config <path> and --metros).');
    process.exit(1);
  }
  const verifyMode = args.verify && verifyEnabled() ? 'zerobounce'
    : (hunterEnabled() ? `hunter-confidence≥${MIN_HUNTER_CONFIDENCE} (free)` : 'off');
  console.log(`[smb] places=on hunter=${hunterEnabled() ? 'on' : 'OFF (no emails)'} verify=${verifyMode} llm=${llmEnabled() ? 'on' : 'rule-based'} db=${dbEnabled() && !args.dryRun ? 'on' : (args.dryRun ? 'dry-run' : 'OFF')}`);
  console.log(`[smb] ${cfg.queries.length} trades × ${cfg.metros.length} metro(s) · target ${args.limit} leads\n`);

  const stats = { seen: 0, noWebsite: 0, noEmail: 0, invalid: 0, belowScore: 0, sourced: 0, updated: 0, byTier: { A: 0, B: 0, C: 0 } };
  const noWebsite = []; const preview = [];

  outer:
  for (const metro of cfg.metros) {
    for (const trade of cfg.queries) {
      let pageToken = null;
      for (let page = 0; page < 3; page += 1) { // up to ~60 businesses per trade×metro
        if (stats.sourced + stats.updated >= args.limit) break outer;
        const res = await searchBusinesses(`${trade} in ${metro}`, pageToken);
        if (!res.ok) { console.error(`[smb] places "${trade} in ${metro}": ${res.error}`); break; }
        for (const biz of res.data.businesses) {
          if (stats.sourced + stats.updated >= args.limit) break outer;
          if (!biz.operational) continue;
          stats.seen += 1;

          if (!biz.domain) { stats.noWebsite += 1; noWebsite.push({ name: biz.name, phone: biz.phone, trade }); continue; }

          // 1. domain → email (capture Hunter's confidence — a FREE deliverability signal)
          let email = null; let hunterConf = null;
          if (hunterEnabled()) { const h = await findEmail(biz.domain); if (h.ok && h.data) { email = h.data.email; hunterConf = h.data.confidence; } }
          if (!email) { stats.noEmail += 1; continue; }

          // 2. deliverability gate. Prefer a paid verifier (ZeroBounce) if configured; otherwise
          // fall back to Hunter's confidence score (FREE — already paid for) so we still drop
          // low-quality addresses without any extra subscription.
          let verifyStatus = hunterConf != null ? `hunter-${hunterConf}` : 'unverified';
          if (args.verify && verifyEnabled()) {
            const v = await verifyEmail(email);
            if (v.ok) { verifyStatus = v.data.status; if (!v.data.deliverable) { stats.invalid += 1; continue; } }
          } else if (hunterConf != null && hunterConf < MIN_HUNTER_CONFIDENCE) {
            stats.invalid += 1; continue; // free gate: skip risky low-confidence emails
          }

          // 3. closeability score + AI-front-desk opener
          const s = (await scoreBusiness({ name: biz.name, type: trade, website: biz.website, reviews: biz.reviews, address: biz.address })).data;
          if (s.score < args.minScore) { stats.belowScore += 1; continue; }
          stats.byTier[s.tier] = (stats.byTier[s.tier] || 0) + 1;
          preview.push({ email, name: biz.name, tier: s.tier, score: s.score, trade });

          // 4. persist
          if (args.dryRun) { stats.sourced += 1; continue; }
          const up = await upsertOutboundProspect({
            email, name: biz.name, company: biz.name, title: trade, vertical: s.vertical, phone: biz.phone,
            channel: 'places', score: s.score, tier: s.tier, reason: s.reason, opener: s.opener,
            automations: s.automations, verifyStatus,
          });
          if (!up.ok) { console.error(`[smb] upsert failed ${email}: ${up.error}`); continue; }
          if (up.data.existed) stats.updated += 1; else stats.sourced += 1;
        }
        pageToken = res.data.nextPageToken;
        if (!pageToken) break;
      }
    }
  }

  console.log('\n── sourced (top by score) ──');
  preview.sort((a, b) => b.score - a.score).slice(0, 15)
    .forEach((p) => console.log(`  [${p.tier}] ${String(p.score).padStart(3)} · ${p.email} · ${p.name} (${p.trade})`));
  if (noWebsite.length) {
    console.log(`\n── ${noWebsite.length} no-website prospects (hand to a CALL/SMS motion — often the best leads) ──`);
    noWebsite.slice(0, 10).forEach((n) => console.log(`  ${n.phone || '(no phone)'} · ${n.name} (${n.trade})`));
  }
  console.log('\n── summary ──');
  console.log(`  seen ${stats.seen} · no-website ${stats.noWebsite} · no-email ${stats.noEmail} · undeliverable ${stats.invalid} · below-score ${stats.belowScore}`);
  console.log(`  NEW ${stats.sourced} · updated ${stats.updated} · tiers A:${stats.byTier.A} B:${stats.byTier.B} C:${stats.byTier.C}`);
  console.log(args.dryRun ? '  (dry-run — nothing written)\n' : '  → review in the admin cockpit, then enroll good leads in the outbound sequence.\n');
}

main().catch((e) => { console.error('[smb] fatal', e); process.exit(1); });
