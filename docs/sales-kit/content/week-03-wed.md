---
pillar: how-to-tactical
hook: "The golden set is the most important part of your LLM eval, and most teams fill it with the wrong examples. Here's what actually belongs in it."
cta_type: repo-link
---

The golden set is the most important part of your LLM eval, and most teams fill it with the wrong examples. Here's what actually belongs in it.

A golden set is the fixed collection of inputs you check every version of your feature against. Get it right and it catches regressions for years. Get it wrong and it passes everything while your users hit walls.

The mistake is loading it with easy, representative cases — the happy path you already know works. That set will stay green forever and tell you nothing. A good golden set is built from where things break:

- **Real failures.** Every time the feature gets something wrong in production, that input becomes a permanent test case. This is your highest-value source. Mine your bug reports and support tickets.
- **Edge inputs.** Empty input, huge input, wrong language, adversarial phrasing, the prompt-injection attempt. The stuff that makes a demo look bad.
- **The boring middle.** A handful of ordinary cases so you notice if a fix for the edges quietly breaks the common path.
- **Known-hard categories.** The two or three input types your feature has always struggled with. Track them explicitly.

Rule of thumb: if adding a case can't fail, it doesn't belong yet. Every entry should represent a way the feature could realistically be wrong.

Thirty of those beats three hundred happy-path samples. Start small, and grow it every time production teaches you something new.

I wired a starter golden set into a public repo if you want a concrete shape to copy → github.com/JasonTeixeira/llm-eval-gate

## Why this works
Actionable and specific — the "if it can't fail, it doesn't belong" heuristic is a portable rule the reader will remember and repeat. Positions the golden set as an ongoing discipline (mine production), which is exactly the recurring work Jason sells, and routes to the free repo.
