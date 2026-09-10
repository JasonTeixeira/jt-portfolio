# GA4 Funnel & Conversion Setup — agency.sageideas.dev

Both the agency and the Academy now report to the **same GA4 property (`G-PS7LKSEGVW`)**.
The agency's `assets/ga.js` also routes the site's own `va()` funnel events into GA4, so you can
build a real conversion funnel — not just pageviews. This is a 15-minute one-time setup in the GA4 UI.

## 1. Confirm events are arriving
GA4 → **Admin → DebugView** (or **Reports → Realtime**). Load `agency.sageideas.dev`, click around
(open the tour, scope a project). You should see `page_view` plus the custom events below.

## 2. The events the agency fires (your funnel milestones)
These land in GA4 as custom event names (hyphenated — GA4 accepts them):

| Funnel stage | Event name(s) | Fires when |
|---|---|---|
| **Land** | `page_view` | any page load (automatic) |
| **Engage** | `welcome-shown`, `welcome-tour-start`, `tour-finished`, `atlas-open`, `atlas-msg` | greeter shown, tour started/finished, AI associate opened/messaged |
| **Scope** | `started`, `plan_built`, `proposal_written` | Scope Studio: began, built a plan, generated an AI proposal |
| **Capture** | `contact-submit` | any contact / lead-audit form submitted (a real lead) |
| **Book intent** | `book-call`, `tldr-book`, `svc-fractional`, `fd-hero-book`, `cs-book`, `eval-audit-book` | any "book a call" CTA clicked |
| **Mini-eval** | `eval-audit-mini-eval`, `atlas-lead-` | free work-sample requested |

(Full list: grep `data-evt` / `va(` / `track(` in the repo.)

## 3. Mark your conversions (Key Events)
GA4 → **Admin → Events** (or **Key events**). Toggle these ON as **Key events** so they show as
conversions and can anchor reports:
- `contact-submit` — a captured lead (the money event)
- `book-call` — booked-call intent
- `proposal_written` — engaged, high-intent
- `plan_built` — scoped (mid-funnel)

## 4. Build the funnel (see where deals drop)
GA4 → **Explore → Funnel exploration → blank**. Add steps in order:
1. `page_view`
2. `welcome-tour-start` **OR** `atlas-open` **OR** `started` (any engagement — set the step to "OR")
3. `plan_built`
4. `proposal_written`
5. `book-call` **OR** `contact-submit`

Turn on **"Make open funnel"** so people can enter at any step. The drop-off between steps tells you
exactly where to focus: if lots of `page_view` but little `welcome-tour-start`, the hook is weak; if
lots of `plan_built` but little `book-call`, the close/CTA is weak.

## 5. Split agency vs school
Everything's in one property. To separate the two sites, add a **secondary dimension = `Hostname`**
(or filter) in any report: `agency.sageideas.dev` vs `www.sageideas.dev`. Or, for a permanent split,
create two **Comparisons** (one per hostname) and pin them.

## 6. What to watch weekly (ties to the Win/Loss loop)
- **Top drop-off step** in the funnel → that's this week's fix.
- `contact-submit` and `book-call` counts → your actual lead flow (should rise once outbound runs).
- Landing pages with high `page_view` but low engagement → tighten the hook.

That's it. No code changes needed — the events already fire; this is pure GA4 configuration.
