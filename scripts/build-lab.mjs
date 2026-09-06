#!/usr/bin/env node
/**
 * build-lab.mjs — generates lab.html (the public "builds wall") from
 * scripts/lab.data.mjs, reusing the live site chrome (head/nav/footer/scripts)
 * from case-studies.html so nav + footer + CSS stay identical to the rest of
 * the site. Run after add-lab-nav.mjs so the donor nav already has the Lab link.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { BUILDS, LAB_TIERS, TIER_ORDER } from './lab.data.mjs';
import { SITE_URL, AUTHOR } from './site.config.mjs';

const DONOR = 'case-studies.html';
const OUT = 'lab.html';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function must(hay, needle, what) {
  if (!hay.includes(needle)) throw new Error(`build-lab: donor ${DONOR} missing ${what} — chrome changed, update the generator.`);
}

const donor = readFileSync(DONOR, 'utf8');

// ── slice chrome ───────────────────────────────────────────────────────────
const navEnd = donor.indexOf('</nav>');
const footStart = donor.indexOf('  <footer');
if (navEnd === -1 || footStart === -1) throw new Error('build-lab: could not locate nav/footer boundaries in donor.');
let top = donor.slice(0, navEnd + '</nav>'.length);
const bottom = donor.slice(footStart);

// ── patch head meta for this page ──────────────────────────────────────────
const TITLE = 'The Lab — Systems I&#8217;ve Built &amp; Shipped · Jason Teixeira';
must(top, '<title>Case Studies', 'title');
top = top.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
top = top.replace(
  /<meta name="description" content="[^"]*">/,
  `<meta name="description" content="${esc('A working portfolio of what I build: live platforms, apps in build, prototypes, and anonymized client work — each labeled with its true status.')}">`,
);
top = top.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE_URL}/lab.html">`);
top = top.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="The Lab — Systems I&#8217;ve Built &amp; Shipped">`);
top = top.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc('Live platforms, apps in build, prototypes, and anonymized client work — each labeled with its true status.')}">`);
top = top.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${SITE_URL}/lab.html">`);

// drop the EN/ES/PT language switcher — no translated lab.html exists yet, so it
// would produce dead links. (Re-add here once /es/lab.html and /pt/lab.html ship.)
top = top.replace(/<div data-i18n="1"[\s\S]*?<\/div>\n/, '');

// move the nav "current page" marker from Work to Lab
top = top.replace(' class="site-nav-link" aria-current="page">Work</a>', ' class="site-nav-link">Work</a>');
top = top.replace('<a href="lab.html" class="site-nav-link">Lab</a>', '<a href="lab.html" class="site-nav-link" aria-current="page">Lab</a>');

// ── JSON-LD: an ItemList of the builds (SEO) ───────────────────────────────
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'The Lab — systems built by Jason Teixeira',
  url: `${SITE_URL}/lab.html`,
  author: { '@type': 'Person', name: AUTHOR, url: SITE_URL },
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: BUILDS.map((b, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'CreativeWork', name: b.name, ...(b.link && /^https?:/.test(b.link) ? { url: b.link } : {}), abstract: b.blurb },
    })),
  },
};

// ── build the page body ────────────────────────────────────────────────────
const counts = TIER_ORDER.reduce((a, t) => (a[t] = BUILDS.filter((b) => b.tier === t).length, a), {});

function stackChips(stack) {
  return (stack || []).map((s) => `<span class="lab-tag">${esc(s)}</span>`).join('');
}
function linkEl(link) {
  if (!link) return '';
  const ext = /^https?:/.test(link);
  const attrs = ext ? ' target="_blank" rel="noopener"' : '';
  const label = ext ? 'Visit' : 'Open';
  return `<a class="lab-link" href="${esc(link)}"${attrs}>${label} <span aria-hidden="true">&#8599;</span></a>`;
}
function card(b) {
  const tier = LAB_TIERS[b.tier] || LAB_TIERS.live;
  const metric = b.metric ? `<span class="lab-metric">${esc(b.metric)}</span>` : '';
  return `        <article class="lab-card" style="--accent:${tier.color}">
          <div class="lab-card-head">
            <span class="lab-chip"><span class="lab-dot"></span>${esc(tier.label)}</span>
            <span class="lab-cat">${esc(b.category)}</span>
          </div>
          <h3 class="lab-name">${esc(b.name)}</h3>
          <p class="lab-blurb">${esc(b.blurb)}</p>
          <div class="lab-stack">${stackChips(b.stack)}</div>
          <div class="lab-foot">${metric}${linkEl(b.link)}</div>
        </article>`;
}
function tierSection(tierKey) {
  const tier = LAB_TIERS[tierKey];
  const items = BUILDS.filter((b) => b.tier === tierKey);
  if (!items.length) return '';
  return `      <section class="lab-tier" aria-labelledby="tier-${tierKey}">
        <div class="sec-rule"><h2 class="sec-label" id="tier-${tierKey}" style="color:${tier.color};margin:0">${esc(tier.label)} <span class="lab-count">${items.length}</span></h2><span class="line"></span></div>
        <p class="lab-tier-note">${esc(tier.note)}</p>
        <div class="lab-grid">
${items.map(card).join('\n')}
        </div>
      </section>`;
}

const legend = TIER_ORDER.map((t) => {
  const tier = LAB_TIERS[t];
  return `<span class="lab-legend-item"><span class="lab-dot" style="background:${tier.color}"></span>${esc(tier.label)} <b>${counts[t]}</b></span>`;
}).join('');

const STYLE = `  <style>
    .lab-legend{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:22px}
    .lab-legend-item{font-family:var(--mono);font-size:12px;color:var(--faint);display:inline-flex;align-items:center;gap:7px}
    .lab-legend-item b{color:var(--ink)}
    .lab-dot{width:8px;height:8px;border-radius:50%;background:var(--accent,var(--green));display:inline-block;flex:none}
    .lab-tier{margin-top:clamp(40px,6vw,72px)}
    .lab-tier-note{font-family:var(--mono);font-size:12px;color:var(--faint);margin:10px 0 22px}
    .lab-count{font-size:11px;color:var(--faint);font-weight:400}
    .lab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:18px}
    .lab-card{position:relative;border:1px solid var(--line);border-left:3px solid var(--accent);background:var(--card);border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:12px;transition:transform .2s var(--ease,ease),border-color .2s ease,box-shadow .2s ease}
    .lab-card:hover{transform:translateY(-3px);border-color:color-mix(in oklab, var(--accent) 55%, var(--line));box-shadow:0 12px 40px -24px var(--accent)}
    .lab-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .lab-chip{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);display:inline-flex;align-items:center;gap:6px}
    .lab-chip .lab-dot{background:var(--accent)}
    .lab-cat{font-family:var(--mono);font-size:11px;color:var(--faint)}
    .lab-name{font-family:var(--serif,'Instrument Serif',Georgia,serif);font-size:clamp(1.5rem,1.1rem+1.4vw,2rem);line-height:1.05;margin:2px 0 0;color:var(--ink)}
    .lab-blurb{font-size:14px;line-height:1.72;color:var(--soft,#A8A29E);margin:0}
    .lab-stack{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
    .lab-tag{font-family:var(--mono);font-size:10.5px;color:var(--faint);border:1px solid var(--line);border-radius:999px;padding:3px 9px}
    .lab-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:auto;padding-top:6px}
    .lab-metric{font-family:var(--mono);font-size:11.5px;color:var(--ink)}
    .lab-link{font-family:var(--mono);font-size:12px;color:var(--accent);text-decoration:none;border:1px solid color-mix(in oklab, var(--accent) 40%, transparent);border-radius:8px;padding:6px 12px;transition:background .18s ease}
    .lab-link:hover{background:color-mix(in oklab, var(--accent) 14%, transparent)}
    @media (prefers-reduced-motion:reduce){.lab-card{transition:none}.lab-card:hover{transform:none}}
  </style>`;

const header = `
  <header class="wrap" style="padding-top:clamp(56px,8vw,96px);padding-bottom:clamp(8px,2vw,20px)">
    <div class="kick">The Lab &middot; what I actually build</div>
    <h1 style="margin-top:20px;max-width:20ch">I don&#8217;t just test software. <em style="color:var(--green)">I build and ship it.</em></h1>
    <p class="subtle" style="margin-top:20px;max-width:64ch">Every system below is real, and every one is labeled with its true status &mdash; live in production, in active build, a working prototype, or anonymized client work. No mockups dressed up as launches. This is the range you get when you hire the person who also runs the QA.</p>
    <div class="lab-legend" aria-label="Status legend">${legend}</div>
  </header>

  <main class="wrap" style="padding-bottom:clamp(48px,8vw,96px)">
${STYLE}
${TIER_ORDER.map(tierSection).filter(Boolean).join('\n\n')}

    <section class="lab-tier" aria-label="Work together">
      <div class="sec-rule"><h2 class="sec-label" style="color:var(--cyan);margin:0">Work with me</h2><span class="line"></span></div>
      <div class="lab-card" style="--accent:var(--green);border-left-width:3px;max-width:none">
        <h3 class="lab-name" style="max-width:24ch">Want a system like these, built for your business?</h3>
        <p class="lab-blurb" style="max-width:60ch">I take on a small number of AI build and QA engagements. If you have something real to ship, let&#8217;s scope it.</p>
        <div class="lab-foot" style="margin-top:6px">
          <a class="btn-solid green" href="build.html" style="padding:11px 20px">Scope a project &rarr;</a>
          <a class="btn-ghost" href="case-studies.html" style="padding:11px 20px">See measured outcomes</a>
        </div>
      </div>
    </section>
  </main>

  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
`;

writeFileSync(OUT, `${top}\n${header}\n${bottom}`);
console.log(`build-lab: wrote ${OUT} — ${BUILDS.length} builds (${TIER_ORDER.map((t) => `${t}:${counts[t]}`).join(' ')})`);
