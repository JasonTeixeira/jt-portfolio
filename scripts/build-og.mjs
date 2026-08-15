#!/usr/bin/env node
/**
 * build-og.mjs — renders the site OG card plus one card per field note
 * (assets/og.png, assets/og-note-<slug>.png), all from the same template.
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { NOTES } from './notes.data.mjs';
import { SERVICES } from './services.data.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + resolve('scripts/og-template.html'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'assets/og.png' });

for (const n of NOTES) {
  await page.evaluate((note) => {
    document.querySelector('.kicker span:last-child').innerHTML =
      '<span class="green">field notes</span> — proof-first engineering · ' + note.read;
    const h1 = document.querySelector('h1');
    h1.textContent = note.title;
    h1.style.fontSize = note.title.length > 48 ? '72px' : '84px';
    document.querySelector('.stats').innerHTML =
      'note ' + note.num + ' · ' + note.dateLabel + '<br>agency.sageideas.dev';
  }, n);
  await page.screenshot({ path: `assets/og-note-${n.slug}.png` });
}
for (const s of SERVICES) {
  await page.evaluate((svc) => {
    document.querySelector('.kicker span:last-child').innerHTML =
      '<span class="green">service</span> — ' + svc.keyword + ' · fixed scope · 4 weeks';
    const h1 = document.querySelector('h1');
    h1.textContent = svc.h1;
    h1.style.fontSize = svc.h1.length > 44 ? '76px' : '86px';
    document.querySelector('.stats').innerHTML =
      'free 30-min intro call<br>agency.sageideas.dev';
  }, s);
  await page.screenshot({ path: `assets/og-service-${s.slug}.png` });
}
await browser.close();
console.log(`✓ rendered assets/og.png + ${NOTES.length} note cards + ${SERVICES.length} service cards (1200×630)`);
