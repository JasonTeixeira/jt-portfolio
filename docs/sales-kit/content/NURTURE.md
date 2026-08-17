# Email Nurture Sequence — The Lead-Magnet Welcome Spine

When a visitor trades their email for the **sample eval report** (the lead magnet), this 4-email sequence runs. It's the proven B2B foundation: deliver the thing, prove you do what you say, teach, then make the offer softly.

**Voice:** Jason's — direct, proof-first, zero hype, short sentences, engineer-to-engineer. No emoji. No exclamation-point energy. Every claim is a real thing that happened. Reads like a person wrote it, because one did.

**The throughline, verbatim:** *I test and prove AI features for teams shipping LLM products.*

**One soft CTA per email.** Never stack asks. The offer only gets named in E4, and even then, softly.

**Booking/offer link everywhere:** `agency.sageideas.dev/book.html` (never the academy site).

---

## E1 — Immediate (on signup): deliver + who I am

**Subject:** Your sample eval report

**Body:**

Here's the sample eval report you asked for: [LINK]

It's a real one — the same shape I hand a paying client. Inputs, pass/fail per case, the failure modes grouped by pattern, and what I'd fix first. Skim the failures section; that's where the value is.

Quick on who sent it: I'm Jason. I test and prove AI features for teams shipping LLM products — chatbots, agents, RAG, generators. The kind of features that demo well and then say something wrong to a real customer three weeks later.

Most teams shipping AI test it by eyeballing it. One person tries a few prompts, it looks right, it ships. That works until the input you didn't try shows up in production. My whole job is finding those inputs before your users do, and building the gate that keeps them out.

That report is what the finding looks like on paper.

Read it. If anything in it maps to something you're shipping, just reply to this email — it comes straight to me.

— Jason

*Soft CTA: reply to this email.*

---

## E2 — Day 2: proof I do what I say

**Subject:** My own gate blocked me at 11:39am

**Body:**

Anyone can say they test rigorously. Here's me getting caught by my own system, twice, on the record.

**The gate that blocked me.** I hold my own platform to the same bar I sell. One morning my release gate came back red: 15 high and critical vulnerabilities had drifted into my production dependencies. Not code I wrote — packages that moved under me. The easy move is to fix it quietly and only ever show the green screenshot. I did the opposite: I left the failing run up, fixed the dependencies, re-ran it, and published the green run right next to the red one. Both are still public. A gate that can't tell you "this is not safe to ship" out loud isn't a gate. It's a hope.

**The lesson that was teaching a bug.** In another audit, one of my automated reviewers flagged a piece of content for teaching an error that doesn't actually exist — a mistake a human skim would have passed, because the reviewer only caught it by *running the code* instead of reading it. That run found 73 defects in total. Every one was re-verified before I trusted the result.

That's the difference between reviewing AI and proving it. Reading it tells you what it looks like. Running it tells you what it does.

If your AI feature has never been *run* against its own worst inputs — only eyeballed — that's the gap I close.

Reply if you want to tell me what you're shipping. I read every one.

— Jason

*Soft CTA: reply with what they're building.*

---

## E3 — Day 4: the educational piece + the live demo

**Subject:** Most teams test their AI by looking at it

**Body:**

Here's the pattern I see in almost every team shipping an LLM feature:

Someone changes a prompt. They try it a few times. It looks better. It ships.

The problem is that "looks better" isn't a measurement, and one good run of a non-deterministic system proves almost nothing. That prompt change didn't improve anything until it ran against a fixed set of inputs — including the ones that broke last time. Otherwise every edit silently re-opens every bug you already fixed, and you find out from a customer.

The fix isn't complicated. It's three moves:

1. **A golden set** — a fixed collection of inputs you check every version against, built from real failures and edge cases, not the happy path.
2. **A rubric** — a handful of pass/fail criteria so "better" becomes a number instead of a feeling.
3. **A gate** — that set and rubric wired into CI, so a worse version physically can't ship.

That's it. That's the whole discipline that separates a feature you *hope* works from one you can *prove* works.

If you want to see it running instead of just reading about it, I built an eval engine that scores outputs live, in public — you can press run yourself and watch it find real failures: **agency.sageideas.dev/eval**

Press the button. It's more convincing than anything I can write.

— Jason

*Soft CTA: try the live /eval demo.*

---

## E4 — Day 7: the offer, softly

**Subject:** Want me to run this on your feature?

**Body:**

Four emails in, so here's the direct version.

If any of this has been sitting in the back of your head — the prompt changes you can't really verify, the RAG answers that cite confidently and might be wrong, the injection case nobody's checked — I can just look at it.

**The free mini-eval.** Send me one AI feature. I'll run a focused eval against it and send back the real failure modes I find, written plainly. No charge, no deck, no pitch. You keep the findings whether or not we ever work together. It's the same thing that sample report came from, run on your actual product.

Most people stop there and fix things themselves with the findings. Good — that's a real outcome.

If you want the full pass, the next step is a **$750 audit** — a complete eval of the feature with a prioritized list of what to fix and how. And if you decide to work together after that, the $750 is credited toward it. So the audit costs you nothing but time if we continue.

Two ways to start:

- Reply to this email with the feature you want looked at, or
- Grab a time here: **agency.sageideas.dev/book.html**

Either way, no pressure. The offer stands whenever you're ready.

— Jason

*Soft CTA: free mini-eval → book link.*

---

## Mechanics

- **Loads into Resend** (`RESEND_API_KEY`) as a simple time-delayed sequence: E1 on signup, E2 at +2 days, E3 at +4 days, E4 at +7 days.
- **Keep it plain-text-feeling.** From a real person (Jason), a real reply-to that reaches him. No template chrome, no header images, no "unsubscribe from our newsletter" branding beyond the required unsubscribe link. The whole point is that it doesn't feel like a funnel.
- **One CTA per email**, as marked. Don't add a second link "just in case" — it lowers the click on the one that matters.
- **Replies are the product.** Every email invites a reply and every reply reaches Jason directly. A human answering fast is the conversion, not the automation.
- **Anonymization holds here too.** If a subscriber's feature becomes a mini-eval, its failure modes can feed the content flywheel (see `FLYWHEEL.md`) — described by shape, never by name.
