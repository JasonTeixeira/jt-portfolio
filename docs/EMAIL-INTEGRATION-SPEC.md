# Email integration — scope (not yet built)

**Goal (Jason's words):** "the CRM connects to my emails and sends me notifications."

Today the system is **outbound-only** (Resend): it emails *you* on new lead / contact
form / client message / deposit / balance / contract-signed / milestone-approved, and
emails *clients* receipts and links. It does **not** read your inbox or thread email
against a prospect. This doc scopes the "connect to my inbox" half as its own project.

## What "connect to my emails" actually means — three levels

| Level | What it does | Effort | Verdict |
|---|---|---|---|
| **A. Log outbound against the client** | Every email the system sends is recorded on the prospect/client timeline (threaded history in the 360). | Small — reuses Resend + existing `scope_events`. | **Do this first.** Real value, no OAuth, no inbox access. |
| **B. Capture replies (forward-to-parse)** | You (or a Gmail filter) auto-forward client replies to a dedicated address → a webhook parses them → logged against the prospect by matching the from-address. | Medium — an inbound-email webhook (Resend Inbound, or a Postmark/Mailgun inbound route) + a parser + prospect-match. No Google OAuth. | **Do this second** if you want reply capture without full sync. |
| **C. Full 2-way Gmail sync** | Read your inbox via the Gmail API (OAuth), thread messages to prospects, send from your Gmail, real-time push via Gmail watch + Pub/Sub. | **Large** — Google OAuth consent screen + verification, token storage/refresh, Gmail API quotas, Pub/Sub push, dedupe, a full thread model. Security-sensitive (your whole inbox). | **Defer.** Only worth it at real client volume. |

## Recommended path
1. **Level A now** (when we build it): on every `sendClient`/`sendOperator` about a
   known prospect, append a `scope_events` row (`type:'email_out'`, subject, to) so the
   360 hub shows a real email history. ~half a day.
2. **Level B when replies matter:** stand up an inbound webhook (`/api/inbound-email`),
   verify the provider signature, match the sender to a `scope_prospects.email`, append
   `type:'email_in'`. Add a Gmail filter that forwards `*@clientdomains` to the inbound
   address. ~1–2 days.
3. **Level C only at scale:** a separate, security-reviewed Gmail-OAuth project. Not
   before there's real volume — reading your whole inbox is a large attack surface for
   a business with, today, zero clients.

## Data model (Levels A/B)
Reuse `scope_events`: `{ prospect_id, type: 'email_out'|'email_in', meta: { subject, to|from, snippet } }`.
The 360 timeline already renders events — email threads appear inline with touches/stages.

## Notifications (already exist)
You're already emailed on: new lead, contact form, client message, deposit paid,
balance paid, contract signed, milestone approved. Level B would add "client replied."

## Honest note
This is ops-tooling, downstream of demand. Level A is a cheap real win; B is worth it
once you're actually running outreach and getting replies; C is premature today.
