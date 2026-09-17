#!/usr/bin/env node
/**
 * build-glossary.mjs — generates the Learn glossary from glossary.data.mjs +
 * glossary-bodies.json:
 *   glossary.html            the hub (all terms by category, DefinedTermSet schema)
 *   glossary/<slug>.html     one indexable page per term (DefinedTerm schema)
 *
 * Related terms + "see also" are derived from each term's category, so every page
 * links up to its pillar cornerstone and across to its siblings automatically.
 * A term with no body yet renders from its gloss (never a blank page).
 *
 * Run: node scripts/build-glossary.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { CATS, TERMS, TERM_SLUGS } from './glossary.data.mjs';
import { SITE_URL, AUTHOR } from './site.config.mjs';

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Instrument Serif',Georgia,serif";
const esc = (s) => String(s ?? '').replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripTags = (s) => String(s ?? '').replace(/<[^>]+>/g, '');

let BODIES = {};
try { BODIES = JSON.parse(readFileSync('scripts/glossary-bodies.json', 'utf8')); } catch { BODIES = {}; }

const bySlug = Object.fromEntries(TERMS.map((t) => [t.slug, t]));
const siblings = (t) => TERMS.filter((x) => x.cat === t.cat && x.slug !== t.slug);
const termPath = (slug) => `glossary/${slug}.html`;

/* ── shell (base='' for the hub at root, base='../' for term pages one level deep) ── */
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

  .g-wrap { max-width:760px; margin:0 auto; padding:clamp(28px,5vw,60px) clamp(18px,4vw,32px) 88px; }
  .g-wide { max-width:1000px; }
  .g-crumb { font-family:var(--mono); font-size:11px; color:var(--faint); margin-bottom:20px; }
  .g-crumb a:hover { color:var(--ink); }
  .g-tag { display:inline-block; font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--tc); border:1px solid var(--line); border-radius:5px; padding:4px 9px; }
  h1 { font-family:var(--serif); font-weight:400; font-size:clamp(2.3rem,5.4vw,3.5rem); line-height:1.05; letter-spacing:-0.02em; margin:16px 0 0; text-wrap:balance; }
  .g-aka { font-family:var(--mono); font-size:12.5px; color:var(--faint); margin-top:10px; }
  .g-def { font-size:clamp(16px,2.1vw,19px); line-height:1.62; color:var(--ink); margin:22px 0 0; padding:20px 22px; border:1px solid var(--line); border-left:2px solid var(--tc); border-radius:0 12px 12px 0; background:linear-gradient(180deg,rgba(255,255,255,0.015),transparent); }
  .g-sec { margin-top:34px; }
  .g-sec h2 { font-family:var(--mono); font-size:11px; letter-spacing:0.13em; text-transform:uppercase; color:var(--tc); margin:0 0 10px; }
  .g-sec p { font-size:15.5px; line-height:1.74; color:var(--dim); margin:0; max-width:66ch; }
  .g-sec p b { color:var(--ink); font-weight:600; }
  .g-sec p a, .g-def a { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }
  .g-eg { margin-top:34px; border:1px solid var(--line); border-radius:12px; padding:18px 20px; background:var(--card); }
  .g-eg .lbl { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--tc); }
  .g-eg p { font-size:15px; line-height:1.72; color:var(--dim); margin:8px 0 0; }
  .g-eg p b { color:var(--ink); }

  .g-related { margin-top:48px; border-top:1px solid var(--line); padding-top:26px; }
  .g-related .rh { font-family:var(--mono); font-size:10px; letter-spacing:0.13em; text-transform:uppercase; color:var(--faint); margin-bottom:14px; }
  .g-chips { display:flex; flex-wrap:wrap; gap:9px; }
  .g-chip { border:1px solid var(--line); border-radius:20px; padding:8px 14px; font-size:13px; color:var(--dim); transition:border-color .2s, color .2s; }
  .g-chip:hover { border-color:var(--tc); color:var(--ink); }
  .g-see { margin-top:20px; font-size:14px; color:var(--dim); }
  .g-see a { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }

  .g-cta { display:flex; align-items:center; gap:16px; flex-wrap:wrap; justify-content:space-between; border:1px solid var(--line); background:linear-gradient(180deg,rgba(16,185,129,0.06),transparent); border-radius:14px; padding:20px 24px; margin-top:46px; }
  .g-cta-h { font-family:var(--serif); font-size:1.35rem; }
  .g-cta-s { font-size:13px; color:var(--dim); margin-top:3px; max-width:52ch; }
  .g-cta-btn { background:var(--green); color:#052e22; border-radius:22px; padding:11px 20px; font-size:13.5px; font-weight:700; white-space:nowrap; }
  .g-foot { margin-top:40px; font-family:var(--mono); font-size:11px; color:var(--faint); }
  .g-foot a { color:inherit; }

  /* hub */
  .g-hero-lead { color:var(--dim); font-size:clamp(15px,2vw,17px); line-height:1.7; margin:18px 0 0; max-width:62ch; }
  .g-hero-lead a { color:var(--cyan); text-decoration:underline; text-underline-offset:2px; }
  .g-catblock { margin-top:44px; }
  .g-cathead { display:flex; align-items:baseline; gap:12px; border-bottom:1px solid var(--line); padding-bottom:10px; }
  .g-cathead h2 { font-family:var(--serif); font-weight:400; font-size:1.5rem; margin:0; }
  .g-cathead .cc { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--cc); }
  .g-termgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr)); gap:2px 20px; margin-top:8px; }
  .g-termrow { display:block; padding:14px 4px; border-bottom:1px solid var(--line); }
  .g-termrow:hover .tt { color:var(--cc); }
  .g-termrow .tt { font-size:15px; color:var(--ink); transition:color .15s; }
  .g-termrow .tg { font-size:12.5px; color:var(--faint); line-height:1.5; margin-top:3px; }
</style>
</head>
<body>
  <div class="l-top">
    <a href="${base}index.html" class="l-brand"><span class="mk"><span style="color:var(--cyan)">J</span><span style="color:var(--purple)">T</span></span><span class="nm">jason.teixeira<span style="color:var(--green)">()</span></span></a>
    <span class="l-badge">Glossary</span>
    <nav class="l-nav" aria-label="Primary">
      <a href="${base}glossary.html">All terms</a>
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

/* ── term page ── */
function termPage(t) {
  const cat = CATS[t.cat];
  const b = BODIES[t.slug] || null;
  const base = '../';
  const def = b ? b.definition : `${t.gloss} <span style="color:var(--faint)">(fuller explainer coming soon)</span>`;
  const sections = b ? [
    ['Why it matters', b.why],
    ['How it works', b.how],
  ].filter((s) => s[1]) : [];
  const example = b && b.example ? b.example : '';

  const rel = siblings(t).slice(0, 8);
  const chips = rel.map((r) => `<a class="g-chip" href="${r.slug}.html">${esc(r.term)}</a>`).join('');

  const body = `<main class="g-wrap" style="--tc:${cat.accent}">
    <div class="g-crumb"><a href="${base}index.html">Home</a> / <a href="${base}learn.html">Learn</a> / <a href="${base}glossary.html">Glossary</a> / <span style="color:var(--dim)">${esc(t.term)}</span></div>
    <span class="g-tag">${esc(cat.label)}</span>
    <h1>${esc(t.term)}</h1>
    ${t.aka ? `<div class="g-aka">also called ${esc(t.aka)}</div>` : ''}
    <p class="g-def">${def}</p>
    ${sections.map((s) => `<div class="g-sec"><h2>${esc(s[0])}</h2><p>${s[1]}</p></div>`).join('')}
    ${example ? `<div class="g-eg"><div class="lbl">In practice</div><p>${example}</p></div>` : ''}
    <div class="g-related">
      <div class="rh">Related terms — ${esc(cat.label)}</div>
      <div class="g-chips">${chips}</div>
      <div class="g-see">See also: <a href="${base}${cat.cornerstone.href}">${esc(cat.cornerstone.t)}</a> · <a href="${base}${cat.pillar}">${esc(cat.pillarName)} pillar →</a></div>
    </div>
    <div class="g-cta"><div><div class="g-cta-h">Want this checked on your own AI feature?</div><div class="g-cta-s">Get a free mini-eval — real findings on your live feature, no call required.</div></div><a href="${base}sample.html" class="g-cta-btn">Free mini-eval →</a></div>
    <div class="g-foot">© <span data-year>2026</span> ${esc(AUTHOR)} · Sage Ideas LLC · <a href="${base}glossary.html">Glossary</a> · <a href="${base}learn.html">Learn</a> · <a href="${base}privacy.html">privacy</a>
    <script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script></div>
  </main>`;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'DefinedTerm',
    name: t.term, ...(t.aka ? { alternateName: t.aka } : {}),
    description: b ? stripTags(b.definition) : t.gloss,
    inDefinedTermSet: `${SITE_URL}/glossary.html`,
    url: `${SITE_URL}/${termPath(t.slug)}`,
  };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE_URL}/learn.html` },
    { '@type': 'ListItem', position: 3, name: 'Glossary', item: `${SITE_URL}/glossary.html` },
    { '@type': 'ListItem', position: 4, name: t.term, item: `${SITE_URL}/${termPath(t.slug)}` },
  ] };
  const desc = b ? stripTags(b.definition).slice(0, 155) : t.gloss;
  return shell({ base, path: termPath(t.slug), title: `${t.term} — AI evaluation glossary`, desc, jsonLd, breadcrumbLd, body });
}

/* ── hub ── */
function hub() {
  const order = Object.keys(CATS);
  const blocks = order.map((catKey) => {
    const cat = CATS[catKey];
    const terms = TERMS.filter((t) => t.cat === catKey);
    const rows = terms.map((t) => `<a class="g-termrow" href="${termPath(t.slug)}"><div class="tt">${esc(t.term)}${t.aka ? ` <span style="color:var(--faint);font-size:12px">· ${esc(t.aka)}</span>` : ''}</div><div class="tg">${esc(t.gloss)}</div></a>`).join('');
    return `<section class="g-catblock" style="--cc:${cat.accent}">
      <div class="g-cathead"><span class="cc">${terms.length} terms</span><h2>${esc(cat.label)}</h2></div>
      <div class="g-termgrid">${rows}</div>
    </section>`;
  }).join('');

  const body = `<main class="g-wrap g-wide">
    <div class="g-crumb"><a href="index.html">Home</a> / <a href="learn.html">Learn</a> / <span style="color:var(--dim)">Glossary</span></div>
    <span class="g-tag" style="--tc:var(--green)">Reference</span>
    <h1>The AI evaluation & quality glossary</h1>
    <p class="g-hero-lead">Plain-English definitions of the vocabulary behind evaluating, testing, and shipping AI you can trust. Every term is a real page with a concrete example, linked to the <a href="learn.html">pillar</a> it belongs to. ${TERMS.length} terms and counting.</p>
    ${blocks}
    <div class="g-cta"><div><div class="g-cta-h">Prefer the applied version?</div><div class="g-cta-s">The Learn library turns these terms into guides, and a free mini-eval turns them into findings on your feature.</div></div><a href="sample.html" class="g-cta-btn">Free mini-eval →</a></div>
    <div class="g-foot">© <span data-year>2026</span> ${esc(AUTHOR)} · Sage Ideas LLC · <a href="learn.html">Learn</a> · <a href="docs.html">Docs</a> · <a href="privacy.html">privacy</a>
    <script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script></div>
  </main>`;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'DefinedTermSet',
    name: 'AI evaluation & quality glossary', description: 'Plain-English definitions of the vocabulary behind evaluating, testing, and shipping AI.',
    url: `${SITE_URL}/glossary.html`,
    hasDefinedTerm: TERMS.map((t) => ({ '@type': 'DefinedTerm', name: t.term, description: t.gloss, url: `${SITE_URL}/${termPath(t.slug)}` })),
  };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE_URL}/learn.html` },
    { '@type': 'ListItem', position: 3, name: 'Glossary', item: `${SITE_URL}/glossary.html` },
  ] };
  return shell({ base: '', path: 'glossary.html', title: 'AI evaluation & quality glossary', desc: 'Plain-English definitions of the vocabulary behind evaluating, testing, and shipping AI you can trust.', jsonLd, breadcrumbLd, body });
}

/* ── write ── */
mkdirSync('glossary', { recursive: true });
writeFileSync('glossary.html', hub());
for (const t of TERMS) writeFileSync(termPath(t.slug), termPage(t));
const withBody = TERM_SLUGS.filter((s) => BODIES[s]).length;
console.log(`✓ built glossary.html + ${TERMS.length} term pages (${withBody} with full bodies, ${TERMS.length - withBody} gloss-only)`);
