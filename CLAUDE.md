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

# Tear down test DB
npm run test:integration:teardown

# Run a single test file
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/drift-analyzer.test.js

# Regenerate soul hashes after editing persona files
npm run init-hashes   # or: node scripts/init-soul-hashes.js

# Purge stale settings (>90 days inactive)
node scripts/purge-settings.js

# Inspect operator logs
node scripts/inspect-logs.js --persona pessoa --since 24h --json

# Manual graph sync (PG → Neo4j)
node scripts/sync-graph.js

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

**Database:** `aeon_matrix` on PostgreSQL 16 with pgvector. User: `architect`. Port: `5432` (dev), `5433` (test).

**Runtime:** Node.js >= 18 (ES Modules project, `"type": "module"`).

**Dependencies:** `pg` (^8.11.3), `neo4j-driver` (^5.27.0), `jest` (^29.7.0 dev).

---

## Repository Structure

```
aeon/
├── .claude/
│   ├── commands/           # 12 slash command definitions
│   └── skills/aeon/        # 25 persona skills + _style.md
├── .codex/                 # Codex agent configuration
├── .omp/                   # Open Middleware Protocol agent config
├── assets/audio/           # Theme music + SFX
├── compute/                # 38 Node.js compute modules
├── db/
│   ├── init/001_schema.sql # Core schema
│   └── migrations/         # 11 numbered migrations (002–016)
├── docs/                   # Mermaid diagrams (pipeline, drift, graph, pynchon, trust FSM)
├── personas/               # 25 persona soul files across 7 categories
│   ├── enochian/           # ave, madimi, nalvage
│   ├── magicians/          # choronzon, crowley, dee, moore
│   ├── mythic/             # cassandra, hermes, prometheus
│   ├── philosophers/       # diogenes, hegel, socrates
│   ├── portuguese/         # caeiro, campos, pessoa, reis, soares
│   ├── scientists/         # feynman, lovelace, tesla
│   ├── strategists/        # machiavelli, michael, suntzu, vito
│   └── .soul-hashes.json   # SHA-256 integrity hashes
├── scripts/                # 7 automation scripts (4 JS + 3 bash)
├── specs/                  # Specification documents (005-Setting-Preservation)
├── tests/
│   ├── unit/               # 27 unit test files
│   ├── integration/        # 2 integration tests (require live DB)
│   └── e2e/                # 1 end-to-end pipeline test
├── AGENTS.md               # Agent coding rules
├── CLAUDE.md               # This file
├── MATRIX_ARCHITECTURE.md  # V1 architecture documentation
├── MATRIX_ARCHITECTURE_V2.md # V2 MCP-native design
├── docker-compose.yml      # Production infrastructure
├── docker-compose.test.yml # Test database configuration
└── package.json            # Node.js project config
```

---

## Architecture

### Constitution Principles

**I — Soul Layer:** Personas in `/personas/*.md` are immutable at runtime (Docker mounts read-only). SHA-256 hashes enforce integrity via `soul-validator.js`. Any edit to persona files requires running `npm run init-hashes` and committing the updated `personas/.soul-hashes.json`.

**II — Invisible Infrastructure:** All system operations are invisible to personas and users. When a persona is invoked, `compute/context-assembler.js` silently injects: setting context, relationship behavioral hints (trust-based), framed memories, and drift corrections — within a 3000-token budget.

**III — Voice Fidelity:** Real-time drift detection via `drift-analyzer.js` (< 100ms). Severity: STABLE (≤0.1) / MINOR (0.1-0.3) / WARNING (0.3-0.5) / CRITICAL (>0.5). Universal forbidden phrases: generic AI self-reference, helpfulness filler, hedging/disclaimers.

**IV — Relationship Continuity:** Trust levels progress STRANGER → ACQUAINTANCE → FAMILIAR → CONFIDANT based on familiarity score (0.0–1.0). Updated via `relationship-tracker.js`; memorable exchanges extracted by `memory-extractor.js`.

**V — Setting Preservation:** `setting-preserver.js` + `setting-extractor.js` maintain personalized atmosphere per user/persona pair. Settings expire after 90 days of inactivity.

**VI — Persona Autonomy:** Persona-to-persona relationships tracked independently of users via `persona-relationship-tracker.js` and `persona-bonds.js`. Persona-specific memories stored via `persona-memory.js`.

### Context Assembly Pipeline

When a persona is invoked, `context-assembler.js` orchestrates a pipeline with token-budgeted components:

1. **Soul markers** (500 tokens) — Voice identity anchors from persona files
2. **Relationship hints** (200) — Behavioral modifiers based on user trust level
3. **Memories** (800) — Framed past interactions, ranked by importance via RRF hybrid search
4. **Drift corrections** (100) — Voice fidelity reinforcements
5. **Setting** (100) — Bar atmosphere context
6. **Temporal/Pynchon layers** (~675) — Non-linear time, entropy, preterite memory, zone boundaries, narrative gravity, interface bleed, paranoid undertones

Session completion (`completeSession()`) handles: memory extraction → familiarity update → setting save → graph sync (fire-and-forget).

### Compute Modules (38 files)

The modules in `compute/` are organized into functional pipelines:

**Context pipeline:**
`context-assembler.js` (entry point) → `soul-marker-extractor.js` → `relationship-shaper.js` → `memory-framing.js` → `drift-correction.js` → `setting-preserver.js`

**Orchestrators** (extracted from context-assembler for separation of concerns):
- `memory-orchestrator.js` — safe memory retrieval, token-budgeted truncation
- `drift-orchestrator.js` — safe soul validation and drift fetch
- `setting-orchestrator.js` — safe setting/Pynchon fetch (9 sub-module wrappers)

**Drift pipeline:**
`drift-orchestrator.js` → `drift-analyzer.js` → `drift-detection.js` → `drift-correction.js` → `drift-dashboard.js`

**Memory pipeline:**
`memory-orchestrator.js` → `memory-extractor.js` → `memory-retrieval.js` (RRF hybrid search) → `memory-framing.js` → `persona-memory.js`

**Relationship pipeline:**
`relationship-tracker.js` → `relationship-shaper.js` → `persona-relationship-tracker.js` → `persona-bonds.js`

**Pynchon Phase 1** (Temporal):
`temporal-awareness.js`, `entropy-tracker.js`, `ambient-generator.js`, `zone-boundary-detector.js`, `preterite-memory.js`

**Pynchon Phase 2** (They):
`they-awareness.js`, `counterforce-tracker.js`, `narrative-gravity.js`, `interface-bleed.js`

**Infrastructure:**
`db-pool.js` (singleton PG), `neo4j-pool.js` (singleton Neo4j), `embedding-provider.js` (circuit breaker), `operator-logger.js` (backoff + file fallback), `constants.js` (~60 config objects)

**Graph:**
`graph-sync.js` (PG→Neo4j sync), `graph-queries.js` (traversal: neighborhood, path, communities, centrality)

**Validation:**
`soul-validator.js` (SHA-256), `persona-validator.js` (existence + path traversal check)

**Settings:**
`setting-preserver.js` (load/save/compile), `setting-extractor.js` (extract from conversation text)

**Learning:**
`learning-extraction.js` (topic extraction, tone analysis, depth scoring from interactions)

### Graceful Degradation Pattern

Optional subsystems return `null` when unavailable — callers must handle this:

- `embedding-provider.js`: circuit breaker (3 failures → 60s cooldown), `generateEmbedding()` returns `null`
- `neo4j-pool.js`: returns `null` when `NEO4J_PASSWORD` is unset, all graph features degrade
- `context-assembler.js`: all `safe*Fetch` helpers catch errors and return `null` — a failing subsystem must never break context assembly
- `operator-logger.js`: falls back to file (`logs/operator-fallback.log`) then stderr if DB unavailable

### Embeddings

Generated locally via Docker Model Runner (`hf.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF`, 384D). API endpoint: `http://localhost:12434/engines/v1/embeddings`. All embedding generation goes through `compute/embedding-provider.js`. If Docker Model Runner is unavailable, memory storage proceeds without embeddings. HNSW indexes used for vector similarity search.

### Database Schema

Core tables: `personas`, `users`, `conversations`, `interactions`, `relationships`, `memories`, `drift_alerts`, `operator_logs`, `context_templates`, `user_settings`.

Extended tables (via migrations): `persona_temporal_state`, `temporal_events`, `ambient_event_templates`, `active_ambient_state`, `entropy_states`, `they_observations`, `paranoia_state`, `counterforce_alignments`, `narrative_arcs`, `interface_events`, `persona_relationships` (`persona_bonds`), `preterite_memories`, `persona_memories`.

Init schema: `db/init/001_schema.sql`. Migrations in `db/migrations/` (numbered: 002, 006, 008–016):

| Migration | Purpose |
|-----------|---------|
| 002 | Recovery (operator_logs, context_templates, persona columns, drift_alerts) |
| 006 | Setting preservation (user_settings, persona location) |
| 008 | Temporal consciousness (temporal_state, temporal_events) |
| 009 | Ambient entropy (ambient_event_templates, active_ambient_state) |
| 010 | Phase 2 Pynchon (they_observations, paranoia_state, counterforce, narrative_arcs, interface_events) |
| 011 | Schema stability fixes (indexes, constraints) |
| 012 | Semantic search (partial indexes for pgvector queries) |
| 013 | Cross-session entropy persistence (entropy_states with temporal decay) |
| 014 | Persona-to-persona relationships (persona_relationships / persona_bonds) |
| 015 | Seed soul hashes (soul_hash, soul_version columns on personas) |
| 016 | Docker Model Runner embeddings (384D HNSW migration from 1536D) |

New migrations follow the next available number (currently 017). Run `scripts/setup.sh` for full automated setup or `bash scripts/apply-migrations.sh` for migrations only.

### MCP Integration

MCP tools are configured via Claude Code settings (`.claude/settings.local.json`), not Docker. The compute modules in `compute/` run directly on the host via Node.js — Docker only provides the storage layer (PostgreSQL + pgvector).

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/summon [persona] [question]` | Invoke single persona with full context injection |
| `/summon-matrix [persona] [question]` | Matrix-enabled invocation (full memory from DB) |
| `/council [topic]` | Gather 3-5 relevant personas for multi-perspective consultation |
| `/dialectic [thesis]` | Hegelian thesis-antithesis-synthesis process |
| `/familia [situation]` | Corleone family consultation (Vito + Michael) |
| `/heteronyms [problem]` | Pessoan fragmentation (Caeiro → Reis → Campos → Soares) |
| `/scry [question]` | Enochian divination protocol (Nalvage, Ave, Madimi, Choronzon) |
| `/magick [situation]` | Alan Moore narrative rewriting method |
| `/war [conflict]` | Sun Tzu + Machiavelli strategic analysis |
| `/drift-check [persona]` | Voice drift diagnostics (single persona or `all`) |
| `/matrix-status [subsystem]` | System health (personas, memories, relationships, alerts) |
| `/graph [query]` | Neo4j graph queries (community, neighbors, path, central, influence) |

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
- **Context assembly helpers must fail silently with `null`**: All `safe*Fetch` functions in `context-assembler.js` and orchestrator modules must catch errors and return `null`.
- **All embedding generation goes through `compute/embedding-provider.js`**: No module may call external embedding APIs directly.
- **Neo4j pool follows db-pool singleton pattern**: `neo4j-pool.js` returns `null` when `NEO4J_PASSWORD` is unset.
- **All thresholds and config values live in `compute/constants.js`**: Never hardcode magic numbers in module files.
- **Orchestrator modules wrap sub-module calls**: `memory-orchestrator.js`, `drift-orchestrator.js`, and `setting-orchestrator.js` handle safe fetching; sub-modules should not duplicate error handling.

---

## Testing

Uses Jest 29 with `--experimental-vm-modules` (ES Modules project). Unit tests mock `db-pool.js` (shared pool). Integration tests in `tests/integration/` require a live database. E2E tests in `tests/e2e/` validate complete persona invocation pipelines.

**Test coverage** (33 test files):
- **27 unit tests** in `tests/unit/` — cover all compute modules including error paths, circuit breakers, and graceful degradation
- **2 integration tests** in `tests/integration/` — `graph-sync.test.js` (Neo4j), `setting-flow.test.js` (PostgreSQL)
- **1 e2e test** in `tests/e2e/` — `persona-invocation.test.js` (full pipeline validation)

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

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/setup.sh` | Full automated first-time setup (Docker + migrations + verification) |
| `scripts/apply-migrations.sh` | Apply pending DB migrations (detects local psql or docker exec) |
| `scripts/setup-test-db.sh` | Start test PostgreSQL container on port 5433, apply schema + migrations |
| `scripts/init-soul-hashes.js` | Regenerate SHA-256 hashes for all persona `.md` files |
| `scripts/purge-settings.js` | Remove stale user_settings records (>90 days inactive) |
| `scripts/sync-graph.js` | Manual full PG→Neo4j graph synchronization |
| `scripts/inspect-logs.js` | CLI tool for inspecting operator_logs (filter by persona, operation, time, severity) |
