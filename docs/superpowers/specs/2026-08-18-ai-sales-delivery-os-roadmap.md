# AI Sales & Delivery OS — Program Roadmap

**Date:** 2026-08-18
**Owner:** Jason Teixeira (Sage Ideas LLC) — solo operator
**Goal:** a mostly-self-running machine that acquires, nurtures, closes, delivers, and compounds — targeting **$10–50k/mo, retainer-led**, run by one person leveraging AI. Also serves the "get hired" funnel (same assets).
**Companion spec:** `2026-08-18-scope-studio-design.md` (Subsystem A+B+F, the procurement core).

---

## 0. The honest thesis

The current site + the Scope Studio spec are a **world-class middle of the funnel** (convert + procure). A real solo business needs the **top** (demand generation + proof) and the **bottom** (close→cash + delivery + flywheel) too. This roadmap maps the whole machine, ranks it by revenue ROI, and sequences it so budget follows leverage — not shiny objects.

**$10–50k/mo comes from retainers, not one-off projects.** 2–5 clients at $2.5–5k/mo recurring = the target, predictably. Every subsystem should push toward the **recurring quality-gate retainer** as the primary close; projects are the on-ramp.

---

## 1. The value chain → subsystems

| Chain | Subsystem | Status |
|---|---|---|
| Acquisition / demand-gen | **G — Acquisition engine** | ❌ missing (the constraint) |
| Human proof / trust | **P — Proof layer** | ❌ deferred (cheapest, gates all) |
| Marketing / content | part of **G** | 🟡 blog exists, no rhythm |
| Chat / sales / capture / procure | **A — Scope Studio** | ✅ spec'd |
| Persistence / pipeline / memory | **B — Data & pipeline** | ✅ spec'd |
| Trust / humanity | **F — Trust & Voice layer** | ✅ spec'd |
| Nurture / closing | **C — Nurture & closer** | 🟡 planned |
| Close → cash | **H — Close→cash** | ❌ missing |
| Delivery / onboarding | **I — Delivery pipeline** | 🟡 sage-kernel/ECC exist, not wired |
| Flywheel (case study→referral) | **J — Flywheel** | ❌ missing |
| Outbound proposals | **D — Outbound engine** | 🟡 planned (last, riskiest) |
| Measurement / control | **E — Operator cockpit** | 🟡 planned |

---

## 2. Subsystem catalog

**P · Proof layer** *(nearly free, highest leverage, un-defer first)*
Real face + 2-sentence founder note (Jason's voice) + one named testimonial + 2–3 tight case studies. Multiplies acquisition AND closing. Phase-2: Jason's cloned voice. *Blocking dependency for cold acquisition and outbound.*

**G · Acquisition engine** *(the actual constraint)*
- **Content rhythm:** 2–4 pieces/mo on the eval/QA-for-AI wedge, each ending in the mini-eval or Scope Studio CTA. Repurposed to LinkedIn/dev.to (kits already drafted).
- **Distribution:** consistent LinkedIn presence; targeted communities where AI-eng/QA buyers are.
- **Outbound (→ Subsystem D):** research-driven, hyper-personalized, human-approved, low-volume.
- **SEO:** the docs + service pages already rank-ready; add programmatic use-case pages.
Cost-smart: content + organic + surgical outbound before any paid.

**A · Scope Studio** — inbound AI funnel → scoped plan + indicative bands + qualified, persisted lead. *(spec'd)*

**B · Data & pipeline** — Supabase: prospects/conversations/plans/events; stages; memory. *(spec'd)*

**F · Trust & Voice layer** — eval-gated AI, confidence signaling, qualification, graceful-no, radical AI transparency, human escape hatch. *(spec'd, §7 + §7.5)*

**C · Nurture & closer** — multi-touch, tasteful follow-up: objection handling, re-engagement, "still thinking?" nudges, retainer framing. Human-approval gated on anything sent. **Where closing actually happens.** Reads B's data.

**H · Close→cash** — proposal → simple e-sign agreement → Stripe deposit/invoice. Lightweight, semi-manual is fine to start (payment link + template). Turns a "yes" into money. *(Note: Stripe was stripped from the public site in the quote-first pivot; close→cash is a private, post-yes flow, not public pricing.)*

**I · Delivery pipeline** — onboarding checklist, project kickoff, status updates to client, delivery via Jason's sage-kernel/ECC proof-first SDLC. Connects "closed" → "delivered with receipts." Protects Jason's time (async, batched, templated).

**J · Flywheel** — on delivery: auto-draft a case study + testimonial ask + referral ask. Feeds P and G. This is what compounds a solo agency.

**D · Outbound engine** *(last — highest risk)*
Research a prospect's public business → auto-draft a genuinely tailored "here's what I'd build for you" proposal (reuses A's plan renderer) → **human-approved** delivery. Risks: CAN-SPAM/GDPR, domain reputation, and quality (a bad auto-proposal hurts more than silence). Never spray-and-pray. Built only after inbound + nurture are proven, so outbound points at a machine that already closes.

**E · Operator cockpit** — Jason's control plane: conversations, pipeline, outbound approvals, eval scores, and **channel-ROI analytics** (so budget follows what converts). Reads B + events.

---

## 3. Sequencing (ROI-ranked for revenue)

**Phase 0 — Proof (P).** Un-defer it. Days, near-free. Unblocks everything. *(Drafting now, per Jason.)*

**Phase 1 — Procurement core (A + B + F).** The Scope Studio foundation. Live, closing inbound, persistence-ready. *(spec'd, ready for implementation plan.)*

**Phase 2 — Convert what arrives (C + H).** Nurture/closer + close→cash. The traffic you have starts turning into signed retainers and collected deposits.

**Phase 3 — Demand (G, incl. surgical D).** Acquisition engine: content rhythm + distribution + human-approved outbound. Now the funnel has fuel.

**Phase 4 — Compound (I + J).** Delivery pipeline + flywheel. Each delivery produces proof + referrals → feeds P and G. The machine starts feeding itself.

**Phase 5 — Steer (E).** Cockpit + channel-ROI. Spend follows leverage, not vibes.

**Rationale:** proof is free and gates all → do first. The procurement core is spec'd and half-built → finish it. Then make the traffic you *already* get convert and pay (cheap, high ROI) before spending to generate *more* traffic. Acquisition is the constraint but it's wasteful to scale traffic into a funnel that doesn't yet convert+collect. Delivery/flywheel compound once deals close. Cockpit last — you need data before a dashboard. Outbound is inside Phase 3 but gated on P + a proven inbound close.

---

## 4. Cross-cutting principles

- **Trust/humanity from line one** (F + §7.5) — on this brand, a robotic or dishonest AI surface is worse than none.
- **Human-in-the-loop on anything outward** (outbound, nurture sends, contracts) — the AI drafts; Jason approves. Scales one person without losing control or trust.
- **Cost discipline** — DeepSeek per-conversation is cents; the spend that matters is *acquisition* + Jason's *time*. Protect both. Qualify hard; async everything; batch.
- **Retainer-led** — every close pushes toward recurring; projects are the on-ramp.
- **Reuse, don't rebuild** — the site, docs, service pages, case studies, transform diagram engine, Atlas, eval harness, sage-kernel, Resend, and (new) Supabase are the parts. Assemble.

---

## 5. Budget-spend guidance (spend intelligently)

1. **~$0 — Proof (P):** your time + one client ask. Do it first.
2. **Low — Content/distribution (G):** your time + minimal tools; compounding organic.
3. **Cents/lead — AI funnel + nurture (A/C):** DeepSeek + Resend + Supabase free tiers.
4. **Only after inbound converts — Outbound (D):** a warm, low-volume, human-approved trickle; watch domain reputation.
5. **Avoid early:** paid ads (until the funnel provably converts + collects), heavy tooling, anything that doesn't move acquisition or close rate.

The trap: spending on the shiny middle (more funnel/nurture polish) while the *ends* (proof + acquisition + close→cash) stay open. Don't.

---

## 6. What's already live (don't rebuild)
Portfolio + docs site (Lighthouse 100), 30+ capability catalog, case studies (verified), ROI calc, Atlas AI associate (DeepSeek), transform scrollytelling, eval harness (llm-eval-gate), Resend lead capture, self-proving QA. The OS assembles on top of these.

---

## 7. Open strategic calls
- Retainer offer definition (what the $2.5–5k/mo quality-gate retainer includes) — needed before C/H push toward it.
- Which acquisition channel to lead with (content vs outbound vs a specific community).
- How hands-on Jason wants delivery vs. automated (affects I).
- Cockpit build-vs-buy (E) — custom vs. a light existing CRM.
