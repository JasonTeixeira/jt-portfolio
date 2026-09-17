# Distribution runbook

How to turn the site's content into traffic, subscribers, and conversations. The build
side (a ~130-page Learn library + a working capture/send stack) is done. This is the
operating manual for the part only you can run: publishing and outreach.

## What's already wired (don't rebuild)

- **Capture → storage.** `/api/subscribe` (field-notes signup) and `/api/lead` (mini-eval +
  scope studio) persist to Supabase, honeypot- and rate-limit-protected. Nothing is lost.
- **Newsletter send.** Cockpit → **Broadcast** composes and sends to subscribers, with
  automatic suppression/unsubscribe handling and dedupe. Send a test to yourself first.
- **RSS.** `feed.xml` carries the field notes plus the Learn library posts (cornerstones,
  tutorials, articles), with a self link + lastBuildDate.
- **Analytics.** GA4 + Vercel Web Analytics on every page; `data-evt` clicks (book-a-call,
  mini-eval, CTAs) fire as GA4 conversion events with UTM capture.
- **Sitemap.** All ~195 URLs, submitted-ready at `/sitemap.xml`.
- **Nurture drip.** Daily cron follows up with *sales* prospects (scoped a project). Separate
  from the newsletter by design.

## The owned asset to syndicate: the Learn library

`/learn.html` — 8 pillars, 3 cornerstones, 52 glossary terms, 21 tool comparisons, 16
tutorials, 32 articles. Every piece links up to a cornerstone and ends in a CTA. This is the
inventory you publish from. The full plan and topic map is `docs/CONTENT_ARCHITECTURE.md`.

## Weekly cadence (~20 min/day)

Publishing is manual on purpose (you press send). Pull from the library.

- **Monday — publish 1 post.** Take a Learn article/tutorial, post a LinkedIn version
  (hook + 3 takeaways + link). Paste-ready hooks: `docs/LINKEDIN_KIT.md`.
- **Wednesday — publish 1 asset.** A comparison ("Promptfoo vs DeepEval") or a glossary
  cluster. These are commercial-intent; they convert.
- **Friday — outreach.** 5–10 personalized mini-eval offers to real prospects. Wedge and
  scripts: `docs/OUTREACH-PLAYBOOK.md`.
- **Monthly — one broadcast.** Cockpit → Broadcast: send subscribers your best recent piece.

Full editorial calendar: `docs/CONTENT_CADENCE.md`. Nurable sequence logic: `docs/NURTURE.md`.

## Earning links (the SEO multiplier)

The code-native diagrams (the Eval Metric Cheat Sheet, the RAG measurement diagram) are the
most link-worthy assets. Pitch them + the comparison pages to newsletters and aggregators.
When embeddable versions ship (`/embed/*`), the embed snippet carries an attribution backlink.

## Activation checklist (env / accounts)

Set in Vercel; the engine degrades safely until each is on. Current state:

- `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO` — set. Outbound email works.
- `NURTURE_ENABLED`, `CRON_SECRET` — set. Sales drip live.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — set. Capture + list storage live.
- `RESEND_AUDIENCE_ID` — **not set.** Optional: set it to also mirror subscribers into a
  portable Resend Audience. The broadcast engine reads the list from Supabase, so this is
  belt-and-suspenders, not required.

## What's still manual (yours to run)

- Writing the LinkedIn/X posts and pressing publish (no auto-poster by design).
- Sending the monthly broadcast from the cockpit.
- Outreach sends.
- Getting the first testimonial + named case-study outcome — the biggest lever, and the one
  thing content can't manufacture.
