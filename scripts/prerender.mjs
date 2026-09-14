#!/usr/bin/env node
/**
 * prerender.mjs — bakes JS-rendered collections into static HTML so crawlers
 * (and no-JS visitors) see full content. The runtime renderers are the single
 * source of truth; each one clears its mount before rebuilding, so a baked page
 * simply gets replaced with an identical render on load — never double-rendered.
 *
 * Idempotent: replaces the innerHTML of each mount div in place.
 *
 * TARGETS drives which files/mounts are baked. index.html renders via site.js;
 * services.html renders via its own inline IIFE (path / svcgrid / capgrid) — the
 * flagship + capability copy that would otherwise be invisible to crawlers.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const TARGETS = [
  {
    file: 'index.html',
    mounts: ['jt-tape', 'jt-projects', 'jt-briefs', 'jt-services', 'jt-timeline', 'jt-notes'],
    waitFor: '#jt-projects article'
  },
  {
    file: 'services.html',
    mounts: ['path', 'svcgrid', 'capgrid'],
    // capgrid renders last in the IIFE; wait for a capability card to exist.
    waitFor: '#capgrid .cap'
  }
];

const browser = await chromium.launch();

for (const target of TARGETS) {
  await bakeFile(target);
}

await browser.close();

async function bakeFile({ file, mounts, waitFor }) {
  const FILE = resolve(file);
  let source = readFileSync(FILE, 'utf8');
  for (const id of mounts) {
    if (source.indexOf(`id="${id}"`) === -1) throw new Error(`mount #${id} not found in ${file}`);
  }

  // The runtime renderer clears each mount before rebuilding, so loading a
  // previously-baked file just re-renders identically. To keep the extraction a
  // fresh product of the current renderer + data (not replayed stale markup),
  // strip every mount into a temp copy first and render THAT.
  let stripped = source;
  for (const id of mounts) stripped = bake(stripped, id, '');
  const TMP = resolve(`.prerender-${file.replace(/[^a-z0-9]/gi, '_')}.html`);
  writeFileSync(TMP, stripped);

  const page = await browser.newPage();
  // file:// is fine: renderers use inline data; any network fetch (scorecard,
  // etc.) fails silently and its strip simply stays hidden during prerender.
  await page.goto('file://' + TMP);
  await page.waitForSelector(waitFor);

  // Reveal state (rise-pre/rise-in) is a runtime concern — never bake it, or
  // below-fold content ships opacity:0 for no-JS and reduced-motion users.
  // (No-op on pages that don't use the IntersectionObserver reveal system.)
  await page.evaluate(() => {
    document.querySelectorAll('.rise-pre, .rise-in').forEach((n) => {
      n.classList.remove('rise-pre', 'rise-in');
    });
  });

  const rendered = {};
  for (const id of mounts) {
    rendered[id] = await page.evaluate((mountId) => document.getElementById(mountId).innerHTML, id);
  }
  await page.close();
  unlinkSync(TMP);

  // Guard: never bake an empty mount over real content. A silent render failure
  // on any single mount would otherwise replace that section with nothing and
  // still report success — permanently, in the committed HTML.
  for (const id of mounts) {
    const len = (rendered[id] || '').trim().length;
    if (len < 20) {
      throw new Error(`prerender: ${file} mount #${id} rendered empty (${len} chars) — refusing to bake over real content`);
    }
  }

  for (const id of mounts) source = bake(source, id, rendered[id].trim());
  writeFileSync(FILE, source);

  const kb = (Buffer.byteLength(source, 'utf8') / 1024).toFixed(1);
  console.log(`✓ baked ${mounts.length} mounts into ${file} (${kb} KB)`);
}

/** Replace innerHTML of <div id="X" ...>…</div> in source, tracking nested divs. */
function bake(html, id, inner) {
  const idAttr = `id="${id}"`;
  const attrPos = html.indexOf(idAttr);
  if (attrPos === -1) throw new Error(`#${id} missing`);
  const openEnd = html.indexOf('>', attrPos) + 1;
  // find matching close tag, counting nesting
  let depth = 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = openEnd;
  let m;
  let closeStart = -1;
  while ((m = re.exec(html)) !== null) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) { closeStart = m.index; break; }
  }
  if (closeStart === -1) throw new Error(`#${id} close tag not found`);
  return html.slice(0, openEnd) + '\n' + inner + '\n' + html.slice(closeStart);
}
