# Jason's inputs — the last-mile that converts hardest

The site is built. These are the things only *you* can supply. Each one is a
real conversion lever, with the exact place to put it. Do them in this order —
top ones move the needle most.

---

## 1. Testimonials  ← highest leverage, do first

Two or three real quotes outconvert almost anything on the page. You already
have people who'd vouch: HighStrike, past managers, colleagues.

**Where:** `case-studies.html`, bottom `<script>` block — the `TESTIMONIALS`
array. Uncomment a line, fill it in, and the "In their words" section appears
automatically (it's hidden while empty). Format:
```js
{ quote: "Jason cut our flake rate from 10% to under 1% and our releases stopped breaking.",
  name: "Full Name", role: "QA Lead, HighStrike", href: "https://linkedin.com/in/…" }
```

**Request script (send to 5 people today):**
> Hey [name] — I'm putting together my consulting site and would love a short
> line about working together. Two sentences is perfect: what the problem was
> and what changed. If it's easy, a LinkedIn recommendation is even better and I
> can link it. No rush, and I'll send you a draft if you'd rather just edit one.

**LinkedIn recommendations** are the strongest version (public, verifiable).
Ask the same people for one — link it via the `href`.

---

## 2. Cal.com booking embed  ← removes friction on the money page

Right now `book.html` uses a contact form. A live calendar with open slots
converts far better.

**Where:** `book.html` — the `<!-- CAL.COM SLOT -->` comment (near the top of the
BOOK section). Create a free Cal.com event type ("15-minute intro"), then drop
its embed or a button link there as the primary CTA above the form. Keep the
form as the fallback.

---

## 3. Google Analytics (GA4)  ← so you can see what's working

The GA snippet is already wired and inert until you add your Measurement ID.

**Where:** it's already in the pages, guarded by a placeholder. Set your real
`G-XXXXXXX` id (search the repo for `__GA_ID__`) and analytics goes live on the
`sageideas.dev` domain only. Free. Then set conversion events for `book-call`,
`atlas-lead-minieval`, and `lead-submit` (already fired as `va()`/gtag events).

---

## 4. Loom / video walkthrough  ← proof you can't fake

A 60–90s screen recording of you running the live eval or walking a case study
makes the whole site feel human and real.

**Where:** record one Loom of `eval.html` running or the nexural-qa-os red→green
arc. Paste the share link into a case study on `case-studies.html` (add an
`<a class="plink" href="[loom]">▸ watch the walkthrough</a>` in that case's
`.proofrow`). Optionally add one to the homepage hero later.

---

## 5. Resend domain verification  ← so leads auto-get their report

Contact + lead-magnet emails work to *your* inbox now. Verifying a sending
domain lets the site auto-email visitors their report + nurture.

**Where:** verify a domain in the Resend dashboard, then set `RESEND_FROM` to
`you@yourdomain` (Vercel env). Code already auto-enables the visitor email once
`RESEND_FROM` is not the `resend.dev` sender. See `api/lead.js`.

---

## 6. GitHub polish  ← recruiters + clients check this

- Pin the 6 repos that back the case studies (llm-eval-gate,
  playwright-sdet-regression-suite, nexural-qa-os if public, etc.).
- Make sure each pinned repo's README leads with the outcome + a run you can
  reproduce (the case studies already cite these — keep them consistent).

---

## The one non-code move that actually drives traffic

None of the above creates demand — distribution does. The verified path:
**publish + run the wedge.**

1. **Publish week-01 content** — `docs/sales-kit/content/week-01-*.md` is
   paste-ready. One post/week on LinkedIn builds the owned channel that the
   research says is what actually works.
2. **Run the outreach engine** — `node scripts/build-outreach.mjs` (see
   `outreach/README.md`). Lead with a free mini-eval on a real prospect's live
   feature. The finding is the hook.

The site converts traffic. These two create it.
