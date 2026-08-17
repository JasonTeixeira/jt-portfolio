---
pillar: proof-story
hook: "I inherited a test suite that failed 1 in 10 runs for no reason. We got it under 1%. Here's what actually moved the number."
cta_type: question
---

I inherited a test suite that failed roughly 1 run in 10 for no reason. Over my time on it we got the flake rate under 1%. Here's what actually moved the number — because it wasn't cleverness.

At HighStrike I owned a live regression suite that everyone had quietly stopped trusting. When a suite flakes 10% of the time, something worse than red builds happens: people start ignoring red. A failure means "run it again," not "we broke something." At that point the suite is decoration.

What fixed it wasn't a better framework. It was treating every flake as a real bug with a root cause:

- **Waits, not sleeps.** Most flake was timing — asserting before the app was ready. Deterministic waits on real conditions, never fixed timeouts.
- **Test isolation.** Shared state between tests meant order changed outcomes. Each test set up and tore down its own world.
- **Quarantine, don't ignore.** A test too flaky to trust got pulled out of the gate and fixed on its own track — not left in to erode confidence.
- **Traces on every failure.** You can't fix what you can't see. Every red run left an artifact showing exactly what happened.

Under 1% isn't a vanity metric. It's the threshold where red means something again, and a red build actually stops a bad merge.

A flaky suite is worse than no suite — it trains your team to disregard failure. What's your flake rate right now, honestly?

## Why this works
Concrete before/after number from real employment history (10% → <1%) with the mechanism spelled out, so it teaches while it proves. The "flaky suite trains people to ignore red" insight is the memorable takeaway that reframes flake as a trust problem, not a tooling one.
