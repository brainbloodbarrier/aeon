---
name: aeon-validate
description: Full validation pass — tests, hashes, schema, types
input: none
---

Run a complete validation of the AEON system:

1. `npm run test:unit` — report failures
2. Check soul hashes: `node -e "import('./compute/soul-validator.js').then(m => m.validateAllPersonas().then(console.log))"` or compare hashes manually
3. Verify migration numbering in `db/migrations/` is sequential
4. Grep for direct `pg` imports in `compute/` (should be zero)
5. Grep for `process.env` usage outside approved locations
6. Check `compute/constants.js` for any TODO/FIXME markers

Report a summary: PASS/FAIL per check, with details on failures.
