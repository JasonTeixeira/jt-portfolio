#!/usr/bin/env node
/**
 * build-notes.mjs — generates notes/<slug>.html, field-notes.html (index),
 * and feed.xml from scripts/notes.data.mjs. One data file → all surfaces.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { NOTES } from './notes.data.mjs';
import { SERVICES } from './services.data.mjs';
import { SITE_URL, AUTHOR } from './site.config.mjs';

const MONO = "font-family:'JetBrains Mono',monospace;";
const SERIF = "font-family:'Instrument Serif',Georgia,serif;";

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function head({ title, description, canonicalPath, jsonLd, depth, ogImage }) {
  const p = depth === 1 ? '../' : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}${canonicalPath}">
<meta property="og:type" content="${jsonLd ? 'article' : 'website'}">
<meta property="og:image" content="${SITE_URL}/assets/${ogImage || 'og.png'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE_URL}${canonicalPath}">
<link rel="alternate" type="application/rss+xml" title="Field Notes — ${AUTHOR}" href="${SITE_URL}/feed.xml">
<link rel="preload" href="${p}assets/fonts/instrument-serif.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${p}assets/fonts/plus-jakarta-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${p}assets/fonts/jetbrains-mono-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${p}assets/site.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%2309090B'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-family='monospace' font-size='26' font-weight='700' fill='%2310b981'%3EJT%3C/text%3E%3C/svg%3E">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>`;
}

function nav(depth) {
  const p = depth === 1 ? '../' : '';
  return `<nav style="position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:14px clamp(18px,4vw,40px);background:rgba(9,9,11,0.82);backdrop-filter:blur(16px);border-bottom:1px solid #2A2826">
    <a href="${p}index.html" style="display:inline-flex;align-items:center;gap:10px;color:#F4F2EF">
      <span style="width:26px;height:26px;border:1px solid #2A2826;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;${MONO}font-size:11px;font-weight:700;background:#0C0C0E"><span style="color:#22d3ee">J</span><span style="color:#a78bfa">T</span></span>
      <span style="${MONO}font-size:13px;font-weight:600;letter-spacing:0.02em">jason.teixeira<span style="color:#10b981">()</span></span>
    </a>
    <div style="display:flex;gap:20px;align-items:center;${MONO}font-size:12px">
      <a href="${p}field-notes.html" class="dim-link">all notes</a>
      <a href="${p}index.html" class="dim-link">← portfolio</a>
    </div>
  </nav>`;
}

function footer(depth) {
  const p = depth === 1 ? '../' : '';
  return `<footer style="border-top:1px solid #2A2826;padding:22px clamp(18px,4vw,40px);display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;${MONO}font-size:11px;color:#837D77">
    <span>© <span data-year>2026</span> Jason Teixeira · Sage Ideas LLC</span>
    <span><a href="${p}feed.xml" class="dim-link" style="color:#837D77">rss</a> · <a href="${p}index.html" class="dim-link" style="color:#837D77">← portfolio</a></span>
  </footer>
<script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script>
<script src="${p}assets/subscribe.js"></script>`;
}

/* ── individual post pages ── */
mkdirSync('notes', { recursive: true });
for (const n of NOTES) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: n.title,
    description: n.dek,
    datePublished: n.date,
    author: { '@type': 'Person', name: AUTHOR, url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/notes/${n.slug}.html`
  };
  const quote = `<div style="border-left:2px solid ${n.color};padding:4px 0 4px 18px;${SERIF}font-size:1.3rem;line-height:1.5;color:#F4F2EF">${n.quote}</div>`;
  const paras = n.body.map((b) =>
    b === '__QUOTE__'
      ? quote
      : b === n.body[0]
        ? `<p style="margin:0"><span style="${SERIF}font-size:2.4rem;float:left;line-height:0.8;padding:6px 8px 0 0;color:${n.color}">${n.dropCap}</span>${b}</p>`
        : `<p style="margin:0">${b}</p>`
  ).join('\n      ');

  const html = `${head({ title: `${n.title} — Field Notes`, description: n.dek, canonicalPath: `/notes/${n.slug}.html`, jsonLd, depth: 1, ogImage: `og-note-${n.slug}.png` })}
<body>
<div style="min-height:100vh;background:#09090B;position:relative">
  ${nav(1)}
  <article style="max-width:820px;margin:0 auto;padding:72px clamp(18px,4vw,40px) 88px">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;${MONO}font-size:11px;letter-spacing:0.12em;text-transform:uppercase">
      <span style="color:${n.color}">note ${n.num}</span><span style="color:#837D77">·</span>
      <time datetime="${n.date}" style="color:#8E8882">${n.dateLabel}</time><span style="color:#837D77">·</span>
      <span style="color:#8E8882">${n.read}</span>
    </div>
    <h1 style="${SERIF}font-weight:400;font-size:clamp(2.2rem,4.5vw,3.2rem);line-height:1.12;letter-spacing:-0.015em;margin:18px 0 0;text-wrap:balance">${n.title}</h1>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#A8A29E;max-width:58ch">${n.dek}</p>
    <div class="prose" style="margin-top:32px;font-size:15px;line-height:1.85;color:#C9C4BF;display:flex;flex-direction:column;gap:18px">
      ${paras}
    </div>
    <div style="margin-top:32px;padding-top:18px;border-top:1px dashed #2A2826;${MONO}font-size:11px;color:#837D77">artifacts — ${n.artifacts}</div>
    <div style="margin-top:36px;display:flex;gap:14px;flex-wrap:wrap">
      <a href="../field-notes.html" class="btn-ghost" style="padding:11px 22px;font-size:13px">← All field notes</a>
      <a href="../index.html#contact" class="btn-solid green" style="padding:11px 22px;font-size:13px">Work with me →</a>
    </div>
    <div data-subscribe style="margin-top:40px"></div>
  </article>
  ${footer(1)}
</div>
</body>
</html>
`;
  writeFileSync(`notes/${n.slug}.html`, html);
}

/* ── field-notes.html index ── */
const indexItems = NOTES.map((n) => `
  <a href="notes/${n.slug}.html" class="note-row" style="display:flex;flex-wrap:wrap;align-items:baseline;gap:clamp(14px,2vw,28px);padding:30px 0;border-bottom:1px solid #2A2826">
    <time datetime="${n.date}" style="${MONO}font-size:11px;color:#837D77;min-width:5.5em">${n.dateLabel}</time>
    <span style="flex:1;min-width:min(300px,100%)">
      <span style="display:block;${SERIF}font-size:clamp(1.3rem,2vw,1.7rem);letter-spacing:-0.01em">${n.title}</span>
      <span style="display:block;font-size:13px;line-height:1.6;color:#8E8882;margin-top:6px;max-width:64ch">${n.dek}</span>
    </span>
    <span style="${MONO}font-size:11px;color:${n.color};white-space:nowrap">${n.read} · read →</span>
  </a>`).join('\n');

const indexHtml = `${head({ title: 'Field Notes — Jason Teixeira', description: 'Working notes from the proof-first trenches — short, specific, and grounded in systems actually shipped.', canonicalPath: '/field-notes.html', jsonLd: null, depth: 0 })}
<body>
<div style="min-height:100vh;background:#09090B;position:relative">
  ${nav(0)}
  <header style="max-width:820px;margin:0 auto;padding:88px clamp(18px,4vw,40px) 24px;animation:jt-fadeup 500ms ease-out">
    <div style="display:flex;align-items:center;gap:14px;${MONO}font-size:11.5px;letter-spacing:0.14em;text-transform:uppercase;color:#8E8882">
      <span style="width:8px;height:8px;border-radius:50%;background:#10b981;animation:jt-blink 2.4s ease-in-out infinite"></span>
      <span>field notes — proof-first engineering</span>
    </div>
    <h1 style="${SERIF}font-weight:400;font-size:clamp(2.8rem,6vw,4.4rem);line-height:1.05;letter-spacing:-0.02em;margin:24px 0 0">Working notes, written between commits.</h1>
    <p style="margin:20px 0 0;font-size:15px;line-height:1.75;color:#A8A29E;max-width:56ch">Short, specific, and grounded in systems I actually shipped. Longer-form writing lives at <a href="https://sageafterdark.com">sageafterdark.com</a>.</p>
  </header>
  <section style="max-width:820px;margin:0 auto;padding:24px clamp(18px,4vw,40px) 88px">
    <div style="border-top:1px solid #2A2826">
${indexItems}
    </div>
    <p style="margin:20px 0 0;${MONO}font-size:11px;color:#837D77">free artifact: <a href="checklist.html" style="color:#a78bfa">the LLM pre-launch eval checklist →</a></p>
    <div data-subscribe style="margin-top:32px"></div>
  </section>
  ${footer(0)}
</div>
</body>
</html>
`;
writeFileSync('field-notes.html', indexHtml);

/* ── RSS feed ── */
const items = NOTES.map((n) => `    <item>
      <title>${esc(n.title)}</title>
      <link>${SITE_URL}/notes/${n.slug}.html</link>
      <guid isPermaLink="true">${SITE_URL}/notes/${n.slug}.html</guid>
      <pubDate>${new Date(n.date + 'T12:00:00Z').toUTCString()}</pubDate>
      <description>${esc(n.dek)}</description>
    </item>`).join('\n');

writeFileSync('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Field Notes — ${AUTHOR}</title>
    <link>${SITE_URL}/field-notes.html</link>
    <description>Working notes from the proof-first trenches: AI automation, QA, and LLM evaluation.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`);

/* ── sitemap + robots ── */
const pages = [
  '/', '/field-notes.html', '/checklist.html',
  ...SERVICES.map((s) => `/services/${s.slug}.html`),
  ...NOTES.map((n) => `/notes/${n.slug}.html`)
];
const today = new Date().toISOString().slice(0, 10);
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
writeFileSync('robots.txt', `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml
`);

console.log(`✓ built ${NOTES.length} note pages, field-notes.html index, feed.xml, sitemap.xml, robots.txt`);
