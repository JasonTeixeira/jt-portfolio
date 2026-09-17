#!/usr/bin/env node
/**
 * build-compare.mjs — generates the "X vs Y" comparison library from
 * comparisons.data.mjs + compare-bodies.json:
 *   compare.html            the hub (all matchups by category)
 *   compare/<slug>.html     one page per matchup (Article + BreadcrumbList schema)
 *
 * The comparison table is the scannable centerpiece. Related matchups + the
 * cornerstone up-link derive from each matchup's category. A matchup with no body
 * yet renders from its gloss (never a blank page).
 *
 * Run: node scripts/build-compare.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { CATS, COMPARISONS, COMPARE_SLUGS } from './comparisons.data.mjs';
import { SITE_URL, AUTHOR } from './site.config.mjs';

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Instrument Serif',Georgia,serif";
const esc = (s) => String(s ?? '').replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripTags = (s) => String(s ?? '').replace(/<[^>]+>/g, '');

let BODIES = {};
try { BODIES = JSON.parse(readFileSync('scripts/compare-bodies.json', 'utf8')); } catch { BODIES = {}; }

const siblings = (c) => COMPARISONS.filter((x) => x.cat === c.cat && x.slug !== c.slug);
const cmpPath = (slug) => `compare/${slug}.html`;

function shell({ base, path, title, desc, jsonLd, breadcrumbLd, body }) {
  const canonical = `${SITE_URL}/${path}`;
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
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE_URL}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE_URL}/assets/og.png">
<link rel="preload" href="${base}assets/fonts/instrument-serif.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}assets/fonts/plus-jakarta-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}assets/fonts/jetbrains-mono-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/site.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%2309090B'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-family='monospace' font-size='26' font-weight='700' fill='%2310b981'%3EJT%3C/text%3E%3C/svg%3E">
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
<style>
  :root { --ink:#F4F2EF; --dim:#A8A29E; --faint:#8E8882; --line:#211F1C; --card:#0C0C0E; --bg:#09090B; --green:#10b981; --cyan:#22d3ee; --purple:#a78bfa; --amber:#F59E0B; --mono:${MONO}; --serif:${SERIF}; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
  a { color:inherit; text-decoration:none; }
  .l-top { position:sticky; top:0; z-index:60; display:flex; align-items:center; gap:12px; padding:11px clamp(14px,3vw,28px); background:rgba(9,9,11,0.9); backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
  .l-brand { display:inline-flex; align-items:center; gap:9px; }
  .l-brand .mk { width:24px; height:24px; border:1px solid var(--line); border-radius:6px; display:grid; place-items:center; font-family:var(--mono); font-size:10px; font-weight:700; background:var(--card); }
  .l-brand .nm { font-family:var(--mono); font-size:12.5px; font-weight:600; white-space:nowrap; }
  .l-badge { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--faint); border:1px solid var(--line); border-radius:5px; padding:3px 8px; }
  .l-nav { margin-left:auto; display:flex; gap:18px; align-items:center; font-family:var(--mono); font-size:12px; }
  .l-nav a { color:var(--dim); } .l-nav a:hover { color:var(--ink); }
  .l-nav .btn { background:var(--green); color:#052e22; border-radius:22px; padding:8px 15px; font-weight:700; white-space:nowrap; }
  @media (max-width:640px){ .l-nav .hideable { display:none; } }

  .c-wrap { max-width:880px; margin:0 auto; padding:clamp(28px,5vw,60px) clamp(18px,4vw,32px) 88px; }
  .c-crumb { font-family:var(--mono); font-size:11px; color:var(--faint); margin-bottom:20px; }
  .c-crumb a:hover { color:var(--ink); }
  .c-tag { display:inline-block; font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--tc); border:1px solid var(--line); border-radius:5px; padding:4px 9px; }
  h1 { font-family:var(--serif); font-weight:400; font-size:clamp(2.3rem,5.2vw,3.5rem); line-height:1.05; letter-spacing:-0.02em; margin:16px 0 0; text-wrap:balance; }
  h1 .vs { color:var(--faint); font-style:italic; }
  .c-intro { font-size:clamp(16px,2.1vw,18px); line-height:1.66; color:var(--ink); margin:20px 0 0; max-width:66ch; }
  .c-intro b { font-weight:600; }

  .c-tablewrap { margin:34px 0 0; border:1px solid var(--line); border-radius:14px; overflow-x:auto; }
  table.c-table { width:100%; border-collapse:collapse; font-size:14px; min-width:560px; }
  .c-table th, .c-table td { text-align:left; padding:13px 16px; border-bottom:1px solid var(--line); vertical-align:top; line-height:1.55; }
  .c-table thead th { font-family:var(--mono); font-size:11px; letter-spacing:0.04em; text-transform:uppercase; background:#0A0A0C; }
  .c-table thead th.dim { color:var(--faint); }
  .c-table thead th.ta { color:var(--tc); }
  .c-table thead th.tb { color:var(--ink); }
  .c-table td.dim { font-family:var(--mono); font-size:11.5px; color:var(--faint); white-space:nowrap; }
  .c-table td { color:var(--dim); }
  .c-table td b { color:var(--ink); font-weight:600; }
  .c-table tbody tr:last-child td { border-bottom:none; }

  .c-picks { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:36px; }
  @media (max-width:620px){ .c-picks { grid-template-columns:1fr; } }
  .c-pick { border:1px solid var(--line); border-radius:14px; padding:18px 20px; background:var(--card); }
  .c-pick.a { border-top:2px solid var(--tc); }
  .c-pick.b { border-top:2px solid var(--dim); }
  .c-pick .ph { font-family:var(--mono); font-size:11px; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:8px; }
  .c-pick.a .ph { color:var(--tc); }
  .c-pick.b .ph { color:var(--ink); }
  .c-pick p { margin:0; font-size:14.5px; line-height:1.66; color:var(--dim); }
  .c-pick p b { color:var(--ink); }

  .c-take { margin-top:34px; border:1px solid var(--line); border-left:2px solid var(--green); background:rgba(16,185,129,0.04); border-radius:0 12px 12px 0; padding:18px 22px; }
  .c-take .th { font-family:var(--mono); font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--green); margin-bottom:8px; }
  .c-take p { margin:0; font-size:15px; line-height:1.7; color:var(--dim); } .c-take p b { color:var(--ink); }

  .c-related { margin-top:48px; border-top:1px solid var(--line); padding-top:26px; }
  .c-related .rh { font-family:var(--mono); font-size:10px; letter-spacing:0.13em; text-transform:uppercase; color:var(--faint); margin-bottom:14px; }
  .c-chips { display:flex; flex-wrap:wrap; gap:9px; }
  .c-chip { border:1px solid var(--line); border-radius:20px; padding:8px 14px; font-size:13px; color:var(--dim); }
  .c-chip:hover { border-color:var(--tc); color:var(--ink); }
  .c-see { margin-top:18px; font-size:14px; color:var(--dim); } .c-see a { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }

  .c-cta { display:flex; align-items:center; gap:16px; flex-wrap:wrap; justify-content:space-between; border:1px solid var(--line); background:linear-gradient(180deg,rgba(16,185,129,0.06),transparent); border-radius:14px; padding:20px 24px; margin-top:46px; }
  .c-cta-h { font-family:var(--serif); font-size:1.35rem; }
  .c-cta-s { font-size:13px; color:var(--dim); margin-top:3px; max-width:54ch; }
  .c-cta-btn { background:var(--green); color:#052e22; border-radius:22px; padding:11px 20px; font-size:13.5px; font-weight:700; white-space:nowrap; }
  .c-note { margin-top:26px; font-family:var(--mono); font-size:11px; color:var(--faint); line-height:1.6; }
  .c-foot { margin-top:22px; font-family:var(--mono); font-size:11px; color:var(--faint); } .c-foot a { color:inherit; }

  /* hub */
  .c-hero-lead { color:var(--dim); font-size:clamp(15px,2vw,17px); line-height:1.7; margin:18px 0 0; max-width:62ch; }
  .c-hero-lead a { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }
  .c-catblock { margin-top:44px; }
  .c-cathead { display:flex; align-items:baseline; gap:12px; border-bottom:1px solid var(--line); padding-bottom:10px; }
  .c-cathead h2 { font-family:var(--serif); font-weight:400; font-size:1.5rem; margin:0; }
  .c-cathead .cc { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--cc); }
  .c-matchrow { display:block; padding:15px 4px; border-bottom:1px solid var(--line); }
  .c-matchrow:hover .mt { color:var(--cc); }
  .c-matchrow .mt { font-size:16px; color:var(--ink); font-family:var(--serif); transition:color .15s; }
  .c-matchrow .mg { font-size:13px; color:var(--faint); line-height:1.5; margin-top:3px; }
</style>
</head>
<body>
  <div class="l-top">
    <a href="${base}index.html" class="l-brand"><span class="mk"><span style="color:var(--cyan)">J</span><span style="color:var(--purple)">T</span></span><span class="nm">jason.teixeira<span style="color:var(--green)">()</span></span></a>
    <span class="l-badge">Compare</span>
    <nav class="l-nav" aria-label="Primary">
      <a href="${base}compare.html">All comparisons</a>
      <a href="${base}learn.html" class="hideable">Learn</a>
      <a href="${base}docs.html" class="hideable">Docs</a>
      <a href="${base}book.html" class="btn">Book a call →</a>
    </nav>
  </div>
  ${body}
  <script defer src="${base}assets/agent.js"></script>
</body>
</html>`;
}

/* ── matchup page ── */
function comparePage(c) {
  const cat = CATS[c.cat];
  const b = BODIES[c.slug] || null;
  const base = '../';
  const title = `${c.a} vs ${c.b}`;
  const intro = b ? b.intro : `${c.gloss} <span style="color:var(--faint)">(full comparison coming soon)</span>`;

  const rows = (b && Array.isArray(b.table) ? b.table : []).map((r) => `<tr><td class="dim">${esc(r.dim)}</td><td>${r.a}</td><td>${r.b}</td></tr>`).join('');
  const table = rows ? `<div class="c-tablewrap"><table class="c-table"><thead><tr><th class="dim">Dimension</th><th class="ta">${esc(c.a)}</th><th class="tb">${esc(c.b)}</th></tr></thead><tbody>${rows}</tbody></table></div>` : '';

  const picks = b ? `<div class="c-picks">
    <div class="c-pick a"><div class="ph">Pick ${esc(c.a)} if</div><p>${b.pickA}</p></div>
    <div class="c-pick b"><div class="ph">Pick ${esc(c.b)} if</div><p>${b.pickB}</p></div>
  </div>` : '';
  const take = b && b.honestTake ? `<div class="c-take"><div class="th">The honest take</div><p>${b.honestTake}</p></div>` : '';

  const rel = siblings(c).slice(0, 8);
  const chips = rel.map((r) => `<a class="c-chip" href="${r.slug}.html">${esc(r.a)} vs ${esc(r.b)}</a>`).join('');

  const body = `<main class="c-wrap" style="--tc:${cat.accent}">
    <div class="c-crumb"><a href="${base}index.html">Home</a> / <a href="${base}learn.html">Learn</a> / <a href="${base}compare.html">Compare</a> / <span style="color:var(--dim)">${esc(title)}</span></div>
    <span class="c-tag">${esc(cat.label)}</span>
    <h1>${esc(c.a)} <span class="vs">vs</span> ${esc(c.b)}</h1>
    <p class="c-intro">${intro}</p>
    ${table}
    ${picks}
    ${take}
    <div class="c-related">
      <div class="rh">Related comparisons — ${esc(cat.label)}</div>
      <div class="c-chips">${chips || '<span style="color:var(--faint);font-size:13px">More in this category coming soon.</span>'}</div>
      <div class="c-see">See also: <a href="${base}${cat.cornerstone.href}">${esc(cat.cornerstone.t)}</a> · <a href="${base}${cat.pillar}">${esc(cat.pillarName)} pillar →</a></div>
    </div>
    <div class="c-cta"><div><div class="c-cta-h">Not sure which fits your stack?</div><div class="c-cta-s">Book a 20-minute call and I’ll tell you straight, based on your setup — no upsell.</div></div><a href="${base}book.html" class="c-cta-btn">Book a call →</a></div>
    <div class="c-note">Comparisons reflect each tool’s general positioning as of ${new Date().getFullYear()} and focus on architecture and fit rather than fast-moving pricing or version details. Check each project’s own docs before you commit.</div>
    <div class="c-foot">© <span data-year>2026</span> ${esc(AUTHOR)} · Sage Ideas LLC · <a href="${base}compare.html">All comparisons</a> · <a href="${base}learn.html">Learn</a>
    <script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script></div>
  </main>`;

  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: `${title}: which should you use?`, description: b ? stripTags(b.intro).slice(0, 155) : c.gloss, author: { '@type': 'Person', name: AUTHOR, url: SITE_URL }, mainEntityOfPage: `${SITE_URL}/${cmpPath(c.slug)}` };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE_URL}/learn.html` },
    { '@type': 'ListItem', position: 3, name: 'Compare', item: `${SITE_URL}/compare.html` },
    { '@type': 'ListItem', position: 4, name: title, item: `${SITE_URL}/${cmpPath(c.slug)}` },
  ] };
  const desc = b ? stripTags(b.intro).slice(0, 155) : c.gloss;
  return shell({ base, path: cmpPath(c.slug), title: `${title}: which should you use? (${new Date().getFullYear()})`, desc, jsonLd, breadcrumbLd, body });
}

/* ── hub ── */
function hub() {
  const order = Object.keys(CATS);
  const blocks = order.map((catKey) => {
    const cat = CATS[catKey];
    const items = COMPARISONS.filter((c) => c.cat === catKey);
    if (!items.length) return '';
    const rows = items.map((c) => `<a class="c-matchrow" href="${cmpPath(c.slug)}"><div class="mt">${esc(c.a)} vs ${esc(c.b)}</div><div class="mg">${esc(c.gloss)}</div></a>`).join('');
    return `<section class="c-catblock" style="--cc:${cat.accent}"><div class="c-cathead"><span class="cc">${items.length}</span><h2>${esc(cat.label)}</h2></div>${rows}</section>`;
  }).join('');

  const body = `<main class="c-wrap" style="max-width:940px">
    <div class="c-crumb"><a href="index.html">Home</a> / <a href="learn.html">Learn</a> / <span style="color:var(--dim)">Compare</span></div>
    <span class="c-tag" style="--tc:var(--green)">Tool comparisons</span>
    <h1>AI eval & testing tools, compared straight</h1>
    <p class="c-hero-lead">Honest head-to-head comparisons of the tools for evaluating, observing, and testing AI, written from hands-on use rather than a feature grid scraped off a landing page. Each one ends with a real recommendation. Start from the <a href="learn.html">Learn library</a> for the concepts behind them.</p>
    ${blocks}
    <div class="c-cta"><div><div class="c-cta-h">Want a recommendation for your exact stack?</div><div class="c-cta-s">Book a short call and I’ll point you at the right tool for your setup, with no affiliate angle.</div></div><a href="book.html" class="c-cta-btn">Book a call →</a></div>
    <div class="c-foot">© <span data-year>2026</span> ${esc(AUTHOR)} · Sage Ideas LLC · <a href="learn.html">Learn</a> · <a href="docs.html">Docs</a>
    <script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script></div>
  </main>`;

  const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'AI eval & testing tool comparisons', description: 'Honest head-to-head comparisons of AI evaluation, observability, and testing tools.', url: `${SITE_URL}/compare.html` };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE_URL}/learn.html` },
    { '@type': 'ListItem', position: 3, name: 'Compare', item: `${SITE_URL}/compare.html` },
  ] };
  return shell({ base: '', path: 'compare.html', title: 'AI eval & testing tools, compared', desc: 'Honest head-to-head comparisons of the tools for evaluating, observing, and testing AI features.', jsonLd, breadcrumbLd, body });
}

/* ── write ── */
mkdirSync('compare', { recursive: true });
writeFileSync('compare.html', hub());
for (const c of COMPARISONS) writeFileSync(cmpPath(c.slug), comparePage(c));
const withBody = COMPARE_SLUGS.filter((s) => BODIES[s]).length;
console.log(`✓ built compare.html + ${COMPARISONS.length} matchup pages (${withBody} with full bodies, ${COMPARISONS.length - withBody} gloss-only)`);
