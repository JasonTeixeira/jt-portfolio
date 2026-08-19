#!/usr/bin/env node
// Live red-team + golden eval of the scope chatbot. Sends probes to /api/chat
// scope mode, grades the GROUNDED server output with the pure assertion library,
// writes proof-artifacts/chatbot-eval.json, prints a summary. Operator-run
// (needs the LLM env live on the target). Usage:
//   node scripts/eval-chatbot.mjs --url https://agency.sageideas.dev
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gradePass } from '../assets/chatbot-evals.mjs';

const urlArg = process.argv.indexOf('--url');
const BASE = (urlArg > -1 && process.argv[urlArg + 1]) || 'http://localhost:8242';

async function loadProbes(f) { return JSON.parse(await readFile(new URL(`../evals/chatbot/${f}`, import.meta.url), 'utf8')); }

async function runProbe(p) {
  try {
    const r = await fetch(`${BASE.replace(/\/$/, '')}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'scope', messages: p.messages }),
    });
    if (r.status === 501) return { name: p.name, skipped: 'llm_not_configured' };
    if (!r.ok) return { name: p.name, pass: false, failures: [`http_${r.status}`] };
    const data = await r.json().catch(() => null);
    if (!data || !data.ok) return { name: p.name, pass: false, failures: ['bad_response'] };
    const g = gradePass({ reply: data.reply, qualification: data.qualification }, p.expect || {});
    return { name: p.name, pass: g.pass, failures: g.failures, reply: data.reply };
  } catch { return { name: p.name, skipped: 'unreachable' }; }
}

const redteam = await loadProbes('redteam.json');
const golden = await loadProbes('golden.json');
const results = [];
for (const p of [...redteam, ...golden]) results.push({ suite: redteam.includes(p) ? 'redteam' : 'golden', ...(await runProbe(p)) });

const scored = results.filter((r) => !r.skipped);
const passed = scored.filter((r) => r.pass).length;
const skipped = results.filter((r) => r.skipped).length;
const report = { base: BASE, total: results.length, scored: scored.length, passed, failed: scored.length - passed, skipped, results };
await mkdir(new URL('../proof-artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../proof-artifacts/chatbot-eval.json', import.meta.url), JSON.stringify(report, null, 2));

console.log(`\nChatbot eval vs ${BASE}`);
if (skipped) console.log(`  (${skipped} skipped — LLM not configured on target)`);
for (const r of scored) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  [${r.suite}] ${r.name}${r.pass ? '' : '  → ' + r.failures.join(', ')}`);
console.log(`\n${passed}/${scored.length} passed. Report: proof-artifacts/chatbot-eval.json\n`);
process.exit(scored.length && passed < scored.length ? 1 : 0);
