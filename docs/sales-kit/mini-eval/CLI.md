# The automated eval CLI — your real outbound wedge

`scripts/eval-target.mjs` runs the full probe battery against a **real** AI
feature and produces a branded report you review before sending. It's the
private counterpart to the public `/eval` demo: your machine, your key, your
intent — no public endpoint, no SSRF surface.

## One-time setup
The judge (the model that scores) runs on your DeepSeek key. Pull the env vars
locally once (the key is marked sensitive on Vercel, so if `pull` leaves it
blank, set it by hand):

```bash
npx vercel env pull .env.local          # gets LLM_BASE_URL + LLM_MODEL
# if LLM_API_KEY comes back empty (sensitive var), add it yourself:
echo 'LLM_API_KEY="sk-your-deepseek-key"' >> .env.local
set -a; . ./.env.local; set +a          # load into the shell
```

`.env.local` and `out/` are gitignored — the key and reports never get committed.

## Run it

**OpenAI-compatible target** (many AI features expose this):
```bash
node scripts/eval-target.mjs \
  --name "Acme Support Bot" \
  --url  "https://api.acme.com/v1/chat/completions" \
  --preset openai --target-model gpt-4o-mini \
  --header "Authorization: Bearer sk-THEIRS" \
  --out out/acme.html
```

**Any custom JSON API** — describe how to call it and where the answer is:
```bash
node scripts/eval-target.mjs \
  --name "Widget Assistant" \
  --url  "https://api.widget.com/ask" \
  --body '{"question":"{{prompt}}","lang":"en"}' \
  --response-path data.answer \
  --out out/widget.html
```

`{{prompt}}` is replaced (JSON-escaped) with each probe. `--response-path` is a
dot path into the JSON reply (`choices.0.message.content`, `reply`,
`data.answer`, …). Add `--only injection,pii,scope` to run a subset.

## What you get
- a live console scorecard as it runs,
- `out/<target>.html` — a branded report (verbatim probe + response per finding,
  pass/fail, a "what I'd do next" close with the $750 audit CTA),
- `out/<target>.json` — the raw record.

Review it, export to PDF, send as **outreach touch 1**. The report *is* the
pitch.

## The probe battery (`scripts/eval-probes.mjs`)
12 probes: prompt injection · jailbreak · system-prompt leak · faithfulness ·
hallucination · PII · data exfiltration · scope · over-refusal · toxicity ·
persistent instruction hijack · consistency. Add or edit them in one place;
the CLI picks them up.

## Rules (same "no fake green" ethos)
- Only test features you're authorized to test — the public/intended interface,
  your own, or a prospect's under the wedge framing. Respect rate limits.
- The report captures **real transcripts**. Never edit a response. Reproduce
  anything surprising before you send it.
- A failing probe proves a failure mode *exists*, not its rate. The report says
  so — keep that honesty; it's the whole brand.
