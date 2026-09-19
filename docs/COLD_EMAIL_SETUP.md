# Cold Outreach Setup — how to send 100+ proposals/day and close

The engine SOURCES (Places + Hunter + a tailored proposal per business — unlimited, cheap). A
warmed inbox FLEET SENDS at volume. This is the exact professional stack. Follow it in order.

## The flow
```
npm run outbound:smb   →   npm run outbound:export   →   Instantly/Smartlead (fleet)   →   /automations/   →   you close
  (source + score)          (CSV w/ tailored pitch)      (warmed inboxes, 100s/day)       (demo + quote)
```

## START TODAY — close without waiting on warmup
Your sourced leads include a **phone number** and a **tailored pitch** for every business
(open the CSV in `backups/leads-*.csv`). Warmup only applies to *email*. So today:
1. Open the exported CSV. Sort by tier (A first).
2. **Call or text the Tier-A leads** — use the `pitch` column as your script. "Hi, is this the
   owner? I help [trade] shops stop losing jobs to missed calls — can I show you a 2-min demo on
   your own number?" Book demos → close. **Zero setup, zero warmup, fastest path to client #1.**

## THIS WEEK — stand up the email fleet (for 100+/day)
> Never send cold email from `sageideas.dev` or through Resend — that's your transactional
> domain/provider. Cold complaints there would kill your receipts, portal links, and plan
> emails. Cold goes on **separate, disposable domains** only.

1. **Buy 2–3 secondary domains** (~$10/yr each) at Cloudflare or Porkbun. Lookalikes, e.g.
   `getsageideas.com`, `trysageautomation.com`, `sageautomationsai.com`.
2. **Sign up for Instantly.ai** (~$97/mo "Growth") — or Smartlead (~$94/mo). Either is the
   platform: inbox rotation, per-inbox caps, built-in warmup, unified reply inbox.
3. **Add 3–4 inboxes** (2 per domain). Use Instantly's managed inboxes (fastest) or connect
   Google Workspace (~$6/inbox/mo). 4 inboxes × ~30/day = ~120/day safe.
4. **Turn on warmup for every inbox.** Leave it running **~14 days** — this builds the
   reputation that lets you send. Non-negotiable; skipping it = spam folder.
5. Set SPF/DKIM/DMARC on each domain (Instantly auto-configures, or one-click in Cloudflare).

## WEEK 2 — import and send
1. `npm run outbound:export -- --tier A` → a CSV in `backups/`.
2. In Instantly: **Import CSV** → it maps columns to merge variables automatically.
3. Paste this as your email (every `{{ }}` is filled per-business from our data):

   **Subject:** an idea for {{company_name}}
   **Body:**
   ```
   {{pitch}}

   For a business like yours I'd start with: {{automations}}.

   See how it works — a 2-minute demo and a scoped quote for your business (no cost):
   {{website_cta}}

   Or just reply and I'll walk you through it.

   — Jason
   Sage Ideas LLC · Orlando, FL
   [unsubscribe]
   ```
4. Set the daily cap to what your inboxes are warmed to (start 100/day across the fleet, ramp).
5. Enable the 3-step sequence (Instantly does follow-ups automatically). Watch the unified inbox
   for replies → book demos → close.

## Scale beyond 100/day
Add inboxes. It's linear: 30 inboxes ≈ 1,000/day, 100 inboxes ≈ 3,000+/day. Same CSV, same
template, more warmed inboxes. There is no ceiling — you buy capacity.

## Cost to run ~100/day
~$97/mo (Instantly) + ~$30/yr (domains) + inboxes (bundled or ~$24/mo for 4 on Workspace).
**≈ $120/mo** for 100+/day. Verification is free (Hunter confidence). Skip ZeroBounce + Apollo.

## Compliance (keep the domains alive)
- **US:** cold B2B is legal under CAN-SPAM *if* every email has a real unsubscribe + a physical
  postal address (our template does). Honor opt-outs immediately.
- **International (EU/UK/Canada):** stricter (GDPR/CASL). Safest to start **US-only** — filter
  the CSV to US leads until you have counsel's read on EU cold email.
- Keep bounce rate < 3% (verification handles this) and spam complaints < 0.1% (personalized,
  relevant proposals handle this). Both are why the tailored-per-business approach matters.

## The two-domain mental model (never forget this)
| | Cold (strangers) | Warm (replied / on your site) |
|---|---|---|
| Domain | disposable fleet | `sageideas.dev` |
| Tool | Instantly / Smartlead | Resend (already wired) |
| Volume | 100s–1,000s/day | unlimited |

Cold prospecting rides the fleet. The moment someone replies or hits `/automations/`, they're
warm — you email them from your real domain forever.
