#!/usr/bin/env node
/**
 * prerender.mjs — bakes the JS-rendered collections into index.html so
 * crawlers (and no-JS visitors) see full content. The runtime renderer in
 * site.js is the single source of truth; it skips mounts that already have
 * children, so baked pages never double-render.
 *
 * Idempotent: replaces the innerHTML of each mount div in place.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MOUNTS = ['jt-tape', 'jt-projects', 'jt-briefs', 'jt-services', 'jt-timeline', 'jt-notes'];
const FILE = resolve('index.html');

// Strip any previously-baked content so the runtime renderer repopulates from data.
let source = readFileSync(FILE, 'utf8');
for (const id of MOUNTS) {
  const start = source.indexOf(`id="${id}"`);
  if (start === -1) throw new Error(`mount #${id} not found in index.html`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
// file:// is fine: site.js renders from inline data; the scorecard fetch
// fails silently and the strip simply stays hidden during prerender.
await page.goto('file://' + FILE);
await page.waitForSelector('#jt-projects article');

const rendered = {};
for (const id of MOUNTS) {
  rendered[id] = await page.evaluate(
    (mountId) => document.getElementById(mountId).innerHTML,
    id
  );
}
await browser.close();

/** Replace innerHTML of <div id="X" ...>…</div> in source, tracking nested divs. */
function bake(html, id, inner) {
  const idAttr = `id="${id}"`;
  const attrPos = html.indexOf(idAttr);
  if (attrPos === -1) throw new Error(`#${id} missing`);
  const openStart = html.lastIndexOf('<div', attrPos);
  const openEnd = html.indexOf('>', attrPos) + 1;
  // find matching close tag, counting nesting
  let depth = 1;
  let i = openEnd;
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

for (const id of MOUNTS) source = bake(source, id, rendered[id].trim());
writeFileSync(FILE, source);

const kb = (Buffer.byteLength(source, 'utf8') / 1024).toFixed(1);
console.log(`✓ baked ${MOUNTS.length} mounts into index.html (${kb} KB)`);
