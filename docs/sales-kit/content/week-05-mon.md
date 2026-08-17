---
pillar: proof-story
hook: "I built a QA system with 85 automated runners. Ten of them do nothing but try to make AI features misbehave."
cta_type: soft-link
---

I built a QA system with 85 automated runners. Ten of them do nothing but try to make the AI features misbehave — and I can reproduce the whole scorecard with a single command.

I want to be specific about what "AI safety evals" actually means, because the phrase gets thrown around as a vibe. In my system it's ten concrete runners with pass/fail conditions. They probe the things that quietly sink LLM features in production: prompt injection, jailbreak attempts, unsafe or off-policy outputs, leaking context that shouldn't leave the boundary, behavior under adversarial and malformed input. Not "we thought about safety." Ten checks that either pass or fail, on every run.

The other 75 runners cover the classical ground — functionality, regressions, performance, accessibility, links, dependency integrity. All of it rolls into one scorecard, and the scorecard is reproducible. One command regenerates it from scratch. No hand-edited numbers, no cherry-picked screenshot. If you ran it, you'd get what I get.

That reproducibility is the part I care about most. A quality claim you can't regenerate is just a story. A quality claim someone else can reproduce on demand is evidence. The entire point of building it this way was to never have to ask anyone to trust a number I couldn't hand them the command for.

That's the standard I bring to a client's AI feature — including the ten runners aimed straight at where it's most likely to fail.

More at agency.sageideas.dev.

## Why this works
Turns a large, potentially-hand-wavy claim (85 runners) into credibility by drilling into the 10 AI-safety evals specifically and naming concrete attack classes. "Reproducible with one command" is the honesty proof that separates evidence from a story — reinforcing the account's core value.
