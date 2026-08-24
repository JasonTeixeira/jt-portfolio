# SDD ledger — plan: docs/superpowers/plans/2026-08-23-client-portal-contracts.md
Pre-flight: clean. Linear: T2 contract-core + T3 portal-db → T4/T5 endpoints → T6/T7 pages → T8 admin → T9 webhook → T10 docs. Mirrors Plan 5 (proposal-*). All imports map (proposal-core exports publicId/money; scope-core computePlan/CARD_BY_KEY). Money-safety: client approves delivered-only + can't set amounts.
Base: 3c578c5.
Task 1: complete — 6219e02
Task 2: complete — cbc6942 (contract-core; unused CARD_BY_KEY import = lint warning, clean in T10)
Task 3: complete — a8fd569 (portal-db)
105 pass.
Task 4: complete — b277fb7 (contract endpoints)
Task 5: complete — 2940777 (portal+milestone endpoints; clientView whitelist + membership guard)
119 pass.
Task 6: complete — 82295b7 (client portal, premium timeline)
Task 7: complete — be558c4 (contract view+accept, print-clean; small additive accepted_at whitelist on api/contract.js GET)
119 pass.
Task 8: complete — 90541f4 (admin contract-gen + milestone editor; +getProjectByProposalId; contract-generate returns id too)
Task 9: complete — 45c607f (webhook portal-link email)
119 pass.
Task 10: complete — 5e1f76a (docs/PORTAL.md + SYSTEM.md + smoke + CARD_BY_KEY cleanup). 119 unit, lint 0 err, smoke 74 passed.
ALL TASKS DONE. Dispatching final security+quality review.
