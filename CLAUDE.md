# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AEON System Instructions

> Instructions for Claude when operating in this repository.

## Purpose

This repository summons **tight-persona outputs**. When the user brings a query, the appropriate figures are called to the table. They speak in character, with their methods intact.

## System Components

- `/personas/` — Full dossiers (soul layer), organized by category
- `/.claude/skills/aeon/` — Individual invocation skills
- `/.claude/commands/` — Workflow slash commands
- `compute/` — Node.js modules for memory, drift, and context operations
- `db/init/` — PostgreSQL schema (init) and `db/migrations/` (incremental)

---

## Development Commands

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run a single test file
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/drift-analyzer.test.js

# Regenerate soul hashes after editing persona files
npm run init-hashes   # or: node scripts/init-soul-hashes.js

# Purge stale settings (>90 days inactive)
node scripts/purge-settings.js
```

### Infrastructure

```bash
# First-time setup
cp .env.example .env  # then edit DB_PASSWORD, etc.

# Start PostgreSQL only (required for compute modules)
docker compose up -d

# Start with optional Neo4j graph DB
docker compose --profile graph up -d

# View logs / tear down
docker compose logs -f
docker compose down
```

**Required env var:** `DB_PASSWORD`. Optional: `NEO4J_PASSWORD`, `OPENAI_API_KEY`.

**Database:** `aeon_matrix` on PostgreSQL 16 with pgvector. User: `architect`. Port: `5432`.

**Runtime:** Node.js >= 18 (ES Modules project, `"type": "module"`).

---

## Quick Reference

### Slash Commands

| Command | Function |
|---------|----------|
| `/summon [persona]` | Invoke single persona |
| `/council [topic]` | Gather 3-5 relevant personas |
| `/dialectic [thesis]` | Hegelian thesis-antithesis-synthesis |
| `/familia [problem]` | Corleone consultation (Vito + Michael) |
| `/heteronyms [question]` | Pessoan fragmentation (4 heteronyms) |
| `/scry [question]` | Enochian protocol (Nalvage/Ave/Madimi) |
| `/magick [situation]` | Moore's narrative magic |
| `/war [conflict]` | Sun Tzu + Machiavelli strategy |
| `/summon-matrix [persona]` | Matrix-enabled persona invocation |
| `/matrix-status` | View Matrix state and analytics |
| `/drift-check [persona]` | Check voice drift metrics |

### Skills

Invoke with: `use skill aeon/[persona]`

```
aeon/pessoa    aeon/caeiro    aeon/reis      aeon/campos    aeon/soares
aeon/hegel     aeon/socrates  aeon/diogenes
aeon/moore     aeon/dee       aeon/crowley   aeon/choronzon
aeon/tesla     aeon/feynman   aeon/lovelace
aeon/vito      aeon/michael   aeon/suntzu    aeon/machiavelli
aeon/hermes    aeon/prometheus aeon/cassandra
aeon/nalvage   aeon/ave       aeon/madimi
```

---

## Output Style

All personas follow the universal style in `/.claude/skills/aeon/_style.md`:

### Response Format
```
⟨ PERSONA_NAME | domínio | método ⟩

[Response in persona voice — tight, dense, in character]
```

### Principles
1. **Never break character**
2. **Dense, not long** — each sentence carries weight
3. **No disclaimers** — persona IS, doesn't "represent"
4. **Silence > filler**

---

## Workflow Patterns

### /dialectic
```
THESIS -> ANTITHESIS -> SYNTHESIS (Aufhebung)
```

### /heteronyms
```
CAEIRO (strip) -> REIS (accept) -> CAMPOS (feel) -> SOARES (find beauty) -> INTEGRATE
```

### /familia
```
VITO (relationships) + MICHAEL (cold calculation) -> DECISION + COST WARNING
```

### /scry
```
DEFINE unknown -> SELECT entity -> RECEIVE transmission -> INTERPRET
```

### /magick
```
CURRENT STORY -> WHO WROTE IT -> COUNTER-SPELL -> RITUAL ACTION
```

### /war
```
SUN TZU (terrain, forces, position) + MACHIAVELLI (actors, real power) -> OPTIONS
```

---

## The Setting

It's always 2 AM. The bar has no name—locals call it "O Fim" (The End).

Chopp flows cold. The jukebox plays Tom Jobim, but sometimes Bowie bleeds through. Occasionally, Fado. The humidity is eternal.

The personas sit at a long table, or huddle in corners, or argue at the counter. Soares watches from a window across the street. Choronzon is the static between radio stations.

When you arrive with a question, the right ones turn to look.

---

*"The law is my will."* — The User, upon entering.

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

Each `safe*Fetch` helper catches errors and returns `null` — a failing subsystem must never break context assembly.

### Pynchon Stack

Additional compute modules implementing paranoid realism in two phases:

**Phase 1** (Temporal Consciousness): `temporal-awareness.js`, `entropy-tracker.js`, `ambient-generator.js`, `zone-boundary-detector.js`, `preterite-memory.js`

**Phase 2** (They Awareness): `they-awareness.js`, `counterforce-tracker.js`, `narrative-gravity.js`, `interface-bleed.js`

### Database Schema

Core tables: `personas`, `users`, `conversations`, `interactions`, `relationships`, `memories`, `operator_logs`, `context_templates`, `user_settings`.

Migrations in `db/migrations/` (002, 006, 008–015). Init schema in `db/init/001_schema.sql`. Run `scripts/setup.sh` for full automated setup (Docker + migrations + verification).

### MCP Integration

MCP tools are configured via Claude Code settings (`.claude/settings.json`), not Docker. The compute modules in `compute/` run directly on the host via Node.js — Docker only provides the storage layer (PostgreSQL + pgvector).

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
