#!/usr/bin/env node
/**
 * scripts/source-leads.mjs — the outbound engine's orchestrator.
 *
 * Pipeline:  Apollo search (ICP) → enrich (reveal email) → verify (deliverable?) →
 *            AI-score (fit + personalized opener) → upsert into scope_prospects (stage 'new',
 *            source 'outbound', score+opener in qualification).
 *
 * The operator runs this manually to fill the pipeline, then reviews the sourced leads in the
 * admin cockpit and enrolls the good ones into the outbound sequence (cron/nurture.js).
 *
 * Every external call is env-gated and non-fatal:
 *   APOLLO_API_KEY       required — no key, nothing to source (prints setup steps, exits 0)
 *   ZEROBOUNCE_API_KEY   optional — without it, leads are sourced but marked 'unverified'
 *   LLM_*                optional — without it, scoring/opener falls back to rule-based
 *   SUPABASE_*           required to persist (dry-run works without it)
 *
 * Usage:
 *   node scripts/source-leads.mjs --icp icp.json --pages 2 --limit 50 --min-score 55
 *   node scripts/source-leads.mjs --dry-run            # source + score, print, don't write
 *   node scripts/source-leads.mjs --no-verify          # skip email verification
 */

import { readFileSync } from 'node:fs';
import { isEnabled as apolloEnabled, searchPeople, enrichPerson } from '../lib/apollo.mjs';
import { isEnabled as verifyEnabled, verifyEmail } from '../lib/lead-verify.mjs';
import { isEnabled as llmEnabled, scoreLead } from '../lib/lead-score.mjs';
import { isEnabled as dbEnabled, upsertOutboundProspect } from '../lib/scope-db.mjs';

// Jason's default ICP: decision-makers at teams plausibly shipping AI/LLM features.
const DEFAULT_ICP = {
  titles: ['CTO', 'VP Engineering', 'Head of Engineering', 'Head of AI', 'Head of Machine Learning',
    'VP Product', 'Head of Product', 'Founder', 'Co-Founder', 'Director of Engineering'],
  employeeRanges: ['11,50', '51,200', '201,500'],
  keywords: ['artificial intelligence', 'machine learning', 'saas', 'llm', 'generative ai'],
  locations: ['United States'],
};

function parseArgs(argv) {
  const a = { pages: 1, limit: 25, minScore: 0, dryRun: false, verify: true, icp: null };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === '--dry-run') a.dryRun = true;
    else if (k === '--no-verify') a.verify = false;
    else if (k === '--pages') a.pages = Math.max(1, Number(argv[++i]) || 1);
    else if (k === '--limit') a.limit = Math.max(1, Number(argv[++i]) || 25);
    else if (k === '--min-score') a.minScore = Math.max(0, Number(argv[++i]) || 0);
    else if (k === '--icp') a.icp = argv[++i];
  }
  return a;
}

function loadIcp(path) {
  if (!path) return DEFAULT_ICP;
  try { return { ...DEFAULT_ICP, ...JSON.parse(readFileSync(path, 'utf8')) }; }
  catch (e) { console.error(`[source] could not read ICP ${path}: ${e.message} — using default`); return DEFAULT_ICP; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!apolloEnabled()) {
    console.log('\n⚠  APOLLO_API_KEY is not set — nothing to source.\n');
    console.log('  1. Get a key: Apollo dashboard → Settings → API');
    console.log('  2. export APOLLO_API_KEY=... (and optionally ZEROBOUNCE_API_KEY, LLM_*)');
    console.log('  3. re-run: node scripts/source-leads.mjs --pages 2 --limit 50\n');
    process.exit(0);
  }

  const icp = loadIcp(args.icp);
  console.log(`[source] apollo=on verify=${args.verify && verifyEnabled() ? 'on' : 'off'} llm=${llmEnabled() ? 'on' : 'rule-based'} db=${dbEnabled() && !args.dryRun ? 'on' : (args.dryRun ? 'dry-run' : 'OFF')}`);
  console.log(`[source] ICP titles=${icp.titles.length} keywords=${icp.keywords.join(', ')} · target ${args.limit} leads over ${args.pages} page(s)\n`);

  const stats = { seen: 0, noEmail: 0, invalid: 0, belowScore: 0, sourced: 0, updated: 0, byTier: { A: 0, B: 0, C: 0 } };
  const preview = [];

  for (let page = 1; page <= args.pages && stats.sourced + stats.updated < args.limit; page += 1) {
    const res = await searchPeople(icp, page, Math.min(100, args.limit));
    if (!res.ok) { console.error(`[source] apollo search failed: ${res.error}`); break; }
    if (!res.data.people.length) { console.log('[source] no more people from Apollo.'); break; }

    for (const raw of res.data.people) {
      if (stats.sourced + stats.updated >= args.limit) break;
      stats.seen += 1;

      // 1. reveal email if Apollo didn't include it
      let person = raw;
      if (!person.email) {
        const en = await enrichPerson(person);
        if (en.ok) person = en.data;
      }
      if (!person.email) { stats.noEmail += 1; continue; }

      // 2. verify deliverability (protect the sending domain)
      let verifyStatus = 'unverified';
      if (args.verify && verifyEnabled()) {
        const v = await verifyEmail(person.email);
        if (v.ok) {
          verifyStatus = v.data.status;
          if (!v.data.deliverable) { stats.invalid += 1; continue; } // don't source undeliverable
        }
      }

      // 3. AI-score + personalized opener
      const s = (await scoreLead(person)).data;
      if (s.score < args.minScore) { stats.belowScore += 1; continue; }
      stats.byTier[s.tier] = (stats.byTier[s.tier] || 0) + 1;

      preview.push({ email: person.email, name: person.name, company: person.company, tier: s.tier, score: s.score });

      // 4. persist (unless dry-run)
      if (args.dryRun) { stats.sourced += 1; continue; }
      const up = await upsertOutboundProspect({
        email: person.email, name: person.name, company: person.company, title: person.title,
        score: s.score, tier: s.tier, reason: s.reason, opener: s.opener, verifyStatus,
      });
      if (!up.ok) { console.error(`[source] upsert failed for ${person.email}: ${up.error}`); continue; }
      if (up.data.existed) stats.updated += 1; else stats.sourced += 1;
    }
  }

  console.log('\n── sourced (top by tier) ──');
  preview.sort((a, b) => b.score - a.score).slice(0, 15)
    .forEach((p) => console.log(`  [${p.tier}] ${String(p.score).padStart(3)} · ${p.email} · ${p.company || ''}`));
  console.log('\n── summary ──');
  console.log(`  seen ${stats.seen} · no-email ${stats.noEmail} · undeliverable ${stats.invalid} · below-score ${stats.belowScore}`);
  console.log(`  NEW ${stats.sourced} · updated ${stats.updated} · tiers A:${stats.byTier.A} B:${stats.byTier.B} C:${stats.byTier.C}`);
  if (args.dryRun) console.log('  (dry-run — nothing written to the CRM)');
  else console.log('  → review in the admin cockpit, then enroll good leads in the outbound sequence.\n');
}

main().catch((e) => { console.error('[source] fatal', e); process.exit(1); });
