#!/usr/bin/env node
/**
 * build-docs.mjs — generates the documentation site from docs.data.mjs:
 * a three-column shell (sidebar · content · on-this-page TOC), ⌘K search,
 * breadcrumbs + prev/next, heading anchors, code blocks, and schema.
 * Writes docs.html (home), docs-<slug>.html for each page, and assets/docs-search.js.
 *
 * Run: node scripts/build-docs.mjs
 */
import { writeFileSync } from 'node:fs';
import { NAV, PAGES, DOC_SLUGS } from './docs.data.mjs';
import { SITE_URL, AUTHOR } from './site.config.mjs';

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Instrument Serif',Georgia,serif";
const esc = (s) => String(s ?? '').replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escCode = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const slugify = (s) => stripHtml(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const href = (slug) => `docs-${slug}.html`;

/* ── block renderers ── */
function renderBlock(b) {
  const t = b[0];
  if (t === 'p') return `<p class="d-p">${b[1]}</p>`;
  if (t === 'h') { const id = slugify(b[1]); return `<h2 id="${id}" class="d-h2"><a href="#${id}" class="d-anchor" aria-label="Link to this section">#</a>${esc(b[1])}</h2>`; }
  if (t === 'ul') return `<ul class="d-ul">${b[1].map((i) => `<li>${i}</li>`).join('')}</ul>`;
  if (t === 'ol') return `<ol class="d-ol">${b[1].map((i) => `<li>${i}</li>`).join('')}</ol>`;
  if (t === 'note') {
    // ['note', html] (default) OR ['note', kind, html] where kind = 'warn' | 'security'
    const kind = b.length >= 3 ? b[1] : 'note';
    const html = b.length >= 3 ? b[2] : b[1];
    const mark = kind === 'warn' ? '!' : kind === 'security' ? '⚿' : '▸';
    return `<div class="d-note d-note-${kind}"><span class="d-note-i">${mark}</span><div>${html}</div></div>`;
  }
  if (t === 'table') {
    // ['table', [headers…], [[row cells…]…]] — cells are trusted authored HTML
    const headers = b[1] || [];
    const rows = b[2] || [];
    return `<div class="d-tablewrap" tabindex="0" role="region" aria-label="Table — scroll horizontally"><table class="d-table"><thead><tr>${
      headers.map((h) => `<th>${h}</th>`).join('')
    }</tr></thead><tbody>${
      rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="d-th"' : ''}>${c}</td>`).join('')}</tr>`).join('')
    }</tbody></table></div>`;
  }
  if (t === 'deflist') {
    // ['deflist', [[term, def, seeAlsoHref?]…]] — anchored terms (deep-linkable, powers DefinedTerm schema)
    return `<dl class="d-deflist">${b[1].map(([term, def, see]) => {
      const id = slugify(term);
      const seeLink = see ? ` <a href="${see}" class="d-see">see also →</a>` : '';
      return `<dt id="${id}" class="d-dt"><a href="#${id}" class="d-anchor" aria-label="Link to ${esc(term)}">#</a>${esc(term)}</dt><dd class="d-dd">${def}${seeLink}</dd>`;
    }).join('')}</dl>`;
  }
  if (t === 'cards') return `<div class="d-cards">${b[1].map(([tt, dd]) => `<div class="d-card"><h3>${esc(tt)}</h3><p>${esc(dd)}</p></div>`).join('')}</div>`;
  if (t === 'proof') return `<div class="d-proof">${b[1].map(([lbl, h]) => `<a href="${h}" class="d-plink"${h.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(lbl)} <span>→</span></a>`).join('')}</div>`;
  if (t === 'code') return `<figure class="d-codewrap"><figcaption class="d-codecap"><span>${esc(b[1] || 'code')}</span><button class="d-copy" type="button" aria-label="Copy code">copy</button></figcaption><pre class="d-code" tabindex="0" role="region" aria-label="${esc(b[1] || 'code')} code sample"><code>${escCode(b[2])}</code></pre></figure>`;
  if (t === 'cta') return `<div class="d-cta"><div><div class="d-cta-h">${esc(b[1] || 'Ready to start?')}</div><div class="d-cta-s">${esc(b[2] || '')}</div></div><a href="book.html" class="d-cta-btn" data-evt="docs-cta">Book a call →</a></div>`;
  if (t === 'html') return b[1]; // raw markup (e.g. a code-native diagram figure) — trusted, authored in docs.data.mjs
  return '';
}

/* on-this-page TOC from a page's h-blocks */
function tocFor(blocks) {
  const hs = blocks.filter((b) => b[0] === 'h');
  if (hs.length < 2) return '';
  return `<nav class="d-toc" aria-label="On this page"><div class="d-toc-h">On this page</div>${
    hs.map((b) => `<a href="#${slugify(b[1])}" class="d-toc-link" data-target="${slugify(b[1])}">${esc(b[1])}</a>`).join('')
  }</nav>`;
}

/* ── sidebar ── */
function sidebar(activeSlug) {
  const groups = NAV.map((g) => {
    const items = g.items.map((it) => {
      if (it.ext) return `<a href="${it.href}" class="d-navitem d-ext">${esc(it.title)} <span class="d-extmark">↗</span></a>`;
      const on = it.slug === activeSlug ? ' d-on' : '';
      return `<a href="${href(it.slug)}" class="d-navitem${on}">${esc(PAGES[it.slug].title)}</a>`;
    }).join('');
    return `<div class="d-group"><div class="d-grouphead">${esc(g.cat)}</div>${items}</div>`;
  }).join('');
  return `<aside class="d-sidebar" id="d-sidebar">
    <a href="docs.html" class="d-navitem d-home${activeSlug === '__home__' ? ' d-on' : ''}">Documentation home</a>
    ${groups}
    <div class="d-group"><div class="d-grouphead">More</div>
      <a href="services.html" class="d-navitem d-ext">Services matrix <span class="d-extmark">↗</span></a>
      <a href="case-studies.html" class="d-navitem d-ext">Case studies <span class="d-extmark">↗</span></a>
      <a href="index.html" class="d-navitem d-ext">← Portfolio</a>
    </div>
  </aside>`;
}

/* ── page shell ── */
function shell({ slug, title, desc, breadcrumb, breadcrumbLd, jsonLd, body, toc = '' }) {
  const canonical = `${SITE_URL}/${slug === '__home__' ? 'docs.html' : href(slug)}`;
  const ld = [jsonLd].concat(breadcrumbLd ? [breadcrumbLd] : []);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Documentation · ${esc(AUTHOR)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)} — Documentation">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE_URL}/assets/og.png">
<link rel="preload" href="assets/fonts/instrument-serif.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/plus-jakarta-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/jetbrains-mono-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/site.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%2309090B'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-family='monospace' font-size='26' font-weight='700' fill='%2310b981'%3EJT%3C/text%3E%3C/svg%3E">
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
<style>
  :root { --ink:#F4F2EF; --dim:#A8A29E; --faint:#8E8882; --line:#211F1C; --card:#0C0C0E; --bg:#09090B; --green:#10b981; --cyan:#22d3ee; --purple:#a78bfa; --amber:#F59E0B; --mono:${MONO}; --serif:${SERIF}; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
  a { color:inherit; text-decoration:none; }
  .d-top { position:sticky; top:0; z-index:60; display:flex; align-items:center; gap:12px; flex-wrap:nowrap; padding:11px clamp(14px,3vw,28px); background:rgba(9,9,11,0.9); backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
  .d-brand { display:inline-flex; align-items:center; gap:9px; flex-shrink:0; }
  .d-brand .mk { width:24px; height:24px; border:1px solid var(--line); border-radius:6px; display:grid; place-items:center; font-family:var(--mono); font-size:10px; font-weight:700; background:var(--card); }
  .d-brand .nm { font-family:var(--mono); font-size:12.5px; font-weight:600; white-space:nowrap; }
  .d-badge { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--faint); border:1px solid var(--line); border-radius:5px; padding:3px 8px; }
  .d-search { margin-left:auto; display:inline-flex; align-items:center; gap:10px; background:#111114; border:1px solid var(--line); border-radius:9px; padding:8px 12px; color:var(--faint); font-size:12.5px; cursor:pointer; min-width:180px; }
  .d-search:hover { border-color:#38342e; color:var(--dim); }
  .d-search kbd { margin-left:auto; font-family:var(--mono); font-size:10px; border:1px solid var(--line); border-radius:4px; padding:1px 5px; color:var(--faint); }
  .d-top-cta { display:flex; gap:12px; align-items:center; font-family:var(--mono); font-size:12px; flex-shrink:0; }
  .d-menu-btn { display:none; background:transparent; border:1px solid var(--line); color:var(--ink); border-radius:8px; padding:7px 10px; font-family:var(--mono); font-size:12px; cursor:pointer; flex-shrink:0; }

  .d-layout { display:grid; grid-template-columns:262px minmax(0,1fr) 210px; max-width:1320px; margin:0 auto; }
  .d-sidebar { position:sticky; top:48px; align-self:start; height:calc(100vh - 48px); overflow-y:auto; padding:24px 14px 60px; border-right:1px solid var(--line); }
  .d-group { margin-top:22px; }
  .d-grouphead { font-family:var(--mono); font-size:9.5px; letter-spacing:0.13em; text-transform:uppercase; color:var(--faint); padding:0 10px 8px; }
  .d-navitem { display:block; padding:7px 10px; border-radius:7px; font-size:13.5px; color:var(--dim); line-height:1.4; }
  .d-navitem:hover { color:var(--ink); background:rgba(255,255,255,0.03); }
  .d-navitem.d-on { color:var(--ink); background:rgba(16,185,129,0.08); box-shadow:inset 2px 0 0 var(--green); }
  .d-navitem.d-home { color:var(--ink); font-weight:600; margin-bottom:6px; }
  .d-ext { color:var(--faint); }
  .d-extmark { font-size:10px; opacity:0.7; }

  .d-main { padding:clamp(28px,4vw,48px) clamp(18px,3.5vw,52px) 80px; min-width:0; }
  .d-crumb { font-family:var(--mono); font-size:11px; color:var(--faint); margin-bottom:18px; }
  .d-crumb a:hover { color:var(--ink); }
  .d-kicker { font-family:var(--mono); font-size:11px; letter-spacing:0.13em; text-transform:uppercase; color:var(--green); }
  h1 { font-family:var(--serif); font-weight:400; font-size:clamp(2.1rem,4.6vw,3.1rem); line-height:1.06; letter-spacing:-0.02em; margin:12px 0 0; }
  .d-lead { color:var(--dim); font-size:16px; line-height:1.7; margin:18px 0 8px; max-width:70ch; }
  .d-body { max-width:70ch; }
  .d-h2 { font-family:var(--serif); font-weight:400; font-size:clamp(1.4rem,2.6vw,1.8rem); letter-spacing:-0.015em; margin:40px 0 14px; scroll-margin-top:70px; position:relative; }
  .d-anchor { position:absolute; left:-1.1em; color:var(--faint); opacity:0; font-family:var(--mono); font-size:0.8em; padding-right:0.3em; }
  .d-h2:hover .d-anchor { opacity:1; }
  .d-p { font-size:15px; line-height:1.75; color:var(--dim); margin:0 0 16px; }
  .d-p b, .d-ul b, .d-ol b, .d-note b { color:var(--ink); font-weight:600; }
  .d-p a, .d-ul a, .d-ol a, .d-note a, .d-lead a { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }
  .d-ul, .d-ol { margin:0 0 18px; padding-left:22px; }
  .d-ul li, .d-ol li { font-size:14.5px; line-height:1.72; color:var(--dim); margin-bottom:9px; }
  .d-note { display:flex; gap:12px; border:1px solid var(--line); border-left:2px solid var(--green); background:rgba(16,185,129,0.04); border-radius:0 10px 10px 0; padding:16px 18px; margin:22px 0; font-size:14px; line-height:1.65; color:var(--dim); }
  .d-note-i { color:var(--green); font-family:var(--mono); }
  .d-note-warn { border-left-color:var(--amber); background:rgba(245,158,11,0.05); } .d-note-warn .d-note-i { color:var(--amber); }
  .d-note-security { border-left-color:var(--cyan); background:rgba(34,211,238,0.05); } .d-note-security .d-note-i { color:var(--cyan); }
  .d-tablewrap { overflow-x:auto; border:1px solid var(--line); border-radius:12px; margin:22px 0; }
  .d-table { width:100%; border-collapse:collapse; font-size:13.5px; min-width:520px; }
  .d-table th, .d-table td { text-align:left; padding:12px 15px; border-bottom:1px solid var(--line); vertical-align:top; line-height:1.6; color:var(--dim); }
  .d-table thead th { font-family:var(--mono); font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:var(--cyan); font-weight:500; background:#0A0A0C; }
  .d-table td.d-th { font-weight:600; color:var(--ink); }
  .d-table td b, .d-table td a { color:var(--ink); } .d-table td a { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }
  .d-table tbody tr:last-child td { border-bottom:none; }
  .d-deflist { margin:22px 0; }
  .d-dt { font-family:var(--mono); font-size:13px; font-weight:600; color:var(--ink); margin-top:20px; scroll-margin-top:90px; }
  .d-dd { margin:6px 0 0; font-size:14px; line-height:1.7; color:var(--dim); }
  .d-dd a, .d-dd .d-see { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }
  .d-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr)); gap:14px; margin:20px 0; }
  .d-card { border:1px solid var(--line); background:var(--card); border-radius:12px; padding:18px; }
  .d-card h3 { font-family:var(--serif); font-weight:400; font-size:1.15rem; margin:0 0 7px; }
  .d-card p { margin:0; font-size:13px; line-height:1.6; color:var(--dim); }
  .d-codewrap { margin:22px 0; border:1px solid var(--line); border-radius:10px; overflow:hidden; background:#0B0B0D; }
  .d-codecap { display:flex; align-items:center; justify-content:space-between; padding:8px 14px; border-bottom:1px solid var(--line); font-family:var(--mono); font-size:10.5px; color:var(--faint); background:#0E0E11; }
  .d-copy { background:transparent; border:1px solid var(--line); border-radius:5px; color:var(--faint); font-family:var(--mono); font-size:10px; padding:3px 8px; cursor:pointer; }
  .d-copy:hover { color:var(--ink); border-color:#38342e; }
  .d-code { margin:0; padding:16px 18px; overflow-x:auto; }
  .d-code code { font-family:var(--mono); font-size:12.5px; line-height:1.7; color:#CFEBDC; white-space:pre; }
  .d-proof { display:flex; flex-direction:column; gap:2px; margin:18px 0; }
  .d-plink { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 4px; border-bottom:1px solid var(--line); font-family:var(--mono); font-size:13px; color:var(--ink); }
  .d-plink span { color:var(--cyan); }
  .d-plink:hover { color:var(--cyan); }
  .d-cta { display:flex; align-items:center; gap:16px; flex-wrap:wrap; justify-content:space-between; border:1px solid var(--line); background:linear-gradient(180deg,rgba(16,185,129,0.06),transparent); border-radius:14px; padding:22px 24px; margin:34px 0 8px; }
  .d-cta-h { font-family:var(--serif); font-size:1.35rem; letter-spacing:-0.01em; }
  .d-cta-s { font-size:13.5px; color:var(--dim); margin-top:4px; max-width:52ch; }
  .d-cta-btn { background:var(--green); color:#052e22; border-radius:24px; padding:12px 22px; font-size:14px; font-weight:700; white-space:nowrap; }
  .d-prevnext { display:flex; gap:14px; margin-top:44px; border-top:1px solid var(--line); padding-top:24px; }
  .d-pn { flex:1; border:1px solid var(--line); border-radius:12px; padding:16px 18px; transition:border-color .2s; }
  .d-pn:hover { border-color:#38342e; }
  .d-pn .l { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--faint); }
  .d-pn .t { font-family:var(--serif); font-size:1.15rem; margin-top:5px; }
  .d-pn.next { text-align:right; }
  .d-help { margin-top:26px; font-family:var(--mono); font-size:11px; color:var(--faint); display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  .d-help a { color:var(--cyan); }
  .d-foot { max-width:70ch; margin-top:30px; font-family:var(--mono); font-size:11px; color:var(--faint); }

  /* code-native inline-SVG diagrams */
  .d-diagram { margin:26px 0; border:1px solid var(--line); border-radius:10px; overflow:hidden; background:#0B0B0D; max-width:none; }
  .d-diagram-cap { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 14px; border-bottom:1px solid var(--line); font-family:var(--mono); font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:var(--faint); background:#0E0E11; }
  .d-diagram-body { padding:22px clamp(10px,3vw,26px); overflow-x:auto; }
  .d-diagram-body svg { display:block; }
  .d-diagram-note { padding:11px 16px 15px; border-top:1px solid var(--line); font-family:var(--mono); font-size:11px; line-height:1.6; color:var(--faint); }
  .d-diagram-note b { color:var(--dim); font-weight:600; }

  /* right-rail on-this-page */
  .d-rail { position:sticky; top:48px; align-self:start; height:calc(100vh - 48px); overflow-y:auto; padding:34px 18px 40px 4px; }
  .d-toc-h { font-family:var(--mono); font-size:9.5px; letter-spacing:0.13em; text-transform:uppercase; color:var(--faint); margin-bottom:10px; }
  .d-toc-link { display:block; padding:5px 10px; font-size:12px; line-height:1.4; color:var(--faint); border-left:1px solid var(--line); }
  .d-toc-link:hover { color:var(--ink); }
  .d-toc-link.on { color:var(--ink); border-left-color:var(--green); }

  /* search modal */
  .d-modal { position:fixed; inset:0; z-index:120; display:none; align-items:flex-start; justify-content:center; padding-top:12vh; background:rgba(0,0,0,0.6); }
  .d-modal.open { display:flex; }
  .d-modal-box { width:min(560px,92vw); background:#0D0D10; border:1px solid #2A2826; border-radius:14px; overflow:hidden; box-shadow:0 40px 90px -20px rgba(0,0,0,0.9); }
  .d-modal input { width:100%; background:transparent; border:none; border-bottom:1px solid #2A2826; padding:16px 18px; font-size:15px; color:var(--ink); font-family:inherit; outline:none; }
  .d-results { max-height:52vh; overflow-y:auto; padding:8px; }
  .d-res { display:block; padding:11px 13px; border-radius:9px; }
  .d-res:hover, .d-res.sel { background:rgba(16,185,129,0.08); }
  .d-res .rt { font-size:14px; color:var(--ink); }
  .d-res .rc { font-family:var(--mono); font-size:10px; color:var(--faint); text-transform:uppercase; letter-spacing:0.08em; }
  .d-res .rd { font-size:12px; color:var(--dim); margin-top:3px; }
  .d-empty { padding:22px; text-align:center; color:var(--faint); font-size:13px; }

  @media (max-width:1120px){ .d-layout { grid-template-columns:262px minmax(0,1fr); } .d-rail { display:none; } }
  @media (max-width:860px){
    .d-layout { grid-template-columns:1fr; }
    .d-menu-btn { display:inline-block; }
    .d-badge { display:none; }
    .d-search { min-width:0; padding:8px; }
    .d-search .d-search-lbl, .d-search kbd { display:none; }
    .d-top-cta .dim-link { display:none; }
    .d-sidebar { position:fixed; top:48px; left:0; width:min(300px,84vw); height:calc(100vh - 48px); background:var(--bg); z-index:70; transform:translateX(-102%); transition:transform .25s ease; border-right:1px solid var(--line); }
    body.d-navopen .d-sidebar { transform:none; box-shadow:0 30px 80px rgba(0,0,0,0.6); }
    body.d-navopen::after { content:''; position:fixed; inset:48px 0 0; background:rgba(0,0,0,0.5); z-index:65; }
    .d-prevnext { flex-direction:column; }
  }
  @media (prefers-reduced-motion:reduce){ .d-sidebar { transition:none; } }
</style>
</head>
<body>
  <div class="d-top">
    <button class="d-menu-btn" id="d-menu" aria-label="Toggle documentation menu" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
    <a href="index.html" class="d-brand"><span class="mk"><span style="color:var(--cyan)">J</span><span style="color:var(--purple)">T</span></span><span class="nm">jason.teixeira<span style="color:var(--green)">()</span></span></a>
    <span class="d-badge">Docs</span>
    <button class="d-search" id="d-search-btn" aria-label="Search documentation"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span class="d-search-lbl">Search the docs…</span><kbd>⌘K</kbd></button>
    <div class="d-top-cta">
      <a href="services.html" class="dim-link">services</a>
      <a href="book.html" class="btn-solid green" style="padding:8px 15px;font-size:12px;white-space:nowrap">Book a call →</a>
    </div>
  </div>
  <div class="d-layout">
    ${sidebar(slug)}
    <main class="d-main">
      <div class="d-crumb">${breadcrumb}</div>
      ${body}
    </main>
    ${toc ? `<div class="d-rail">${toc}</div>` : '<div></div>'}
  </div>

  <div class="d-modal" id="d-modal" role="dialog" aria-label="Search documentation" aria-modal="true">
    <div class="d-modal-box">
      <input id="d-q" type="text" placeholder="Search the documentation…" autocomplete="off" aria-label="Search query">
      <div class="d-results" id="d-results"></div>
    </div>
  </div>

  <script>
    (function(){
      var b=document.getElementById('d-menu');
      if(b){ b.addEventListener('click',function(){ var o=document.body.classList.toggle('d-navopen'); b.setAttribute('aria-expanded',o?'true':'false'); }); }
      document.querySelectorAll('.d-sidebar a').forEach(function(a){ a.addEventListener('click',function(){ document.body.classList.remove('d-navopen'); }); });
      document.querySelectorAll('.d-copy').forEach(function(btn){ btn.addEventListener('click',function(){ var c=btn.closest('.d-codewrap').querySelector('code'); navigator.clipboard&&navigator.clipboard.writeText(c.innerText); var o=btn.textContent; btn.textContent='copied'; setTimeout(function(){btn.textContent=o;},1200); }); });
      // scroll-spy for the on-this-page rail
      var links=[].slice.call(document.querySelectorAll('.d-toc-link'));
      if(links.length){
        var map={}; links.forEach(function(l){ var el=document.getElementById(l.getAttribute('data-target')); if(el) map[l.getAttribute('data-target')]=l; });
        var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ links.forEach(function(x){x.classList.remove('on');}); var l=map[e.target.id]; if(l)l.classList.add('on'); } }); },{rootMargin:'-64px 0px -70% 0px'});
        Object.keys(map).forEach(function(id){ io.observe(document.getElementById(id)); });
      }
    })();
  </script>
  <script defer src="assets/docs-search.js"></script>
  <script defer src="assets/agent.js"></script>
</body>
</html>`;
}

/* Per-page-type structured data. A page opts in via p.schema ('faq'|'glossary'|'howto'); default TechArticle. */
function contentSchema(slug, p) {
  const base = `${SITE_URL}/${href(slug)}`;
  if (p.schema === 'faq') {
    const qa = [];
    for (let i = 0; i < p.blocks.length; i++) {
      if (p.blocks[i][0] !== 'h') continue;
      const ans = [];
      for (let j = i + 1; j < p.blocks.length && p.blocks[j][0] !== 'h'; j++) {
        if (p.blocks[j][0] === 'p') ans.push(stripHtml(p.blocks[j][1]));
      }
      if (ans.length) qa.push({ '@type': 'Question', name: stripHtml(p.blocks[i][1]), acceptedAnswer: { '@type': 'Answer', text: ans.join(' ') } });
    }
    return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa };
  }
  if (p.schema === 'glossary') {
    const dl = p.blocks.find((b) => b[0] === 'deflist');
    const terms = dl ? dl[1].map(([term, def]) => ({ '@type': 'DefinedTerm', name: stripHtml(term), description: stripHtml(def) })) : [];
    return { '@context': 'https://schema.org', '@type': 'DefinedTermSet', name: p.title, description: p.desc, hasDefinedTerm: terms };
  }
  if (p.schema === 'howto') {
    const steps = p.blocks.filter((b) => b[0] === 'h').map((b, i) => ({ '@type': 'HowToStep', position: i + 1, name: stripHtml(b[1]) }));
    return { '@context': 'https://schema.org', '@type': 'HowTo', name: p.title, description: p.desc, step: steps };
  }
  return { '@context': 'https://schema.org', '@type': 'TechArticle', headline: p.title, description: p.desc, author: { '@type': 'Person', name: AUTHOR, url: SITE_URL }, mainEntityOfPage: base };
}

/* ── content page ── */
function contentPage(slug) {
  const p = PAGES[slug];
  const idx = DOC_SLUGS.indexOf(slug);
  const prev = idx > 0 ? DOC_SLUGS[idx - 1] : null;
  const next = idx >= 0 && idx < DOC_SLUGS.length - 1 ? DOC_SLUGS[idx + 1] : null;
  const pn = `<div class="d-prevnext">${
    prev ? `<a class="d-pn prev" href="${href(prev)}"><div class="l">← Previous</div><div class="t">${esc(PAGES[prev].title)}</div></a>` : '<div class="d-pn" style="visibility:hidden"></div>'
  }${
    next ? `<a class="d-pn next" href="${href(next)}"><div class="l">Next →</div><div class="t">${esc(PAGES[next].title)}</div></a>` : '<div class="d-pn" style="visibility:hidden"></div>'
  }</div>`;

  const body = `
    <div class="d-kicker">${esc(p.cat)}</div>
    <h1>${esc(p.title)}</h1>
    <p class="d-lead">${p.lead}</p>
    <div class="d-body">${p.blocks.map(renderBlock).join('\n')}</div>
    <div class="d-help"><span>Was this helpful?</span><a href="book.html" data-evt="docs-help-yes">Book a call →</a><a href="sample.html" data-evt="docs-help-eval">Get a free mini-eval →</a></div>
    ${pn}
    <div class="d-foot">© <span data-year>2026</span> ${esc(AUTHOR)} · Sage Ideas LLC · <a href="docs.html" class="dim-link" style="color:inherit">Documentation home</a></div>
    <script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script>`;

  const jsonLd = contentSchema(slug, p);
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Docs', item: `${SITE_URL}/docs.html` },
    { '@type': 'ListItem', position: 3, name: p.cat },
    { '@type': 'ListItem', position: 4, name: p.title, item: `${SITE_URL}/${href(slug)}` },
  ] };
  const breadcrumb = `<a href="index.html">Home</a> / <a href="docs.html">Docs</a> / ${esc(p.cat)} / <span style="color:var(--dim)">${esc(p.title)}</span>`;
  return shell({ slug, title: p.title, desc: p.desc, breadcrumb, breadcrumbLd, jsonLd, body, toc: tocFor(p.blocks) });
}

/* ── docs home ── */
function homePage() {
  const cats = NAV.map((g) => {
    const links = g.items.map((it) => it.ext
      ? `<a href="${it.href}" class="d-card-link">${esc(it.title)} ↗</a>`
      : `<a href="${href(it.slug)}" class="d-card-link">${esc(PAGES[it.slug].title)}</a>`).join('');
    return `<div class="d-card"><h3>${esc(g.cat)}</h3><div style="display:flex;flex-direction:column;gap:2px;margin-top:8px">${links}</div></div>`;
  }).join('');

  const body = `
    <div class="d-kicker">Documentation</div>
    <h1>What I build, how it works, and the proof behind it.</h1>
    <p class="d-lead">The complete, honest reference for working with me: every capability documented, the evaluation method explained, and how engagements actually run. Start with the <a href="${href('overview')}">overview</a>, press <kbd style="font-family:var(--mono);font-size:0.8em;border:1px solid var(--line);border-radius:4px;padding:1px 5px">⌘K</kbd> to search, or jump to what you need.</p>
    <div class="d-note"><span class="d-note-i">▸</span><div>New here? The fastest way to see the work is a <a href="sample.html">free mini-eval</a> on your live AI feature, or the <a href="eval.html">live eval</a> running in your browser.</div></div>
    <style>.d-card-link{font-size:13.5px;color:var(--dim);padding:5px 0}.d-card-link:hover{color:var(--cyan)}</style>
    <div class="d-cards" style="margin-top:28px">${cats}</div>
    <div class="d-cta"><div><div class="d-cta-h">Prefer to talk it through?</div><div class="d-cta-s">Ask my AI associate on any page, or book a 15-minute call.</div></div><a href="book.html" class="d-cta-btn" data-evt="docs-home-cta">Book a call →</a></div>
    <div class="d-foot">© <span data-year>2026</span> ${esc(AUTHOR)} · Sage Ideas LLC</div>
    <script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script>`;

  const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Documentation', description: 'Complete documentation of what Jason Teixeira builds and how engagements work.', url: `${SITE_URL}/docs.html` };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Docs', item: `${SITE_URL}/docs.html` },
  ] };
  const breadcrumb = `<a href="index.html">Home</a> / <span style="color:var(--dim)">Docs</span>`;
  return shell({ slug: '__home__', title: 'Documentation', desc: 'Complete documentation of what Jason Teixeira builds — AI engineering, evaluation & quality, test automation, workflow automation — and how engagements work.', breadcrumb, breadcrumbLd, jsonLd, body });
}

/* ── search index + modal behavior (assets/docs-search.js) ── */
function searchAsset() {
  const index = Object.keys(PAGES).map((slug) => {
    const p = PAGES[slug];
    const headings = p.blocks.filter((b) => b[0] === 'h').map((b) => stripHtml(b[1]));
    return { t: p.title, c: p.cat, u: href(slug), d: stripHtml(p.lead).slice(0, 120), k: (p.title + ' ' + p.cat + ' ' + headings.join(' ') + ' ' + stripHtml(p.desc)).toLowerCase() };
  });
  return `/* generated by build-docs.mjs — docs ⌘K search */
(function(){
  var IDX=${JSON.stringify(index)};
  var modal=document.getElementById('d-modal'), q=document.getElementById('d-q'), out=document.getElementById('d-results'), sel=0, cur=[];
  var btn=document.getElementById('d-search-btn');
  function open(){ modal.classList.add('open'); q.value=''; render(''); setTimeout(function(){q.focus();},30); }
  function close(){ modal.classList.remove('open'); }
  function score(it,terms){ var s=0; for(var i=0;i<terms.length;i++){ if(it.t.toLowerCase().indexOf(terms[i])>-1)s+=5; if(it.k.indexOf(terms[i])>-1)s+=1; else return -1; } return s; }
  function render(query){
    var terms=query.toLowerCase().split(/\\s+/).filter(Boolean);
    cur = terms.length ? IDX.map(function(it){return {it:it,s:score(it,terms)};}).filter(function(r){return r.s>=0;}).sort(function(a,b){return b.s-a.s;}).map(function(r){return r.it;}) : IDX.slice();
    sel=0;
    if(!cur.length){ out.innerHTML='<div class="d-empty">No matches. Try “eval”, “pricing”, or “automation”.</div>'; return; }
    out.innerHTML=cur.map(function(it,i){ return '<a class="d-res'+(i===0?' sel':'')+'" href="'+it.u+'"><div class="rc">'+it.c+'</div><div class="rt">'+it.t+'</div><div class="rd">'+it.d+'</div></a>'; }).join('');
  }
  function move(d){ var items=out.querySelectorAll('.d-res'); if(!items.length)return; items[sel]&&items[sel].classList.remove('sel'); sel=(sel+d+items.length)%items.length; items[sel].classList.add('sel'); items[sel].scrollIntoView({block:'nearest'}); }
  function go(){ var items=out.querySelectorAll('.d-res'); if(items[sel]) location.href=items[sel].getAttribute('href'); }
  if(btn) btn.addEventListener('click',open);
  document.addEventListener('keydown',function(e){
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); modal.classList.contains('open')?close():open(); }
    else if(e.key==='Escape'&&modal.classList.contains('open')){ close(); }
    else if(modal.classList.contains('open')){ if(e.key==='ArrowDown'){e.preventDefault();move(1);} else if(e.key==='ArrowUp'){e.preventDefault();move(-1);} else if(e.key==='Enter'){e.preventDefault();go();} }
  });
  if(q) q.addEventListener('input',function(){ render(q.value); });
  if(modal) modal.addEventListener('click',function(e){ if(e.target===modal)close(); });
})();`;
}

/* ── write ── */
writeFileSync('docs.html', homePage());
let n = 0;
for (const slug of Object.keys(PAGES)) { writeFileSync(href(slug), contentPage(slug)); n++; }
writeFileSync('assets/docs-search.js', searchAsset());
console.log(`✓ built docs.html + ${n} documentation pages + assets/docs-search.js`);
