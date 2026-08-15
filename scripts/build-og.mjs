#!/usr/bin/env node
/** build-og.mjs — renders scripts/og-template.html to assets/og.png (1200×630). */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + resolve('scripts/og-template.html'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'assets/og.png' });
await browser.close();
console.log('✓ assets/og.png rendered (1200×630)');
