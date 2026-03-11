---
name: aeon-test
description: Run tests, diagnose failures, and fix them
input: optional module name or test file
---

Run tests and fix failures:

1. If module specified: `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/<module>.test.js`
2. If no module: `npm run test:unit`
3. For each failure:
   - Read the test file and the module it tests
   - Determine if the bug is in the test or the module
   - Fix the test if it's a test issue (stale mock, wrong assertion, import order)
   - Fix the module if it's a real bug
4. Re-run to confirm all pass
5. If new tests are needed for uncovered code paths, write them
