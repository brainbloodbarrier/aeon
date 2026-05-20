# AEON PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-10 | **Commit:** d7b792f | **Branch:** main

## OVERVIEW

Persona system with persistent memory. 25 personas across 7 categories in an isometric bar ("O Fim" in Rio). Three invocation surfaces: Express API (`server.js`), Claude Code commands (`.claude/commands/`), and persona skills (`.claude/skills/aeon/`). Storage: PostgreSQL 16 + pgvector. Compute: Node.js ES Modules on host. Frontend: vanilla JS Canvas 2D game.

## STRUCTURE

```
aeon/
├── compute/              # 38 flat JS modules — context, drift, memory, Pynchon Stack
├── personas/             # 25 soul .md files in 7 category subdirs + .soul-hashes.json
├── public/src/           # Isometric bar frontend (Canvas 2D game engine)
├── db/
│   ├── init/             # 001_schema.sql (auto-runs on Docker first-start)
│   └── migrations/       # 13 SQL files (002-018, gaps at 003-005,007)
├── tests/
│   ├── unit/             # 27 files — all mock DB, never connect
│   ├── integration/      # 2 files — live DB on port 5433
│   └── e2e/              # 1 file — full pipeline, mocked DB
├── scripts/              # 8 ops scripts (setup, migrations, hashes, diagnostics)
├── server.js             # Express 5 entry — API routes + serves frontend on :3000
├── .claude/
│   ├── commands/         # 12 workflow commands (/summon, /council, /dialectic, etc.)
│   └── skills/aeon/      # 25 persona skills + _style.md shared voice guide
├── docs/diagrams/        # 5 Mermaid diagrams (context pipeline, drift, trust FSM, etc.)
└── docker-compose.yml    # PostgreSQL+pgvector (always) + Neo4j (optional profile:graph)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/edit persona | `personas/{category}/{name}.md` | Then `npm run init-hashes` + commit `.soul-hashes.json` |
| New compute module | `compute/` | Must import `db-pool.js`, never `pg` directly |
| Add API endpoint | `server.js` | Imports compute modules as libraries |
| Add workflow | `.claude/commands/{name}.md` | Claude-interpreted markdown procedure |
| Add persona skill | `.claude/skills/aeon/{name}.md` | Thin wrapper referencing soul file |
| Frontend changes | `public/src/` | Vanilla JS Canvas 2D, no build step |
| Schema changes | `db/migrations/` | Next available number, must be idempotent |
| Config/thresholds | `compute/constants.js` | 717 lines, ~60 config objects. NEVER hardcode elsewhere |
| Test a module | `tests/unit/{module}.test.js` | ESM mock protocol required (see `tests/AGENTS.md`) |
| Architecture docs | `docs/diagrams/*.mmd` + `MATRIX_ARCHITECTURE*.md` | Mermaid diagrams + prose |

## CODE MAP

### Orchestration Chain

```
server.js (HTTP entry, 279 lines)
  └─ compute/context-assembler.js  (CENTRAL HUB — imports 15+ siblings)
       ├─ memory-orchestrator.js   → memory-retrieval, persona-memory, preterite-memory
       ├─ drift-orchestrator.js    → drift-analyzer, drift-correction, soul-marker-extractor, soul-validator
       └─ setting-orchestrator.js  → temporal-awareness, ambient-generator, entropy-tracker,
                                      zone-boundary-detector, they-awareness, counterforce-tracker,
                                      narrative-gravity, interface-bleed
```

### Foundation Layer (imported by nearly all modules)

| Module | Dependents | Role |
|--------|-----------|------|
| `db-pool.js` | 28/38 | Singleton PG pool. `getSharedPool()`, `getClient()`, `withTransaction()` |
| `operator-logger.js` | 30/38 | Fire-and-forget logging with backoff + file fallback |
| `constants.js` | 16/38 | All thresholds/config centralized (717 lines) |
| `persona-validator.js` | 4 | Input sanitization — directory traversal guard |
| `embedding-provider.js` | 3 | Circuit breaker (3 fails → 60s cooldown), returns `null` on failure |

### Three Invocation Surfaces

1. **Express API** (`server.js`) — imports compute modules, calls Claude API via Anthropic SDK
2. **Claude Commands** (`.claude/commands/`) — instruct Claude to execute SQL via MCP directly
3. **Claude Skills** (`.claude/skills/aeon/`) — persona invocation via Claude Code CLI

Surfaces 1 and 2 implement context assembly independently — can drift apart.

### Context Assembly Pipeline (token-budgeted, 3000 total)

| Component | Budget | Source |
|-----------|--------|--------|
| Soul markers | 500 | `soul-marker-extractor.js` |
| Relationship hints | 200 | `relationship-shaper.js` |
| Memories | 800 | `memory-framing.js` (RRF hybrid search) |
| Drift corrections | 100 | `drift-correction.js` |
| Setting | 100 | `setting-preserver.js` |
| Pynchon layers | ~675 | temporal, entropy, preterite, zone, narrative gravity, interface bleed, paranoia |

### Constitution Principles

| # | Name | Enforcement |
|---|------|-------------|
| I | Soul Immutability | SHA-256 hashes in `.soul-hashes.json`, Docker read-only mount |
| II | Invisible Infrastructure | `operator_logs` never exposed, context assembly silent |
| III | Voice Fidelity | Drift detection < 100ms, forbidden phrase penalties |
| IV | Relationship Continuity | Trust levels: STRANGER → ACQUAINTANCE → FAMILIAR → CONFIDANT |
| V | Setting Preservation | Per-user/persona atmosphere, 90-day expiry |

## CONVENTIONS

- **ES Modules only** — `import`/`export`, never `require()`. `"type": "module"`
- **No linter/formatter** — conventions enforced by documentation (CLAUDE.md, this file)
- **Graceful degradation** — optional subsystems return `null` on failure, callers handle
- **`safe*Fetch` pattern** — all context assembly helpers catch errors → return `null`
- **Fire-and-forget logging** — `logOperation().catch(() => {})`, never throw
- **Persona files in Portuguese** — all section headers, content, voice examples
- **Section dividers** use box-drawing: `// ═══════════════════════`
- **Console errors** prefixed: `[ModuleName] error description`
- **`_underscore` exports** — test-only helpers (`_resetState`, `_getState`)

## ANTI-PATTERNS (THIS PROJECT)

### ERROR-level (will break things)

- Importing `pg` directly — must use `getSharedPool()` from `db-pool.js`
- Editing `personas/**/*.md` without `npm run init-hashes` — soul validator rejects at runtime
- Exposing `operator_logs` to users — Constitution Principle II violation
- SQL function signature mismatches with JS callers — silent failures in catch blocks
- String interpolation/concatenation in SQL — use parameterized `$1`, `$2`

### WARNING-level (subtle bugs)

- Hardcoding thresholds — must live in `compute/constants.js`
- Uppercase ARC_PHASES — must be lowercase: `'rising'`, `'apex'`, `'falling'`, `'impact'`
- Static `import` in tests — bypasses ESM mocks. Use `await import()` after mock setup
- Bare `return` to skip tests — use `test.skip()` or `describe.skip()`
- Throwing from `safe*Fetch` helpers — must catch and return `null`
- Calling embedding APIs directly — must go through `embedding-provider.js`

## COMMANDS

```bash
# Setup
cp .env.example .env                    # DB_PASSWORD required
./scripts/setup.sh                      # Docker + migrations + persona verification

# Development
npm start                               # Express on :3000
npm run dev                             # --watch mode

# Testing
npm test                                # All (no DB needed for unit)
npm run test:unit                       # Unit only
npm run test:integration                # Starts test DB on :5433

# Infrastructure
docker compose up -d                    # PostgreSQL only
docker compose --profile graph up -d    # + Neo4j
docker model pull hf.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF

# Maintenance
npm run init-hashes                     # After editing persona .md files
bash scripts/apply-migrations.sh        # Apply pending migrations
node scripts/purge-settings.js          # Clear stale settings (>90d)
node scripts/sync-graph.js              # PG → Neo4j sync
```

## NOTES

- No CI/CD — testing and deployment is local/manual
- `aeon-compute` Docker container is dormant (`tail -f /dev/null`) — compute runs on host
- Migration numbering gaps (003-005, 007) — lost, consolidated into `002_recovery.sql`
- No migration tracking table — all migrations must be idempotent (`IF NOT EXISTS`)
- `server.js` has manual `.env` parser (no dotenv dependency)
- `scripts/purge-settings.js` imported by `context-assembler.js` — intentional cross-layer
- Multi-agent configs coexist: `.claude/`, `.omp/`, `.codex/`, `.serena/`
- Embeddings: 384D local via Docker Model Runner, through `embedding-provider.js` only
- `ANTHROPIC_API_KEY` unset → server runs in diagnostic mode (shows assembled prompt)
