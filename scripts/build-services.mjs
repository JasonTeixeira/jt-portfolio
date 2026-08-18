#!/usr/bin/env node
/**
 * build-services.mjs — generates services/<slug>.html landing pages from
 * scripts/services.data.mjs. Service + BreadcrumbList JSON-LD, buyer-keyword
 * targeting, proof links back into the portfolio.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { SERVICES, BOOK_URL } from './services.data.mjs';
import { SITE_URL, AUTHOR } from './site.config.mjs';

const MONO = "font-family:'JetBrains Mono',monospace;";
const SERIF = "font-family:'Instrument Serif',Georgia,serif;";

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

mkdirSync('services', { recursive: true });

for (const s of SERVICES) {
  const url = `${SITE_URL}/services/${s.slug}.html`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: s.keyword,
      description: s.metaDescription,
      url,
      provider: { '@type': 'Person', name: AUTHOR, url: SITE_URL },
      areaServed: 'Remote (US)',
      serviceType: s.keyword,
      ...(s.packages
        ? {
            offers: s.packages.map((p) => ({
              '@type': 'Offer',
              name: `${s.keyword} — ${p.name}`,
              priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'USD' },
              availability: 'https://schema.org/InStock',
              url: BOOK_URL,
              description: p.d
            }))
          }
        : {})
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'Services', item: SITE_URL + '/index.html#services' },
        { '@type': 'ListItem', position: 3, name: s.keyword, item: url }
      ]
    }
  ];

  const symptoms = s.symptoms.map((x) =>
    `<li style="font-size:14px;line-height:1.75;color:#A8A29E">${x}</li>`).join('\n        ');

  const deliverables = s.deliverables.map((d) => `
      <div style="border:1px solid #2A2826;background:#0C0C0E;padding:24px;display:flex;flex-direction:column;gap:10px">
        <span style="width:30px;height:3px;border-radius:2px;background:${s.color}"></span>
        <h3 style="${SERIF}font-weight:400;font-size:1.25rem;margin:0">${d.t}</h3>
        <p style="margin:0;font-size:13.5px;line-height:1.7;color:#A8A29E">${d.d}</p>
      </div>`).join('\n');

  const proof = s.proof.map((p) => `
      <a href="${p.href}" style="display:flex;flex-wrap:wrap;align-items:baseline;gap:14px;padding:18px 0;border-bottom:1px solid #2A2826;color:#F4F2EF" class="note-row">
        <span style="${MONO}font-size:12.5px;color:${s.color};min-width:14em">${p.name}</span>
        <span style="flex:1;font-size:13px;line-height:1.6;color:#8E8882">${p.metric} →</span>
      </a>`).join('\n');

  const faq = s.faq.map((f) => `
      <details class="faq" style="border-color:#2A2826">
        <summary style="color:#F4F2EF">${f.q}</summary>
        <p style="color:#A8A29E">${f.a}</p>
      </details>`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)}</title>
<meta name="description" content="${esc(s.metaDescription)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(s.title)}">
<meta property="og:description" content="${esc(s.metaDescription)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/assets/og-service-${s.slug}.png">
<link rel="preload" href="../assets/fonts/instrument-serif.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../assets/fonts/plus-jakarta-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../assets/fonts/jetbrains-mono-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../assets/site.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%2309090B'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-family='monospace' font-size='26' font-weight='700' fill='%2310b981'%3EJT%3C/text%3E%3C/svg%3E">
${jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
</head>
<body>
<div style="min-height:100vh;background:#09090B;position:relative">
  <nav style="position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:14px clamp(18px,4vw,40px);background:rgba(9,9,11,0.82);backdrop-filter:blur(16px);border-bottom:1px solid #2A2826">
    <a href="../index.html" style="display:inline-flex;align-items:center;gap:10px;color:#F4F2EF">
      <span style="width:26px;height:26px;border:1px solid #2A2826;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;${MONO}font-size:11px;font-weight:700;background:#0C0C0E"><span style="color:#22d3ee">J</span><span style="color:#a78bfa">T</span></span>
      <span style="${MONO}font-size:13px;font-weight:600;letter-spacing:0.02em">jason.teixeira<span style="color:#10b981">()</span></span>
    </a>
    <div style="display:flex;gap:20px;align-items:center;${MONO}font-size:12px">
      <a href="../index.html#services" class="dim-link">all services</a>
      <a href="../index.html" class="dim-link">← portfolio</a>
    </div>
  </nav>

  <header style="max-width:920px;margin:0 auto;padding:88px clamp(18px,4vw,40px) 40px;animation:jt-fadeup 500ms ease-out">
    <div style="display:flex;align-items:center;gap:14px;${MONO}font-size:11.5px;letter-spacing:0.14em;text-transform:uppercase;color:#8E8882">
      <span style="width:8px;height:8px;border-radius:50%;background:${s.color};animation:jt-blink 2.4s ease-in-out infinite"></span>
      <span style="color:${s.color}">${s.keyword}</span>
      <span style="flex:1;height:1px;background:#2A2826"></span>
    </div>
    <h1 style="${SERIF}font-weight:400;font-size:clamp(2.4rem,5.4vw,4rem);line-height:1.08;letter-spacing:-0.02em;margin:24px 0 0;text-wrap:balance">${s.h1}</h1>
    <p style="margin:20px 0 0;font-size:15.5px;line-height:1.75;color:#A8A29E;max-width:62ch">${s.sub}</p>
    <div style="display:flex;gap:14px;margin-top:32px;flex-wrap:wrap">
      <a href="${BOOK_URL}" class="btn-solid green" data-evt="book-call">Book an intro call →</a>
        <a href="../index.html#contact" class="btn-ghost" data-evt="contact-form">or use the contact form</a>
      <a href="../index.html#briefs" class="btn-ghost">Read the engineering briefs</a>
    </div>
  </header>

  <section style="max-width:920px;margin:0 auto;padding:24px clamp(18px,4vw,40px)">
    <div class="sec-rule"><span class="sec-label" style="color:${s.color}">sound familiar?</span><span class="line"></span></div>
    <ul style="margin:24px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:10px">
        ${symptoms}
    </ul>
  </section>

  <section style="max-width:920px;margin:0 auto;padding:48px clamp(18px,4vw,40px) 24px">
    <div class="sec-rule"><span class="sec-label" style="color:${s.color}">what you get</span><span class="line"></span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:16px;margin-top:24px">
${deliverables}
    </div>
    <p style="margin:20px 0 0;${MONO}font-size:11.5px;color:#837D77">fixed scope · quoted after a week-1 risk map · your repo, your CI</p>
  </section>

  <section style="max-width:920px;margin:0 auto;padding:48px clamp(18px,4vw,40px) 24px" id="packages">
    <div class="sec-rule"><span class="sec-label" style="color:${s.color}">how we work together</span><span class="line"></span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:16px;margin-top:24px">
${(s.packages || []).map((p, i) => `      <div style="border:1px solid ${i === 0 ? s.color : '#2A2826'};background:#0C0C0E;padding:26px;display:flex;flex-direction:column;gap:12px">
        <div style="${MONO}font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:${s.color}">${esc(p.name)}</div>
        <div><span style="${SERIF}font-size:1.5rem;letter-spacing:-0.01em;color:#F4F2EF">${esc(p.timing)}</span> <span style="${MONO}font-size:11px;color:#837D77">· scoped &amp; quoted</span></div>
        <p style="margin:0;font-size:13.5px;line-height:1.65;color:#A8A29E;flex:1">${esc(p.d)}</p>
        <a href="${BOOK_URL}" class="${i === 0 ? 'btn-solid green' : 'btn-ghost'}" data-evt="pkg-book" style="align-self:flex-start">${i === 0 ? 'Start here — get a quote →' : 'Get a quote →'}</a>
      </div>`).join('\n')}
    </div>
    <p style="margin:18px 0 0;${MONO}font-size:11px;color:#837D77">no fixed price list — every engagement is scoped and quoted after a short conversation, so you pay for your problem, not a package · every engagement ends with evidence you keep — and if the scoping shows I can’t help, I’ll say so and it costs nothing</p>
  </section>

  <section style="max-width:920px;margin:0 auto;padding:48px clamp(18px,4vw,40px) 24px">
    <div class="sec-rule"><span class="sec-label" style="color:${s.color}">proof, not promises</span><span class="line"></span></div>
    <div style="margin-top:12px">
${proof}
    </div>
  </section>

  <section style="max-width:920px;margin:0 auto;padding:48px clamp(18px,4vw,40px) 64px">
    <div class="sec-rule"><span class="sec-label" style="color:${s.color}">questions</span><span class="line"></span></div>
    <div style="margin-top:16px">
${faq}
    </div>
    <div style="margin-top:44px;text-align:center;border:1px solid #2A2826;background:#0C0C0E;padding:clamp(28px,5vw,48px)">
      <h2 style="${SERIF}font-weight:400;font-size:clamp(1.7rem,3.4vw,2.4rem);letter-spacing:-0.015em;margin:0">30 minutes. Bring the feature that scares you.</h2>
      <p style="margin:14px auto 0;font-size:14px;color:#A8A29E;max-width:44ch">You leave with a concrete plan either way — the call is free and the plan is yours.</p>
      <div style="display:flex;gap:14px;justify-content:center;margin-top:24px;flex-wrap:wrap">
        <a href="${BOOK_URL}" class="btn-solid green" data-evt="book-call">Book the call →</a>
        <a href="#packages" class="btn-ghost" data-evt="see-packages">see the engagement paths ↑</a>
      </div>
    </div>
  </section>

  <footer style="border-top:1px solid #2A2826;padding:22px clamp(18px,4vw,40px);display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;${MONO}font-size:11px;color:#837D77">
    <span>© <span data-year>2026</span> Jason Teixeira · Sage Ideas LLC</span>
    <span><a href="../index.html" class="dim-link" style="color:#837D77">← portfolio</a></span>
  </footer>
<script>document.querySelectorAll('[data-year]').forEach(function(n){n.textContent=String(new Date().getFullYear())});</script>
</div>
</body>
</html>
`;
  writeFileSync(`services/${s.slug}.html`, html);
}

console.log(`✓ built ${SERVICES.length} service landing pages`);
