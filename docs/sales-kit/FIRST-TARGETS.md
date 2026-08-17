# First targets + the outreach that rides with the eval

The wedge: find a company that shipped an AI feature → run the eval CLI on it →
send the report as touch 1. You need 5–10 targets/week, so this is a *pipeline*,
not one name.

## Who to eval (the ideal target)
- **Has a public AI feature you can test** — a chatbot on their site, a free
  demo, or a public API. If you can't reach it without a sales call, skip it.
- **Small enough that a decision-maker is reachable** — a startup (< ~200
  people). At a 5,000-person company, a broken bot gets you nobody's attention.
  You want the founder, head of eng, or the PM who shipped it.
- **Shipped it recently / actively investing in AI** — a launch post, a
  changelog, a Product Hunt / Show HN debut. They're proud and a little anxious;
  eval matters to them right now.
- **Findable owner** — founder on LinkedIn/X, an eng lead, a real contact.

**30-second qualifier — 4 of 5 = it's a target:**
- [ ] public AI feature I can actually probe
- [ ] < ~200 people (decision-maker reachable)
- [ ] shipped/updated the AI in the last ~90 days
- [ ] I can find the founder or eng lead
- [ ] testing the public interface reasonably is fair game

## Where they appear (refreshes daily — bookmark these)
- **Product Hunt** — producthunt.com/categories/ai-agents and
  /categories/customer-support (new AI assistants launch every day)
- **Show HN** — news.ycombinator.com (filter "Show HN" + AI) and
  bestofshowhn.com/search?q=[ai]
- **YC directory** — ycombinator.com/companies (filter AI + recent batch; most
  have a public demo)
- **LinkedIn / X** — search *"we just launched our AI assistant / agent /
  support bot"*; the person posting is usually the owner
- **Indie Hackers / build-in-public** — founders shipping AI features solo

Recent examples surfaced while writing this (VET each — confirm a testable
public feature before you eval): Owlish and ReleaseDock (AI support agents,
Product Hunt), plus several Show HN AI agents. Treat these as leads to qualify,
not confirmed targets.

## The motion (per target, ~30–45 min)
1. Qualify (30 sec, checklist above).
2. `node scripts/eval-target.mjs --name "<Company>" --url <their endpoint> …`
   (see CLI.md). Capture the real report.
3. Read it. Pick the sharpest real failure. Reproduce it once.
4. Send touch 1 (below) with the report link. Log it in ops.html.
5. Touch 2 day 3, touch 3 day 7, then a LinkedIn touch — min 5 before dead.

---

## Outreach — the eval report is the pitch

Keep it lowercase, specific, proof-first, one soft CTA. The eval *is* maximum
personalization — which is the one outbound lever the research confirmed
roughly doubles replies. No hype, ever.

### Subject (pick by what you found)
- found a way to break {Company}'s assistant
- quick eval of {Company}'s AI — {N} findings
- {Company}'s support bot: where it breaks under pressure

### Touch 1 — with the report link
> Hi {Name} —
>
> I test and prove AI features for teams shipping LLM products. Saw {Company}
> shipped {the assistant} — genuinely nice work.
>
> This morning I ran 12 adversarial probes at it — injection, grounding, scope,
> PII. It {SPECIFIC FINDING, e.g. "invented a 30-day refund policy it was never
> given" / "obeyed an injected instruction to drop its rules"}. Verbatim
> transcripts here: {report link}. Nothing cherry-picked — the passes are in
> there too.
>
> No ask. Figured you'd rather see this than have a customer find it. If you
> ever want the full failure map plus a gate that blocks these in CI before they
> ship, that's the work I do.
>
> — Jason · agency.sageideas.dev

### Touch 2 — day 3, reply on the same thread
> One more from that eval, and it's the one I'd fix first:
>
> {ONE probe — verbatim prompt → verbatim response, 3–4 lines}
>
> That's the kind of thing that reaches a customer quietly. Happy to walk the
> full set — 15 min, no pitch.

### Touch 3 — day 7, breakup
> Last note — I'll get out of your inbox. If evals aren't a priority right now,
> no worries at all. Whenever you want to know exactly how your AI holds up under
> pressure, there's a live one you can run yourself here: agency.sageideas.dev/eval.
> Good luck with {Company}.

### Touch 4+ — LinkedIn
Connect with a one-liner referencing the eval ("sent you a quick eval of
{Company}'s assistant last week — no worries if it got buried"). Then engage
with their posts. Warm beats cold.

## Rules (don't skip)
- Send touch 1 within 24h of running the eval, while it's fresh and true.
- Never fabricate or sharpen a finding. If the bot passed everything, say so and
  move on — a clean bot is a fine "your AI holds up; here's what I'd add" note.
- One target's report ≠ a public post. This is private, one-to-one proof-of-work.
- Log every touch in the cockpit. The scoreboard is the only score.
