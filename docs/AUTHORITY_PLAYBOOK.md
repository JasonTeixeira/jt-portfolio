# Authority & Distribution Playbook — Jason Teixeira / Sage Ideas LLC

Owner: Jason Teixeira · Site: agency.sageideas.dev · GitHub: github.com/JasonTeixeira
Positioning: "proof, not vibes" — AI automation + QA/LLM-evaluation engineer
Status at time of writing: near-zero off-site authority. No backlinks, no directory
listings, no third-party reviews. GitHub/YouTube/LinkedIn exist but aren't doing
proof work. This doc is the fix, ordered by ROI, not by category.

This playbook covers **off-site** authority — directories, reviews, backlinks, press,
and channel leverage. It does not duplicate `docs/CONTENT_CADENCE.md` (on-site
publishing rhythm), `docs/DISTRIBUTION.md` (owned-asset syndication), or
`docs/LINKEDIN_KIT.md` (profile setup) — those are done and referenced, not repeated.

---

## Reality check before the steps

Two hard constraints shape the order below:

1. **Clutch and Google Business Profile reviews require a real paying client of Sage
   Ideas LLC.** Home Depot and HighStrike were W-2/contract employers, not clients —
   they don't count and using them would be exactly the kind of soft dishonesty
   "proof, not vibes" is built to reject. The review flywheel is gated on the first
   paid engagement from the outreach motion in `docs/OUTREACH-PLAYBOOK.md`. Set the
   infrastructure up now (Section 1) so it's ready the moment client #1 closes —
   don't wait to build it after.
2. **The single highest-ROI move on this whole list is not new work.** `llm-eval-gate`
   already exists, is MIT-licensed, has a real README, and is already linked from
   pages on the live site. It has 0 stars because it has never been launched
   anywhere. Fixing that is a few hours, not a new build — see Section 2.1 and the
   closing section.

---

## 1. Directories & reviews B2B buyers actually check

### 1.1 Google Business Profile (do this first — 20 min setup, ongoing)

Free, and it's the listing that shows up when anyone searches "Jason Teixeira" or
"AI QA consultant [city]." For a solo LLC with no storefront, set it up as a
**service-area business**, not a physical-location business.

1. Go to `business.google.com` → "Manage now."
2. Business name: **"Sage Ideas"** or **"Jason Teixeira — AI Automation &
   QA Engineering."** Do not put "LLC" in the name — Google's guidelines explicitly
   disallow legal suffixes/taglines in the business name field and it risks a
   suspension review.
3. Category: primary = "Software company" or "Computer consultant"; add secondary
   categories "Website designer" and "Internet marketing service" (Google doesn't
   have a native "LLM evaluation" category — pick the closest real ones, don't
   keyword-stuff).
4. Business type: choose **"I deliver goods and services to my customers"** (service-
   area business) — this hides your home address and lets you list service areas
   (up to 20) instead. If you work remote/national, list your metro + "serves
   customers nationwide" in the business description.
5. Add: phone (use a Google Voice number if you don't want your personal cell
   public), website (`https://agency.sageideas.dev`), hours (or "by appointment").
6. Business description (750 char max) — use a trimmed version of the LinkedIn
   About from `docs/LINKEDIN_KIT.md`: lead with "I ship AI features, then I prove
   they work," name the concrete services (LLM evaluation, CI quality gates, test
   automation), close with the ISTQB CT-AI credential.
7. Verification: Google will offer phone/email verification for many service-area
   businesses now, but be ready for a **postcard by mail** (5–14 days) if that's
   the only option offered. Don't skip this — an unverified profile doesn't show in
   local/service search at all.
8. Once verified, add the Services list (matches your three site service pages:
   LLM Evaluation & QA, Test Automation & CI, AI Workflow Automation) with the
   one-line descriptions already on `services/*.html`.
9. **Review request:** once you have a paying client, Google gives you a short
   review link from the profile dashboard ("Ask for reviews" → copy link). Send it
   in the project-close email, not before — asking with zero delivered work reads
   as fake.

Time: ~20 min setup + wait for verification. Ongoing: 5 min per completed client.

### 1.2 Clutch.co (highest-trust B2B directory for services — set up now, activate at client #1)

Clutch is the directory technical buyers actually check before hiring a services
provider — more so than G2 for anything that isn't a software product.

1. Go to `clutch.co/get-listed`.
2. Choose **Basic** (free) to start — Verified/Sponsoring tiers cost money and add
   analyst-conducted phone reviews, which is worth revisiting once you have 3+
   happy clients, not before.
3. Sign in with LinkedIn or Google (use the same identity as the LinkedIn profile
   in `docs/LINKEDIN_KIT.md` for consistency).
4. Fill the profile:
   - Company: Sage Ideas LLC
   - Website: `https://agency.sageideas.dev`
   - Location: your metro
   - Industries served: pick "Artificial Intelligence," "Information Technology,"
     and "Business Services" — Clutch's taxonomy is broad, don't force a fit that
     doesn't exist for "LLM evaluation."
   - Services offered: map 1:1 to the three service pages, using the same language
     as their `og:description` tags (already written, already tested copy — reuse
     it, don't rewrite).
   - Add the logo and 2–3 images — screenshot the homepage proof strip (the
     Playwright badge) and the case-studies grid. That IS your credibility, use it.
   - Portfolio/case study field: pull directly from `case-studies.html` — the
     CISSP-Exam-Prep and llm-eval-gate write-ups translate almost verbatim.
5. Submit for review (Clutch's team publishes within a few business days).
6. **On free tier, Clutch reviews come from an online form your client fills out**,
   not an analyst call. When client #1 closes, send them the direct review-submission
   link from your Clutch dashboard in the same email as the Google review ask —
   batch both asks into one message, don't send two separate emails.

Time: ~45 min setup. First review lands whenever client #1 completes an engagement,
not before — don't chase reviews you haven't earned yet.

**Free 10-minute duplicate:** Clutch's sister site **The Manifest**
(`themanifest.com/get-listed`) uses the same underlying network — filling out the
Clutch profile largely populates here too, and it's a second surface buyers check
alongside Clutch's own methodology. 10 minutes, do it same sitting.

### 1.3 G2 — deprioritize

G2 is built for productized software with a purchase/comparison journey ("which
tool do I buy"), not solo consulting services. It's the wrong shelf for "AI
QA consultant" right now. **Revisit only if `llm-eval-gate` grows into something
with a hosted/paid tier** — at that point G2's software category fits and the
open-source traction becomes the pitch for the listing. Until then, skip it; don't
spend setup time on a directory buyers in this category don't use for services.

---

## 2. Backlinks & domain authority

Ordered by ROI. The first one is the whole game.

### 2.1 Launch `llm-eval-gate` — the highest-ROI single action on this list

It already exists (MIT, real README, zero-API-key onboarding, already linked from
site pages). It has never been submitted anywhere. This is a launch problem, not a
build problem.

**Before launching (2–3 hrs, do first):**
1. Add a `CONTRIBUTING.md` and a one-paragraph "why this exists" section to the
   README that states the proof-not-vibes thesis in one sentence — reviewers on HN/
   PH read the README before the code.
2. Add 3–5 GitHub topics: `llm-evaluation`, `ci-cd`, `promptfoo`, `llm-testing`,
   `ai-quality`. Topics are how people find repos via GitHub search and are free.
3. Add an `og:image`/social preview image in repo Settings → Social preview (GitHub
   renders this on every share — a blank gray box kills click-through on HN/PH/
   Twitter).
4. Make sure the "0 API keys to start" mock-provider path actually runs clean in
   under 5 minutes on a fresh clone — this is the exact claim that gets tested
   first by a skeptical HN reader; if it breaks, the whole launch dies in the
   comments.

**Launch sequence (spread over ~10 days, ~1 hr/day active):**
1. **Show HN** (`news.ycombinator.com/submit`, or use `hn.algolia.com` to check
   nothing similar was posted same week first). Title format: `Show HN: llm-eval-gate
   – a CI gate that can say no to bad LLM prompt changes, zero API keys to start`.
   Post at 8–10am ET on a Tuesday–Thursday (highest HN traffic windows). Be
   present in the comments for the first 3 hours — that's what keeps a post alive
   past the new-post queue.
2. **Product Hunt** (`producthunt.com/posts/new`), 2–3 days after HN (don't
   same-day — split the traffic spikes). Tagline: "Your first green LLM eval gate
   in 10 minutes." Use the checklist (`checklist.html`) as a companion asset in the
   PH gallery — "built the checklist first, then the tool that enforces it."
3. **r/LocalLLaMA and r/MachineLearning** (self-promo Saturday threads only, or a
   "I built X" post if the sub allows — check each sub's self-promo rule before
   posting, this is the fastest way to get banned). Lead with the technical
   decision (mock-provider pattern for zero-API-key onboarding), not the marketing
   line.
4. **dev.to / Hashnode** — write a "how llm-eval-gate works" technical post,
   `canonical_url` pointing at a new note on `agency.sageideas.dev` (same pattern
   already documented in `docs/syndication/README.md` — extend that pipeline to
   Hashnode too, it's currently dev.to-only and Hashnode has meaningfully less
   competition for the same audience).
5. Every launch surface gets one thing in return: a backlink to
   `agency.sageideas.dev` in the repo README and in the HN/PH post body (not just
   the repo link — the site link, so authority flows to the money page, not just
   the repo).

Realistic outcome: 20–150 GitHub stars from a clean HN front-page run (most Show HN
posts get far less — plan for the low end), a dozen or so real backlinks from
aggregator sites that scrape HN/PH daily (these compound over months), and — the
actual point — instant proof-of-work on `case-studies.html` where the ★ badge is
already wired and currently empty.

### 2.2 Qwoted + Featured.com — earned press links (ongoing, ~20 min/week)

HARO itself was shut down and relaunched under Featured.com in 2025; Qwoted and
Featured.com are the two platforms journalists actually use now for expert sourcing.

1. **Qwoted** — `qwoted.com`, sign up as a source (free tier available), fill your
   expertise as "AI evaluation, LLM testing, QA automation." Qwoted has an
   approval step and a smaller, higher-quality query pool than Featured — expect
   fewer but better-fit requests.
2. **Featured.com** — `featured.com`, sign up as an expert, same expertise tags.
   Higher volume, more noise, filter aggressively for "AI," "LLM," "testing,"
   "QA" queries only — answering off-topic queries wastes time and doesn't build
   topical authority.
3. Weekly routine: scan both inboxes once (Monday, ~15 min), answer only queries
   where you have a specific, evidence-backed claim to make (a real number from a
   real engagement — "10%→<1% flake rate" style, not generic opinion). Most
   answers earn a backlink from the publishing outlet's site, which is real
   domain authority, unlike guest-post link farms.
4. Track every placement in a simple list — outlet, date, URL, anchor text — so
   you can point to "featured in X" as its own proof line later.

### 2.3 Existing dev.to pipeline → extend to Hashnode (30 min setup, then reuse existing cadence)

`docs/syndication/README.md` already documents the dev.to republish pattern with
`canonical_url`. Do the identical thing on Hashnode (`hashnode.com`, connect a
custom domain or just post with a canonical link field — Hashnode supports
canonical URLs natively in post settings). This is a copy-paste of work already
being done for dev.to — no new writing, just a second publish target per note
already scheduled in `docs/CONTENT_CADENCE.md`. Hashnode's dev audience skews more
toward this exact niche (AI/dev-tooling) than dev.to's broader front page.

---

## 3. Turning existing channels into proof surfaces

### 3.1 LinkedIn — build-in-public cadence layered on the existing posting rhythm

`docs/LINKEDIN_KIT.md` covers profile setup (done). `docs/CONTENT_CADENCE.md`
already schedules a Monday LinkedIn post per field note. What's missing is a
distinct **authority-building post type** that isn't just "here's my new article" —
it's "here's my methodology working, in public, right now."

Post types (rotate, don't repeat the same shape twice in a row):

1. **The score post** (2×/month): a real before/after number from client work or
   from `llm-eval-gate`/`sage-kernel` itself — "Golden set went from 62% pass to
   94% after adding 2 assertions. Here's the diff." Screenshot the CI run. This is
   the single highest-performing post type for a proof-based brand because it's
   unfakeable — a number plus a screenshot reads as evidence, not opinion.
2. **The methodology teardown** (1×/month): pick one real eval failure mode
   (hallucination, prompt injection, flaky non-determinism) and walk through how
   the gate catches it, 150–250 words, ends on the service-page CTA already
   established in `docs/CONTENT_CADENCE.md`'s intent-note structure.
3. **The build-log post** (1×/month, tied to open-source work): "Shipped X in
   llm-eval-gate this week — here's why." Links the commit/PR directly. This is
   what makes GitHub activity visible to people who will never visit the repo.
4. **The repost-with-take** (weekly, 5 min): find one real AI-eval/QA industry post
   from someone with actual following, add a genuine technical disagreement or
   extension (not "great post!") — this is how you get in front of audiences you
   don't have yet, cheaply.

Frequency: 2 posts/week steady-state (one from the existing Monday field-note
cadence, one from the rotation above), never zero for more than 10 days — LinkedIn's
algorithm penalizes irregular posters harder than infrequent-but-steady ones.

### 3.2 YouTube — eval walkthroughs as embedded case-study evidence

The case-study template already has a `video` field wired
(`video: 'https://youtube.com/watch?v=…'` per `README.md`) — it's just empty.
Screen-recorded walkthroughs are the single most persuasive proof format for a
technical buyer because they can't be faked in the way a static screenshot can.

1. Record 3 videos, 3–6 minutes each, screen capture + voiceover, no editing
   software needed beyond trim (QuickTime screen record + iMovie trim is enough):
   - "Running the llm-eval-gate CI check live — watch it block a bad PR."
   - "Reading a golden-set diff: what a real regression looks like."
   - "The 18-point pre-launch checklist, applied to a real RAG feature" (ties
     directly to `checklist.html`, the existing lead magnet).
2. Upload to the existing YouTube channel (unify the handle/branding with the
   LinkedIn headline copy from `docs/LINKEDIN_KIT.md` — same bio line, same link
   to `agency.sageideas.dev`).
3. Drop each video URL into the matching case study's `video` field — this is a
   one-line change per video, the plumbing already exists.
4. Cross-post the same video as a LinkedIn native upload (LinkedIn's algorithm
   favors native video over YouTube links) — one recording, two placements.

Time: ~3 hrs total for the first 3 videos (script from existing eval-method docs,
no new research needed), then 1/month ongoing tied to whatever the current client
engagement or `llm-eval-gate` release actually produced.

### 3.3 GitHub stars, made visible on-site (30 min, one-time + light upkeep)

`case-studies.html` already hardcodes star counts (`<span class="bstar">★ 7</span>`)
for CISSP-Exam-Prep and Nexural_Automation but has no badge at all next to
`llm-eval-gate` or `sage-kernel`. Two fixes:

1. Add the missing `<span class="bstar">★ N</span>` markup to the `llm-eval-gate`
   and `playwright-sdet-regression-suite` cards once they have a nonzero count
   post-launch (Section 2.1) — matches the existing pattern exactly, no new CSS.
2. Longer-term, consider swapping the hardcoded numbers for a live shields.io badge
   (`https://img.shields.io/github/stars/JasonTeixeira/llm-eval-gate?style=flat-square`)
   so it never goes stale — but that's a nice-to-have, not urgent; the hardcoded
   pattern is fine as long as someone remembers to bump it monthly.

---

## 4. The 30/60/90-day sequence

Ordered so the highest-trust, lowest-effort wins land first. Time estimates are
active work, not calendar time.

### Days 1–10 (foundation — ~8 hrs total)
1. Google Business Profile setup (Section 1.1) — 20 min + verification wait.
2. Clutch.co profile (Section 1.2) — 45 min.
3. The Manifest duplicate listing — 10 min.
4. Qwoted + Featured.com signup (Section 2.2) — 30 min.
5. `llm-eval-gate` pre-launch hardening: CONTRIBUTING.md, topics, social preview
   image, verify the zero-API-key path runs clean (Section 2.1) — 2–3 hrs.
6. Hashnode account + canonical-URL republish of the most recent existing field
   note (Section 2.3) — 30 min.

### Days 10–20 (the launch — ~6 hrs active + monitoring)
7. Show HN post for `llm-eval-gate`, Tuesday–Thursday morning ET, 3 hrs of comment
   presence same day.
8. Product Hunt launch, 2–3 days after HN.
9. Reddit self-promo posts where each sub's rules allow.
10. dev.to technical writeup of how the gate works, canonical back to a new site note.
11. Add the earned star badge to `case-studies.html` once stars land.

### Days 20–30 (channel leverage — ~5 hrs)
12. Record and publish the first 3 YouTube eval walkthroughs (Section 3.2).
13. Wire video URLs into the case-study `video` fields.
14. Start the LinkedIn authority rotation (Section 3.1) — first "score post" and
    first "methodology teardown."

### Days 30–60 (compounding — ~2 hrs/week steady-state)
15. Weekly Qwoted/Featured scan and response.
16. Continue LinkedIn 2×/week rotation.
17. First client closes via the outreach motion in `docs/OUTREACH-PLAYBOOK.md` →
    immediately send the combined Google + Clutch review ask in the project-close
    email (Section 1.1/1.2). This is the single event that unlocks real third-party
    review proof — don't let it slip past without the ask.
18. Second Hashnode/dev.to republish cycle from whatever field note published that
    month.

### Days 60–90 (second wave + measurement)
19. If `llm-eval-gate` got real traction (20+ stars, any inbound issues/PRs), do a
    second, smaller launch wave: a "6 weeks later, here's what I changed based on
    real usage" post on HN/dev.to — follow-up posts on tools that got initial
    traction often outperform the original launch because there's now social proof
    behind it.
20. Revisit Clutch tier: if 2–3 reviews are in, consider upgrading to Verified for
    analyst-conducted phone reviews (higher trust signal, costs money — only
    worth it once there's a base of reviews to build on).
21. Second and third client closes → repeat the review ask (step 17) each time.
22. Full metrics review (Section 5) — decide what to double down on for the next
    90 days based on what actually moved, not what felt productive.

---

## 5. What to measure

Track these four, monthly, in one place (a simple spreadsheet is enough — don't
build a dashboard for this yet):

1. **Referring domains** (not backlinks — domains). Use Google Search Console
   (free, already available since the site is on Search Console per the sitemap
   submission in `docs/DISTRIBUTION.md`) → Links report, or Ahrefs/Ubersuggest free
   tier monthly checks. This is the real domain-authority signal; 10 links from 1
   domain is worth less than 10 links from 10 domains.
2. **GitHub stars + forks on `llm-eval-gate`** specifically (not aggregate across
   all repos) — it's the one repo positioned as the proof asset, so it's the one
   that needs to be watched as a leading indicator of "is the open-source bet
   working."
3. **Directory-sourced inbound** — tag every lead source in the existing CRM/
   Marketing cockpit (per `docs/OUTREACH-PLAYBOOK.md`'s tracking pattern) with
   `clutch`, `gbp`, `hn`, `producthunt`, `linkedin`, etc. This tells you which of
   these channels actually produces qualified conversations vs. which just produces
   vanity traffic — cut spend on whichever channel shows zero attributed leads
   after 90 days.
4. **Review count + average rating** across Google Business Profile and Clutch
   combined. Even 3–5 real reviews materially changes conversion on the proposal/
   deposit path already built (`docs/PROPOSALS.md`) — this is worth tracking on
   its own line, not folded into generic "traffic."

Skip vanity metrics (impressions, follower count, total pageviews) as primary
KPIs — they're fine as secondary color, but none of them tell you if a stranger
trusted you enough to start a paid conversation, which is the only thing this
playbook is optimizing for.

---

## Which tool to open-source first

**Already answered by his own repo: it's `llm-eval-gate`, and it's already built.**

Don't build something new. The highest-ROI move here is recognizing that Jason
already shipped the correct artifact and simply never launched it. Verified state
as of this writing: public, MIT-licensed, real README, zero-API-key onboarding
path, already cross-linked from live site pages — and sitting at 0 stars because it
has never been submitted to HN, Product Hunt, Reddit, or any aggregator.

**Repo:** `github.com/JasonTeixeira/llm-eval-gate`

**README pitch (tightened version of what's already there):**

> A CI gate that can say no. `llm-eval-gate` gives you your first green LLM
> evaluation check in under 10 minutes — no API keys required to start, thanks to
> a mock-provider path you can swap for a real model once the pattern's proven.
> Bring a 30-case golden set, get deterministic assertions and an automated
> quality floor that ratchets up over time, wired straight into GitHub Actions.
> This is the exact pattern used to gate client LLM features before they ship —
> extracted, genericized, MIT-licensed, and free to fork.

**Why this one and not a new build:**

1. **It's already the proof, not a description of proof.** A hallucination-gate
   GitHub Action or a golden-set diff tool built from scratch would take a week
   and still just be "a tool Jason made." This repo is literally the artifact his
   consulting pitch describes — launching it *is* the case study.
2. **Zero build cost, all launch cost.** Every hour spent here goes into
   distribution (Section 2.1), not implementation. That's the highest-leverage
   place to spend hours when starting from zero authority.
3. **The audience match is exact.** The people who star a CI-gate-for-LLMs repo on
   HN/PH are the same people who search "LLM evaluation CI" and land on
   `/services/llm-evaluation-qa.html` — this isn't a tool that happens to be
   adjacent to the business, it's the business, packaged as something free.
4. **It's small enough to actually finish polishing.** A golden-set diff tool or a
   full hallucination-gate GitHub Action are good *next* projects once this one has
   traction — but scope discipline matters starting from zero: ship the thing
   that's 90% done, not the thing that's 0% done and more interesting to build.

Second launch, 60–90 days out once `llm-eval-gate` has real usage: extract the
`checklist.html` 18-point eval checklist into a small CLI (`npx llm-preflight` or
similar) that runs the same checks against a repo automatically — but that's a
Phase 2 bet, not a Day 1 one. Phase 1 is: ship what's already built.
