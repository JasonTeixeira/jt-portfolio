// @ts-check
import { test, expect } from '@playwright/test';

/**
 * The 120 localized es/pt pages had zero test coverage. This asserts each locale's
 * homepage + key funnel pages actually render: correct <html lang>, a visible H1,
 * the language switcher, and no unexpected console errors. (Audit high finding.)
 */

const LOCALES = ['es', 'pt'];
const PAGES = ['index.html', 'services.html', 'book.html', 'ai-agent-testing.html', 'reduce-test-flakiness.html'];

for (const loc of LOCALES) {
  for (const pg of PAGES) {
    test(`/${loc}/${pg} renders correctly`, async ({ page }) => {
      const errs = [];
      page.on('console', (m) => {
        if (m.type() === 'error') {
          const t = m.text();
          // ignore infra noise + WebKit's native <video> control-chrome complaints
          // (pip/airplay/placard button icons) that only surface on the mobile player
          if (!/_vercel\/insights|\/api\/|favicon|net::ERR|404|Failed to load resource|placard|Button failed to load/.test(t)) errs.push(t);
        }
      });
      page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
      await page.goto(`/${loc}/${pg}`);
      await expect(page.locator('h1').first()).toBeVisible();
      expect(await page.getAttribute('html', 'lang')).toBe(loc);
      // the injected language switcher marks the current locale
      await expect(page.locator('[data-i18n="1"]')).toHaveCount(1);
      expect(errs, `console errors on /${loc}/${pg}`).toEqual([]);
    });
  }
}
