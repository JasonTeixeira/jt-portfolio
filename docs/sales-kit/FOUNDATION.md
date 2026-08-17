# The foundation — what's proven, what's done, what finishes it

Start here. This is the whole business on one page, grounded in the verified
research (2026-08-16 run: 26 sources, 115 claims, only 8 survived adversarial
verification — so this is what's *battle-tested*, not what sounds good).

## The one verified truth
The only path to $10k–$50k/mo that survived verification was FletchPMM's
($1.7M/yr, 2 people): **productize a fixed-scope offer, and build an owned
organic channel — publishing proof — before/alongside the offer. Spend 3–9
months cracking that channel.** Not ads. Not cold-email blasts. An owned
audience that compounds. Cold outbound is real but low-yield (~1–5% reply,
declining) and no cold-outbound AI operator's success survived verification —
so it's a *secondary* proof-of-work wedge, never the engine.

**Your moat is proof nobody can fake.** That's exactly what this model runs on.
You are the rare operator who can execute it.

## The four pillars of the foundation (and where each stands)
1. **One sharp niche + positioning** — *done.* "I test and prove AI features
   for teams shipping LLM products."
2. **A productized, fixed-scope offer** — *done.* Free mini-eval → $750 audit
   (credited) → from $2,500 pilot → from $9,500 build. Real Stripe-ready prices.
3. **A proof-of-work wedge** — *done.* The mini-eval + the automated eval CLI
   (`scripts/eval-target.mjs`) — you run it on a real feature, send the report.
4. **An owned organic channel** — *the gap.* The content is written
   (14 posts) and now expanded into a real system (BACKLOG.md · FLYWHEEL.md),
   but **not one post is live.** This is the pillar that takes 3–9 months to
   compound, so the single highest-leverage move is to start it *today*.

The assets are ~95% built. The foundation is not "complete" when there's one
more feature — it's complete when the channel is live and a first conversation
is in the pipe. More building delays the 3–9 month clock. **Publishing starts it.**

## Finish the machine — 3 pastes, ~20 minutes (your accounts)
These are the only remaining *build* items, and none need code from me — the
site already has the slots wired. Do them once:

### 1. Get paid in one click — Stripe Payment Link (~3 min)
- Stripe dashboard → Products → **Payment Links** → new link, **$750**, name it
  "Sage Audit."
- Copy the `https://buy.stripe.com/…` URL.
- In `book.html`, find `<!-- STRIPE PAYMENT LINK -->` and paste it as the
  `#audit-buy` button's `href`. Done — the audit is now one-click-payable,
  standalone, no academy dependency.

### 2. Get booked without email tennis — Cal.com (~10 min)
- Create a free Cal.com account; make a **15-min "intro call"** event type.
- Copy your booking link (`https://cal.com/yourname/intro`).
- In `book.html`, find `<!-- CAL.COM SLOT -->` and drop a button linking to it
  above the form. It becomes the primary CTA; the form stays as the fallback.

### 3. Stop losing form leads — Resend (~5 min)
- Create a free Resend account, verify the sending domain (or use their test
  sender to start), grab an API key.
- Vercel → jt-portfolio → Settings → Environment Variables → add
  `RESEND_API_KEY`. Redeploy.
- `/api/contact` flips from 501 (mailto fallback) to real inbox delivery +
  a record of every lead. (This same key later sends the NURTURE.md sequence.)

### 4. See the funnel — Vercel Web Analytics (~1 min)
- Vercel → jt-portfolio → **Analytics** tab → Enable Web Analytics.
- The tracking snippet is already on the pages; pageviews + every CTA click
  (`data-evt`) start recording. Now you can see what converts.

## Then: the only thing left is not code
- Set your **LinkedIn** to the niche sentence (draft in
  `linkedin-github-rewrite.md`) and **post `week-01-mon.md` today.** Then Wed,
  then Fri. Never break the cadence. Refill from BACKLOG.md + FLYWHEEL.md.
- Comment on **5 buyer posts/day** (this feeds reach more than posting early on).
- Run **one real eval** this week (FIRST-TARGETS.md → find a target → CLI →
  send the report). Then 5–10/week. Log every touch in `ops.html`.
- Expect leading indicators (posts, comments, evals, touches) for months before
  lagging ones (calls, closes). The compounding is real and it is the point.

## The honest scorecard
- **Assets/machine:** ~95 → ~99 after the 3 pastes above.
- **Pipeline throughput:** ~10 until traffic + a first conversation flow — and
  no site quality substitutes for that. The pipeline hits 100 the week it's
  *running*, not the week it's *finished*. It's finished. Run it.
