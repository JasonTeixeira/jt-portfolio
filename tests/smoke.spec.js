// @ts-check
import { test, expect } from '@playwright/test';

/** Collect console errors + page errors for a page. */
function trackErrors(page) {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

test.describe('portfolio — index', () => {
  test('loads with correct title and hero claim', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/Jason Teixeira/);
    await expect(page.locator('h1')).toContainText('prove');
    expect(errors).toEqual([]);
  });

  test('renders all content collections', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#jt-projects article')).toHaveCount(5);
    await expect(page.locator('#jt-briefs article')).toHaveCount(3);
    await expect(page.locator('#jt-services article')).toHaveCount(3);
    await expect(page.locator('#jt-notes a')).toHaveCount(3);
  });

  test('dual funnel toggles and persists', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('#jt-root');
    await expect(root).toHaveAttribute('data-funnel', 'client');
    await expect(page.locator('#top .only-client a').first()).toBeVisible();

    await page.locator('button[data-set="hire"]').click();
    await expect(root).toHaveAttribute('data-funnel', 'hire');
    await expect(page.locator('#top .only-hire a').first()).toBeVisible();
    await expect(page.locator('#top .only-client a').first()).toBeHidden();

    await page.reload();
    await expect(root).toHaveAttribute('data-funnel', 'hire');
  });

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test('nav anchors resolve to real sections', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page.locator('nav a[href^="#"]').evaluateAll(
      (as) => as.map((a) => a.getAttribute('href'))
    );
    for (const href of hrefs) {
      if (href === '#top') continue;
      await expect(page.locator(href)).toHaveCount(1);
    }
  });

  test('proof terminal types after scrolling into view', async ({ page }) => {
    await page.goto('/');
    await page.locator('#jt-term').scrollIntoViewIfNeeded();
    await expect
      .poll(async () => page.locator('#jt-term-body > div').count(), { timeout: 8000 })
      .toBeGreaterThan(3);
  });

  test('project GitHub links point at real repos', async ({ page }) => {
    await page.goto('/');
    const links = await page.locator('#jt-projects a[href*="github.com"]').evaluateAll(
      (as) => as.map((a) => a.getAttribute('href'))
    );
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const href of links) expect(href).toMatch(/^https:\/\/github\.com\/JasonTeixeira\//);
  });

  test('self-proof strip renders from real scorecard', async ({ page }) => {
    await page.goto('/');
    const strip = page.locator('#jt-selfproof');
    await expect(strip).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#jt-selfproof-detail')).toContainText(/\d+ checks passed/);
    await expect(page.locator('#jt-selfproof-detail')).toContainText('npm run proof');
  });

  test('footer year is current', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer [data-year]').first()).toHaveText(String(new Date().getFullYear()));
  });
});

test.describe('portfolio — SEO', () => {
  test('all content is present with JavaScript disabled', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('#jt-projects article')).toHaveCount(5);
    await expect(page.locator('#jt-briefs article')).toHaveCount(3);
    await expect(page.locator('#jt-services article')).toHaveCount(3);
    await expect(page.locator('#jt-notes a')).toHaveCount(3);
    await expect(page.locator('body')).toContainText('RAG that cites or shuts up');
    await ctx.close();
  });
});

test.describe('portfolio — field notes', () => {
  test('loads with 3 articles and working back link', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/field-notes.html');
    await expect(page).toHaveTitle(/Field Notes/);
    await expect(page.locator('article')).toHaveCount(3);
    await page.locator('nav a[href="index.html"]').last().click();
    await expect(page).toHaveURL(/index\.html/);
    expect(errors).toEqual([]);
  });

  test('note anchors from index resolve', async ({ page }) => {
    await page.goto('/field-notes.html#note-2');
    await expect(page.locator('#note-2')).toBeVisible();
  });
});
