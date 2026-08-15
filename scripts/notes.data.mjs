/**
 * Field-note content — single source of truth for the notes index,
 * individual post pages, the RSS feed, and the homepage notes list.
 * To publish a new note: add an entry here, run `npm run build:notes`,
 * then `npm run prerender` (homepage list) and `npm run proof`.
 */
export const NOTES = [
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
    artifacts: 'nexural-qa-os: 85 runners, 13/13 proof gates · sage-agents: @sage/eval golden-trace runner',
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
