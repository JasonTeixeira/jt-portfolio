#!/usr/bin/env node
/**
 * eval-scope.mjs — golden-set eval harness for the Scope Studio "scope" chat
 * mode (POST /api/chat { mode:'scope', messages }). Scores the live model
 * against evals/scope-golden.json and gates whether the AI conversation is
 * trustworthy enough to ship.
 *
 * WHY THIS EXISTS: CI cannot call the live LLM deterministically (non-zero
 * temperature, provider drift, no committed API key). So this is NOT a CI
 * gate — tests/unit/scope-eval.test.mjs is the CI gate, and it only proves
 * the golden data is well-formed and every expectKeys entry is a real
 * assets/scope-core.mjs RATE_CARD key, plus that the scoring math
 * (precisionRecallF1) is correct. Actually scoring the live model is an
 * OPERATOR gate: Jason runs this script by hand (or against the deployed
 * site) before flipping the AI scope path live. See docs/SCOPE-EVAL.md.
 *
 * USAGE
 *   node scripts/eval-scope.mjs
 *   node scripts/eval-scope.mjs --url https://agency.sageideas.dev/api/chat
 *   node scripts/eval-scope.mjs --threshold 0.75 --golden evals/scope-golden.json
 *
 * FLAGS
 *   --url        target /api/chat endpoint (default http://localhost:3000/api/chat)
 *   --golden     path to the golden JSON file (default evals/scope-golden.json)
 *   --threshold  minimum mean F1 to pass (default 0.8)
 *
 * EXIT CODES
 *   0  scorecard printed, mean F1 >= threshold
 *   1  scorecard printed, mean F1 < threshold — OR the endpoint was unreachable
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_URL = 'http://localhost:3000/api/chat';
const DEFAULT_GOLDEN = join(__dirname, '../evals/scope-golden.json');
const DEFAULT_THRESHOLD = 0.8;
const REQUEST_TIMEOUT_MS = 20_000;

/* ---------- pure scoring (exported for unit testing) ---------- */

/**
 * Set-based precision/recall/F1 between an expected key list and a returned
 * key list. Duplicates are ignored (compared as sets). Both empty is a
 * perfect (trivial) match; expected-empty-but-got-something is all false
 * positives; expected-something-but-got-nothing is all false negatives.
 *
 * @param {string[]} expected
 * @param {string[]} got
 * @returns {{precision:number, recall:number, f1:number, tp:number, fp:number, fn:number}}
 */
export function precisionRecallF1(expected, got) {
  const expSet = new Set(Array.isArray(expected) ? expected : []);
  const gotSet = new Set(Array.isArray(got) ? got : []);
  const tp = [...gotSet].filter((k) => expSet.has(k)).length;
  const fp = gotSet.size - tp;
  const fn = expSet.size - tp;
  const precision = gotSet.size === 0 ? (expSet.size === 0 ? 1 : 1) : tp / gotSet.size;
  const recall = expSet.size === 0 ? 1 : tp / expSet.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, tp, fp, fn };
}

/* ---------- args ---------- */

function parseArgs(argv) {
  const a = { url: DEFAULT_URL, golden: DEFAULT_GOLDEN, threshold: DEFAULT_THRESHOLD };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--url') a.url = next();
    else if (k === '--golden') a.golden = resolve(next());
    else if (k === '--threshold') a.threshold = Number(next());
  }
  return a;
}

/* ---------- transport ---------- */

/**
 * POST one golden case's messages to the target /api/chat endpoint.
 * @returns {Promise<{ok:true, data:any} | {ok:false, unreachable:true, error:string} | {ok:false, unreachable:false, status?:number, error:string}>}
 */
async function callScopeEndpoint(url, messages) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'scope', messages }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) {
      return { ok: false, unreachable: false, status: r.status, error: text.slice(0, 300) };
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, unreachable: false, status: r.status, error: `non-JSON response: ${text.slice(0, 200)}` };
    }
    return { ok: true, data };
  } catch (e) {
    // fetch throws on network failure (connection refused, DNS, abort/timeout)
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, unreachable: true, error: msg };
  } finally {
    clearTimeout(t);
  }
}

/* ---------- scoring ---------- */

function scoreCase(golden, response) {
  const selection = Array.isArray(response?.selection) ? response.selection : [];
  const gotKeys = selection.map((s) => s && s.key).filter((k) => typeof k === 'string');
  const { precision, recall, f1, tp, fp, fn } = precisionRecallF1(golden.expectKeys, gotKeys);
  const gotFit = response?.qualification?.fit ?? null;
  const fitMatch = gotFit === golden.expectFit;
  return { id: golden.id, precision, recall, f1, tp, fp, fn, gotKeys, gotFit, fitMatch };
}

/* ---------- CLI runner ---------- */

async function run(argv) {
  const args = parseArgs(argv);
  const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m', c: '\x1b[36m' };

  let golden;
  try {
    golden = JSON.parse(readFileSync(args.golden, 'utf8'));
  } catch (e) {
    console.error(`${C.r}✗ could not read golden set at ${args.golden}${C.x}`);
    console.error(`  ${e instanceof Error ? e.message : e}`);
    return 1;
  }
  const cases = Array.isArray(golden.cases) ? golden.cases : [];
  if (!cases.length) {
    console.error(`${C.r}✗ golden set has no cases${C.x}`);
    return 1;
  }

  console.log(`\n${C.b}Scope Studio golden-set eval${C.x}`);
  console.log(`${C.d}${cases.length} cases · target: ${args.url} · threshold: mean F1 >= ${args.threshold}${C.x}\n`);

  const results = [];
  for (const golden_case of cases) {
    process.stdout.write(`  ${golden_case.id.padEnd(32)} `);
    const response = await callScopeEndpoint(args.url, golden_case.messages);

    if (!response.ok && response.unreachable) {
      console.log(`${C.r}UNREACHABLE${C.x}`);
      console.error(
        `\n${C.r}✗ endpoint unreachable: ${args.url}${C.x}\n  ${response.error}\n\n` +
          `  Start the app first (e.g. "vercel dev" or your local server) and pass --url to point at it,\n` +
          `  or point --url at a deployed target, e.g.:\n` +
          `    node scripts/eval-scope.mjs --url https://agency.sageideas.dev/api/chat\n`
      );
      return 1;
    }
    if (!response.ok) {
      console.log(`${C.r}ERROR (${response.status ?? 'n/a'})${C.x}`);
      results.push({
        id: golden_case.id,
        precision: 0, recall: 0, f1: 0, tp: 0, fp: 0, fn: golden_case.expectKeys.length,
        gotKeys: [], gotFit: null, fitMatch: false, error: response.error,
      });
      continue;
    }

    const scored = scoreCase(golden_case, response.data);
    results.push(scored);
    const f1pct = (scored.f1 * 100).toFixed(0);
    const fitMark = scored.fitMatch ? `${C.g}fit ✓${C.x}` : `${C.y}fit ✗ (${scored.gotFit ?? 'null'})${C.x}`;
    console.log(`F1 ${f1pct.padStart(3)}%  ${fitMark}`);
  }

  const n = results.length;
  const meanF1 = results.reduce((s, r) => s + r.f1, 0) / n;
  const meanPrecision = results.reduce((s, r) => s + r.precision, 0) / n;
  const meanRecall = results.reduce((s, r) => s + r.recall, 0) / n;
  const fitMatches = results.filter((r) => r.fitMatch).length;
  const fitAccuracy = fitMatches / n;
  const pass = meanF1 >= args.threshold;

  console.log(`\n  ${C.b}Selection scoring${C.x}`);
  console.log(`  mean precision: ${(meanPrecision * 100).toFixed(1)}%`);
  console.log(`  mean recall:    ${(meanRecall * 100).toFixed(1)}%`);
  console.log(`  mean F1:        ${(meanF1 * 100).toFixed(1)}%  ${C.d}(threshold ${(args.threshold * 100).toFixed(0)}%)${C.x}`);
  console.log(`\n  ${C.b}Qualification scoring${C.x}`);
  console.log(`  fit accuracy:   ${fitMatches}/${n} (${(fitAccuracy * 100).toFixed(1)}%)`);

  const worst = [...results].sort((a, b) => a.f1 - b.f1).slice(0, 3);
  if (worst.some((r) => r.f1 < 1)) {
    console.log(`\n  ${C.b}Lowest-scoring cases${C.x}`);
    for (const r of worst) {
      if (r.f1 >= 1) continue;
      console.log(`  ${C.d}${r.id}: expected keys not fully matched (got: ${r.gotKeys.join(', ') || '(none)'})${C.x}`);
    }
  }

  console.log(
    `\n  ${pass ? `${C.g}${C.b}PASS${C.x}` : `${C.r}${C.b}FAIL${C.x}`} — mean F1 ${(meanF1 * 100).toFixed(1)}% ${
      pass ? '>=' : '<'
    } ${(args.threshold * 100).toFixed(0)}% threshold\n`
  );

  return pass ? 0 : 1;
}

// Only run the CLI (network calls, process.exit) when this file is executed
// directly — importing it (e.g. from tests) must stay side-effect-free.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  run(process.argv.slice(2)).then((code) => process.exit(code));
}
