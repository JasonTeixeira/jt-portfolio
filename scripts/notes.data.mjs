/**
 * Field-note content — single source of truth for the notes index,
 * individual post pages, the RSS feed, and the homepage notes list.
 * To publish a new note: add an entry here, run `npm run build:notes`,
 * then `npm run prerender` (homepage list) and `npm run proof`.
 */
export const NOTES = [
  {
    slug: 'gate-blocked-me',
    num: '05',
    date: '2026-08-15',
    dateLabel: '2026·08',
    read: '4 min',
    color: '#f43f5e',
    title: 'The day my own quality gate blocked me',
    dek: 'At 11:39 my proof loop refused the PROVEN verdict — 15 high/critical CVEs had drifted into production deps. By 14:35 it was green. Both runs are published verbatim.',
    artifacts: 'red run: /captures/nexural-qa-os.html · green rerun: /captures/nexural-qa-os-fixed.html · fix: 9 pnpm security floors',
    quote: 'A gate that never fires isn’t discipline. It’s decoration.',
    dropCap: 'A',
    arch: {
      nodes: [
        { x: 38, y: 75, c: '#f43f5e', l: '11:39 run', s: '15 CVEs found' },
        { x: 155, y: 75, c: '#f43f5e', l: 'NOT PROVEN', s: 'release blocked' },
        { x: 272, y: 75, c: '#F59E0B', l: '+9 floors', s: 'pnpm overrides' },
        { x: 396, y: 75, c: '#10b981', l: '14:35 rerun', s: 'PROVEN 13/13' }
      ],
      edges: [[0, 1], [1, 2], [2, 3]],
      packets: [{ d: 'M38,75 H396', c: '#10b981', dur: 4.5, delay: 0.5 }]
    },
    archCaption: 'fig. 1 — the arc, one working day, both runs published',
    body: [
      't 11:39 this morning I ran the proof loop on my own QA platform — the 85-runner system this site leans on for credibility — and it told me no. <span style="font-family:\'JetBrains Mono\',monospace;font-size:0.9em;color:#f43f5e">VERDICT: NOT PROVEN ✗ — 12/13 gates</span>. Fifteen high and critical CVEs had drifted into production dependencies while I was busy shipping features. The gate did exactly what I built it to do: it blocked me.',
      '__DIAGRAM__',
      'The honest move mattered more than the fix. I could have quietly patched and nobody would ever have known the red run existed. Instead it’s <a href="../captures/nexural-qa-os.html">published verbatim</a> — because a portfolio that only shows green runs is indistinguishable from a portfolio that fakes them.',
      'The fix itself took one focused hour: nine dependency floors in <span style="font-family:\'JetBrains Mono\',monospace;font-size:0.9em">pnpm.overrides</span>. Eight were routine version bumps. The ninth was the interesting one — an <em>unpatchable</em> advisory in a transitive dependency (extract-zip, no fixed version exists) that died only because its parent package had replaced it entirely two majors ago. Audit went from 27 vulnerabilities to 2 low. The <a href="../captures/nexural-qa-os-fixed.html">14:35 rerun</a>: <span style="font-family:\'JetBrains Mono\',monospace;font-size:0.9em;color:#10b981">PROVEN ✓ — 13/13</span>.',
      '__QUOTE__',
      'This is the whole argument for gates over dashboards. A dashboard would have shown me a number drifting somewhere in a tab I stopped opening in March. The gate stopped the line. Drift got caught the day it mattered, fixed inside the same working day, and the evidence trail — red run, diff, green run — needs no narrative because you can read it yourself. If your LLM feature or release pipeline has no gate that can tell <em>you</em> no, that’s the gap I close.'
    ]
  },
  {
    slug: 'promptfoo-ci-minimum-gate',
    num: '04',
    date: '2026-08-15',
    dateLabel: '2026·08',
    read: '6 min',
    color: '#a78bfa',
    title: 'LLM regression testing with Promptfoo in CI: the minimum viable gate',
    dek: '30 golden traces, one judge, one failing exit code. The smallest setup that stops a bad prompt change from reaching production — runnable this afternoon.',
    artifacts: 'clone it: github.com/JasonTeixeira/llm-eval-gate (runs keyless) · pattern shipped in nexural-qa-os · full service: /services/llm-evaluation-qa.html',
    quote: 'Your first eval suite doesn’t need to be good. It needs to exist, run in CI, and be allowed to say no.',
    dropCap: 'E',
    arch: {
      nodes: [
        { x: 38, y: 75, c: '#A8A29E', l: 'PR opened', s: 'prompt change' },
        { x: 155, y: 75, c: '#a78bfa', l: 'promptfoo eval', s: '30 golden traces' },
        { x: 272, y: 75, c: '#F59E0B', l: 'judge score', s: 'vs ratcheted floor' },
        { x: 396, y: 75, c: '#10b981', l: 'merge gate', s: 'pass or block' }
      ],
      edges: [[0, 1], [1, 2], [2, 3]],
      packets: [{ d: 'M38,75 H396', c: '#a78bfa', dur: 4.5, delay: 0 }]
    },
    archCaption: 'fig. 1 — the minimum viable gate: four stops, no exceptions',
    body: [
      'very LLM team I talk to has the same confession: prompt changes ship because they "seemed better" in a couple of manual checks. Nobody can prove the last change didn’t make something else worse, because nothing is measuring. Here is the smallest setup that fixes that — not a platform, not a framework migration. One config file, one CI step, one afternoon.',
      '__DIAGRAM__',
      '<strong style="color:#F4F2EF">Step 1 — the golden set.</strong> Collect 30 real inputs from logs or support tickets — not invented ones; real phrasing is weirder than anything you’ll write. For each, record the output your domain expert agrees is good. Commit them next to the code. This file is now the definition of "working," and changing it requires a reviewed diff — which is the entire point.',
      '<strong style="color:#F4F2EF">Step 2 — the judge.</strong> A minimal <span style="font-family:\'JetBrains Mono\',monospace;font-size:0.9em">promptfooconfig.yaml</span> that runs every golden input through your prompt and scores the output with an LLM rubric:',
      '```yaml\nprompts:\n  - file://prompts/support-answer.txt\nproviders:\n  - anthropic:claude-sonnet-5\ntests: file://golden/*.yaml   # 30 cases: vars + assertions\ndefaultTest:\n  assert:\n    - type: llm-rubric\n      value: >-\n        Faithful to the provided context, answers the actual\n        question, no invented policies or prices.\n    - type: cost\n      threshold: 0.02\n```',
      '<strong style="color:#F4F2EF">Step 3 — the gate.</strong> Promptfoo exits non-zero when assertions fail, so CI needs exactly one honest step:',
      '```yaml\n# .github/workflows/eval.yml\n- run: npx promptfoo eval --config promptfooconfig.yaml\n  # non-zero exit = merge blocked. that\'s the whole gate.\n```\nWire it to trigger on changes to <span style="font-family:\'JetBrains Mono\',monospace;font-size:0.9em">prompts/**</span>, <span style="font-family:\'JetBrains Mono\',monospace;font-size:0.9em">golden/**</span>, and wherever your model or retrieval config lives. A red eval that can’t block a merge is a report, not a gate.',
      '__QUOTE__',
      '<strong style="color:#F4F2EF">What I add when teams outgrow the minimum</strong> — in rough order of payoff: a ratcheting floor (every improvement becomes the new minimum, so quality can’t silently regress); safety runners for injection, PII, and toxicity on the same golden set; retrieval-quality metrics in front of generation for RAG; and per-request cost budgets that fail the run like any other assertion. That fuller battery is what my <a href="../services/llm-evaluation-qa.html">LLM evaluation engagement</a> builds — but the 30-trace version above is free, takes an afternoon, and catches the regression you currently can’t see. Start there.'
    ]
  },
  {
    slug: 'no-fake-green',
    num: '01',
    date: '2026-08-04',
    dateLabel: '2026·08',
    read: '6 min',
    color: '#10b981',
    title: 'No fake green: what a proof ledger taught me about AI agents',
    dek: 'Agents will happily report success they never earned. The fix isn’t a better prompt — it’s an evidence gate the agent physically cannot talk its way past.',
    artifacts: 'sage-kernel: 140 MCP tools, 78 release gates, proof ledger at .sage-kernel/proof/ledger.jsonl',
    quote: 'If your agent can say "done" without evidence, it eventually will. Build the gate before you build the agent.',
    dropCap: 'T',
    body: [
      'he first time I let an AI agent drive a full engineering loop, it did something no junior engineer would dare: it reported the work done, tests passing, everything green — without having run anything. Not maliciously. Language models complete patterns, and "task finished" is how the pattern completes.',
      'That failure shaped the core rule of <a href="https://github.com/JasonTeixeira/sage-kernel">sage-kernel</a>: <strong style="color:#F4F2EF">nothing is done because a model said so.</strong> Every claim of success must be backed by a fresh, diff-matched artifact in a hash-chained ledger — the exact command, the exit code, the parsed metric. If the proof isn’t there, the kernel doesn’t argue with the agent; it just returns <span style="font-family:\'JetBrains Mono\',monospace;font-size:0.9em;color:#f43f5e">blocked_*</span> with a next step.',
      'The unexpected part: the gate made the agent <em>better</em>, not slower. When the only path to "done" runs through a real test suite, the agent stops narrating and starts iterating — run, fail, fix, re-run. The claim-firewall (a scan that rejects unproven success language in the final answer) catches the last few lies at the boundary.',
      '__QUOTE__',
      'Practically, that means three things for any agentic system: (1) verification is a separate, dumber process the model can’t influence — exit codes, not vibes; (2) evidence is append-only and tamper-evident, so "it passed yesterday" is checkable; (3) the loop stops honestly — a stall surfaced to a human beats a confident hallucination every time.'
    ]
  },
  {
    slug: 'llm-regression-suite',
    num: '02',
    date: '2026-07-18',
    dateLabel: '2026·07',
    read: '5 min',
    color: '#a78bfa',
    title: 'Your LLM feature needs a regression suite more than a better prompt',
    dek: 'Prompt tweaks feel like progress because nobody is measuring. Golden traces + LLM-as-judge in CI turn "it seems better" into a diff you can gate on.',
    artifacts: 'nexural-qa-os: 85 runners, gate-scored proof loop · sage-agents: @sage/eval golden-trace runner',
    quote: 'A prompt change without an eval run is a schema migration without a backup.',
    dropCap: 'E',
    body: [
      'very team I talk to is tuning prompts. Almost none of them can answer the only question that matters: <strong style="color:#F4F2EF">did this change make the feature better or worse?</strong> Without measurement, prompt engineering is redecorating in the dark.',
      'The fix is the same discipline we’ve had for code for twenty years, adapted for non-determinism. A <em>golden set</em>: 50–200 real inputs with agreed-good outputs, versioned next to the code. A <em>judge</em>: LLM-as-judge scoring faithfulness, relevance, and safety against that set — imperfect, but consistent enough to catch regressions. A <em>gate</em>: the suite runs in CI, and a score drop below the ratcheted floor blocks the merge.',
      'In <a href="../index.html#briefs">nexural-qa-os</a> this became ten dedicated runners — hallucination, jailbreak, prompt-injection, toxicity, PII-leak, refusal, bias, consistency, cost, latency — each producing a computed score from a real command, never a stated one. The scorecard is reproducible: run it twice, get identical output.',
      '__QUOTE__',
      'Start smaller than you think: even 30 golden traces and one faithfulness judge in CI beats zero. The floor ratchets up from there — every improvement becomes the new minimum, and quality stops silently regressing while everyone stares at the prompt.'
    ]
  },
  {
    slug: 'automation-that-never-talks',
    num: '03',
    date: '2026-06-22',
    dateLabel: '2026·06',
    read: '4 min',
    color: '#22d3ee',
    title: 'Automation that never talks to your customer',
    dek: 'The best-converting AI workflow I’ve shipped sends zero AI-written messages. Where to put the human approval point, and why it beats full autonomy.',
    artifacts: 'feedback-triage pipeline (Make + Gemini) · sage-agents TCPA gate in @sage/voice',
    quote: 'Full autonomy isn’t the goal. The right approval point is.',
    dropCap: 'T',
    body: [
      'he most reliable AI workflow I’ve shipped sends zero AI-written messages to customers. It classifies feedback, summarizes it, logs it, and — when sentiment turns negative — alerts a human within seconds. The human replies. That’s the whole design.',
      'This sounds unambitious until you count the failure modes it deletes. No hallucinated apology promising a refund policy that doesn’t exist. No tone-deaf reply to an angry customer. No audit problem, because every AI output lands in a spreadsheet a human reviews, not an inbox a customer reads.',
      'The design rule I now apply to every automation: <strong style="color:#F4F2EF">put the AI on the reading side, keep the human on the writing side</strong> — until the eval suite proves the writing side is safe. Reading-side AI (classify, extract, summarize, route) fails cheap: a mislabeled row. Writing-side AI fails expensive: a customer, a contract, a reputation.',
      '__QUOTE__',
      'When a client asks for a "fully automated" agent, the real question is where the approval gate belongs: before every send (early days), before novel situations only (once evals are green), or after-the-fact review (mature, measured systems). Moving down that ladder is earned with evidence — never assumed.'
    ]
  }
];
