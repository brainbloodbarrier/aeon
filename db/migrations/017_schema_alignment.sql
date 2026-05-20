-- =============================================================================
-- AEON Matrix - Migration 017: Schema Alignment
--
-- Fixes schema gaps between compute modules and database:
--   1. Creates persona_memories table (persona-memory.js)
--   2. Creates setting_state table (entropy-tracker.js)
--   3. Adds last_topic, metadata, invocation_count to persona_temporal_state
--   4. Changes operator_logs.duration_ms to DOUBLE PRECISION
--   5. Makes narrative_arcs.session_id nullable
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. persona_memories — used by compute/persona-memory.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS persona_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    source_persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
    memory_type VARCHAR(50) NOT NULL DEFAULT 'observation',
    content TEXT NOT NULL,
    context TEXT,
    importance_score DOUBLE PRECISION DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    embedding vector(384),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_memories_persona ON persona_memories(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_memories_type ON persona_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_persona_memories_importance ON persona_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_persona_memories_source ON persona_memories(source_persona_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. setting_state — used by compute/entropy-tracker.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS setting_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    entropy_level DOUBLE PRECISION DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_setting_state CHECK (id = 1)
);

-- Seed default row
INSERT INTO setting_state (id, entropy_level)
VALUES (1, 0.0)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. persona_temporal_state — add missing columns
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'persona_temporal_state' AND column_name = 'last_topic'
    ) THEN
        ALTER TABLE persona_temporal_state ADD COLUMN last_topic TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'persona_temporal_state' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE persona_temporal_state ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'persona_temporal_state' AND column_name = 'invocation_count'
    ) THEN
        ALTER TABLE persona_temporal_state ADD COLUMN invocation_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. operator_logs.duration_ms — INTEGER → DOUBLE PRECISION
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE operator_logs ALTER COLUMN duration_ms TYPE DOUBLE PRECISION;

-- Also update the log_operation function signature
CREATE OR REPLACE FUNCTION log_operation(
    p_session_id UUID,
    p_persona_id UUID,
    p_user_id UUID,
    p_operation VARCHAR(100),
    p_details JSONB DEFAULT '{}',
    p_duration_ms DOUBLE PRECISION DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO operator_logs (session_id, persona_id, user_id, operation, details, duration_ms, success)
    VALUES (p_session_id, p_persona_id, p_user_id, p_operation, p_details, p_duration_ms, p_success)
    RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. narrative_arcs.session_id — make nullable for initial arc creation
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE narrative_arcs ALTER COLUMN session_id DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE 'Migration 017_schema_alignment completed successfully';
END $$;

COMMIT;
