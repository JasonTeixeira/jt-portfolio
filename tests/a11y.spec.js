// @ts-check
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/field-notes.html', '/notes/no-fake-green.html'];

for (const path of PAGES) {
  test(`axe scan — ${path} has no serious/critical violations`, async ({ page }) => {
    // measure resting state: our CSS disables animations under reduced motion,
    // so scroll-linked reveals don't hold elements at low opacity mid-scan
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`)
    ).toEqual([]);
  });
}
