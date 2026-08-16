# Outreach Sequences

**RULE: minimum 5 touches per prospect before marking dead.** Most replies come after touch 3. Quitting at 2 is throwing away the work already done.

Two lanes. Local is voice-first. Remote is evidence-first.

---

## LANE 1 — LOCAL (voice lane)

Target: home-service businesses (Orlando area). Offer: missed-call rescue.
Prep: actually call their shop first, off-hours or busy hours, and note the day/time nobody picked up. The opener depends on it being true.

### Cold-call script

**Opener (verbatim):**

> "I called your shop [day/time] and nobody picked up — I build the thing that catches that job."

Then:

> "Quick version: when a call goes to voicemail, most homeowners just call the next company on the list. I set up a system that texts them back within a minute, books the job, and puts it on your calendar. You keep the customer you already paid to make ring.
>
> I'm local — Orlando. Takes about fifteen minutes to show you how it works on your own phone number. Do you have fifteen minutes [DAY] or [DAY]?"

**If "we have someone who answers":** "Great — this catches the ones they miss. After hours, on a ladder, second line ringing. When did you last check how many calls hit voicemail last month?"

**If "not interested":** "No problem. Can I text you one line with what it does, in case a slow week changes your mind?" (Gets the number into the SMS follow-up.)

### Voicemail script (leave on first unanswered call)

> "Hi, this is Jason — kind of proving my own point here, because I called [day/time] and got this voicemail. I build a system for [TRADE] shops that texts back missed callers within a minute so the job doesn't go to the next company. I'm in Orlando. I'll text you the short version — takes one read. Thanks."

Keep it under 25 seconds. Then send the SMS the same day.

### SMS follow-up (same day as voicemail)

> "Hi [NAME], Jason here — left you a voicemail earlier. Short version: I called your shop [day/time], nobody picked up. I build the thing that catches that job — missed calls get an instant text-back and a booking link. 15-min demo on your own number, no charge to see it. Worth a look? — Jason, Sage Ideas (Orlando)"

**Touch cadence (local):** Call → voicemail + SMS (day 0) → call again (day 2) → SMS (day 4) → call (day 7) → final SMS (day 10). That's 5+ touches. Then mark dead and recycle in 90 days.

---

## LANE 2 — REMOTE (eval lane)

Target: teams shipping LLM-powered features. Offer: I test and prove AI features.
Prep: run a real mini-eval against their public-facing AI feature before touch 1. No mini-eval, no sequence.

### Touch 1 (day 0) — mini-eval findings + video

Subject: `Ran [N] checks against [FEATURE] — [X] worth a look`

> Hi [NAME],
>
> I ran a small eval against [PRODUCT]'s [FEATURE] — [N] test cases, scripted, repeatable. [X] of them produced output I think your team would want to see before a customer does.
>
> Here's a 3-minute video walking through what I ran and what came back: [VIDEO_LINK]
>
> No pitch in the video, just the findings. If it's useful, I do this as a service: eval suites with pass/fail gates, wired into CI, handed off to your team.
>
> Worth a 20-minute call?
>
> Jason Teixeira
> Sage Ideas LLC · agency.sageideas.dev

### Touch 2 (day 3) — one specific failure transcript

Subject: `Re: Ran [N] checks against [FEATURE]`

> Hi [NAME],
>
> One concrete example from the eval, pasted in full so you can judge it yourself:
>
> **Input:** [EXACT_PROMPT/INPUT]
> **Output:** [EXACT_OUTPUT]
> **Why it matters:** [ONE_SENTENCE — wrong fact / policy miss / broken format / unsafe answer]
>
> This is reproducible — same input, same class of failure. A gate would have caught it before release.
>
> Happy to send the full transcript set. 20 minutes this week?
>
> Jason

### Touch 3 (day 7) — breakup note

Subject: `Closing the loop on [FEATURE]`

> Hi [NAME],
>
> Last note from me. If AI testing isn't a priority right now, no problem — timing is everything.
>
> Two things before I go:
>
> 1. The findings from your feature are yours either way. Say the word and I'll send the full set.
> 2. If you ever want to see what the finished product looks like, here's a sample report and the proof behind it: https://agency.sageideas.dev
>
> Door's open whenever it becomes a priority.
>
> Jason

**Touch cadence (remote):** Email 1 (day 0) → email 2 (day 3) → email 3 (day 7) → LinkedIn connect + short note (day 10) → final short email or LinkedIn message (day 14). That's 5 touches. Then mark dead and recycle in 90 days.

---

## Logging

Every touch gets logged: date, prospect, lane, touch #, response. If a line keeps working, promote it into the scripts above. If a line keeps dying, cut it.
