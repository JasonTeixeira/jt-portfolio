#!/usr/bin/env node
/**
 * One-shot, idempotent: add a "Lab" link to the site nav on every root-level
 * page, immediately after the "Work" (case-studies) link. Safe to re-run —
 * skips any page that already has the Lab link.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const WORK_LINK = /(<a href="case-studies\.html" class="site-nav-link"[^>]*>Work<\/a>)/;
const LAB_LINK = '\n      <a href="lab.html" class="site-nav-link">Lab</a>';

const files = readdirSync('.').filter((f) => f.endsWith('.html'));
let changed = 0;
const touched = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!WORK_LINK.test(src)) continue;               // page has no site-nav Work link
  if (src.includes('>lab.html" class="site-nav-link"') || /href="lab\.html" class="site-nav-link"/.test(src)) continue; // already has Lab
  const out = src.replace(WORK_LINK, `$1${LAB_LINK}`);
  if (out !== src) { writeFileSync(f, out); changed++; touched.push(f); }
}
console.log(`add-lab-nav: added Lab link to ${changed} page(s)${touched.length ? ' — ' + touched.join(', ') : ''}`);
