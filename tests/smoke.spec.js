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
    await expect(page.locator('#jt-notes a')).toHaveCount(5);
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

  test('command palette opens, filters, and navigates', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('ControlOrMeta+k');
    const paletteInput = page.locator('#jt-palette input');
    await expect(paletteInput).toBeFocused();
    await paletteInput.fill('briefs');
    await expect(page.locator('#jt-palette .item')).toHaveCount(1);
    await paletteInput.press('Enter');
    await expect(page.locator('#jt-palette')).not.toHaveClass(/open/);
    await expect(page).toHaveURL(/#briefs/);
    // esc closes
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.press('Escape');
    await expect(page.locator('#jt-palette')).not.toHaveClass(/open/);
  });

  test('copy-email button shows toast', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'clipboard permission prompt blocks headless webkit');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.locator('#jt-copy-email').click();
    await expect(page.locator('#jt-toast')).toHaveClass(/show/);
    await expect(page.locator('#jt-toast')).toContainText('hello@sageideas.dev');
  });

  test('track record: 3 roles, credentials, downloadable résumé', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('#record .xp-row')).toHaveCount(3);
    await expect(page.locator('#record')).toContainText('The Home Depot');
    await expect(page.locator('#record')).toContainText('HighStrike');
    await expect(page.locator('#record .cred-chip')).toHaveCount(6);
    await expect(page.locator('#record')).toContainText('ISTQB CT-AI');
    const pdf = await request.get('/assets/Jason-Teixeira-Resume.pdf');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('pdf');
  });

  test('briefs: outcome-first with working full-spec expander', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#jt-briefs .brief-outcome')).toHaveCount(3);
    const first = page.locator('#jt-briefs details.brief-more').first();
    await expect(first.locator('summary')).toContainText('view full spec');
    // deep sections hidden until opened
    const arch = page.locator('#jt-briefs article').first().getByText('Why not a chatbot');
    await expect(arch).toBeHidden();
    await first.locator('summary').click();
    await expect(arch).toBeVisible();
  });

  test('FAQ expands and pull-quote band present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('details.faq')).toHaveCount(6);
    const q = page.locator('details.faq').first();
    await q.locator('summary').click();
    await expect(q.locator('p')).toBeVisible();
    await expect(page.locator('.quote-band blockquote')).toContainText('Build the gate');
  });

  test('no circular links to own domain; FAQPage schema present', async ({ page }) => {
    await page.goto('/');
    const circular = await page.locator('a[href*="agency.sageideas.dev"]').count();
    expect(circular).toBe(0);
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = schemas.map((s) => JSON.parse(s)['@type']);
    expect(types).toContain('Person');
    expect(types).toContain('FAQPage');
  });

  test('contact form validates and falls back to mailto when API is absent', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('#jt-contact-form');
    await form.scrollIntoViewIfNeeded();
    await form.locator('[name="name"]').fill('Test Client');
    await form.locator('[name="email"]').fill('client@example.com');
    await form.locator('[name="message"]').fill('We ship an LLM feature with no evals.');
    await form.locator('button[type="submit"]').click();
    // local static server has no /api — the fallback path must engage
    await expect(page.locator('#jt-form-status')).toContainText('email app', { timeout: 5000 });
  });

  test('per-post OG images exist and are referenced', async ({ page, request }) => {
    await page.goto('/notes/no-fake-green.html');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-note-no-fake-green\.png/);
    const img = await request.get('/assets/og-note-no-fake-green.png');
    expect(img.status()).toBe(200);
  });

  test('architecture diagrams render for all five projects', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#jt-projects svg[aria-label="architecture diagram"]')).toHaveCount(5);
    // node labels present in the baked SVG
    await expect(page.locator('#jt-projects')).toContainText('LLM router');
    await expect(page.locator('#jt-projects')).toContainText('proof ledger');
  });

  test('checklist page + PDF exist; subscribe widget renders with fallback', async ({ page, request }) => {
    const ck = await request.get('/checklist.html');
    expect(ck.status()).toBe(200);
    const pdf = await request.get('/assets/llm-eval-checklist.pdf');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('pdf');

    await page.goto('/notes/no-fake-green.html');
    const widget = page.locator('[data-subscribe] form');
    await expect(widget).toBeVisible();
    await widget.locator('input[name="email"]').fill('reader@example.com');
    await widget.locator('button[type="submit"]').click();
    // no /api locally — the manual-subscribe fallback must engage
    await expect(page.locator('[data-sub-status]')).toContainText('hello@sageideas.dev', { timeout: 5000 });
  });

  test('real-run captures: linked from cards, honest red gate visible', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('#jt-projects a[href="captures/nexural-qa-os.html"]')).toHaveCount(1);
    await expect(page.locator('#jt-projects a[href="captures/playwright-suite.html"]')).toHaveCount(1);
    const cap = await request.get('/captures/nexural-qa-os.html');
    expect(cap.status()).toBe(200);
    const text = await cap.text();
    expect(text).toContain('NOT PROVEN');       // the honest red verdict ships verbatim
    expect(text).toContain('12/13 gates');
    expect(text).toContain('noindex');
    // the same-day green rerun is published beside it
    await expect(page.locator('#jt-projects a[href="captures/nexural-qa-os-fixed.html"]')).toHaveCount(1);
    const fixed = await request.get('/captures/nexural-qa-os-fixed.html');
    expect(fixed.status()).toBe(200);
    expect(await fixed.text()).toContain('PROVEN ✓  —  13/13 gates');
    // hero terminal replays the full arc: red verdict then green verdict
    await page.locator('#jt-term').scrollIntoViewIfNeeded();
    await expect(page.locator('#jt-term-body')).toContainText('NOT PROVEN', { timeout: 10000 });
    await expect(page.locator('#jt-term-body')).toContainText('PROVEN ✓ — 13/13', { timeout: 10000 });
  });

  test('scored diagnostic: score bar updates and adapts CTA to weakest group', async ({ page }) => {
    await page.goto('/checklist.html');
    const bar = page.locator('#ck-score');
    await expect(bar).toContainText('0/18');
    // tick everything except the safety battery
    const groups = page.locator('.ck-group');
    for (let g = 0; g < 5; g++) {
      if ((await groups.nth(g).locator('h2').textContent()) === 'Safety battery') continue;
      for (const box of await groups.nth(g).locator('[data-ck]').all()) await box.check();
    }
    await expect(bar).toContainText('13/18');
    await expect(bar).toContainText('safety battery');
    await expect(bar.locator('a')).toHaveAttribute('href', /llm-evaluation-qa/);
    // persists across reload
    await page.reload();
    await expect(page.locator('#ck-score')).toContainText('13/18');
  });

  test('404 page and comparison table and delta bars', async ({ page, request }) => {
    const nf = await request.get('/404.html');
    expect(nf.status()).toBe(200);
    await page.goto('/');
    await expect(page.locator('table.cmp tbody tr')).toHaveCount(6);
    await expect(page.locator('#record .delta')).toHaveCount(3);
  });

  test('real UI screenshot in RAG card, zoomable to full size', async ({ page, request }) => {
    await page.goto('/');
    const shot = page.locator('#jt-projects img[src="assets/shots/rag-dashboard.jpg"]');
    await expect(shot).toHaveCount(1);
    expect((await request.get('/assets/shots/rag-dashboard.jpg')).status()).toBe(200);
    expect((await request.get('/assets/shots/rag-dashboard-full.png')).status()).toBe(200);
    await expect(shot).toHaveAttribute('alt', /citation/i);
  });

  test('notes 4 and 5: diagrams and code blocks render', async ({ page }) => {
    await page.goto('/notes/promptfoo-ci-minimum-gate.html');
    await expect(page.locator('svg[role="img"]')).toHaveCount(1);
    await expect(page.locator('pre.code')).toHaveCount(2);
    await expect(page.locator('body')).toContainText('llm-rubric');
    await page.goto('/notes/gate-blocked-me.html');
    await expect(page.locator('svg[role="img"]')).toHaveCount(1);
    await expect(page.locator('a[href="../captures/nexural-qa-os-fixed.html"]')).toHaveCount(1);
  });

  test('mobile sticky CTA appears after hero, hides at contact', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'mobile-viewport behavior — run on the mobile project only');
    await page.goto('/');
    const cta = page.locator('#jt-mobile-cta');
    await expect(cta).toBeHidden();
    await page.locator('#briefs').scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible({ timeout: 4000 });
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(cta).toBeHidden({ timeout: 4000 });
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
    await expect(page.locator('#jt-notes a')).toHaveCount(5);
    await expect(page.locator('body')).toContainText('RAG that cites or shuts up');
    // content must be VISIBLE without JS, not merely present —
    // a baked reveal class once shipped briefs at opacity:0
    for (const art of await page.locator('#jt-briefs article').all()) {
      expect(await art.evaluate((n) => getComputedStyle(n).opacity)).toBe('1');
    }
    await ctx.close();
  });

  test('all content visible under prefers-reduced-motion', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    for (const sel of ['#jt-projects article', '#jt-briefs article', '#record .xp-row']) {
      for (const n of await page.locator(sel).all()) {
        expect(await n.evaluate((e) => getComputedStyle(e).opacity), sel).toBe('1');
      }
    }
    await ctx.close();
  });
});

test.describe('portfolio — service pages', () => {
  const SLUGS = ['llm-evaluation-qa', 'test-automation-ci', 'ai-workflow-automation'];

  test('all service pages load with schema, symptoms, deliverables, CTA', async ({ page }) => {
    for (const slug of SLUGS) {
      await page.goto(`/services/${slug}.html`);
      await expect(page.locator('h1')).toBeVisible();
      const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
      const types = schemas.map((s) => JSON.parse(s)['@type']);
      expect(types, slug).toContain('Service');
      expect(types, slug).toContain('BreadcrumbList');
      await expect(page.locator('a[href="../index.html#contact"]').first()).toBeVisible();
      expect(await page.locator('details.faq').count(), slug).toBeGreaterThanOrEqual(3);
    }
  });

  test('homepage service cards link to landing pages', async ({ page }) => {
    await page.goto('/');
    for (const slug of SLUGS) {
      await expect(page.locator(`#jt-services a[href="services/${slug}.html"]`)).toHaveCount(1);
    }
  });

  test('sitemap covers service pages', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    for (const slug of SLUGS) expect(xml).toContain(`/services/${slug}.html`);
    expect((xml.match(/<loc>/g) || []).length).toBe(11);
  });
});

test.describe('portfolio — field notes', () => {
  test('index lists 3 notes and links back to portfolio', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/field-notes.html');
    await expect(page).toHaveTitle(/Field Notes/);
    await expect(page.locator('a.note-row')).toHaveCount(5);
    await page.locator('nav a[href="index.html"]').last().click();
    await expect(page).toHaveURL(/index\.html/);
    expect(errors).toEqual([]);
  });

  test('note post page has content, Article schema, and canonical', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/notes/no-fake-green.html');
    await expect(page.locator('h1')).toContainText('No fake green');
    await expect(page.locator('article .prose p')).not.toHaveCount(0);
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(ld['@type']).toBe('Article');
    expect(ld.author.name).toBe('Jason Teixeira');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /notes\/no-fake-green/);
    expect(errors).toEqual([]);
  });

  test('every note listed on the index resolves to a real page', async ({ page, request }) => {
    await page.goto('/field-notes.html');
    const hrefs = await page.locator('a.note-row').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBe(5);
    for (const href of hrefs) {
      const res = await request.get('/' + href);
      expect(res.status(), href).toBe(200);
    }
  });

  test('RSS feed exists and contains all notes', async ({ request }) => {
    const res = await request.get('/feed.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<rss');
    expect((xml.match(/<item>/g) || []).length).toBe(5);
  });

  test('sitemap + robots exist; homepage has OG image and Person schema', async ({ page, request }) => {
    const sm = await request.get('/sitemap.xml');
    expect(sm.status()).toBe(200);
    expect((await sm.text()).match(/<loc>/g).length).toBe(11);
    const rb = await request.get('/robots.txt');
    expect(rb.status()).toBe(200);
    const og = await request.get('/assets/og.png');
    expect(og.status()).toBe(200);
    await page.goto('/');
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
    expect(ld['@type']).toBe('Person');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png/);
  });
});
