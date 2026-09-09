# Atlas Greeter — Voiceover Script & Drop-in Guide

The landing greeter ("Atlas") runs an animated, skippable guided tour on the homepage.
It works **text-first today**. To add the natural voice, generate the six short lines
below and drop them in — the tour auto-detects them and a Sound toggle appears. Nothing
else changes.

## How the voice slots in

- Files go in: `assets/greeter/<locale>/s1.mp3 … s6.mp3`
  - English: `assets/greeter/en/s1.mp3` … `s6.mp3`
  - Spanish: `assets/greeter/es/s1.mp3` … `s6.mp3` (optional)
  - Portuguese: `assets/greeter/pt/s1.mp3` … `s6.mp3` (optional)
- One clip per tour step. `s1` plays on the first step, `s2` on the second, etc.
- The tour **types the same text on screen** as it speaks — so keep the recorded
  wording identical to the lines below (or update `T.<loc>.steps[]` in
  `assets/welcome.js` to match your read).
- No clips present = silent, text-only tour (no broken UI, no console errors).
- Voice only starts after the visitor clicks **"Take the 60-second tour"** — a real
  user gesture, so it never trips browser autoplay blocking.

## Voice choice

- It's a **branded AI guide named Atlas** — clearly Jason's assistant, not a fake human
  (keeps the "no fake / never impersonate a human" brand principle intact).
- Pick any natural ElevenLabs voice you like — warm and conversational, female or male.
  Whatever you choose, keep it consistent across all six clips.
- **ElevenLabs settings suggestion:** Stability ~45, Similarity ~75, Style ~0–10,
  Speaker Boost on, Multilingual v2 (or latest). Export MP3, mono is fine, 128kbps+.
- Tone: a friendly concierge giving a quick, confident tour — not a hype ad read.

## The script (English)

Each line is one file. Keep them tight — they play while the page scrolls to each section.

**s1.mp3** (hero)
> Here's the whole idea: Jason builds your AI feature — then proves it actually works.

**s2.mp3** (the 30-second version)
> The short version lives right here: what he does, why him, and how to start.

**s3.mp3** (proof / self-QA)
> This is the part most shops skip — the site runs its own quality checks, in public. No fake green, not even his.

**s4.mp3** (services)
> The work comes in three shapes: LLM and RAG evaluation, test automation, and workflow automation.

**s5.mp3** (about)
> Behind it: thirteen years in software quality, and two live AI products he builds and runs on his own.

**s6.mp3** (contact / CTA)
> The best first step is a one-week audit — you leave with a plan either way. Want to grab a time?

## Spanish (es/) and Portuguese (pt/) — optional

The translated lines already live in `assets/welcome.js` under `T.es.steps` and
`T.pt.steps`. If you want voice on those locales too, generate the matching clips into
`assets/greeter/es/` and `assets/greeter/pt/`. Otherwise those tours run text-only.

## After you drop the files in

1. Put the mp3s in `assets/greeter/en/` (and es/pt if doing them).
2. Commit + deploy (they're static assets — no code change needed).
3. Load the homepage with `?welcome=1` to force the greeter, click "Take the 60-second
   tour," and confirm the Sound toggle appears and the voice tracks each step.
