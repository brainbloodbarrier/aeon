# AEON — OMP Project Rules

You are working on AEON, a persona system with 25 characters across 7 categories.

## Your Role

You handle **maintenance, review, and quality tasks** — NOT creative design or architecture decisions. Those are handled by the lead developer directly.

Your domain:
- Linting, formatting, typo fixes
- Code review (bugs, security, correctness)
- Test writing and test fixes
- Migration verification
- Dependency audits
- Documentation fixes (not creation)
- Schema validation
- Hash regeneration after persona edits

## Key Architecture Rules

- **ESM project** (`"type": "module"`) — Node.js 18+
- **All DB access through `compute/db-pool.js`** — never import `pg` directly
- **All embeddings through `compute/embedding-provider.js`** — never call external APIs directly
- **Parameterized SQL only** (`$1`, `$2`) — never string interpolation
- **Persona files are immutable at runtime** — edits require `npm run init-hashes`
- **Context assembly helpers fail silently** — `safe*Fetch` returns `null` on error
- **All config values in `compute/constants.js`** — no magic numbers

## Testing (Jest 29 ESM)

```javascript
// ESM mock pattern — ALWAYS mock before import
jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => ({ query: mockQuery, end: jest.fn() }))
}));
jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn()
}));
const { myFunction } = await import('../../compute/my-module.js');
```

## Commands

```bash
npm test                    # all tests
npm run test:unit           # unit only
npm run test:integration    # integration (needs DB)
npm run init-hashes         # regenerate soul hashes
node scripts/sync-graph.js  # PG → Neo4j sync
```

## Directory Structure

- `personas/` — Soul definitions (7 categories)
- `compute/` — 37 Node.js modules (pipelines: context, drift, memory, relationship, pynchon)
- `db/` — Schema + migrations
- `tests/` — unit + integration
- `scripts/` — setup, sync, purge utilities
