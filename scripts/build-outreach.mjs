#!/usr/bin/env node
/**
 * build-outreach.mjs — the outbound weapon. Turns a list of prospects into
 * personalized artifacts you actually send:
 *   1. a private, noindex landing page per prospect (outreach/<slug>.html) —
 *      "here's exactly what I'd test on YOUR feature" + a free-mini-eval CTA
 *   2. a paste-ready 3-touch opener (email / LinkedIn) printed to the console
 *
 * The wedge is proof-of-work, not a pitch: you lead by offering to run a real
 * eval on their live AI feature. This script makes that personal at scale.
 *
 * Input:  outreach/prospects.json   (real data — gitignored, private)
 *         falls back to outreach/prospects.example.json if none.
 * Output: outreach/<slug>.html      (gitignored except the committed example)
 *
 * Run:    node scripts/build-outreach.mjs
 *
 * Privacy: generated pages contain a real company name, so they are private by
 * default (gitignored, not in the sitemap, robots: noindex). To actually send a
 * link, deploy that one page deliberately — or just send the printed opener and
 * link them to /sample.html. Never commit real prospect data.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { SITE_URL } from './site.config.mjs';

const DIR = 'outreach';
mkdirSync(DIR, { recursive: true });

const dataPath = existsSync(`${DIR}/prospects.json`)
  ? `${DIR}/prospects.json`
  : `${DIR}/prospects.example.json`;
const prospects = JSON.parse(readFileSync(dataPath, 'utf8'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function page(p) {
  const probes = (p.probes && p.probes.length ? p.probes : [
    'a prompt-injection attempt that tries to drop its instructions',
    'a factual question it has no grounded answer for (hallucination)',
    'an out-of-scope request to see if it leaves its lane',
  ]).map((x) => `<li>${esc(x)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>For ${esc(p.company)} — a free eval on ${esc(p.feature || 'your AI feature')} · Jason Teixeira</title>
<link rel="stylesheet" href="${SITE_URL}/assets/site.css">
<style>
 :root{--ink:#F4F2EF;--dim:#A8A29E;--faint:#8E8882;--line:#2A2826;--card:#0C0C0E;--bg:#09090B;--green:#10b981;--cyan:#22d3ee;--mono:'JetBrains Mono',monospace;--serif:'Instrument Serif',Georgia,serif}
 *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Plus Jakarta Sans',system-ui,sans-serif}
 .wrap{max-width:760px;margin:0 auto;padding:clamp(48px,8vw,88px) clamp(16px,4vw,40px)}
 .kick{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
 h1{font-family:var(--serif);font-weight:400;font-size:clamp(2rem,5vw,3.2rem);line-height:1.06;letter-spacing:-.02em;margin:16px 0 0}
 .sub{color:var(--dim);font-size:15.5px;line-height:1.7;margin-top:18px}
 .card{border:1px solid var(--line);background:var(--card);border-radius:16px;padding:24px;margin-top:28px}
 .card h2{font-family:var(--serif);font-weight:400;font-size:1.35rem;margin:0 0 12px}
 ul{margin:0;padding-left:20px}li{font-size:14px;line-height:1.7;color:var(--dim);margin-bottom:6px}
 .cta{display:inline-flex;align-items:center;gap:9px;background:var(--green);color:#052e22;border:none;border-radius:26px;padding:14px 26px;font-size:15px;font-weight:700;font-family:inherit;margin-top:8px}
 .mono{font-family:var(--mono)}.a{color:var(--cyan)}
 .foot{font-family:var(--mono);font-size:10.5px;color:var(--faint);margin-top:40px;border-top:1px solid var(--line);padding-top:16px}
</style></head><body>
<main class="wrap">
 <div class="kick">A note for ${esc(p.company)}${p.contact ? ` · ${esc(p.contact)}` : ''}</div>
 <h1>I'd like to run a free eval on ${esc(p.feature || 'your AI feature')}.</h1>
 <p class="sub">${esc(p.hook || `I test and prove AI features for teams shipping LLM products. I put together this page just for ${p.company} — no form-letter. If ${p.feature || 'your AI feature'} is live, I'll point my eval engine at it and send you the verbatim findings. No call required, no cost.`)}</p>
 <div class="card">
  <h2>What I'd probe first</h2>
  <ul>${probes}</ul>
  <p class="sub" style="margin-top:14px">You get back real transcripts — pass/fail, the exact failure modes, and what I'd gate before your next release. It's the same rigor in <a class="a" href="${SITE_URL}/sample.html">this sample report</a> and the <a class="a" href="${SITE_URL}/eval.html">live eval</a>.</p>
 </div>
 <div style="margin-top:28px;display:flex;gap:14px;flex-wrap:wrap;align-items:center">
  <a class="cta" href="${SITE_URL}/sample.html">Get the free eval &rarr;</a>
  <a class="mono a" href="${SITE_URL}/book.html" style="font-size:13px">or grab 15 minutes &rarr;</a>
 </div>
 <div class="foot">Jason Teixeira · Sage Ideas LLC · ${SITE_URL} · this page was made just for ${esc(p.company)}</div>
</main>
<script defer src="${SITE_URL}/assets/agent.js"></script>
</body></html>`;
}

function opener(p) {
  const feat = p.feature || 'your AI feature';
  return `── ${p.company}${p.contact ? ` (${p.contact})` : ''} ──
Touch 1 (email/DM):
  Subject: a free eval on ${feat}
  Hi${p.contact ? ' ' + p.contact.split(' ')[0] : ''} — I test and prove AI features for teams shipping LLM products.
  I'd like to run a free eval on ${feat}: real adversarial probes (injection,
  hallucination, scope), verbatim findings, no call needed. Made you a quick
  page: ${SITE_URL}/outreach/${slugify(p.company)}.html — or just reply with the URL.

Touch 2 (+3 days, if no reply): send ONE concrete finding or the sample report link.
Touch 3 (+4 days): "still happy to run this free — want the findings?"
(Minimum 5 touches before marking dead — most replies come after #3.)`;
}

let n = 0;
for (const p of prospects) {
  if (!p.company) continue;
  const slug = slugify(p.company);
  writeFileSync(`${DIR}/${slug}.html`, page(p));
  console.log('\n' + opener(p));
  n++;
}
console.log(`\n✓ generated ${n} outreach page(s) in ${DIR}/ (source: ${dataPath})`);
console.log('  → pages are private (noindex, gitignored). Send the opener above; link them to /sample.html,');
console.log('    or deploy a specific outreach/<slug>.html deliberately if you want the personalized link live.');
