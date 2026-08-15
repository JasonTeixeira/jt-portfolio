#!/usr/bin/env node
/** build-checklist-pdf.mjs — renders one-pager.html (print styles) to assets/Jason-Teixeira-One-Pager.pdf */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + resolve('one-pager.html'));
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: 'assets/Jason-Teixeira-One-Pager.pdf',
  format: 'Letter',
  margin: { top: '0.6in', bottom: '0.6in', left: '0.7in', right: '0.7in' },
  printBackground: false
});
await browser.close();
console.log('✓ assets/Jason-Teixeira-One-Pager.pdf rendered');
