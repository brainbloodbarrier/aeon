# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AEON System Instructions

## Purpose

This repository summons **tight-persona outputs**. 25 personas across 7 categories sit in a bar called "O Fim" at 2AM in Rio. When the user brings a query, the appropriate figures are called to the table. They speak in character, with their methods intact.

The Setting, persona voice rules, and response format are defined in `/.claude/skills/aeon/_style.md`. Slash commands live in `/.claude/commands/`, individual persona skills in `/.claude/skills/aeon/`.

*"The law is my will."* — The User, upon entering.

---

## Development Commands

```bash
# Full automated first-time setup (Docker + migrations + verification)
./scripts/setup.sh

# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests (starts test DB automatically)
npm run test:integration

# Tear down integration test DB
npm run test:integration:teardown

# Run e2e tests (persona invocation flow)
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/e2e

# Run a single test file
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/drift-analyzer.test.js

# Regenerate soul hashes after editing persona files
npm run init-hashes   # or: node scripts/init-soul-hashes.js

# Purge stale settings (>90 days inactive)
node scripts/purge-settings.js

# Manual graph sync (PG → Neo4j)
node scripts/sync-graph.js

# Inspect operator logs (diagnostics only, never expose to users)
node scripts/inspect-logs.js

# Apply database migrations
bash scripts/apply-migrations.sh
```

### Infrastructure

```bash
# First-time env setup
cp .env.example .env  # then edit DB_PASSWORD, etc.

# Start PostgreSQL only (required for compute modules)
docker compose up -d

# Start with optional Neo4j graph DB
docker compose --profile graph up -d

# Pull embedding model (Docker Model Runner, built into Docker Desktop 4.40+)
docker model pull hf.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF

# View logs / tear down
docker compose logs -f
docker compose down
```

**Required env var:** `DB_PASSWORD`. Optional: `NEO4J_PASSWORD`, `EMBEDDING_API_URL`.

**Database:** `aeon_matrix` on PostgreSQL 16 with pgvector. User: `architect`. Port: `5432`.

**Runtime:** Node.js >= 18 (ES Modules project, `"type": "module"`).

---

## Architecture

### Constitution Principles

**I — Soul Layer:** Personas in `/personas/*.md` are immutable at runtime (Docker mounts read-only). SHA-256 hashes enforce integrity via `soul-validator.js`. Any edit to persona files requires running `npm run init-hashes` and committing the updated `personas/.soul-hashes.json`.

**II — Invisible Infrastructure:** All system operations are invisible to personas and users. When a persona is invoked, `compute/context-assembler.js` silently injects: setting context, relationship behavioral hints (trust-based), framed memories, and drift corrections — within a 3000-token budget.

**III — Voice Fidelity:** Real-time drift detection via `drift-analyzer.js` (< 100ms). Severity: STABLE (≤0.1) / MINOR (0.1-0.3) / WARNING (0.3-0.5) / CRITICAL (>0.5). Universal forbidden phrases: generic AI self-reference, helpfulness filler, hedging/disclaimers.

**IV — Relationship Continuity:** Trust levels progress STRANGER → ACQUAINTANCE → FAMILIAR → CONFIDANT based on familiarity score (0.0–1.0). Updated via `relationship-tracker.js`; memorable exchanges extracted by `memory-extractor.js`.

**V — Setting Preservation:** `setting-preserver.js` + `setting-extractor.js` maintain personalized atmosphere per user/persona pair. Settings expire after 90 days of inactivity.

### Context Assembly Pipeline

When a persona is invoked, `context-assembler.js` orchestrates a pipeline with token-budgeted components:

1. **Soul markers** (500 tokens) — Voice identity anchors from persona files
2. **Relationship hints** (200) — Behavioral modifiers based on user trust level
3. **Memories** (800) — Framed past interactions, ranked by importance
4. **Drift corrections** (100) — Voice fidelity reinforcements
5. **Setting** (100) — Bar atmosphere context
6. **Temporal/Pynchon layers** (~675) — Non-linear time, entropy, preterite memory, zone boundaries, narrative gravity, interface bleed, paranoid undertones

Session completion (`completeSession()`) handles: memory extraction → familiarity update → setting save → graph sync (fire-and-forget).

### Compute Module Pipelines

The modules in `compute/` are organized into functional pipelines:

- **Context pipeline:** `context-assembler.js` (entry point) → `soul-marker-extractor.js` → `relationship-shaper.js` → `memory-framing.js` → `drift-correction.js` → `setting-preserver.js`
- **Drift pipeline:** `drift-orchestrator.js` → `drift-analyzer.js` → `drift-detection.js` → `drift-correction.js` → `drift-dashboard.js`
- **Memory pipeline:** `memory-orchestrator.js` → `memory-extractor.js` → `memory-retrieval.js` → `memory-framing.js` → `persona-memory.js`
- **Relationship pipeline:** `relationship-tracker.js` → `relationship-shaper.js` → `persona-relationship-tracker.js` → `persona-bonds.js`
- **Pynchon Phase 1** (Temporal): `temporal-awareness.js`, `entropy-tracker.js`, `ambient-generator.js`, `zone-boundary-detector.js`, `preterite-memory.js`
- **Pynchon Phase 2** (They): `they-awareness.js`, `counterforce-tracker.js`, `narrative-gravity.js`, `interface-bleed.js`
- **Infrastructure:** `db-pool.js` (singleton PG), `neo4j-pool.js` (singleton Neo4j), `embedding-provider.js` (circuit breaker), `operator-logger.js` (backoff), `constants.js` (~60 config objects)
- **Graph:** `graph-sync.js` (PG→Neo4j sync), `graph-queries.js` (traversal: neighborhood, path, communities, centrality)
- **Validation:** `soul-validator.js` (SHA-256), `persona-validator.js` (existence check)

### Graceful Degradation Pattern

Optional subsystems return `null` when unavailable — callers must handle this:

- `embedding-provider.js`: circuit breaker (3 failures → 60s cooldown), `generateEmbedding()` returns `null`
- `neo4j-pool.js`: returns `null` when `NEO4J_PASSWORD` is unset, all graph features degrade
- `context-assembler.js`: all `safe*Fetch` helpers catch errors and return `null` — a failing subsystem must never break context assembly

### Embeddings

Generated locally via Docker Model Runner (`hf.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF`, 384D). API endpoint: `http://localhost:12434/engines/v1/embeddings`. All embedding generation goes through `compute/embedding-provider.js`. If Docker Model Runner is unavailable, memory storage proceeds without embeddings.

### Database Schema

Core tables: `personas`, `users`, `conversations`, `interactions`, `relationships`, `memories`, `drift_alerts`, `operator_logs`, `context_templates`, `user_settings`.

Init schema: `db/init/001_schema.sql`. Migrations in `db/migrations/` (numbered: 002, 006, 008–016). New migrations follow the next available number. Run `scripts/setup.sh` for full automated setup or `bash scripts/apply-migrations.sh` for migrations only.

### MCP Integration

MCP tools are configured via Claude Code settings (`.claude/settings.local.json`), not Docker. The compute modules in `compute/` run directly on the host via Node.js — Docker only provides the storage layer (PostgreSQL + pgvector).

### Claude Code Hooks (`~/.claude/hooks/`)

19 hooks user-wide em `~/.claude/settings.json`. Todos os hooks de logging escrevem para `~/.claude/logs/session-intel.jsonl` (JSONL, uma linha por evento tipado). O log é resetado a cada `SessionStart`.

**Lifecycle:**
- `session-start.sh` — Injeta git state + Serena discovery via `additionalContext`. Reseta `session-reads.log` e `session-intel.jsonl`.
- `session-end.sh` — macOS notification de uncommitted changes. Smart `/debug` suggestion quando >= 2 de 5 thresholds atingidos (dirty >= 10, commits >= 5, untracked >= 15, failures >= 3, duration >= 30min) E sessão >= 5min.
- `pre-compact.sh` — Preserva contexto pós-compaction via `systemMessage` (branch, dirty, CLAUDE.md reminder, top-read files, Serena coaching).

**Security (PreToolUse, blocking):**
- `bash-guard.sh` — 3 tiers: catastrophic (exit 2), dangerous (ask), risky (ask).
- `file-guard.sh` — Bloqueia secrets/credentials (exit 2), ask para lock files e blueprint violations.
- `elicitation-guard.sh` — Ask para MCP URL mode.

**Quality (PostToolUse):**
- `auto-lint.sh` (Write|Edit, blocking) — Syntax check (exit 2 on errors). Complexity warnings via `additionalContext` (Claude vê). TS/TSX: skip syntax (LSP handles).
- `anti-drift.sh` (any, async) — Logs file_edit events + blueprint drift to session-intel.
- `token-waste.sh` (any, async) — Tracks Read ops em `session-reads.log` (feeds prompt-context + pre-compact). Logs large responses (>50KB).

**Context:**
- `prompt-context.sh` (UserPromptSubmit) — Ancora `[⚓ Context: date | Project | Plan]` + Serena coaching + re-read warnings.
- `subagent-context.sh` (SubagentStart) — Injeta project/branch/CLAUDE.md/Serena em subagents.

**Intel/Logging (async):**
- `failure-log.sh` — Tool failures → session-intel + failures.log.
- `notification-log.sh` — Desktop alerts (idle/permission/error) + session-intel.
- `elicitation-result.sh` — Desktop alert on decline/cancel + session-intel.
- `teammate-idle.sh` — Desktop notification + session-intel.

**Teams:**
- `teammate-check.sh` (blocking) — Bloqueia idle se teammate tem tasks in_progress.

**Config/Worktree:**
- `config-change.sh` — Backup configs + bloqueia policy_settings.
- `worktree-create.sh` / `worktree-remove.sh` — Lifecycle de git worktrees com stash safety.

**Prompt hooks:**
- `SubagentStop` / `TaskCompleted` / `Stop` — Prompt-based validation (JSON one-liner).
- `PermissionRequest` (Read|Glob|Grep) — Auto-allow.

**Session Intel Pipeline:** `session-intel.jsonl` acumula eventos tipados (`tool_failure`, `file_edit`, `large_response`, `complexity_warning`, `blueprint_drift`, `notification`, `teammate_idle`, `elicitation_result`, `debug_suggested`). Consumido por `session-end.sh` para decidir se sugere `/debug`.

---

## Coding Rules

### Security

- **Validate persona names against directory traversal**: Any function receiving a persona name to construct a file path must sanitize input. Strip or reject `..`, `/`, `\`, and null bytes. Validate the resolved path stays within `PERSONAS_DIR` using `path.resolve()` + `startsWith()`.
- **Never expose `operator_logs` content to users**: Constitution Principle II mandates invisible infrastructure. Operator logs are exclusively for system diagnostics.
- **Use parameterized SQL** (`$1`, `$2` for pg) for all database operations. Never use string interpolation or template literals to build SQL with variables.
- **Load credentials from environment variables**, never hard-code.

### Correctness

- **Match SQL function signatures to JS callers**: Mismatches cause silent runtime failures caught by catch blocks.
- **Check return shape before accessing properties**: Never check for nonexistent properties — `undefined` is falsy and silently disables code paths.
- **Use lowercase constants for `ARC_PHASES`**: All phase values must use lowercase (`'rising'`, `'apex'`, `'falling'`, `'impact'`) matching the constants in `narrative-gravity.js`.

### Architecture

- **All compute modules must use `getSharedPool()` from `db-pool.js`**: No compute module may import `pg` directly or create its own Pool instance.
- **Soul file modifications require hash regeneration**: Run `npm run init-hashes` and commit the updated `personas/.soul-hashes.json`.
- **Context assembly helpers must fail silently with `null`**: All `safe*Fetch` functions in `context-assembler.js` must catch errors and return `null`.
- **All embedding generation goes through `compute/embedding-provider.js`**: No module may call external embedding APIs directly.
- **Neo4j pool follows db-pool singleton pattern**: `neo4j-pool.js` returns `null` when `NEO4J_PASSWORD` is unset.
- **All thresholds and config values live in `compute/constants.js`**: Never hardcode magic numbers in module files.

---

## Testing

Uses Jest 29 with `--experimental-vm-modules` (ES Modules project). Unit tests mock `db-pool.js` (shared pool). Integration tests in `tests/integration/` require a live database.

**ESM mocking pattern** (standard `jest.mock` doesn't work with ES Modules):
```javascript
import { jest } from '@jest/globals';
const mockQuery = jest.fn();
jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => ({ query: mockQuery, end: jest.fn() }))
}));
// Also mock operator-logger to prevent transitive DB access
jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn()
}));
// Import module AFTER mock setup
const { myFunction } = await import('../../compute/my-module.js');
```

**Rules:**
- All `jest.unstable_mockModule()` calls must appear before any `await import()` of the module under test.
- Always mock `operator-logger.js` in compute unit tests to prevent transitive database access.
- Never use bare `return` to skip tests; use `test.skip()` or `describe.skip()`.
