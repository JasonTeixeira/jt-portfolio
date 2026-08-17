#!/usr/bin/env node
/**
 * eval-target.mjs — run the automated LLM-eval battery against a REAL AI feature
 * and produce a branded report you review before sending. This is the private,
 * server-side counterpart to the public /eval demo: your machine, your key,
 * your intent — no public endpoint, no SSRF surface.
 *
 * TARGET (the feature under test): any HTTP endpoint that takes a prompt and
 * returns a reply. You describe how to call it and where the answer is.
 * JUDGE: DeepSeek (or any OpenAI-compatible model) via env — reads
 * LLM_API_KEY / LLM_BASE_URL / LLM_MODEL (same names as the site). Pull them
 * locally once with:  npx vercel env pull .env.local   then:  source .env.local
 *
 * USAGE
 *   node scripts/eval-target.mjs \
 *     --name "Acme Support Bot" \
 *     --url  "https://api.acme.com/v1/chat/completions" \
 *     --preset openai --target-model gpt-4o-mini \
 *     --header "Authorization: Bearer sk-THEIRS" \
 *     --out out/acme.html
 *
 *   # custom (non-OpenAI) API:
 *   node scripts/eval-target.mjs --name "Widget" --url https://api.x.com/ask \
 *     --body '{"question":"{{prompt}}"}' --response-path data.answer --out out/widget.html
 *
 * FLAGS
 *   --name           label for the report (default: the URL host)
 *   --url            target endpoint (required)
 *   --method         default POST
 *   --header "K: V"  repeatable; auth headers for the target
 *   --preset openai  sets --body + --response-path for OpenAI-compatible APIs
 *   --target-model   model name for --preset openai
 *   --target-system  optional system prompt to send the target (openai preset)
 *   --body '<json>'  request body template; {{prompt}} is replaced (JSON-escaped)
 *   --response-path  dot path to the reply text in the JSON response
 *   --out <file>     write the HTML report here (default out/eval-<host>-<date>.html)
 *   --only a,b,c     run only these probe ids
 *
 * HONESTY / SAFETY (this tool captures REAL transcripts — never fabricate):
 *   - Only test features you are authorized to test (public/intended interface,
 *     your own, or a prospect's with the wedge framing). Respect rate limits.
 *   - A failing probe proves a failure mode EXISTS, not its rate. The report
 *     says so. Reproduce anything surprising before you send it.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PROBES, JUDGE_SYSTEM, runProbe } from './eval-probes.mjs';

/* ---------- args ---------- */
function parseArgs(argv) {
  const a = { headers: {}, only: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--name') a.name = next();
    else if (k === '--url') a.url = next();
    else if (k === '--method') a.method = next();
    else if (k === '--header') { const h = next(); const ix = h.indexOf(':'); a.headers[h.slice(0, ix).trim()] = h.slice(ix + 1).trim(); }
    else if (k === '--preset') a.preset = next();
    else if (k === '--target-model') a.targetModel = next();
    else if (k === '--target-system') a.targetSystem = next();
    else if (k === '--body') a.body = next();
    else if (k === '--response-path') a.responsePath = next();
    else if (k === '--out') a.out = next();
    else if (k === '--only') a.only = next().split(',').map((s) => s.trim());
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));

if (!args.url) {
  console.error('✗ --url is required. See the header of this file for usage.');
  process.exit(1);
}

/* judge creds */
const JKEY = process.env.LLM_API_KEY;
const JBASE = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';
const JMODEL = process.env.LLM_MODEL || 'deepseek-chat';
if (!JKEY) {
  console.error('✗ LLM_API_KEY not set. Pull it once:  npx vercel env pull .env.local  &&  source .env.local');
  process.exit(1);
}

/* preset: openai-compatible */
if (args.preset === 'openai') {
  if (!args.targetModel) { console.error('✗ --preset openai needs --target-model'); process.exit(1); }
  const msgs = args.targetSystem
    ? `[{"role":"system","content":${JSON.stringify(args.targetSystem)}},{"role":"user","content":"{{prompt}}"}]`
    : `[{"role":"user","content":"{{prompt}}"}]`;
  args.body = args.body || `{"model":${JSON.stringify(args.targetModel)},"messages":${msgs}}`;
  args.responsePath = args.responsePath || 'choices.0.message.content';
}
if (!args.body || !args.responsePath) {
  console.error('✗ need --body + --response-path (or --preset openai --target-model). See usage.');
  process.exit(1);
}

const NAME = args.name || new URL(args.url).host;
const METHOD = args.method || 'POST';

/* ---------- transport ---------- */
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? Number(k) : k]), obj);
}
async function callTarget(prompt) {
  const body = args.body.replace('{{prompt}}', JSON.stringify(prompt).slice(1, -1));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const r = await fetch(args.url, {
      method: METHOD,
      headers: { 'Content-Type': 'application/json', ...args.headers },
      body,
      signal: ctrl.signal,
    });
    const txt = await r.text();
    if (!r.ok) return `[target error ${r.status}] ${txt.slice(0, 200)}`;
    let data; try { data = JSON.parse(txt); } catch { return txt.slice(0, 500); }
    const out = getPath(data, args.responsePath);
    return typeof out === 'string' ? out : JSON.stringify(out ?? data).slice(0, 500);
  } catch (e) {
    return `[target unreachable] ${e instanceof Error ? e.message : e}`;
  } finally {
    clearTimeout(t);
  }
}
async function callJudge(judgeUser) {
  const r = await fetch(`${JBASE.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JKEY}` },
    body: JSON.stringify({
      model: JMODEL,
      messages: [{ role: 'system', content: JUDGE_SYSTEM }, { role: 'user', content: judgeUser }],
      max_tokens: 120, temperature: 0, response_format: { type: 'json_object' },
    }),
  });
  const d = await r.json();
  return d?.choices?.[0]?.message?.content?.trim() || '{}';
}

/* ---------- run ---------- */
const battery = args.only ? PROBES.filter((p) => args.only.includes(p.id)) : PROBES;
const C = { g: '\x1b[32m', r: '\x1b[31m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m', c: '\x1b[36m' };

console.log(`\n${C.b}Independent eval — ${NAME}${C.x}`);
console.log(`${C.d}${battery.length} probes · judge: ${JMODEL} · ${new Date().toISOString().slice(0, 10)}${C.x}\n`);

const results = [];
for (const probe of battery) {
  process.stdout.write(`  ${probe.dimension.padEnd(34)} `);
  const res = await runProbe({ probe, callTarget, callJudge });
  results.push(res);
  const mark = res.verdict === 'PASS' ? `${C.g}PASS${C.x}` : `${C.r}FAIL${C.x}`;
  console.log(`${mark}  ${C.d}${res.reason}${C.x}`);
}

const passed = results.filter((r) => r.verdict === 'PASS').length;
const failed = results.length - passed;
console.log(`\n  ${C.b}${passed}/${results.length} passed${C.x}${failed ? `  ${C.r}· ${failed} failure mode${failed > 1 ? 's' : ''} to gate${C.x}` : ''}\n`);

/* ---------- report ---------- */
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const rows = results.map((r) => `
    <div class="probe">
      <div class="head"><span class="dim">${esc(r.dimension)}</span><span class="v ${r.verdict === 'PASS' ? 'pass' : 'fail'}">${r.verdict}</span></div>
      <div class="reason">↳ ${esc(r.reason)}</div>
      <details><summary>probe + verbatim response</summary><div class="pr"><b>Probe:</b> ${esc(r.prompt)}</div><div class="resp">${esc(r.response)}</div></details>
    </div>`).join('');

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Independent AI Evaluation — ${esc(NAME)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#F4F2EF;--dim:#A8A29E;--line:#2A2826;--card:#0C0C0E;--bg:#09090B;--green:#10b981;--red:#f43f5e;--amber:#F59E0B;--mono:'JetBrains Mono',monospace;--serif:'Instrument Serif',Georgia,serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Plus Jakarta Sans',system-ui,sans-serif;line-height:1.6}
.wrap{max-width:760px;margin:0 auto;padding:56px 28px 80px}
.kick{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#8E8882}
h1{font-family:var(--serif);font-weight:400;font-size:2.4rem;letter-spacing:-.02em;margin:14px 0 0}
.meta{font-family:var(--mono);font-size:11px;color:#8E8882;margin-top:10px}
.score{display:flex;align-items:baseline;gap:12px;margin:28px 0 8px}
.score b{font-family:var(--serif);font-size:3rem;letter-spacing:-.02em}
.bar{height:8px;border-radius:4px;background:#1a1815;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--red),var(--amber),var(--green));width:${Math.round((passed / results.length) * 100)}%}
.note{font-size:13.5px;color:var(--dim);border:1px solid var(--line);border-radius:12px;background:var(--card);padding:18px;margin:24px 0}
.probe{border-top:1px solid var(--line);padding:16px 0}
.head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.dim{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#c9c4bd}
.v{font-family:var(--mono);font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px}
.v.pass{color:var(--green);border:1px solid rgba(16,185,129,.4);background:rgba(16,185,129,.08)}
.v.fail{color:var(--red);border:1px solid rgba(244,63,94,.4);background:rgba(244,63,94,.08)}
.reason{font-family:var(--mono);font-size:12px;color:var(--dim);margin-top:8px}
details{margin-top:10px}summary{font-family:var(--mono);font-size:11px;color:#22d3ee;cursor:pointer}
.pr{font-size:13px;color:var(--dim);margin-top:10px}.resp{font-family:var(--mono);font-size:11.5px;color:#9a948c;white-space:pre-wrap;background:#0b0a08;border-left:2px solid var(--line);padding:10px 12px;margin-top:8px;border-radius:0 6px 6px 0}
.cta{border:1px solid rgba(16,185,129,.35);background:rgba(16,185,129,.05);border-radius:12px;padding:20px;margin-top:28px;font-size:14px;color:var(--dim)}
.foot{font-family:var(--mono);font-size:10.5px;color:#8E8882;margin-top:40px;border-top:1px solid var(--line);padding-top:16px}
a{color:#22d3ee;text-decoration:none}
</style></head><body><div class="wrap">
<div class="kick">Independent AI evaluation · Sage Ideas</div>
<h1>${esc(NAME)}</h1>
<div class="meta">${battery.length} probes · run live against the feature · ${esc(date)} · judged by an evaluation model</div>
<div class="score"><b style="color:${failed ? 'var(--amber)' : 'var(--green)'}">${passed}/${results.length}</b><span class="meta">probes passed${failed ? ` · ${failed} failure mode${failed > 1 ? 's' : ''} found` : ''}</span></div>
<div class="bar"><i></i></div>
<div class="note">Each result below is a real, reproducible probe run against the live feature — verbatim prompt and verbatim response. A failing probe proves a failure mode <b>exists</b>; it is not a statistical rate. This is a fast ${battery.length}-probe pass; a full engagement runs hundreds and wires the gate into your CI.</div>
${rows}
<div class="cta"><b style="color:var(--ink)">What I'd do next.</b> Map the full failure surface, reproduce each finding, and build the eval gate that blocks these regressions before they ship — scored, in your CI, owned by your team. The audit is $750 (one week, credited toward any build); pilots from $2,500; full harness from $9,500.<br><br><a href="https://agency.sageideas.dev/book.html">Book a 15-minute call →</a></div>
<div class="foot">© ${new Date().getFullYear()} Jason Teixeira · Sage Ideas LLC · agency.sageideas.dev · proof, not vibes</div>
</div></body></html>`;

const outPath = args.out || `out/eval-${new URL(args.url).host.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.html`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
writeFileSync(outPath.replace(/\.html$/, '.json'), JSON.stringify({ name: NAME, url: args.url, date, passed, total: results.length, results }, null, 2));
console.log(`  ${C.c}report:${C.x} ${outPath}`);
console.log(`  ${C.d}review it, export to PDF, and send as outreach touch 1.${C.x}\n`);
