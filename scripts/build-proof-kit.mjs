#!/usr/bin/env node
/** build-proof-kit.mjs — renders the proof-kit HTML documents to branded PDFs
 *  (Letter, running footer with page numbers) plus a PNG preview of page 1 for QA.
 *  Add a document by appending to DOCS. Run: npm run build:proofkit */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const DOCS = [
  { src: 'sow-sample.html',      pdf: 'assets/Sage-Ideas-Sample-SOW.pdf',      png: 'assets/shots/doc-sow.png',      label: 'Statement of Work (sample)' },
  { src: 'msa-sample.html',      pdf: 'assets/Sage-Ideas-Sample-MSA.pdf',      png: 'assets/shots/doc-msa.png',      label: 'Master Services Agreement (sample)' },
  { src: 'work-onepager.html',   pdf: 'assets/Sage-Ideas-Selected-Work.pdf',   png: 'assets/shots/doc-work.png',     label: 'Selected Work one-pager' },
];

const footer = `
  <div style="width:100%;font-family:'JetBrains Mono',monospace;font-size:7px;color:#938C83;
       padding:0 0.7in;display:flex;justify-content:space-between;align-items:center;">
    <span>Sage Ideas LLC · Confidential</span>
    <span>hello@sageideas.dev · agency.sageideas.dev</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
const header = `<div></div>`;

mkdirSync(resolve('assets/shots'), { recursive: true });
const browser = await chromium.launch();
let ok = 0;
for (const d of DOCS) {
  const page = await browser.newPage();
  try {
    const res = await page.goto('file://' + resolve(d.src));
    if (!res || !res.ok()) { console.log(`  ⚠ skip ${d.src} (not found)`); await page.close(); continue; }
    await page.evaluate(() => document.fonts.ready);
    // PNG preview (screen styles, at paper width) for visual QA
    await page.setViewportSize({ width: 900, height: 1400 });
    await page.screenshot({ path: resolve(d.png), fullPage: true });
    // PDF (print styles + running footer)
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: resolve(d.pdf),
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer,
      margin: { top: '0.55in', bottom: '0.7in', left: '0.7in', right: '0.7in' },
    });
    console.log(`  ✓ ${d.pdf}  (${d.label})`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${d.src}: ${e.message}`);
  } finally {
    await page.close();
  }
}
await browser.close();
console.log(`\n${ok}/${DOCS.length} documents rendered.`);
