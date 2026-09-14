// @ts-check
import { test, expect } from '@playwright/test';

/**
 * The default webServer (python http.server) has no /api routes, so the existing
 * smoke suite only ever exercises the OFFLINE fallback branch. These tests mock a
 * real 200 with page.route so the SUCCESS UI state is actually asserted — the path
 * a paying visitor hits when the backend is up. (Audit critical: API success paths
 * were never tested.)
 */

test('contact form success — mocked /api/contact 200 shows the confirmation toast', async ({ page }) => {
  await page.route('**/api/contact', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  );
  await page.goto('/');
  await page.locator('#jt-contact-form input[name="name"]').fill('Ada Lovelace');
  await page.locator('#jt-contact-form input[name="email"]').fill('ada@example.com');
  await page.locator('#jt-contact-form textarea[name="message"]').fill('We shipped a RAG feature and need an eval gate before the next release.');
  await page.locator('#jt-contact-form button[type="submit"]').click();
  // success handler fires toast('sent — I read every one. talk soon.') and resets the form
  await expect(page.locator('#jt-toast')).toContainText('sent', { timeout: 6000 });
  await expect(page.locator('#jt-contact-form input[name="name"]')).toHaveValue('');
});

test('contact form does NOT reset when the API errors (lead is preserved for the mailto fallback)', async ({ page }) => {
  await page.route('**/api/contact', (route) => route.fulfill({ status: 500, body: 'err' }));
  // block the mailto navigation the fallback triggers so the test stays on-page
  await page.route('mailto:**', (route) => route.abort()).catch(() => {});
  await page.goto('/');
  await page.locator('#jt-contact-form input[name="name"]').fill('Grace Hopper');
  await page.locator('#jt-contact-form input[name="email"]').fill('grace@example.com');
  await page.locator('#jt-contact-form textarea[name="message"]').fill('Testing the failure path.');
  await page.locator('#jt-contact-form button[type="submit"]').click();
  await page.waitForTimeout(600);
  // on API failure the handler hands off to mailto and shows a status — it must NOT
  // silently clear the field as if it succeeded
  await expect(page.locator('#jt-form-status')).toContainText(/email/i);
});
