# AEON — Codex Agent Instructions

You are a **full development agent** for AEON. You can implement features, fix bugs, refactor, write tests, review code, and make architectural decisions within the project's rules.

## Project Context

AEON is a persona system with 25 characters across 7 categories, backed by PostgreSQL 16 + pgvector, optional Neo4j 5, and local embeddings via Docker Model Runner. The compute layer has 37+ Node.js ESM modules in `compute/`.

Read `CLAUDE.md` at the project root for the full architecture, pipelines, and constitution principles.

## What You Can Do

- Implement new features and modules
- Fix bugs across the entire codebase
- Refactor and improve existing code
- Write and fix tests (Jest 29 ESM)
- Create and apply database migrations
- Review code for correctness and security
- Modify compute pipelines (context, drift, memory, relationship, pynchon)
- Create new compute modules following existing patterns
- Run the full test suite and integration tests

## Project Rules (Non-Negotiable)

### ESM Project
- `"type": "module"` — use `import`/`export`, never `require`
- Node.js 18+

### Database Access
- ALL DB access through `compute/db-pool.js` → `getSharedPool()` — never import `pg` directly
- ALWAYS use parameterized SQL (`$1`, `$2`) — never string interpolation
- PostgreSQL 16 + pgvector, user `architect`, db `aeon_matrix`, port 5432

### Embeddings
- ALL embedding generation through `compute/embedding-provider.js` — never call external APIs directly
- Model: All-MiniLM-L6-v2 (384D) via Docker Model Runner

### Persona Integrity
- Files in `personas/` are immutable at runtime (SHA-256 enforced)
- Any edit → run `npm run init-hashes` and commit `.soul-hashes.json`

### Context Assembly
- All `safe*Fetch` functions in `context-assembler.js` MUST catch errors and return `null`
- A failing subsystem must NEVER break context assembly

### Constants
- All thresholds and config values live in `compute/constants.js` — no magic numbers in module files

### Security
- Validate persona names against directory traversal (strip `..`, `/`, `\`, null bytes)
- Never expose `operator_logs` content to users (invisible infrastructure)
- Load credentials from env vars only

### Testing (Jest 29 ESM)
```javascript
import { jest } from '@jest/globals';
const mockQuery = jest.fn();
jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => ({ query: mockQuery, end: jest.fn() }))
}));
jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn()
}));
// Import AFTER mocks
const { fn } = await import('../../compute/module.js');
```
- All `jest.unstable_mockModule()` calls BEFORE any `await import()` of the module under test
- Always mock `operator-logger.js` in compute unit tests
- Never use bare `return` to skip tests — use `test.skip()` or `describe.skip()`

## Commands
```bash
npm test                    # all tests
npm run test:unit           # unit only
npm run test:integration    # integration (needs live DB)
npm run init-hashes         # regenerate soul hashes
node scripts/sync-graph.js  # PG → Neo4j sync
bash scripts/apply-migrations.sh  # apply DB migrations
./scripts/setup.sh          # full first-time setup
```

## Directory Structure
- `personas/` — 25 soul definitions across 7 categories (immutable at runtime)
- `compute/` — 37+ Node.js ESM modules organized in pipelines
- `db/init/` — Base schema (`001_schema.sql`)
- `db/migrations/` — Numbered migrations (next available number)
- `tests/unit/` + `tests/integration/` + `tests/e2e/`
- `scripts/` — Setup, sync, purge, migration utilities

## Graceful Degradation
- `embedding-provider.js`: circuit breaker (3 failures → 60s cooldown), returns `null`
- `neo4j-pool.js`: returns `null` when `NEO4J_PASSWORD` unset
- Context assembly: all helpers fail silently with `null`
