# Outbound Targeting — closeability ranking + ICP

Two lanes run in parallel:
- **Lane A — SMB AI automation** (AI front desk / missed-call text-back / booking / review
  automation). High volume, sourced via **Google Places**. Ranked below.
- **Lane B — AI product eval/QA** (the site's existing offer). Lower volume, higher ticket,
  sourced via **Apollo** (B2B/tech decision-makers). ICP in `icp-ai-product.json`.

The ranking below is Lane A. It's ordered by **likelihood to close a retainer**, which is a
product of: (1) how much a missed call/lead actually costs them, (2) how fast the owner
decides, (3) how underserved they are by existing tech, (4) retainer budget, (5) friction
(compliance, incumbents). Restaurants/retail rank last despite huge volume — thin margins and
low ticket make them the worst retainer customers, so we don't lead with them.

## Closeability ranking (lead here → down)

### Tier 1 — highest close rate (start here)
**1. Home services** — plumbing, HVAC, electrical, roofing, garage doors, water/fire
restoration, pest control.
- *Why they close:* a missed call = a lost job worth $200–$5,000; emergencies happen
  after-hours when nobody answers; owners are the decision-maker and decide in one call; the
  category is underserved by software. An AI front desk that answers 24/7 and books the job
  has an ROI you can state in one sentence. **This is the single best SMB vertical for us.**
- *Search seeds:* `plumber`, `HVAC contractor`, `electrician`, `roofing contractor`,
  `garage door repair`, `water damage restoration`, `pest control` × target metros.
- *Hook:* "How many after-hours calls went to voicemail last month? Each one was a job."

**2. Legal — solo & small firms** — personal injury, family, criminal, immigration, estate.
- *Why they close:* a single intake is worth thousands; they already spend heavily on
  marketing, so a lost intake call is a lit-money-on-fire moment they feel; small/solo firms
  have no 24/7 receptionist. Target **1–10 attorney** firms (bigger ones have front-desk staff).
- *Search seeds:* `personal injury attorney`, `family law firm`, `criminal defense attorney`,
  `immigration lawyer` × metros. Filter to smaller firms (low review counts, single location).
- *Hook:* "Your marketing pays for the call. Missing it wastes the whole spend."

### Tier 2 — strong, slightly more friction
**3. Med spas & cash-pay clinics** — med spas, aesthetics, chiropractic, dental (cash-pay),
cosmetic, wellness/IV clinics.
- *Why they close:* high ticket per client, booking-driven, review-sensitive. Med spas are the
  sweet spot — cash-pay (no insurance friction), marketing-savvy owners.
- *Friction:* general medical/dental carries **HIPAA** + entrenched practice-management
  systems — real but navigable. Lead with med spas / cash-pay to sidestep it.
- *Search seeds:* `med spa`, `aesthetics clinic`, `chiropractor`, `cosmetic dentist`,
  `IV therapy clinic` × metros.
- *Hook:* "Every missed booking is a $300–$2,000 appointment that went to a competitor."

**4. Other local services** — auto repair, cleaning, moving, locksmith, landscaping, appliance
repair, towing.
- *Why they close:* same missed-call economics as home services, slightly lower ticket.
- *Search seeds:* `auto repair shop`, `cleaning service`, `moving company`, `locksmith`,
  `landscaping company` × metros.

### Tier 3 — workable but not the opener
**5. Fitness / wellness / salons** — gyms, studios, salons, spas, barbershops.
- Mid ticket, decent volume, but more price-sensitive and often have booking apps already.

### Tier 4 — deprioritize (volume trap)
**6. Restaurants / local retail** — thin margins, low ticket, high churn, price-sensitive.
Big volume, worst retainer economics. Don't lead here; revisit only for a productized, cheap
tier later.

## How to run it
- **Geography:** start with 2–3 metros you can speak to (or nationwide by vertical). More
  metros × more verticals = more volume, but keep sends deliverability-safe (~30–100/day/domain).
- **Score bias:** the AI-scorer (`lib/lead-score.mjs`) and the Places signals let us prefer
  businesses that (a) have a website (enrichable email) and (b) show signs of being busy but
  under-staffed (high review count = lots of customers, but a small single location).
- **The "no website" cut:** businesses with a phone but **no website** are often the *best*
  automation prospects (they're behind on tech) — but they need phone/SMS outreach, not email.
  The sourcer flags them separately so you can hand them to a call/text motion.

## Priority order to actually send
Home services → solo legal → med spas → other local services → (later) fitness/salons →
(maybe never) restaurants. Start Tier 1 in your first metro, prove the offer, then widen.
