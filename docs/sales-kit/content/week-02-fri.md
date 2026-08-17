---
pillar: contrarian-educational
hook: "An agent that grades your AI by reading it tells you what sounds right. One that grades by executing tells you what is right."
cta_type: question
---

An agent that grades your AI output by reading it tells you what sounds right. One that grades by executing tells you what is right. Most eval setups do the first and call it done.

This distinction is quietly costing teams a lot.

Say your feature generates code, a SQL query, a config, an API call — anything with a runtime. The common eval is: another model reads the output and scores it against a rubric. Clean, fast, cheap. And it will happily pass output that is fluent, well-structured, and completely broken. Because reading only checks whether it looks like a correct answer.

Executing checks the truth. Run the generated code and see if it throws. Run the query and see if it returns rows. Hit the endpoint and read the actual status. The output either survives contact with reality or it doesn't, and no amount of confident phrasing saves it.

I've watched a review pass a snippet that "clearly" raised one error when it actually died with a different one entirely — caught only because someone ran it. Reading graders don't catch that class of bug. They can't. They're evaluating plausibility, not correctness.

Use reading-based judges where the output is genuinely subjective — tone, summarization, helpfulness. But anywhere the output has a runtime, execute it. Plausible and correct are different words for a reason.

Which of your evals actually run the output, and which just read it?

## Why this works
Sharpens the reading-vs-executing thesis into a tactical distinction the reader can immediately apply to their own stack. The question forces a self-audit. Reinforces Monday's proof story without repeating it.
