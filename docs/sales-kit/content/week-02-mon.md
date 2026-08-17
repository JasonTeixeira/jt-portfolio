---
pillar: proof-story
hook: "One of my published lessons taught a factually false error. It survived review by six people. It got caught the moment one of them ran the code."
cta_type: soft-link
---

One of my published lessons taught a factually false error. It survived review by people reading it carefully. It got caught the moment someone actually ran the code.

I'd shipped 34 technical lessons and wanted them airtight, so I pointed an audit gauntlet at them: 18 reviewers in three roles — 6 auditors executing every code claim, 6 rewriters fixing what broke, 6 independent verifiers confirming the fix.

They found 73 defects. Seventeen were critical or high. But one still bothers me.

A lesson claimed a snippet would throw a NameError. Reasonable-sounding. Wrong. That code doesn't raise a NameError — it dies earlier with a SyntaxError, before the name is ever evaluated. Every reviewer who read the explanation nodded along, because it sounded right. The only reason it got caught is that an auditor ran it and watched the actual traceback come back different.

That's the entire lesson of my work in one bug. Reading tells you what sounds correct. Executing tells you what is correct. They are not the same skill, and for AI-generated content the gap between them is where the confidently-wrong answers live.

All 34 lessons were re-verified to a 95-plus bar before anything went back out. I wrote up the false-error catch in full — it's the clearest example I have of why "looks right" is not a test.

The write-up is public: agency.sageideas.dev/notes/eighteen-agent-audit-gauntlet.html

## Why this works
A specific, technical, self-critical story (my own lesson was wrong) that doubles as the core thesis: reading vs executing. The NameError-vs-SyntaxError detail is precise enough that only someone who actually does this could have written it.
