---
title: The day my own quality gate blocked me
published: true
canonical_url: https://agency.sageideas.dev/notes/gate-blocked-me.html
tags: testing, ai, devops, cicd
---

At 11:39 this morning I ran the proof loop on my own QA platform — the 85-runner system my portfolio leans on for credibility — and it told me no. `VERDICT: NOT PROVEN ✗ — 12/13 gates`. Fifteen high and critical CVEs had drifted into production dependencies while I was busy shipping features. The gate did exactly what I built it to do: it blocked me.

The honest move mattered more than the fix. I could have quietly patched and nobody would ever have known the red run existed. Instead it's [published verbatim](https://agency.sageideas.dev/captures/nexural-qa-os.html) — because a portfolio that only shows green runs is indistinguishable from a portfolio that fakes them.

The fix took one focused hour: nine dependency floors in `pnpm.overrides`. Eight were routine bumps. The ninth was the interesting one — an *unpatchable* advisory in a transitive dependency (extract-zip, no fixed version exists) that died only because its parent package had replaced it entirely two majors ago. Audit went from 27 vulnerabilities to 2 low. The [14:35 rerun](https://agency.sageideas.dev/captures/nexural-qa-os-fixed.html): `PROVEN ✓ — 13/13`.

> A gate that never fires isn't discipline. It's decoration.

This is the whole argument for gates over dashboards. A dashboard would have shown me a number drifting in a tab I stopped opening in March. The gate stopped the line. Drift got caught the day it mattered, fixed inside the same working day, and the evidence trail — red run, diff, green run — needs no narrative because you can read it yourself.

If your LLM feature or release pipeline has no gate that can tell *you* no, that's the gap I close: https://agency.sageideas.dev
