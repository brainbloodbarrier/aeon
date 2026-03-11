# DB — PostgreSQL Schema & Migrations

PostgreSQL 16 + pgvector. Schema in `init/`, migrations in `migrations/`. No migration tracking table — everything must be idempotent.

## STRUCTURE

```
db/
├── init/
│   └── 001_schema.sql        # Base schema (auto-runs on Docker first-start via entrypoint)
└── migrations/
    ├── 002_recovery.sql       # Consolidates LOST migrations 003-005, 007 (579 lines)
    ├── 006_setting_preservation.sql
    ├── 008_temporal_consciousness.sql
    ├── 009_ambient_entropy.sql
    ├── 010_phase2_pynchon.sql
    ├── 011_schema_fixes.sql
    ├── 012_semantic_search.sql
    ├── 013_entropy_persistence.sql
    ├── 014_persona_relationships.sql
    ├── 015_seed_soul_hashes.sql
    ├── 016_docker_embeddings.sql    # Destructive: NULLs all embeddings (1536D→384D)
    ├── 017_schema_alignment.sql
    └── 018_runtime_fixes.sql
```

## CORE TABLES

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `personas` | 25 persona identities | name, category, soul_path, soul_hash, learned_traits (JSONB) |
| `users` | User identifiers | identifier (unique), created_at |
| `conversations` | Thread containers | persona_id, user_id, session_id |
| `interactions` | Individual messages | conversation_id, role, content, embedding VECTOR(384) |
| `memories` | Extracted insights | persona_id, user_id, content, importance (0-1), embedding VECTOR(384) |
| `relationships` | User↔persona bonds | user_id, persona_id, familiarity_score (0-1), trust_level |
| `drift_alerts` | Voice drift events | persona_id, severity, drift_score, trigger (DB trigger) |
| `operator_logs` | Silent system logs | operation, details (JSONB), duration_ms, success |
| `user_settings` | Per-user atmosphere | user_id, persona_id, preferences (JSONB) |
| `persona_temporal_state` | Time consciousness | persona_id, user_id, last_interaction, gap_classification |
| `entropy_state` | System decay level | level, state, last_updated |
| `paranoia_state` | Surveillance level | persona_id, user_id, level, triggers |
| `narrative_arcs` | Story progression | persona_id, user_id, phase, momentum |
| `interface_bleeds` | System artifact log | type, content, entropy_level |

## CONVENTIONS

- **UUIDs** as primary keys (`gen_random_uuid()`)
- **TIMESTAMPTZ** for all timestamps, default `NOW()`
- **JSONB** for flexible data (learned_traits, patterns, preferences)
- **VECTOR(384)** for embeddings (pgvector, All-MiniLM-L6-v2)
- **CHECK constraints** for bounded values (scores 0-1, enum strings)
- **CASCADE** deletes on foreign keys
- **HNSW indexes** for vector similarity (`vector_cosine_ops`, m=16, ef=64)
- **Naming**: `idx_{table}_{column}` for indexes, `snake_case` everywhere
- **Parameterized SQL only** — `$1`, `$2` in all queries. Never string interpolation
- **Idempotent migrations** — `IF NOT EXISTS`, `CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`

## ADDING A MIGRATION

1. Use next available number: `019_descriptive_name.sql`
2. Every statement must be re-runnable (`IF NOT EXISTS` guards)
3. Apply: `bash scripts/apply-migrations.sh`
4. No rollback mechanism — forward-only

## ANTI-PATTERNS

- **String interpolation in SQL** — parameterized queries only (`$1`, `$2`) (ERROR)
- **Non-idempotent DDL** — all migrations re-execute on every `setup.sh` run (ERROR)
- **Mismatched function signatures** — SQL functions must match JS caller arguments exactly. Mismatches cause silent failures caught by catch blocks (ERROR)
- **`operator_logs` exposure** — Constitution Principle II: never surface to users (ERROR)

## NOTES

- Migration gaps: 003, 004, 005, 007 were lost, consolidated into `002_recovery.sql`
- No `schema_migrations` tracking table — scripts glob `migrations/*.sql` and run all sequentially
- `016_docker_embeddings.sql` is destructive: NULLs all existing embeddings when changing vector dimensions
- `015_seed_soul_hashes.sql` has hardcoded SHA-256 hashes for all 25 personas
- Database: `aeon_matrix`, user: `architect`, port: 5432 (prod), 5433 (test)
- Test DB uses `docker-compose.test.yml` with tmpfs storage and hardcoded password `test_secret`
