# TESTS — Jest 29 + ESM

27 unit tests (mock everything), 2 integration (live DB), 1 e2e (full pipeline, mocked DB). All use `--experimental-vm-modules` for ES module support.

## STRUCTURE

```
tests/
├── unit/             # 27 files — 1:1 mapping to compute/ modules
│   ├── context-assembler.test.js    # Heaviest mock setup (20+ mocks)
│   ├── error-paths.test.js          # Cross-module resilience (986 lines)
│   ├── entropy-tracker.test.js      # Simplest template — copy this
│   └── ...                          # {module-name}.test.js
├── integration/      # 2 files — live PostgreSQL on port 5433
│   ├── graph-sync.test.js           # Neo4j conditional skip
│   └── setting-flow.test.js         # Full setting persistence
└── e2e/              # 1 file — complete invocation pipeline
    └── persona-invocation.test.js   # 3 personas, drift scoring, 350+ lines setup
```

## ESM MOCK PROTOCOL (CRITICAL — strict ordering)

```javascript
// PHASE 1: Import jest
import { jest } from '@jest/globals';

// PHASE 2: Create mock state BEFORE registering mocks
const mockQuery = jest.fn();
const mockPool = { query: mockQuery, end: jest.fn() };

// PHASE 3: Register ALL mocks (before ANY dynamic import)
jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool),
  getClient: jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn()
  })
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

// PHASE 4: Dynamic import AFTER all mocks
const { functionToTest } = await import('../../compute/module-under-test.js');
```

## TWO MANDATORY MOCKS (every compute unit test)

| Mock | Why | Level |
|------|-----|-------|
| `db-pool.js` | Prevent real DB connections | ERROR |
| `operator-logger.js` | Prevent transitive DB access via logging | WARNING |

## CONDITIONAL SKIP PATTERN (integration tests)

```javascript
// CORRECT — used in integration tests
const describeIfDb = dbAvailable ? describe : describe.skip;
describeIfDb('With Live Database', () => { /* ... */ });

// WRONG — produces phantom passes
if (!dbAvailable) return;
```

## COMMANDS

```bash
npm test                          # All tests
npm run test:unit                 # Unit only (no infra needed)
npm run test:integration          # Starts test DB first (port 5433)
npm run test:integration:teardown # Destroy test container

# Single file
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/drift-analyzer.test.js
```

## ANTI-PATTERNS

- **Static `import` of module under test** — bypasses all mocks. MUST use `await import()` after mock setup (ERROR)
- **Missing `operator-logger.js` mock** — causes transitive DB connection attempts (WARNING)
- **Bare `return` to skip tests** — phantom passes. Use `test.skip()` or `describe.skip()` (WARNING)
- **Importing `pg` in non-db-pool tests** — only `db-pool-errors.test.js` may mock `pg` directly (WARNING)

## NOTES

- Config is inline in `package.json` (no `jest.config.js`)
- Every `describe` block uses `jest.clearAllMocks()` in `beforeEach`
- `_underscore` exports in compute modules (`_resetState`, `_getState`) exist exclusively for test access
- `error-paths.test.js` (986 lines) tests resilience across 20+ modules — the most comprehensive mock file
- `persona-invocation.test.js` (e2e) mocks all DB but runs real pipeline logic across 3 personas
- For new tests: copy `entropy-tracker.test.js` as minimal template
