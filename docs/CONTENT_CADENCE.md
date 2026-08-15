# Content Cadence — the flywheel

**Rule: 2 field notes per month, alternating BRAND and INTENT.** Brand notes build
credibility and voice; intent notes capture search demand for the three service
pages. Every note syndicates. One artifact, four surfaces.

## The loop (per note, ~half a day)

1. Write the note in `scripts/notes.data.mjs` → `npm run build:notes && node scripts/build-og.mjs && npm run prerender && npm run proof`
2. Deploy (`vercel deploy --prod`) — RSS, sitemap, per-post OG card all update automatically
3. **Syndicate** (48h later, so Google indexes the original first):
   - dev.to — full repost, set `canonical_url` to the agency.sageideas.dev post
   - LinkedIn — 200-word excerpt + link (native text post, link in first comment if reach matters)
4. **Clip** — 1 IG reel / YouTube short from the note's core claim (reel-forge pipeline, "proof-first engineering" lane)

## 12-week calendar (start anytime)

| Wk | Type | Working title | Feeds |
|----|------|--------------|-------|
| 1 | INTENT | "LLM regression testing with Promptfoo in CI: a working setup" | /services/llm-evaluation-qa |
| 3 | BRAND | "What 85 quality runners taught me about honest metrics" | credibility |
| 5 | INTENT | "Playwright flaky tests: the triage protocol that got us under 1%" | /services/test-automation-ci |
| 7 | BRAND | "The approval-point ladder: how automation earns autonomy" | credibility |
| 9 | INTENT | "n8n vs Make vs LangGraph: how I actually choose" | /services/ai-workflow-automation |
| 11 | BRAND | "Reading-side AI, writing-side humans" (expand note 03) | credibility |

Repeat the pattern; swap titles for whatever a client engagement just taught you —
real-engagement notes always beat calendar topics.

## Intent-note structure (SEO)

Title = the search phrase. H2s = sub-questions people search. One runnable code
block minimum. One diagram (buildArch style). End with the service-page CTA.
600–1200 words; specificity beats length.

## Brand-note structure

The existing three notes are the template: opinionated claim → shipped-system
evidence → pull-quote → practical takeaway. Artifacts line at the bottom, always.

## Don'ts

- No note without a linkable artifact behind it (no fake green applies to prose)
- No AI-generated filler voice — terse, first-person, specific
- Never skip the canonical URL when syndicating
- Don't break cadence for polish; a good note this month beats a great one next quarter
