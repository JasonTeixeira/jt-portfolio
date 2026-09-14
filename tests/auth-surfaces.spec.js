// @ts-check
import { test, expect } from '@playwright/test';

/**
 * login/signup/reset/dashboard had zero E2E/a11y coverage despite being real
 * client-side flows. These assert they render (form present, correct heading),
 * stay noindex, and don't throw. (Audit medium finding.)
 */

const AUTH = [
  { path: '/login.html', heading: 'Welcome back' },
  { path: '/signup.html', heading: 'Start your portal' },
  { path: '/reset.html', heading: 'Reset password' }
];

for (const a of AUTH) {
  test(`${a.path} renders its form and stays noindex`, async ({ page }) => {
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/_vercel\/insights|\/api\/|favicon|404|Failed to load resource|net::ERR/.test(t)) errs.push(t); } });
    page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
    const resp = await page.goto(a.path);
    expect(resp && resp.status(), 'page loads').toBeLessThan(400);
    await expect(page.locator('h1, h2').filter({ hasText: a.heading }).first()).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    expect(await page.locator('meta[name="robots"]').getAttribute('content'), 'private surface must be noindex').toContain('noindex');
    expect(errs, 'console errors').toEqual([]);
  });
}

test('/dashboard.html renders a calm logged-out state without crashing', async ({ page }) => {
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/_vercel\/insights|\/api\/|favicon|404|Failed to load resource|net::ERR/.test(t)) errs.push(t); } });
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await page.goto('/dashboard.html');
  await page.waitForTimeout(700); // client-rendered by dashboard.mjs
  expect(await page.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex');
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length, 'dashboard rendered content (not blank)').toBeGreaterThan(20);
  expect(errs, 'console errors').toEqual([]);
});
