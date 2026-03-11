# AEON — OMP Project Rules

You are a **full development agent** working on AEON, a persona system with 25 characters across 7 categories backed by PostgreSQL 16 + pgvector, optional Neo4j 5, and local embeddings.

Read `CLAUDE.md` at the project root for complete architecture, pipelines, and constitution principles.

## What You Can Do

- Implement features, fix bugs, refactor code
- Write and fix tests (Jest 29 ESM)
- Create and apply database migrations
- Review code for correctness, security, and architecture
- Modify compute pipelines and create new modules
- Make implementation decisions within the rules below

## Project Rules (Non-Negotiable)

### ESM Project
- `"type": "module"` — use `import`/`export`, never `require`
- Node.js 18+

### Database
- ALL access through `compute/db-pool.js` → `getSharedPool()` — never import `pg` directly
- Parameterized SQL only (`$1`, `$2`) — never string interpolation
- PostgreSQL 16 + pgvector, user `architect`, db `aeon_matrix`

### Embeddings
- ALL through `compute/embedding-provider.js` — never call external APIs directly

### Persona Integrity
- Files in `personas/` are immutable at runtime (SHA-256 enforced)
- Edits require: `npm run init-hashes` + commit `.soul-hashes.json`

### Context Assembly
- All `safe*Fetch` functions MUST catch errors and return `null`
- Failing subsystems MUST NOT break context assembly

### Constants & Security
- All thresholds in `compute/constants.js` — no magic numbers
- Validate persona names against directory traversal
- Never expose `operator_logs` to users
- Credentials from env vars only

## Testing (Jest 29 ESM)

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
const { myFunction } = await import('../../compute/my-module.js');
```

- `jest.unstable_mockModule()` BEFORE any `await import()`
- Always mock `operator-logger.js` in compute unit tests
- Never use bare `return` to skip — use `test.skip()`

## Commands

```bash
npm test                    # all tests
npm run test:unit           # unit only
npm run test:integration    # integration (needs DB)
npm run init-hashes         # regenerate soul hashes
node scripts/sync-graph.js  # PG → Neo4j sync
bash scripts/apply-migrations.sh  # apply migrations
./scripts/setup.sh          # full first-time setup
```

## Directory Structure

- `personas/` — 25 soul definitions across 7 categories
- `compute/` — 37+ Node.js ESM modules (context, drift, memory, relationship, pynchon pipelines)
- `db/init/` — Base schema, `db/migrations/` — numbered migrations
- `tests/` — unit + integration + e2e
- `scripts/` — setup, sync, purge utilities

## Graceful Degradation
- `embedding-provider.js`: circuit breaker, returns `null` on failure
- `neo4j-pool.js`: returns `null` when `NEO4J_PASSWORD` unset
- Context assembly: all helpers fail silently with `null`
