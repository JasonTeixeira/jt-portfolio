---
pillar: contrarian-educational
hook: "No fake green. If your CI is passing but nobody trusts it, you don't have tests — you have theater."
cta_type: question
---

No fake green.

If your pipeline is passing but nobody on the team actually trusts it, you don't have tests. You have theater. And LLM features attract theater like nothing I've seen.

Here's how fake green happens. Someone wraps the AI feature in a test that asserts the response isn't empty. Or that it's valid JSON. Or that it contains the word "yes." All pass. All green. None of them check whether the answer is right. The dashboard says healthy while the feature ships nonsense, and everyone points at the green checkmark.

The tell is simple: ask "if this feature broke in the way our users would actually notice, would a test go red?" If the honest answer is no, the green is fake. It's measuring that the code ran, not that it worked.

This is worse than having no tests, because it manufactures false confidence. A team with no tests knows it's flying blind. A team with fake green thinks it's covered and ships faster into the wall.

Real green is uncomfortable. It means writing checks that can actually fail — that go red when the output is fluent and wrong, not just when the service is down. It means a golden set built from real failures, and judges that execute instead of skim.

Green should mean "we proved it works," not "nothing crashed."

Look at your last passing build: would it have caught the failure your users would care about most?

## Why this works
"No fake green" is a memorable, quotable brand phrase that ties the whole account together. The "would a test go red if it broke the way users notice?" test is a single sharp question the reader can't un-see. Confronts the reader's own suite without naming or pitching.
