#!/usr/bin/env node
/**
 * build-captures.mjs — renders proof/captures/*.txt (verbatim outputs of real
 * command runs) into on-brand viewer pages at captures/<slug>.html.
 * The text is untouched evidence; only the frame is presentation. noindex —
 * these are proof artifacts, not content pages.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const MONO = "font-family:'JetBrains Mono',monospace;";

const CAPTURES = [
  {
    slug: 'nexural-qa-os',
    file: 'proof/captures/nexural-qa-os_2026-08-15.txt',
    title: 'nexural-qa-os — proof-loop.mjs (morning run: RED)',
    cmd: 'node scripts/proof-loop.mjs',
    date: '2026-08-15 · 11:39',
    note: 'Verbatim output. The harness found 15 high/critical CVEs in its own production deps and refused the PROVEN verdict — it blocks me too. The fix and the green rerun from the same afternoon: /captures/nexural-qa-os-fixed.html'
  },
  {
    slug: 'nexural-qa-os-fixed',
    file: 'proof/captures/nexural-qa-os-fixed_2026-08-15.txt',
    title: 'nexural-qa-os — proof-loop.mjs (afternoon rerun: GREEN)',
    cmd: 'node scripts/proof-loop.mjs',
    date: '2026-08-15 · 14:35',
    note: 'Same command, same day, after 9 dependency security floors (15 high/critical → 0; the unpatchable extract-zip advisory eliminated by moving @puppeteer/browsers to 3.x). Caught → blocked → patched → proven, inside one working day. The morning red run stays published: /captures/nexural-qa-os.html'
  },
  {
    slug: 'playwright-suite',
    file: 'proof/captures/playwright-suite_2026-07-10.txt',
    title: 'playwright-sdet-regression-suite — full run',
    cmd: 'npx playwright test',
    date: '2026-07-10',
    note: 'Verbatim output from the evidence/ folder committed in the public repo — 37 specs, 8 workers, 15.3 seconds, zero flakes.'
  }
];

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** minimal severity coloring on the escaped verbatim text */
function colorize(line) {
  const e = esc(line);
  if (/✗|NOT PROVEN|OUTSTANDING|failed [1-9]/.test(line)) return `<span style="color:#f43f5e">${e}</span>`;
  if (/⚠|advisory|Warning/.test(line)) return `<span style="color:#F59E0B">${e}</span>`;
  if (/✓|passed|VERDICT: PROVEN/.test(line)) return `<span style="color:#10b981">${e}</span>`;
  if (/^\$|^&gt; /.test(e)) return `<span style="color:#22d3ee">${e}</span>`;
  return `<span style="color:#C9C4BF">${e}</span>`;
}

mkdirSync('captures', { recursive: true });
for (const c of CAPTURES) {
  const raw = readFileSync(c.file, 'utf8');
  const body = raw.split('\n').map(colorize).join('\n');
  writeFileSync(`captures/${c.slug}.html`, `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Real run — ${esc(c.title)}</title>
<meta name="robots" content="noindex">
<link rel="preload" href="../assets/fonts/jetbrains-mono-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../assets/site.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%2309090B'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-family='monospace' font-size='26' font-weight='700' fill='%2310b981'%3EJT%3C/text%3E%3C/svg%3E">
</head>
<body>
<div style="min-height:100vh;background:#09090B;padding:40px clamp(14px,3vw,40px)">
  <div style="max-width:980px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:18px">
      <span style="${MONO}font-size:12px;color:#8E8882">real run · captured ${c.date} · <span style="color:#22d3ee">${esc(c.cmd)}</span></span>
      <a href="../index.html#work" class="dim-link" style="${MONO}font-size:12px">← back to portfolio</a>
    </div>
    <div style="background:#08090c;border:1px solid #2A2826;border-radius:12px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #2A2826;background:#0C0C0E">
        <span style="width:10px;height:10px;border-radius:50%;background:#f43f5e;opacity:0.7"></span>
        <span style="width:10px;height:10px;border-radius:50%;background:#F59E0B;opacity:0.7"></span>
        <span style="width:10px;height:10px;border-radius:50%;background:#10b981;opacity:0.7"></span>
        <span style="${MONO}font-size:11px;color:#8E8882;margin-left:8px">${esc(c.title)}</span>
      </div>
      <pre style="margin:0;padding:18px 20px;${MONO}font-size:12px;line-height:1.8;overflow-x:auto">${body}</pre>
    </div>
    <p style="${MONO}font-size:11.5px;line-height:1.7;color:#8E8882;max-width:76ch;margin:16px 0 0">${esc(c.note)}</p>
  </div>
</div>
</body>
</html>
`);
}
console.log(`✓ built ${CAPTURES.length} capture pages`);
