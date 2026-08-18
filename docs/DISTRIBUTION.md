# Distribution runbook — your one-click launch

The site is built. This is the part that creates demand. Two engines run in
parallel: **publish** (owned channel) and **outreach** (the mini-eval wedge).
Everything below is already written — this is the sequence, not new work.

> The rule from the research: the site converts traffic, it doesn't create it.
> Publishing consistently + leading outreach with a free mini-eval is what works.
> Cold volume without either is the low-yield trap.

---

## This week — do exactly this (about 20 min/day)

### Monday
1. **Publish** `docs/sales-kit/content/week-01-mon.md` (the red→green gate story)
   to **LinkedIn**. Paste the body above the `## Why this works` line. Keep the
   final question as the last line — it drives comments.
2. **Outreach:** run `node scripts/build-outreach.mjs` (fill `outreach/prospects.json`
   first — see `outreach/README.md`). Send **touch 1** to 5 prospects: lead with
   the free mini-eval, link them to `/sample.html`.
3. Log both in the cockpit: open `ops.html` → Content queue + Pipeline.

### Wednesday
1. **Publish** `week-01-wed.md` to LinkedIn.
2. **Outreach:** send **touch 2** to Monday's non-repliers (one concrete finding
   or the sample-report link). Add 5 new prospects, touch 1.

### Friday
1. **Publish** `week-01-fri.md` to LinkedIn.
2. **Outreach:** touch 3 to the oldest thread. Run 1–2 actual mini-evals on
   prospects who shared a URL (`node scripts/eval-target.mjs` → send the report).
3. **Retro (30 min):** open `ops.html`, fill the scoreboard + one retro line:
   "what advanced or killed deals this week."

Repeat with `week-02-*`, `week-03-*` … (content is written through week 5;
backlog of 45 hooks in `docs/sales-kit/content/BACKLOG.md`).

---

## The two engines

### 1. Publish (owned channel)
- **What:** one post Mon/Wed/Fri. Files are paste-ready in `docs/sales-kit/content/`.
- **Where:** LinkedIn primary. Optionally cross-post to a dev.to / blog canonical
  (see `docs/syndication/` and `docs/LINKEDIN_KIT.md` if present).
- **Why it works:** each post is a proof story or a teaching post, not a pitch.
  The niche line ("I test and prove AI features for teams shipping LLM products")
  appears early without selling.
- **Rule:** consistency beats brilliance. Three posts every week > one perfect one.

### 2. Outreach (the mini-eval wedge)
- **What:** `node scripts/build-outreach.mjs` → a personalized noindex page +
  a paste-ready 3-touch opener per prospect. Full playbook: `outreach/README.md`
  and `docs/sales-kit/outreach-sequences.md`.
- **The opener is the free eval, never a pitch.** The finding is the hook.
- **Rule:** minimum 5 touches before a prospect is dead — most replies come after #3.
- **Track:** `ops.html` Pipeline + Mini-eval queue (localStorage, private).

---

## Where everything lives
| Need | File |
|------|------|
| Posts (5 weeks written) | `docs/sales-kit/content/week-*.md` |
| More hooks (45) | `docs/sales-kit/content/BACKLOG.md` |
| Outreach generator | `scripts/build-outreach.mjs` + `outreach/README.md` |
| Outreach sequences (scripts) | `docs/sales-kit/outreach-sequences.md` |
| Objection answers | `docs/sales-kit/objection-answer-sheet.md` |
| The mini-eval you deliver | `docs/sales-kit/mini-eval/` + `scripts/eval-target.mjs` |
| Positioning / GTM | `docs/sales-kit/FOUNDATION.md`, `GTM-PLAYBOOK.md` |
| Nurture sequence | `docs/sales-kit/content/NURTURE.md` |
| Weekly cockpit | `ops.html` |
| Your one-time inputs | `docs/JASON-INPUTS.md` |

---

## What I can't do (yours to run)
Posting to your LinkedIn and sending to real prospects happen from your accounts —
I've made both one-click, but you press send. The site, the content, the openers,
the mini-eval engine, and the tracking are all ready to go.
