#!/usr/bin/env node
/** build-checklist-pdf.mjs — renders checklist.html (print styles) to assets/llm-eval-checklist.pdf */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + resolve('checklist.html'));
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: 'assets/llm-eval-checklist.pdf',
  format: 'Letter',
  margin: { top: '0.6in', bottom: '0.6in', left: '0.7in', right: '0.7in' },
  printBackground: false
});
await browser.close();
console.log('✓ assets/llm-eval-checklist.pdf rendered');
