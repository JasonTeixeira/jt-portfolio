#!/usr/bin/env node
/**
 * build-i18n.mjs — finalizes localized pages for SEO + navigation.
 *
 * Translation itself is done separately (a full translated copy is written to
 * es/<page> and pt/<page> with the ORIGINAL relative paths preserved). This
 * script is the mechanical post-process that makes those copies actually work
 * as a localized site:
 *
 *   1. sets <html lang="xx">
 *   2. rewrites relative asset/link paths so a page under /es/ or /pt/ resolves
 *      (assets → absolute /assets; internal *.html → locale-prefixed)
 *   3. points <link canonical> and og:url at the locale URL
 *   4. injects hreflang alternates (en / es / pt / x-default) into <head>
 *   5. injects a small language switcher (idempotent)
 *
 * It also runs over the English source pages to give them the same hreflang
 * block + switcher (needed for SEO and so EN links out to ES/PT). All edits are
 * idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/build-i18n.mjs [page ...]   # default: index.html
 *   node scripts/build-i18n.mjs --all        # every root *.html that has an es/ copy
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://agency.sageideas.dev';
const LOCALES = ['en', 'es', 'pt'];
const LABEL = { en: 'EN', es: 'ES', pt: 'PT' };
const MARK = 'data-i18n="1"'; // idempotency marker on injected switcher

const dirOf = (l) => (l === 'en' ? '' : `${l}/`);
const urlFor = (page, l) => `${SITE}/${dirOf(l)}${page === 'index.html' ? '' : page}`;
const pathFor = (page, l) => `/${dirOf(l)}${page === 'index.html' ? '' : page}`;

// ── head injections ─────────────────────────────────────────────────────────
function hreflangBlock(page) {
  const links = LOCALES.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(page, l)}">`
  );
  links.push(`<link rel="alternate" hreflang="x-default" href="${urlFor(page, 'en')}">`);
  return links.join('\n');
}

function switcherHtml(page, current) {
  const items = LOCALES.map((l) =>
    l === current
      ? `<span aria-current="true" style="color:#10b981;font-weight:600">${LABEL[l]}</span>`
      : `<a href="${pathFor(page, l)}" style="color:#8E8882;text-decoration:none">${LABEL[l]}</a>`
  ).join('<span style="color:#3D3A37">·</span>');
  return `<div ${MARK} role="navigation" aria-label="Language" style="position:fixed;left:16px;bottom:16px;z-index:90;display:flex;gap:8px;align-items:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;letter-spacing:0.08em;background:rgba(9,9,11,0.85);backdrop-filter:blur(6px);border:1px solid #2A2826;border-radius:999px;padding:7px 12px">${items}</div>`;
}

// ── path rewriting (only for locale subdirectory pages) ─────────────────────
function rewritePaths(html, page) {
  return html
    // assets referenced relatively → absolute so /es/ and /pt/ resolve them
    .replace(/(\b(?:href|src)=)"(assets\/[^"]*)"/g, '$1"/$2"')
    .replace(/(\b(?:href|src)=)"(feed\.xml|sitemap\.xml|robots\.txt)"/g, '$1"/$2"')
    // internal page links → locale-prefixed (skip anchors, external, mailto, tel, already-absolute)
    .replace(/(\bhref=)"([a-z0-9][a-z0-9._-]*\.html(?:#[^"]*)?)"/gi, (m, a, href) => `${a}"/${dirOf(page.locale)}${href}"`)
    // bare root link "/" → locale root
    .replace(/(\bhref=)"\/"/g, `$1"/${dirOf(page.locale)}"`);
}

// ── per-page processing ─────────────────────────────────────────────────────
function processLocale(pageName, locale) {
  const rel = locale === 'en' ? pageName : `${locale}/${pageName}`;
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) return { rel, skipped: 'missing' };

  let html = readFileSync(abs, 'utf8');
  const already = html.includes(MARK);

  // 1. lang attribute
  html = html.replace(/<html\b[^>]*>/i, (tag) =>
    /\blang=/.test(tag) ? tag.replace(/\blang="[^"]*"/i, `lang="${locale}"`) : tag.replace(/<html\b/i, `<html lang="${locale}"`)
  );

  // 2. paths (locale pages only; English root already resolves relatively)
  if (locale !== 'en') html = rewritePaths(html, { locale });

  // 3. canonical + og:url → this locale's URL
  const u = urlFor(pageName, locale);
  html = html.replace(/(<link\s+rel="canonical"\s+href=)"[^"]*"/i, `$1"${u}"`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=)"[^"]*"/i, `$1"${u}"`);

  // 4/5. hreflang + og:locale + switcher (idempotent — only if not already marked)
  if (!already) {
    const ogLocale = { en: 'en_US', es: 'es_ES', pt: 'pt_BR' }[locale];
    const headAdd = `\n${hreflangBlock(pageName)}\n<meta property="og:locale" content="${ogLocale}">\n`;
    html = html.replace(/<\/head>/i, `${headAdd}</head>`);
    html = html.replace(/<body[^>]*>/i, (m) => `${m}\n${switcherHtml(pageName, locale)}`);
  }

  writeFileSync(abs, html);
  return { rel, injected: !already, u };
}

function pagesWithTranslations() {
  return readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => existsSync(resolve(ROOT, 'es', f)) || existsSync(resolve(ROOT, 'pt', f)));
}

function main(argv) {
  const args = argv.slice(2);
  const pages = args.includes('--all') ? pagesWithTranslations() : (args.filter((a) => !a.startsWith('--')) .length ? args.filter((a) => !a.startsWith('--')) : ['index.html']);
  if (!pages.length) { console.error('no pages with es/ or pt/ translations found — run the translation step first'); process.exit(1); }

  for (const l of ['es', 'pt']) mkdirSync(resolve(ROOT, l), { recursive: true });

  console.log(`\n  finalizing ${pages.length} page(s) × ${LOCALES.length} locales\n`);
  for (const page of pages) {
    for (const l of LOCALES) {
      const r = processLocale(page, l);
      const tag = r.skipped ? `skip (${r.skipped})` : r.injected ? 'injected' : 'refreshed';
      console.log(`  ${l}  ${page.padEnd(28)} ${tag}`);
    }
  }
  console.log(`\n  done. Verify: ${SITE}/es/  and  ${SITE}/pt/\n`);
}

main(process.argv);
