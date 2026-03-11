---
name: aeon-validate
description: Full validation pass — tests, hashes, schema, architecture rules
input: none
---

Run a complete validation of the AEON system. Fix issues where possible.

1. `npm run test:unit` — if tests fail, diagnose and fix
2. Check soul hashes match persona files — if stale, run `npm run init-hashes`
3. Verify migration numbering in `db/migrations/` is sequential
4. Grep for direct `pg` imports in `compute/` (should be zero) — fix any found
5. Grep for hardcoded magic numbers in `compute/` modules (should be in `constants.js`) — move them
6. Check `compute/constants.js` for TODO/FIXME markers — resolve or report

Report summary: PASS/FAIL per check, with details on what was fixed and what needs human input.
