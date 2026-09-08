# AI Front Desk — Outreach Playbook

The platform is built. **The only thing between you and $50k/mo is volume of the right conversations.** This is the weekly routine that produces them. Everything here uses tools you already have (`scripts/score-leads.mjs`, the Marketing cockpit, `niches.mjs`).

> The math (from the research): ~2 new clients/mo needs ~8–13 qualified meetings, ≈ **1,000–1,300 well-targeted contacts/month** if outbound is your only channel — far fewer if referrals/partnerships carry part of the load. At ~$4k/mo average, ~12 retainers = $50k/mo. So the target is **~250–300 fresh, well-targeted contacts a week.**

## The offer you're selling
| Rung | Price | One-liner |
|---|---|---|
| Setup | $2,500 one-time | Missed-call text-back + 24/7 AI receptionist + instant web-lead reply, built **and tested** for their trade |
| Maintain | $2,500/mo | Keep it running, monitored, monthly report |
| Growth | $4,500/mo | + booking, follow-ups, reviews, reactivation, 2 automations/qtr |
| Scale | $7,500/mo | + multi-location, priority queue, quarterly strategy |

Retainers are billed per client in the **Stripe dashboard** (custom amount, hosted pay page) — no in-app billing needed.

## The weekly loop (≈3–4 focused hours)
1. **Source (Mon, ~1h).** Pull a Google-Maps/Outscraper list for 1–2 niches in a metro (use the `keywords` in `niches.mjs`). Run `node scripts/score-leads.mjs <csv>` → `outreach/shortlist.csv` + `outreach/openers.md` (ranked, with per-niche hooks).
2. **Load the CRM.** Add the best ~50–75 as prospects (Pipeline → add, or import). They surface in the **Marketing** tab under "who to reach out to."
3. **Send (Mon–Thu, ~30min/day).** From the Marketing tab, hit **Copy opener** per lead, personalize one line, send (email or LinkedIn/DM). Log the touch (one click). Target ~50/day.
4. **Follow up.** The cockpit flags leads going cold (3+ days). Use the follow-up templates below. Most replies come on touch 2–4, not touch 1.
5. **Book + close.** Reply/interest → book a 15-min call (`book.html`). On the call: confirm scope, quote the tier, send the Stripe subscription + the setup invoice.
6. **Ask for referrals.** After every good call (won or not), use the referral ask. Referrals close highest.

## Channels (don't rely on one — single-channel = 2.4× more volatile)
- **Outbound (your controllable engine):** the loop above. Volume is the dial.
- **Referrals/partnerships (highest close):** other trades, larger agencies who don't do AI, SaaS partners (Housecall Pro / Jobber ecosystems). One warm intro > 50 cold.
- **Content (slow compounder):** the field notes / case studies already on the site. Keep it light; it's a trust layer, not a lead source yet.

## Paste-ready templates (tuned to the offer)

**Cold opener (email/DM) — the cockpit "Copy opener" gives a per-lead version of this:**
> Hi {first} — I set up an AI front desk for {trade} businesses: it texts back every missed call, answers 24/7, and replies to web leads in seconds, so the jobs that hit voicemail stop going to the next {trade} on the list. I build it and — because I'm a QA engineer — I actually *test* it before it talks to your customers. Worth a quick look at what it'd catch for {company}? — Jason

**Follow-up 1 (day 3):**
> {first} — quick one: {hook_for_their_niche}. If that's happening even a couple times a week, the front desk pays for itself off one recovered job. 15 minutes this week?

**Follow-up 2 (day 8, value):**
> Not a nag — here's the number that matters: a missed call for {trade} is often a ${avgJob}+ job. Catch even 2 a month and you're well past what this costs. Happy to show you exactly how it'd work for {company}.

**Break-up (day 14):**
> I'll stop here so I'm not cluttering your inbox. If catching more of your missed calls ever moves up the list, reply and I'll set it up fast. — Jason

**Referral ask (after any good call):**
> One favor — who's the best {trade} or {adjacent-trade} owner you know who's busy enough to be losing calls? Happy to do the same for them and send you something for the intro.

## What to track (already in the cockpit)
- **Need a touch** count → your daily work queue.
- **Nurture sent (7d)** → automated warm follow-ups (flip `NURTURE_ENABLED=true` to turn on).
- Reply rate, meetings booked, close rate → know your funnel so you know how much to source.

**Reality check:** if you send 250 good contacts/week and book &lt;5 meetings, the *offer/targeting* is off, not the volume — fix the message, not the machine. If you book meetings but don't close, it's pricing/qualification. The platform won't tell you which; the conversations will.
