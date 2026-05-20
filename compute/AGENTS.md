# COMPUTE — Context Assembly Engine

42 flat JS modules. No subdirectories. Organized by naming-convention clusters, orchestrated through 3 sub-orchestrators + prompt builder that feed into one central hub.

## ARCHITECTURE

```
context-assembler.js (463 lines — CENTRAL HUB, orchestrates pipeline)
  ├── prompt-builder.js         → token budgeting, component ordering, memory truncation
  ├── drift-orchestrator.js     → soul-validator, soul-marker-extractor, drift-analyzer, drift-correction
  ├── memory-orchestrator.js    → memory-retrieval, persona-memory, preterite-memory, embedding-provider
  └── setting-orchestrator.js   → temporal-awareness, ambient-generator, entropy-tracker,
                                   zone-boundary-detector, they-awareness, counterforce-tracker,
                                   narrative-gravity, interface-bleed
```

### Foundation (imported by nearly everything)

| Module | Lines | Importers | Role |
|--------|-------|-----------|------|
| `db-pool.js` | 179 | 24/38 | Singleton PG pool. `getSharedPool()`, `getClient()`, `withTransaction()` |
| `operator-logger.js` | 309 | 29/38 | Fire-and-forget to `operator_logs`. Backoff after 5 DB failures → file fallback |
| `constants.js` | 717 | ~18/38 | ALL thresholds, budgets, config. ~60 exported objects |
| `persona-validator.js` | 64 | 6/38 | Rejects `..`, `/`, `\`, null bytes in persona names |
| `embedding-provider.js` | ~200 | 3/38 | Circuit breaker (3 fails → 60s cooldown). Returns `null` on failure |

### Module Clusters

| Cluster | Files | Entry Point |
|---------|-------|-------------|
| **Memory** | memory-extractor, memory-retrieval, memory-framing, persona-memory, preterite-memory | `memory-orchestrator.js` |
| **Drift** | drift-analyzer, drift-correction, drift-detection*, drift-dashboard | `drift-orchestrator.js` |
| **Setting** | setting-preserver, setting-extractor | `setting-orchestrator.js` |
| **Prompt** | prompt-builder | `context-assembler.js` → `prompt-builder.js` |
| **Relationship** | relationship-tracker, relationship-shaper, persona-relationship-tracker, persona-bonds | `context-assembler.js` directly |
| **Soul** | soul-validator, soul-marker-extractor | `drift-orchestrator.js` |
| **Pynchon Phase 1** | temporal-awareness, entropy-tracker, ambient-generator, zone-boundary-detector, preterite-memory | `setting-orchestrator.js` |
| **Pynchon Phase 2** | they-awareness, counterforce-tracker, narrative-gravity, interface-bleed | `setting-orchestrator.js` |
| **Graph** | graph-sync, graph-queries, neo4j-pool | `context-assembler.js` (fire-and-forget) |
| **Sandbox** | learning-extraction*, drift-detection* | Standalone scripts (read `process.env`, no imports) |

\* = standalone sandbox scripts with zero internal imports; may be V1 remnants.

## WHERE TO LOOK

| Task | File(s) | Notes |
|------|---------|-------|
| Add context layer | `context-assembler.js` + `prompt-builder.js` | Add safe*Fetch in assembler → add key to `COMPONENT_ORDER` in builder |
| Add Pynchon subsystem | New module + `setting-orchestrator.js` | Add safe*Fetch wrapper in orchestrator |
| Change drift scoring | `drift-analyzer.js` + `constants.js` | Thresholds in constants, algorithm in analyzer |
| Change memory retrieval | `memory-retrieval.js` | RRF hybrid search (keyword + embedding) |
| Add new config | `constants.js` | NEVER hardcode thresholds in module files |
| Debug assembly failures | `operator_logs` table | Every safe*Fetch logs success/failure silently |

## CONVENTIONS

### Prompt Assembly (COMPONENT_ORDER in prompt-builder.js)

New context layers must be added to the `COMPONENT_ORDER` array in `prompt-builder.js`. Order matters — components assemble top-to-bottom into the system prompt. Token budgeting and memory truncation are handled automatically.

### safe*Fetch Pattern (14 functions across 4 files)

Every optional subsystem is wrapped in a safe*Fetch that catches errors → returns `null`:

```javascript
async function safe<Name>Fetch(params) {
  try {
    const result = await subsystem.doWork(params);
    if (!result) return null;
    const framed = frameContext(result);  // Format for prompt injection
    logOperation('<name>_fetch', {...}).catch(() => {});
    return framed || null;
  } catch (error) {
    logOperation('error_graceful', { error_type: '<name>_failure' }).catch(() => {});
    return null;  // NEVER throw
  }
}
```

### Module Structure

```javascript
// 1. JSDoc header with @module tag
// 2. import getSharedPool from './db-pool.js'       (never pg directly)
// 3. import { logOperation } from './operator-logger.js'
// 4. import { THRESHOLDS } from './constants.js'
// 5. Internal getPool() helper
// 6. Named exports for public API
// 7. _underscore exports for test-only helpers
// ═══════════════════════════════════════════════ (section dividers)
```

### Error Handling

- `logOperation().catch(() => {})` — fire-and-forget, NEVER await in hot path
- Console errors: `[ModuleName] error description`
- Embedding failures: `generateEmbedding()` returns `null`, callers proceed without vectors

## ANTI-PATTERNS

- **Importing `pg` directly** — must use `getSharedPool()` from `db-pool.js` (ERROR)
- **Hardcoding thresholds** — must live in `constants.js` (WARNING)
- **Throwing from safe\*Fetch** — must catch and return `null` (WARNING)
- **Uppercase ARC_PHASES** — must be lowercase: `'rising'`, `'apex'`, `'falling'`, `'impact'` (WARNING)
- **Calling embedding APIs directly** — must go through `embedding-provider.js` (WARNING)
- **Awaiting logOperation in hot paths** — use `.catch(() => {})` pattern (WARNING)

## NOTES

- `prompt-builder.js` (129 lines) handles token budgeting, component ordering, and memory truncation — extracted from context-assembler.js
- `context-assembler.js` imports `../scripts/purge-settings.js` — intentional cross-layer for lazy setting cleanup
- `interface-bleed.js` is the only Pynchon module that does NOT import `db-pool.js` (pure logic + logging)
- `learning-extraction.js` and `drift-detection.js` are sandbox scripts with zero internal imports — V1 remnants
- `db-pool.js` self-heals on ECONNREFUSED: destroys pool, recreates on next `getSharedPool()` call
- Pool config: max=10 connections, idle timeout 30s, connect timeout 2s
