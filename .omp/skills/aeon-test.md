---
name: aeon-test
description: Run tests and fix failures
input: optional module name or test file
---

Run tests for the specified module or all tests:

1. If module specified: `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/<module>.test.js`
2. If no module: `npm run test:unit`
3. For each failure:
   - Read the test file and the module it tests
   - Determine if the bug is in the test or the module
   - Fix the test if it's a test issue (stale mock, wrong assertion)
   - Report the module bug if it's a real bug (DO NOT fix production code without explicit approval)
4. Re-run to confirm fixes
