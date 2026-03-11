---
name: aeon-review
description: Review and fix issues in recent changes against AEON coding rules
input: optional diff range or file list
---

Review the current git diff (or specified range) against AEON coding rules. Fix what you can, report what needs discussion.

1. **Security**: directory traversal in persona paths, exposed operator_logs, SQL injection, hardcoded creds
2. **Correctness**: SQL function signature mismatches, unchecked return shapes, uppercase ARC_PHASES
3. **Architecture**: direct `pg` imports (must use db-pool.js), direct embedding API calls, hardcoded magic numbers
4. **Testing**: mocks before imports, operator-logger mocked, no bare returns

Run `git diff` first. For each issue:
- If fixable without changing behavior: fix it
- If requires design decision: report file, line, rule, severity, and recommended approach
- Run `npm run test:unit` after fixes to verify
