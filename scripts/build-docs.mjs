#!/usr/bin/env node
/**
 * build-docs.mjs — generates the documentation site from docs.data.mjs:
 * a shared sidebar chrome, breadcrumbs, prev/next, and block-rendered content.
 * Writes docs.html (home) + docs-<slug>.html for every page in PAGES.
 *
 * Run: node scripts/build-docs.mjs
 */
import { writeFileSync } from 'node:fs';
import { NAV, PAGES, DOC_SLUGS } from './docs.data.mjs';
import { SITE_URL, AUTHOR } from './site.config.mjs';

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Instrument Serif',Georgia,serif";
const esc = (s) => String(s ?? '').replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const href = (slug) => `docs-${slug}.html`;

/* ── block renderers ── */
function renderBlock(b) {
  const [t] = b;
  if (t === 'p') return `<p class="d-p">${b[1]}</p>`;
  if (t === 'h') return `<h2 class="d-h2">${esc(b[1])}</h2>`;
  if (t === 'ul') return `<ul class="d-ul">${b[1].map((i) => `<li>${i}</li>`).join('')}</ul>`;
  if (t === 'ol') return `<ol class="d-ol">${b[1].map((i) => `<li>${i}</li>`).join('')}</ol>`;
  if (t === 'note') return `<div class="d-note"><span class="d-note-i">▸</span><div>${b[1]}</div></div>`;
  if (t === 'cards') return `<div class="d-cards">${b[1].map(([tt, dd]) => `<div class="d-card"><h3>${esc(tt)}</h3><p>${esc(dd)}</p></div>`).join('')}</div>`;
  if (t === 'proof') return `<div class="d-proof">${b[1].map(([lbl, h]) => `<a href="${h}" class="d-plink"${h.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(lbl)} <span>→</span></a>`).join('')}</div>`;
  if (t === 'cta') return `<div class="d-cta"><div><div class="d-cta-h">${esc(b[1] || 'Ready to start?')}</div><div class="d-cta-s">${esc(b[2] || '')}</div></div><a href="book.html" class="d-cta-btn" data-evt="docs-cta">Book a call →</a></div>`;
  return '';
}

/* ── sidebar ── */
function sidebar(activeSlug) {
  const groups = NAV.map((g) => {
    const items = g.items.map((it) => {
      if (it.ext) return `<a href="${it.href}" class="d-navitem d-ext">${esc(it.title)} <span class="d-extmark">↗</span></a>`;
      const p = PAGES[it.slug];
      const on = it.slug === activeSlug ? ' d-on' : '';
      return `<a href="${href(it.slug)}" class="d-navitem${on}">${esc(p.title)}</a>`;
    }).join('');
    return `<div class="d-group"><div class="d-grouphead">${esc(g.cat)}</div>${items}</div>`;
  }).join('');
  return `<aside class="d-sidebar" id="d-sidebar">
    <a href="docs.html" class="d-navitem d-home${activeSlug === '__home__' ? ' d-on' : ''}">Documentation home</a>
    ${groups}
    <div class="d-group"><div class="d-grouphead">More</div>
      <a href="services.html" class="d-navitem d-ext">Services matrix <span class="d-extmark">↗</span></a>
      <a href="case-studies.html" class="d-navitem d-ext">Case studies <span class="d-extmark">↗</span></a>
      <a href="index.html" class="d-navitem d-ext">← Portfolio <span class="d-extmark"></span></a>
    </div>
  </aside>`;
}

/* ── page shell ── */
function shell({ slug, title, desc, breadcrumb, jsonLd, body }) {
  const canonical = `${SITE_URL}/${slug === '__home__' ? 'docs.html' : href(slug)}`;
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
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root { --ink:#F4F2EF; --dim:#A8A29E; --faint:#8E8882; --line:#211F1C; --card:#0C0C0E; --bg:#09090B; --green:#10b981; --cyan:#22d3ee; --purple:#a78bfa; --amber:#F59E0B; --mono:${MONO}; --serif:${SERIF}; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
  a { color:inherit; text-decoration:none; }
  .d-top { position:sticky; top:0; z-index:60; display:flex; align-items:center; gap:12px; padding:12px clamp(16px,3vw,28px); background:rgba(9,9,11,0.9); backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
  .d-brand { display:inline-flex; align-items:center; gap:9px; }
  .d-brand .mk { width:24px; height:24px; border:1px solid var(--line); border-radius:6px; display:grid; place-items:center; font-family:var(--mono); font-size:10px; font-weight:700; background:var(--card); }
  .d-brand .nm { font-family:var(--mono); font-size:12.5px; font-weight:600; }
  .d-badge { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--faint); border:1px solid var(--line); border-radius:5px; padding:3px 8px; }
  .d-top-cta { margin-left:auto; display:flex; gap:14px; align-items:center; font-family:var(--mono); font-size:12px; }
  .d-menu-btn { display:none; background:transparent; border:1px solid var(--line); color:var(--ink); border-radius:8px; padding:7px 10px; font-family:var(--mono); font-size:12px; cursor:pointer; }

  .d-layout { display:grid; grid-template-columns:264px minmax(0,1fr); max-width:1240px; margin:0 auto; }
  .d-sidebar { position:sticky; top:49px; align-self:start; height:calc(100vh - 49px); overflow-y:auto; padding:24px 14px 60px; border-right:1px solid var(--line); }
  .d-group { margin-top:22px; }
  .d-grouphead { font-family:var(--mono); font-size:9.5px; letter-spacing:0.13em; text-transform:uppercase; color:var(--faint); padding:0 10px 8px; }
  .d-navitem { display:block; padding:7px 10px; border-radius:7px; font-size:13.5px; color:var(--dim); line-height:1.4; }
  .d-navitem:hover { color:var(--ink); background:rgba(255,255,255,0.03); }
  .d-navitem.d-on { color:var(--ink); background:rgba(16,185,129,0.08); box-shadow:inset 2px 0 0 var(--green); }
  .d-navitem.d-home { color:var(--ink); font-weight:600; margin-bottom:6px; }
  .d-ext { color:var(--faint); }
  .d-extmark { font-size:10px; opacity:0.7; }

  .d-main { padding:clamp(28px,4vw,52px) clamp(18px,4vw,56px) 80px; min-width:0; }
  .d-crumb { font-family:var(--mono); font-size:11px; color:var(--faint); margin-bottom:18px; }
  .d-crumb a:hover { color:var(--ink); }
  .d-kicker { font-family:var(--mono); font-size:11px; letter-spacing:0.13em; text-transform:uppercase; color:var(--green); }
  h1 { font-family:var(--serif); font-weight:400; font-size:clamp(2.1rem,4.6vw,3.1rem); line-height:1.06; letter-spacing:-0.02em; margin:12px 0 0; }
  .d-lead { color:var(--dim); font-size:16px; line-height:1.7; margin:18px 0 8px; max-width:66ch; }
  .d-body { max-width:66ch; }
  .d-h2 { font-family:var(--serif); font-weight:400; font-size:clamp(1.4rem,2.6vw,1.8rem); letter-spacing:-0.015em; margin:38px 0 14px; }
  .d-p { font-size:15px; line-height:1.75; color:var(--dim); margin:0 0 16px; }
  .d-p b, .d-ul b, .d-ol b, .d-note b { color:var(--ink); font-weight:600; }
  .d-p a, .d-ul a, .d-ol a, .d-note a, .d-lead a { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }
  .d-ul, .d-ol { margin:0 0 18px; padding-left:22px; }
  .d-ul li, .d-ol li { font-size:14.5px; line-height:1.72; color:var(--dim); margin-bottom:9px; }
  .d-note { display:flex; gap:12px; border:1px solid var(--line); border-left:2px solid var(--green); background:rgba(16,185,129,0.04); border-radius:0 10px 10px 0; padding:16px 18px; margin:22px 0; font-size:14px; line-height:1.65; color:var(--dim); }
  .d-note-i { color:var(--green); font-family:var(--mono); }
  .d-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr)); gap:14px; margin:20px 0; }
  .d-card { border:1px solid var(--line); background:var(--card); border-radius:12px; padding:18px; }
  .d-card h3 { font-family:var(--serif); font-weight:400; font-size:1.15rem; margin:0 0 7px; }
  .d-card p { margin:0; font-size:13px; line-height:1.6; color:var(--dim); }
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
  .d-foot { max-width:66ch; margin-top:40px; font-family:var(--mono); font-size:11px; color:var(--faint); }

  @media (max-width:860px){
    .d-layout { grid-template-columns:1fr; }
    .d-menu-btn { display:inline-block; }
    .d-sidebar { position:fixed; top:49px; left:0; width:min(300px,84vw); height:calc(100vh - 49px); background:var(--bg); z-index:70; transform:translateX(-102%); transition:transform .25s ease; border-right:1px solid var(--line); }
    body.d-navopen .d-sidebar { transform:none; box-shadow:0 30px 80px rgba(0,0,0,0.6); }
    body.d-navopen::after { content:''; position:fixed; inset:49px 0 0; background:rgba(0,0,0,0.5); z-index:65; }
    .d-prevnext { flex-direction:column; }
  }
  @media (prefers-reduced-motion:reduce){ .d-sidebar { transition:none; } }
</style>
</head>
<body>
  <div class="d-top">
    <button class="d-menu-btn" id="d-menu" aria-label="Toggle documentation menu" aria-expanded="false">☰ Docs</button>
    <a href="index.html" class="d-brand"><span class="mk"><span style="color:var(--cyan)">J</span><span style="color:var(--purple)">T</span></span><span class="nm">jason.teixeira<span style="color:var(--green)">()</span></span></a>
    <span class="d-badge">Docs</span>
    <div class="d-top-cta">
      <a href="services.html" class="dim-link">services</a>
      <a href="book.html" class="btn-solid green" style="padding:8px 15px;font-size:12px">Book a call →</a>
    </div>
  </div>
  <div class="d-layout">
    ${sidebar(slug)}
    <main class="d-main">
      <div class="d-crumb">${breadcrumb}</div>
      ${body}
    </main>
  </div>
  <script>
    (function(){
      var b=document.getElementById('d-menu');
      if(b){ b.addEventListener('click',function(){ var o=document.body.classList.toggle('d-navopen'); b.setAttribute('aria-expanded',o?'true':'false'); }); }
      document.querySelectorAll('.d-sidebar a').forEach(function(a){ a.addEventListener('click',function(){ document.body.classList.remove('d-navopen'); }); });
    })();
  </script>
  <script defer src="assets/agent.js"></script>
</body>
</html>`;
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
    ${pn}
    <div class="d-foot">© <span data-year>2026</span> ${esc(AUTHOR)} · Sage Ideas LLC · <a href="docs.html" class="dim-link" style="color:inherit">Documentation home</a></div>
    <script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script>`;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: p.title, description: p.desc,
    author: { '@type': 'Person', name: AUTHOR, url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/${href(slug)}`,
  };
  const breadcrumb = `<a href="index.html">Home</a> / <a href="docs.html">Docs</a> / ${esc(p.cat)} / <span style="color:var(--dim)">${esc(p.title)}</span>`;
  return shell({ slug, title: p.title, desc: p.desc, breadcrumb, jsonLd, body });
}

/* ── docs home ── */
function homePage() {
  const cats = NAV.map((g) => {
    const links = g.items.map((it) => {
      if (it.ext) return `<a href="${it.href}" class="d-card-link">${esc(it.title)} ↗</a>`;
      return `<a href="${href(it.slug)}" class="d-card-link">${esc(PAGES[it.slug].title)}</a>`;
    }).join('');
    return `<div class="d-card"><h3>${esc(g.cat)}</h3><div style="display:flex;flex-direction:column;gap:2px;margin-top:8px">${links}</div></div>`;
  }).join('');

  const body = `
    <div class="d-kicker">Documentation</div>
    <h1>What I build, how it works, and the proof behind it.</h1>
    <p class="d-lead">The complete, honest reference for working with me: every capability documented, the evaluation method explained, and how engagements actually run. Start with the <a href="${href('overview')}">overview</a>, or jump to what you need.</p>
    <div class="d-note"><span class="d-note-i">▸</span><div>New here? The fastest way to see the work is a <a href="sample.html">free mini-eval</a> on your live AI feature, or the <a href="eval.html">live eval</a> running in your browser.</div></div>
    <style>.d-card-link{font-size:13.5px;color:var(--dim);padding:5px 0}.d-card-link:hover{color:var(--cyan)}</style>
    <div class="d-cards" style="margin-top:28px">${cats}</div>
    <div class="d-cta"><div><div class="d-cta-h">Prefer to talk it through?</div><div class="d-cta-s">Ask my AI associate on any page, or book a 15-minute call.</div></div><a href="book.html" class="d-cta-btn" data-evt="docs-home-cta">Book a call →</a></div>
    <div class="d-foot">© <span data-year>2026</span> ${esc(AUTHOR)} · Sage Ideas LLC</div>
    <script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script>`;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Documentation', description: 'Complete documentation of what Jason Teixeira builds and how engagements work.',
    url: `${SITE_URL}/docs.html`,
  };
  const breadcrumb = `<a href="index.html">Home</a> / <span style="color:var(--dim)">Docs</span>`;
  return shell({ slug: '__home__', title: 'Documentation', desc: 'Complete documentation of what Jason Teixeira builds — AI engineering, evaluation & quality, test automation, workflow automation — and how engagements work.', breadcrumb, jsonLd, body });
}

/* ── write ── */
writeFileSync('docs.html', homePage());
let n = 0;
for (const slug of Object.keys(PAGES)) { writeFileSync(href(slug), contentPage(slug)); n++; }
console.log(`✓ built docs.html + ${n} documentation pages (docs-*.html)`);
