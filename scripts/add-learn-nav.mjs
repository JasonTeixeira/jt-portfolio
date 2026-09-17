#!/usr/bin/env node
/**
 * One-shot, idempotent: add a "Learn" link to the site nav on every root-level
 * page that has the primary nav, immediately BEFORE the "Docs" link. Safe to
 * re-run — skips any page that already has the Learn link.
 *
 * Run: node scripts/add-learn-nav.mjs   (also part of `npm run build:learn`)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const DOCS_LINK = /(<a href="docs\.html" class="site-nav-link"[^>]*>Docs<\/a>)/;
const LEARN_LINK = '<a href="learn.html" class="site-nav-link">Learn</a>\n      ';

const files = readdirSync('.').filter((f) => f.endsWith('.html'));
let changed = 0;
const touched = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!DOCS_LINK.test(src)) continue;                                 // no primary nav on this page
  if (/href="learn\.html" class="site-nav-link"/.test(src)) continue; // already has Learn
  const out = src.replace(DOCS_LINK, `${LEARN_LINK}$1`);
  if (out !== src) { writeFileSync(f, out); changed++; touched.push(f); }
}
console.log(`add-learn-nav: added Learn link to ${changed} page(s)${touched.length ? ' — ' + touched.join(', ') : ''}`);
