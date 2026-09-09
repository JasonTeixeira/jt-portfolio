# Intro Video — Handoff for Voiceover Polish

**Goal:** replace the temporary robotic browser voice with a real ElevenLabs
narration in Jason's voice, so the homepage intro is "really well produced."

**Read this first — it is not an mp4.** The intro is a *code-native animated
sequence*: HTML + CSS + JavaScript that plays in the browser. There is no video
file to edit. You polish it by (a) generating one audio file and dropping it in,
and (b) optionally tuning scene timings/animation in the source. Everything is
already wired to sync to the audio the moment it exists.

---

## 1. Where the "video" lives

Live (silent-cut with temporary browser TTS voice):
- https://agency.sageideas.dev/intro.html

Source files (this repo — these three files ARE the video):
| File | Role |
|------|------|
| `intro.html` | Scene markup + poster + controls. Loads the css/js below. |
| `assets/intro-video.css` | All animation, layout, motion design. |
| `assets/intro-video.mjs` | The clock/controller. Drives scene activation + captions + audio sync. |

Run locally: serve the repo root over http (e.g. `npx serve .` on a non-3000
port) and open `/intro.html`. Opening the file directly (`file://`) will not
load the ES module.

---

## 2. The ONE thing that makes it premium: `assets/intro-vo.mp3`

The controller already supports a real voiceover. In `assets/intro-video.mjs`:

```js
const VO_SRC = ''; // e.g. 'assets/intro-vo.mp3' — leave '' for the captioned silent cut
```

**To finish the video:**
1. Generate the narration below as a single MP3 in Jason's ElevenLabs voice.
2. Save it as `assets/intro-vo.mp3`.
3. Set `const VO_SRC = 'assets/intro-vo.mp3';`
4. Bump the cache-buster in `intro.html` (`intro-video.mjs?v=...` → next letter).

That's it. When `VO_SRC` is set, the master clock becomes the `<audio>`
element's `currentTime`, and **every scene + caption already syncs to it**.
The browser-TTS fallback auto-disables whenever a real VO is present (guarded by
`useAudio` in `speak()`), so there is no double-voice.

---

## 3. The narration script (≈150 seconds, 6 scenes)

Record/generate as ONE continuous file. The timestamps are the CURRENT scene
boundaries — see §4 if the natural read runs longer/shorter (it probably will,
and that's fine — adjust the timings to the audio, not the other way around).

| # | Scene | In | Line |
|---|-------|-----|------|
| 1 | hook | 0:00 | "Hi — I'm Jason. Welcome to Sage Ideas." |
| 2 | problem | 0:08 | "AI is showing up in everything right now." |
| | | 0:18 | "The trouble is, a lot of it ships on a demo and a prayer — and a customer finds the one thing it gets wrong." |
| 3 | do | 0:30 | "So we build both halves: the AI feature you actually want…" |
| | | 0:44 | "…and the proof it works — evals, tests, and gates that turn 'trust me' into a number you can see." |
| 4 | who | 1:02 | "I've spent thirteen years in software quality, at The Home Depot and in fintech." |
| | | 1:18 | "Today I build and run two live products entirely on my own." |
| 5 | work | 1:32 | "Teams bring me three kinds of work: LLM and RAG evaluation, test automation and CI, and workflow automation." |
| | | 1:46 | "We start with a one-week audit — you leave with a plan either way." |
| 6 | cta | 2:00 | "If there's an AI feature you're not sure about, let's talk." |
| | | 2:14 | "Book a free call. I'm Jason — thanks for watching, and welcome to Sage Ideas." |

Total runtime target: ~2:30 (150s). Tone: warm, confident, unhurried —
a founder talking to one person, not a hype ad read.

**ElevenLabs settings suggestion** (tune to taste): Stability ~45–55,
Similarity ~75, Style ~0–15, Speaker Boost on. Model: Multilingual v2 or the
latest quality model. Export MP3, mono is fine, 128kbps+ .

---

## 4. Syncing scenes to the real audio (the polish step)

After you have `intro-vo.mp3`, listen to where each line actually lands and
update the two arrays in `assets/intro-video.mjs` so the visuals hit with the
voice. Both use seconds.

**Scene ranges** (which scene is on screen when):
```js
const SCENES = [
  { id: 'hook',    t0: 0,   t1: 8 },
  { id: 'problem', t0: 8,   t1: 30 },
  { id: 'do',      t0: 30,  t1: 62 },
  { id: 'who',     t0: 62,  t1: 92 },
  { id: 'work',    t0: 92,  t1: 120 },
  { id: 'cta',     t0: 120, t1: 150 },
];
const TOTAL = 150; // set to the real audio duration
```

**Caption cues** (the on-screen text, chunked): the `CUES` array right below —
each `{ t0, t1, text }` sets when a caption line shows. Match `t0` to when the
voice says that line.

**Sound-effect beats:** the `SOUND_CUES` array (whooshes/snaps/pops) fires at
fixed times synced to the visual transitions. If you move scene boundaries, nudge
these to match, or lower/remove them if the VO is carrying the piece. They're
already turned down to sit under narration.

Rule of thumb: **set `TOTAL` and the last scene's `t1` to the exact audio
length**, then walk the boundaries so each scene's animation lands with its line.

---

## 5. Turning it into an actual MP4 (only if you need a file)

If a downstream tool needs a real video file (for social, a thumbnail, etc.),
screen-record the playing `intro.html` at 1920×1080:
- Play it once fullscreen and capture with any recorder, **or**
- Headless render: point Playwright/puppeteer at `/intro.html`, start playback,
  and record the page for `TOTAL` seconds. (Ask the dev who set this up — the
  repo already uses Playwright.)

Keep the code-native version as the homepage embed; the MP4 is a byproduct.

---

## 6. Guardrails (don't regress these)

- **Every dynamic string uses `textContent`, never `innerHTML`.** Keep it that way.
- **Cache-buster discipline:** any change to `.mjs`/`.css` requires bumping the
  `?v=` query in `intro.html` or the edge CDN serves the stale file.
- **Reduced motion:** the CSS honors `prefers-reduced-motion`; don't remove it.
- **No autoplay with sound:** audio starts on the play click (a user gesture) —
  required by browser policy. Don't try to autoplay the VO on load.
- Free/open assets only unless Jason approves paid. ElevenLabs generation in
  Jason's own account is the approved path for THIS voiceover.

---

## 7. Quick checklist for whoever finishes this

- [ ] Generate `assets/intro-vo.mp3` from the §3 script (Jason's ElevenLabs voice)
- [ ] `const VO_SRC = 'assets/intro-vo.mp3';` in `assets/intro-video.mjs`
- [ ] Set `TOTAL` + last scene `t1` to the real audio duration
- [ ] Walk `SCENES` + `CUES` timings to match where lines land
- [ ] Nudge/soften `SOUND_CUES` to taste
- [ ] Bump `intro-video.mjs?v=` (and `.css?v=` if css changed) in `intro.html`
- [ ] Test in Chrome + Safari + mobile; confirm voice plays and stays in sync
- [ ] Deploy
