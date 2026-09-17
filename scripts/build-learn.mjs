#!/usr/bin/env node
/**
 * build-learn.mjs — generates the Learn reference hub from learn.data.mjs:
 *   learn.html            the flagship library home (all 8 pillars)
 *   learn-<pillar>.html   one cornerstone landing page per pillar
 *
 * Reuses the global design system (assets/site.css) + the docs top-bar idiom, with a
 * hub-specific library layout. Every linked entry is a real existing page (see
 * learn.data.mjs). Structured data: CollectionPage for the hub, CollectionPage +
 * ItemList for each pillar, BreadcrumbList on every page.
 *
 * Run: node scripts/build-learn.mjs
 */
import { writeFileSync } from 'node:fs';
import { PILLARS, LIBRARY, LEARN_SLUGS } from './learn.data.mjs';
import { SITE_URL, AUTHOR } from './site.config.mjs';

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Instrument Serif',Georgia,serif";
const esc = (s) => String(s ?? '').replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TYPE_LABEL = {
  guide: 'Guide', tutorial: 'Tutorial', glossary: 'Glossary', comparison: 'Compare',
  study: 'Study', service: 'Service', note: 'Field note', case: 'Case study', tool: 'Tool', reference: 'Reference',
};
const pillarHref = (id) => `learn-${id}.html`;
const entryCount = (id) => (LIBRARY[id] || []).length;

/* ── shared shell ── */
function shell({ path, title, desc, jsonLd, breadcrumbLd, body }) {
  const canonical = `${SITE_URL}/${path}`;
  const ogImage = `${SITE_URL}/api/og?eyebrow=Learn&amp;title=${encodeURIComponent(String(title).replace(/ — Learn.*$/, '').slice(0, 110))}`;
  const ld = [jsonLd].concat(breadcrumbLd ? [breadcrumbLd] : []);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(AUTHOR)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
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
  .l-top { position:sticky; top:0; z-index:60; display:flex; align-items:center; gap:12px; padding:11px clamp(14px,3vw,28px); background:rgba(9,9,11,0.9); backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
  .l-brand { display:inline-flex; align-items:center; gap:9px; flex-shrink:0; }
  .l-brand .mk { width:24px; height:24px; border:1px solid var(--line); border-radius:6px; display:grid; place-items:center; font-family:var(--mono); font-size:10px; font-weight:700; background:var(--card); }
  .l-brand .nm { font-family:var(--mono); font-size:12.5px; font-weight:600; white-space:nowrap; }
  .l-badge { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--faint); border:1px solid var(--line); border-radius:5px; padding:3px 8px; }
  .l-nav { margin-left:auto; display:flex; gap:18px; align-items:center; font-family:var(--mono); font-size:12px; }
  .l-nav a { color:var(--dim); } .l-nav a:hover { color:var(--ink); }
  .l-nav .btn { background:var(--green); color:#052e22; border-radius:22px; padding:8px 15px; font-weight:700; white-space:nowrap; }
  @media (max-width:680px){ .l-nav .hideable { display:none; } }

  .l-wrap { max-width:1080px; margin:0 auto; padding:clamp(30px,5vw,68px) clamp(18px,4vw,40px) 90px; }
  .l-crumb { font-family:var(--mono); font-size:11px; color:var(--faint); margin-bottom:22px; }
  .l-crumb a:hover { color:var(--ink); }
  .l-kicker { font-family:var(--mono); font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:var(--green); }
  h1 { font-family:var(--serif); font-weight:400; font-size:clamp(2.4rem,6vw,4.2rem); line-height:1.02; letter-spacing:-0.02em; margin:14px 0 0; max-width:16ch; text-wrap:balance; }
  .l-lead { color:var(--dim); font-size:clamp(15px,2vw,18px); line-height:1.7; margin:20px 0 0; max-width:64ch; }
  .l-lead a { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }
  .l-meta { display:flex; gap:22px; flex-wrap:wrap; margin-top:26px; font-family:var(--mono); font-size:11.5px; color:var(--faint); }
  .l-meta b { color:var(--ink); font-weight:600; }

  /* pillar grid (hub home) */
  .l-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr)); gap:16px; margin-top:44px; }
  .l-pillar { position:relative; display:flex; flex-direction:column; border:1px solid var(--line); background:var(--card); border-radius:16px; padding:22px 22px 18px; overflow:hidden; transition:border-color .2s, transform .2s; }
  .l-pillar:hover { border-color:#38342e; transform:translateY(-2px); }
  .l-pillar::before { content:''; position:absolute; inset:0 auto 0 0; width:3px; background:var(--pc); opacity:.8; }
  .l-pillar .pnum { font-family:var(--mono); font-size:11px; letter-spacing:0.1em; color:var(--pc); }
  .l-pillar h2 { font-family:var(--serif); font-weight:400; font-size:1.6rem; letter-spacing:-0.01em; margin:8px 0 0; line-height:1.1; }
  .l-pillar .pk { font-size:13.5px; color:var(--dim); line-height:1.55; margin:9px 0 0; }
  .l-pillar .plist { margin:16px 0 0; display:flex; flex-direction:column; }
  .l-pillar .plink { display:flex; align-items:baseline; gap:9px; padding:7px 0; border-top:1px solid var(--line); font-size:13px; color:var(--dim); }
  .l-pillar .plink:hover { color:var(--ink); }
  .l-pillar .plink .tag { font-family:var(--mono); font-size:9px; letter-spacing:0.06em; text-transform:uppercase; color:var(--pc); flex-shrink:0; min-width:58px; }
  .l-pillar .pmore { margin-top:14px; font-family:var(--mono); font-size:11.5px; color:var(--pc); }
  .l-pillar .pmore:hover { text-decoration:underline; }

  /* pillar page cluster list */
  .l-cluster { margin-top:40px; display:flex; flex-direction:column; gap:2px; }
  .l-item { display:grid; grid-template-columns:96px minmax(0,1fr); gap:18px; align-items:baseline; padding:20px 6px; border-top:1px solid var(--line); transition:background .15s; }
  .l-item:hover { background:rgba(255,255,255,0.015); }
  .l-item .itag { font-family:var(--mono); font-size:10px; letter-spacing:0.06em; text-transform:uppercase; color:var(--pc); padding-top:3px; }
  .l-item h3 { font-family:var(--serif); font-weight:400; font-size:1.32rem; letter-spacing:-0.01em; margin:0; line-height:1.2; }
  .l-item h3 a:hover { color:var(--cyan); }
  .l-item p { margin:6px 0 0; font-size:14px; line-height:1.6; color:var(--dim); max-width:62ch; }
  .l-item .arrow { color:var(--faint); font-family:var(--mono); }
  @media (max-width:560px){ .l-item { grid-template-columns:1fr; gap:6px; } .l-item .itag { padding-top:0; } }

  /* adjacent pillars nav */
  .l-adjacent { margin-top:56px; border-top:1px solid var(--line); padding-top:30px; }
  .l-adjacent .ah { font-family:var(--mono); font-size:10px; letter-spacing:0.13em; text-transform:uppercase; color:var(--faint); margin-bottom:14px; }
  .l-adjgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr)); gap:12px; }
  .l-adj { border:1px solid var(--line); border-radius:12px; padding:15px 16px; transition:border-color .2s; }
  .l-adj:hover { border-color:#38342e; }
  .l-adj .an { font-family:var(--mono); font-size:10px; color:var(--ac); }
  .l-adj .at { font-family:var(--serif); font-size:1.15rem; margin-top:5px; line-height:1.15; }

  .l-cta { display:flex; align-items:center; gap:16px; flex-wrap:wrap; justify-content:space-between; border:1px solid var(--line); background:linear-gradient(180deg,rgba(16,185,129,0.06),transparent); border-radius:16px; padding:24px 26px; margin-top:52px; }
  .l-cta-h { font-family:var(--serif); font-size:1.5rem; letter-spacing:-0.01em; }
  .l-cta-s { font-size:13.5px; color:var(--dim); margin-top:5px; max-width:54ch; }
  .l-cta-btn { background:var(--green); color:#052e22; border-radius:24px; padding:12px 22px; font-size:14px; font-weight:700; white-space:nowrap; }

  .l-foot { max-width:70ch; margin-top:46px; font-family:var(--mono); font-size:11px; color:var(--faint); }
  .l-foot a { color:inherit; }
</style>
</head>
<body>
  <div class="l-top">
    <a href="index.html" class="l-brand"><span class="mk"><span style="color:var(--cyan)">J</span><span style="color:var(--purple)">T</span></span><span class="nm">jason.teixeira<span style="color:var(--green)">()</span></span></a>
    <span class="l-badge">Learn</span>
    <nav class="l-nav" aria-label="Primary">
      <a href="learn.html">Library</a>
      <a href="docs.html" class="hideable">Docs</a>
      <a href="services.html" class="hideable">Services</a>
      <a href="book.html" class="btn">Book a call →</a>
    </nav>
  </div>
  ${body}
  <script defer src="assets/agent.js"></script>
</body>
</html>`;
}

function footer() {
  return `<div class="l-foot">© <span data-year>2026</span> ${esc(AUTHOR)} · Sage Ideas LLC · <a href="learn.html">Learn home</a> · <a href="docs.html">Docs</a> · <a href="privacy.html">privacy</a> · <a href="terms.html">terms</a>
  <script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script></div>`;
}

/* ── hub home ── */
function hubHome() {
  const totalEntries = PILLARS.reduce((n, p) => n + entryCount(p.id), 0);
  const cards = PILLARS.map((p) => {
    const entries = (LIBRARY[p.id] || []);
    const featured = entries.slice(0, 3).map((e) => `<a class="plink" href="${e.href}"><span class="tag">${TYPE_LABEL[e.type] || e.type}</span><span>${esc(e.title)}</span></a>`).join('');
    const more = entries.length > 3 ? `<a class="pmore" href="${pillarHref(p.id)}">All ${entries.length} in ${esc(p.title)} →</a>` : `<a class="pmore" href="${pillarHref(p.id)}">Open ${esc(p.title)} →</a>`;
    return `<article class="l-pillar" style="--pc:${p.accent}">
      <div class="pnum">${p.num} · Pillar</div>
      <h2><a href="${pillarHref(p.id)}">${esc(p.title)}</a></h2>
      <p class="pk">${esc(p.blurb)}</p>
      <div class="plist">${featured}</div>
      ${more}
    </article>`;
  }).join('');

  const body = `<main class="l-wrap">
    <div class="l-crumb"><a href="index.html">Home</a> / <span style="color:var(--dim)">Learn</span></div>
    <div class="l-kicker">The reference library</div>
    <h1>Everything I know about shipping AI you can trust.</h1>
    <p class="l-lead">A working reference on evaluating, testing, and shipping AI features — organized into eight pillars, from LLM evaluation to workflow automation. Built from real engagements, and every claim links to a receipt. New material lands here continuously; the <a href="docs.html">docs</a> cover how engagements run.</p>
    <div class="l-meta"><span><b>${PILLARS.length}</b> pillars</span><span><b>${totalEntries}</b> resources live</span><span><b>Growing</b> weekly</span></div>
    <div class="l-grid">${cards}</div>
    <div class="l-cta"><div><div class="l-cta-h">Want this applied to your product?</div><div class="l-cta-s">Ask my AI associate on any page, or book a 15-minute call and we'll scope it.</div></div><a href="book.html" class="l-cta-btn" data-evt="learn-home-cta">Book a call →</a></div>
    ${footer()}
  </main>`;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Learn — the reference library', description: 'A working reference on evaluating, testing, and shipping AI you can trust.',
    url: `${SITE_URL}/learn.html`,
    hasPart: PILLARS.map((p) => ({ '@type': 'CollectionPage', name: p.title, url: `${SITE_URL}/${pillarHref(p.id)}`, description: p.blurb })),
  };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE_URL}/learn.html` },
  ] };
  return shell({ path: 'learn.html', title: 'Learn — the AI evaluation & quality reference library', desc: 'A working reference on evaluating, testing, and shipping AI features you can trust — LLM evaluation, RAG, agents, CI/CD, test automation, and workflow automation.', jsonLd, breadcrumbLd, body });
}

/* ── pillar page ── */
function pillarPage(pillar) {
  const entries = LIBRARY[pillar.id] || [];
  const items = entries.map((e) => `<article class="l-item">
    <div class="itag">${TYPE_LABEL[e.type] || e.type}</div>
    <div><h3><a href="${e.href}">${esc(e.title)} <span class="arrow">→</span></a></h3><p>${esc(e.desc)}</p></div>
  </article>`).join('');

  const others = PILLARS.filter((p) => p.id !== pillar.id);
  const adjacent = others.map((p) => `<a class="l-adj" href="${pillarHref(p.id)}" style="--ac:${p.accent}"><div class="an">${p.num} · Pillar</div><div class="at">${esc(p.title)}</div></a>`).join('');

  const body = `<main class="l-wrap" style="--pc:${pillar.accent}">
    <div class="l-crumb"><a href="index.html">Home</a> / <a href="learn.html">Learn</a> / <span style="color:var(--dim)">${esc(pillar.title)}</span></div>
    <div class="l-kicker" style="color:${pillar.accent}">${pillar.num} · Pillar</div>
    <h1>${esc(pillar.title)}</h1>
    <p class="l-lead">${esc(pillar.kicker)} ${esc(pillar.blurb)}</p>
    <div class="l-meta"><span><b>${entries.length}</b> resources</span><span>${esc(pillar.intent)}</span></div>
    <div class="l-cluster">${items}</div>
    <div class="l-adjacent"><div class="ah">Continue across the library</div><div class="l-adjgrid">${adjacent}</div></div>
    <div class="l-cta"><div><div class="l-cta-h">Need this on your product, not just in theory?</div><div class="l-cta-s">Book a 15-minute call and we'll scope the smallest useful next step.</div></div><a href="book.html" class="l-cta-btn" data-evt="learn-pillar-cta">Book a call →</a></div>
    ${footer()}
  </main>`;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: pillar.title, description: pillar.blurb, url: `${SITE_URL}/${pillarHref(pillar.id)}`,
    mainEntity: { '@type': 'ItemList', itemListElement: entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.title, url: `${SITE_URL}/${e.href}` })) },
  };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE_URL}/learn.html` },
    { '@type': 'ListItem', position: 3, name: pillar.title, item: `${SITE_URL}/${pillarHref(pillar.id)}` },
  ] };
  return shell({ path: pillarHref(pillar.id), title: `${pillar.title} — Learn`, desc: pillar.blurb, jsonLd, breadcrumbLd, body });
}

/* ── write ── */
writeFileSync('learn.html', hubHome());
for (const p of PILLARS) writeFileSync(pillarHref(p.id), pillarPage(p));
console.log(`✓ built learn.html + ${LEARN_SLUGS.length} pillar pages (${PILLARS.reduce((n, p) => n + entryCount(p.id), 0)} resources mapped)`);
