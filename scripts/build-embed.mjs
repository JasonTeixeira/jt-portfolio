#!/usr/bin/env node
/**
 * build-embed.mjs — standalone embeddable versions of the code-native diagrams, so other
 * sites can iframe them (with an attribution backlink). These are the most link-worthy
 * assets on the site.
 *   embed/<slug>.html   a minimal, self-contained page showing one diagram + attribution
 *   embeds.html         an index with a copy-paste iframe snippet per diagram
 *
 * Run: node scripts/build-embed.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { DIAGRAM_METRIC_CHEATSHEET, DIAGRAM_RAG_EVAL, DIAGRAM_EVAL_GATE } from './docs.data.mjs';
import { SITE_URL, AUTHOR } from './site.config.mjs';

const esc = (s) => String(s ?? '').replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EMBEDS = [
  { slug: 'eval-metric-cheatsheet', title: 'The LLM Eval Metric Cheat Sheet', h: 470, svg: DIAGRAM_METRIC_CHEATSHEET, source: 'docs-llm-evaluation-metrics.html', sourceTitle: 'LLM Evaluation Metrics Explained' },
  { slug: 'rag-eval-map', title: 'Where a RAG Pipeline Is Measured', h: 330, svg: DIAGRAM_RAG_EVAL, source: 'docs-rag-evaluation-metrics.html', sourceTitle: 'RAG Evaluation Metrics Explained' },
  { slug: 'eval-gate', title: 'The CI Eval Gate', h: 320, svg: DIAGRAM_EVAL_GATE, source: 'docs-eval-gates-ci.html', sourceTitle: 'Eval Gates: The Missing CI Step' },
];

// Minimal CSS for the code-native figure, inlined so the embed is fully self-contained.
const DIAGRAM_CSS = `
  :root { --ink:#F4F2EF; --dim:#A8A29E; --faint:#8E8882; --line:#211F1C; }
  * { box-sizing:border-box; }
  body { margin:0; background:#09090B; color:var(--ink); font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif; padding:14px; }
  .d-diagram { margin:0; border:1px solid var(--line); border-radius:10px; overflow:hidden; background:#0B0B0D; }
  .d-diagram-cap { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 14px; border-bottom:1px solid var(--line); font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:var(--faint); background:#0E0E11; }
  .d-diagram-body { padding:20px clamp(10px,3vw,24px); overflow-x:auto; }
  .d-diagram-body svg { display:block; }
  .d-diagram-note { padding:11px 16px 14px; border-top:1px solid var(--line); font-family:'JetBrains Mono',monospace; font-size:11px; line-height:1.6; color:var(--faint); }
  .d-diagram-note b { color:var(--dim); font-weight:600; }
  .credit { margin-top:10px; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--faint); text-align:right; }
  .credit a { color:#10b981; text-decoration:none; }`;

function embedPage(e) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(e.title)} — ${esc(AUTHOR)}</title>
<meta name="robots" content="noindex">
<style>${DIAGRAM_CSS}</style>
</head><body>
${e.svg}
<div class="credit">via <a href="${SITE_URL}/${e.source}" target="_blank" rel="noopener">${esc(AUTHOR)} — ${esc(e.sourceTitle)}</a></div>
</body></html>`;
}

function snippet(e) {
  const src = `${SITE_URL}/embed/${e.slug}.html`;
  const src2 = `${SITE_URL}/${e.source}`;
  return `&lt;iframe src="${src}" width="100%" height="${e.h}" style="border:0;max-width:1040px" loading="lazy" title="${esc(e.title)}"&gt;&lt;/iframe&gt;
&lt;p&gt;Diagram by &lt;a href="${src2}"&gt;${esc(AUTHOR)}&lt;/a&gt;&lt;/p&gt;`;
}

function indexPage() {
  const cards = EMBEDS.map((e) => `
    <section style="border:1px solid #211F1C;border-radius:14px;overflow:hidden;margin-top:22px;background:#0C0C0E">
      <div style="padding:16px 20px;border-bottom:1px solid #211F1C"><h2 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:1.5rem;margin:0">${esc(e.title)}</h2></div>
      <div style="padding:18px 20px">
        <iframe src="${SITE_URL}/embed/${e.slug}.html" width="100%" height="${e.h}" style="border:1px solid #211F1C;border-radius:10px;max-width:1040px" loading="lazy" title="${esc(e.title)} preview"></iframe>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8E8882;margin:18px 0 8px">Copy this embed code (keeps the attribution link)</div>
        <pre style="background:#0B0B0D;border:1px solid #211F1C;border-radius:10px;padding:14px 16px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6;color:#CFEBDC;white-space:pre-wrap">${snippet(e)}</pre>
      </div>
    </section>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Embeddable diagrams — ${esc(AUTHOR)}</title>
<meta name="description" content="Free, embeddable code-native diagrams on LLM evaluation, RAG, and CI eval gates. Drop them into your docs or posts with attribution.">
<link rel="canonical" href="${SITE_URL}/embeds.html">
<meta property="og:title" content="Embeddable AI evaluation diagrams">
<meta property="og:description" content="Free, embeddable diagrams on LLM evaluation, RAG, and eval gates — with attribution.">
<meta property="og:image" content="${SITE_URL}/api/og?eyebrow=Free%20to%20embed&amp;title=AI%20evaluation%20diagrams">
<meta name="robots" content="index, follow">
<style>
  * { box-sizing:border-box; } body { margin:0; background:#09090B; color:#F4F2EF; font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif; }
  .wrap { max-width:920px; margin:0 auto; padding:clamp(30px,5vw,64px) clamp(18px,4vw,32px) 90px; }
  a { color:#22d3ee; } h1 { font-family:'Instrument Serif',Georgia,serif; font-weight:400; font-size:clamp(2.2rem,5vw,3.2rem); line-height:1.05; margin:14px 0 0; }
  .kick { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#10b981; }
  .lead { color:#A8A29E; font-size:16px; line-height:1.7; margin:18px 0 0; max-width:60ch; }
</style>
</head><body>
<div class="wrap">
  <div class="kick">Free to embed</div>
  <h1>Embeddable diagrams</h1>
  <p class="lead">Code-native diagrams on LLM evaluation, RAG, and CI eval gates. Drop one into your docs, blog, or slides — the embed keeps a small attribution link back, and that's the only ask. Prefer the source? Each links to the full write-up on <a href="${SITE_URL}/learn.html">Learn</a>.</p>
  ${cards}
</div>
</body></html>`;
}

mkdirSync('embed', { recursive: true });
for (const e of EMBEDS) writeFileSync(`embed/${e.slug}.html`, embedPage(e));
writeFileSync('embeds.html', indexPage());
console.log(`✓ built embeds.html + ${EMBEDS.length} embeddable diagram pages`);
