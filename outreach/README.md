# Outreach engine

Turns a prospect list into the two things you actually send: a **personalized
page** and a **paste-ready 3-touch opener** — both built around the proof-of-work
wedge (offer to run a free eval on their live AI feature).

## Use it

1. Copy the example and fill in real prospects (this file stays private — it's gitignored):
   ```bash
   cp outreach/prospects.example.json outreach/prospects.json
   ```
   Each entry: `company` (required), `contact`, `feature`, `hook` (optional — a
   real, specific first line), `probes` (optional — what you'd test first).

2. Generate:
   ```bash
   node scripts/build-outreach.mjs
   ```
   - Prints a 3-touch opener per prospect → paste into email / LinkedIn.
   - Writes `outreach/<company>.html` — a private, noindex landing page.

3. Send touch 1. Link them to `/sample.html` (the sample report) or, if you want
   the personalized link live, deploy that one page deliberately.

## Rules

- **Minimum 5 touches** before marking a prospect dead — most replies come after #3.
- Lead with the free eval, not a pitch. The finding is the hook.
- `prospects.json` and generated `*.html` are **gitignored** — never commit real
  prospect data or company names.

## Where the rest of the kit lives

- Full sequences (local voice lane + remote evidence lane): `docs/sales-kit/outreach-sequences.md`
- Positioning + GTM: `docs/sales-kit/FOUNDATION.md`, `GTM-PLAYBOOK.md`
- Objection answers: `docs/sales-kit/objection-answer-sheet.md`
- The mini-eval you deliver: `docs/sales-kit/mini-eval/` + `scripts/eval-target.mjs`
- Track prospects/pipeline: `ops.html` (operator cockpit, localStorage)
