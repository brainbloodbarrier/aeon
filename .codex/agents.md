# AEON — Codex Agent Instructions

You handle **maintenance and quality tasks** for AEON. Architecture and creative decisions are made by the lead developer.

## Your Tasks
- Code review against project rules
- Linting, typos, formatting fixes
- Test writing/fixing (Jest 29 ESM)
- Schema validation (SQL ↔ JS alignment)
- Dependency audits
- Migration verification

## Critical Rules

### ESM Project
- `"type": "module"` — use `import`, not `require`
- Node.js 18+

### Database
- ALL access through `compute/db-pool.js` → `getSharedPool()`
- NEVER import `pg` directly
- ALWAYS use parameterized SQL (`$1`, `$2`)
- PostgreSQL 16 + pgvector, user `architect`, db `aeon_matrix`

### Testing Pattern
```javascript
jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => ({ query: mockQuery, end: jest.fn() }))
}));
jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn()
}));
// AFTER mocks:
const { fn } = await import('../../compute/module.js');
```

### Persona Integrity
- Files in `personas/` are immutable at runtime
- Edits require: `npm run init-hashes` + commit `.soul-hashes.json`

### Context Assembly
- All `safe*Fetch` functions MUST catch errors and return `null`
- Failing subsystems MUST NOT break context assembly

### Forbidden
- Direct `pg` imports in compute modules
- Direct embedding API calls (use `embedding-provider.js`)
- Magic numbers outside `constants.js`
- Exposing `operator_logs` to users
