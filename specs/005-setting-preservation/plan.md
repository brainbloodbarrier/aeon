# Implementation Plan: Setting Preservation

**Branch**: `005-setting-preservation` | **Date**: 2025-12-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-setting-preservation/spec.md`

## Summary

Constitution Principle V: **The bar itself remembers you.** Setting Preservation enables O Fim to remember each user's atmosphere preferences—music, lighting, location within the bar, sensory details—and apply them automatically when users return. This extends the existing context assembly system with user-specific and relationship-specific setting customization, preference extraction at session end, and automatic purging after 90 days of inactivity.

## Technical Context

**Language/Version**: JavaScript (Node.js 18+, ES Modules)
**Primary Dependencies**: `pg` (PostgreSQL driver) - already in use
**Storage**: PostgreSQL 16 (existing `aeon_matrix` database)
**Testing**: Node.js native test runner or manual validation scripts
**Target Platform**: Linux server (Docker container via docker-compose.yml)
**Project Type**: Single project extending existing compute modules
**Performance Goals**: Setting context assembly adds < 50ms latency
**Constraints**: 200-token default budget for settings (configurable); must integrate invisibly per Constitution II
**Scale/Scope**: Extends existing schema; ~25 personas, multi-user support

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| **I. Soul Immutability** | Settings MUST NOT override persona soul definitions | PASS | FR-008 explicitly requires this; preferences adapt around souls |
| **II. Invisible Infrastructure** | Setting assembly MUST be invisible to users/personas | PASS | FR-009 requires invisible ops; extends existing context-assembler pattern |
| **III. Voice Fidelity** | Settings MUST NOT compromise persona voice | PASS | Settings are atmosphere only, not voice modification |
| **IV. Relationship Continuity** | Settings MUST integrate with existing relationship data | PASS | Relationship Settings entity links to relationships table |
| **V. Setting Preservation** | Core feature being implemented | PASS | This is the implementation of Principle V |
| **Containment: No Character Breaking** | Settings provide atmosphere, not meta-information | PASS | Natural language framing, no database references |
| **Containment: Silence Over Filler** | Settings MUST use token budget, truncate silently | PASS | FR-010 requires silent truncation |
| **Development: Schema Changes** | MUST maintain backward compatibility | PASS | New tables/columns, existing data untouched |

**Gate Status**: PASSED - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/005-setting-preservation/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (internal APIs)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
compute/
├── context-assembler.js    # UPDATE: Integrate setting-preserver
├── setting-preserver.js    # NEW: Load/compile/extract settings
└── ...existing modules...

db/migrations/
├── 006_setting_preservation.sql  # NEW: Tables, views, functions

scripts/
└── test-setting-preservation.js  # NEW: Validation script
```

**Structure Decision**: Extends existing single-project structure. New compute module `setting-preserver.js` follows established pattern (see `relationship-tracker.js`, `memory-extractor.js`). Migration continues numbered sequence (006).

## Complexity Tracking

> No violations requiring justification. Design follows established patterns.

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| New table vs extending existing | New `user_settings` table | Cleaner separation; relationships table already has specific purpose |
| User vs relationship settings | Both entities | User settings = global defaults; relationship settings = per-persona overrides |
| Extraction timing | Session end | Follows `memory-extractor.js` pattern; no real-time complexity |
