---
pillar: how-to-tactical
hook: "The hardest question in AI automation isn't 'can the agent do it.' It's 'where does a human sign off.' Here's how I place that approval point."
cta_type: question
---

The hardest question in AI automation isn't "can the agent do it." It's "where does a human sign off." Get that placement wrong and you either bottleneck everything or ship an agent that quietly does damage. Here's how I decide.

I think of it as an approval ladder. An automated step earns more autonomy as it earns more trust — and the approval point sits at the height of the blast radius.

Two questions set the placement:

**1. Is the action reversible?** Drafting an email, tagging a record, generating a proposal — reversible. Let the agent run and review after. Sending money, deleting data, emailing a customer, merging to main — not reversible. A human approves before, every time, no exceptions.

**2. How confident is the step, measured?** Not vibes — a real signal. If the eval score on this action type is high and stable, the approval point moves later or samples a fraction. If it's shaky or new, every instance gets a human until the numbers earn the slack.

The failure mode I see most: teams put one approval gate at the very end, on everything, then remove it entirely once they get tired of clicking. Both extremes are wrong. The gate belongs on the irreversible, low-confidence actions — and nowhere the agent has already proven itself on reversible ones.

Autonomy is earned per action, not granted to the whole system.

Where's the one place in your workflow an agent should never act without a human?

## Why this works
Addresses the automation buyer directly (agents, workflows) with a decision framework they can apply today — reversibility × measured confidence. The "earned per action, not granted to the system" line is a reusable principle, and it surfaces Jason's second competency (workflow automation) without leaving the proof lane.
