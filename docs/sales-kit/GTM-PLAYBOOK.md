# Go-To-Market Playbook — Sage Ideas (Remote LLM-Eval / QA Lane)

> Grounded in adversarially-verified research (2026-08-16 deep-research run:
> 26 sources, 115 claims, 8 survived verification). Where a tactic is NOT
> backed by a verified source, it says so. This overrides the cold-outbound
> emphasis in MASTER_EXECUTION_PLAN.txt where the two conflict — see
> "What changed and why" at the bottom.

---

## The positioning (locked)

**"I test and prove AI features for teams shipping LLM products."**

Buyer: founders, eng leaders, and PMs at companies shipping LLM-powered
features (chatbots, agents, RAG, generators) who currently test by eyeballing
it. Not "AI automation for everyone." One sentence, one buyer.

The second lane — local AI-receptionist / missed-call rescue — is a real
business and it is NOT dead. It is **paused**, not killed. Splitting focus
across both is the #1 verified reason operators stall under $5k/mo. Lead
remote. Revisit local after 3 signed remote clients.

---

## The price ladder (locked, live on Stripe)

| Step | Price | What it is |
|---|---|---|
| Mini-eval | **free** | Proof-of-work wedge. I run 15-20 rubric cases on your live AI feature and send findings. The pitch IS the sample. |
| Audit | **$750** | 1 week. Map the failure modes, score current coverage, costed plan. Live one-click Stripe checkout. Credited in full toward any build. |
| Pilot | **from $2,500** | 2-3 weeks. Minimum viable eval gate: 30-50 golden traces, one judge, one CI step that can block a merge. |
| Build | **from $9,500** | 4-8 weeks. Full eval battery: safety runners, ratcheting floors, RAG retrieval metrics, cost budgets, runbook + handoff. |
| Operate | **$2,500/mo** | Ongoing tuning + gate maintenance. |

Price is tiered by scope, not hours. The research's one hard-numbers winner
(FletchPMM, $1.7M/yr) tiers by client size — as you get traction, quote the
Build tier by the client's ARR/team size, not a flat rate.

---

## The strategy: own a channel before you spray

**The single verified path to $10k-$50k/mo** (FletchPMM, 3-0 verified): a
productized fixed-scope service distributed through an **owned organic channel
built before/alongside the offer.** Their words: *pick a channel with an
organic algorithm and spend 3-9 months cracking it before building the
product.* They reached $1.7M/yr on LinkedIn organic content — not ads, not
cold email.

**Why this is the play for you specifically:** your moat is *proof nobody can
fake* — the self-proving site, the CVE red→green arc, the 18-agent audit that
caught a false lesson, "no fake green." That is genuinely differentiated
content. You are the rare builder who can run this playbook because you have
something real to publish. Cold-spray plays to your weakness; publishing proof
plays to your strength.

**What the research KILLED — do not build the business on these:**
- Missed-call loss stats (62% / 85% / $126k-lost) — refuted 0-3.
- Cold-email hook A/B numbers — refuted 0-3.
- Landing-page conversion benchmarks — refuted 0-3.
- Every "solo n8n guy makes $8k/mo from Reddit" story — refuted, unverifiable.
- Not one named cold-outbound AI-automation operator's success survived
  verification. The only verified winner used organic content.

**Cold email is a real but declining, low-yield channel** (verified): 1-5%
reply baseline (3.43% platform-wide, down from 8.5% in 2019), top campaigns
15-25%, personalization ~2x. Use it as a *secondary* targeted wedge, never the
primary engine, and never spray.

---

## The engine: three loops, run daily

### Loop 1 — PUBLISH (primary, the verified winner)
The content engine lives in `docs/sales-kit/content/`. Mon/Wed/Fri LinkedIn
posts from your real proof (proof stories, contrarian/educational, how-to,
manifesto). This is the channel you are cracking. Expect **3-9 months** before
it produces inbound reliably — that is the verified timeline, not a failure.
The compounding starts around month 3-6.

- Post 3×/week, same days/times.
- Reply to every comment in the first hour (algorithm reward).
- Comment substantively on 5 target-buyer posts/day (this feeds reach more
  than posting does early on).
- The free mini-eval is the recurring soft CTA. The llm-eval-gate repo is the
  free-value CTA. Rotate; don't pitch every post.

### Loop 2 — TARGETED OUTREACH (secondary, proof-of-work wedge)
NOT cold-spray. The wedge is the **free mini-eval** — you do the work first,
then reach out with findings. This is proof-of-work selling; the sample IS the
product. Sequence lives in `docs/sales-kit/outreach-sequences.md`.

- Find 5-10 companies/week that shipped an LLM feature recently (launch posts,
  changelogs, Product Hunt, "AI" in release notes, Show HN).
- Run a real 15-20 case mini-eval on their public feature.
- Touch 1: the findings + a 3-min Loom. Touch 2 (day 3): one specific failure
  transcript. Touch 3 (day 7): breakup + link to your sample report.
- Minimum 5 touches before dead. Quality over volume — the verified data says
  personalization ~2x's reply, and your mini-eval is maximum personalization.

### Loop 3 — REFERRAL + WARM (compounds after client #1)
Every delivery mechanically produces: a case study (24h after handoff), a
referral ask, and a retainer offer. First 3 clients priced to win (up to ~30%
off) ONLY in written trade for a named case study + 2 referral intros + a
testimonial. After client #3: full price, and the site gets its first
third-party proof.

---

## Funnel math (honest, from verified reply rates)

Target: **$10k/mo ≈ 2 builds + a retainer, or 1 build + 2 pilots + retainers.**

Two ways to get the first meetings, run both:

**Content (primary, compounding, slow start):** unverified but concrete
directional benchmark from the research — ~1,000 LinkedIn touches (posts +
comments + connects) over 90 days → a handful of inbound conversations →
1-2 calls/mo early, growing. The compounding is the point; month 6 >> month 1.

**Mini-eval outreach (secondary, immediate):** 10 mini-evals/week is realistic
solo. At maximum personalization, expect meaningfully above the 1-5% cold
baseline because you did the work first — but plan conservatively: ~10-15
mini-evals → ~2-3 replies → ~1 call → proposal. ~1 close per 3-4 proposals.

Neither number is a promise. The verified takeaway is: **volume of genuine
proof-work + a compounding owned channel, not clever cold copy.**

---

## The weekly scoreboard (the ONLY score)

Not repo commits. Not coverage. Every Friday, 30 min:

| Metric | Target/wk |
|---|---|
| Posts published | 3 |
| Substantive comments on buyer posts | 25 (5/day) |
| Mini-evals run | 5-10 |
| Outreach touches sent | 25 |
| Conversations started | track |
| Calls booked | track |
| Proposals sent (within 24h of every call) | track |
| $ collected | track |

One retro line each Friday: "what advanced or killed deals this week."

---

## Kill rules (from MASTER_EXECUTION_PLAN, still binding)

1. No new products/repos/courses until 3 paying clients exist. Every build
   hour traces to a signed deal or a numbered task.
2. If tasks aren't done by their gate, the fix is "do the task," not "replan."
3. Weekly review question: "How many touches, and what did the scoreboard say?"
4. If 100 touches produce zero conversations, the SCRIPTS change (hook, niche,
   channel) — not the plan, not the assets.
5. Re-reading/reorganizing this plan is not work. Touches are work.

---

## What changed and why (vs MASTER_EXECUTION_PLAN)

The master plan weighted cold outbound (25 cold touches/week as the primary
engine). The verified research inverts that priority: **the only path with hard
numbers was organic-content-led; cold outbound is real but low-yield and
declining, and no cold-outbound AI operator's success survived verification.**

So: content publishing is promoted to the primary engine (Loop 1), cold
outreach is demoted to a proof-of-work wedge (Loop 2), and the weekly quota
now leads with posts + comments + mini-evals. The dollar targets, kill rules,
qualify-don't-convince discipline, and first-3-clients rule are unchanged —
they were sound.

## Open items for Sage (only you can do these)
- [ ] Restore Supabase (unblocks the academy funnel; independent of this lane)
- [ ] Produce the first sample mini-eval report on a real public AI feature
      (I run it with you — pick the target)
- [ ] Set up the LinkedIn profile to the niche sentence (draft in
      `linkedin-github-rewrite.md`) and start the 3×/week cadence
- [ ] Record the 3-min mini-eval Loom template
- [ ] Stripe deposit links for pilots/builds (audit already live)
