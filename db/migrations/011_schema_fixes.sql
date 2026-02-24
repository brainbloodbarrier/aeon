-- =============================================================================
-- AEON Matrix - Migration 011: Schema Fixes from Code Review
--
-- Fixes 5 schema issues identified during comprehensive code review:
--   C4 - Add soul_hash and soul_version columns to personas table
--   C5 - Create log_modification_attempt function (called by soul-validator.js)
--   C6 - Add missing columns to zone_observations (JS/DB mismatch)
--   C7 - Add missing bleed types to interface_bleeds CHECK constraint
--   C8 - Fix log_operation call in update_relationship_silently function
-- =============================================================================

BEGIN;

-- =============================================================================
-- FIX C4: Add soul_hash and soul_version columns to personas table
-- Constitution Principle I: Soul Layer integrity enforcement
-- soul-validator.js uses SHA-256 hashes to verify persona file integrity
-- =============================================================================

ALTER TABLE personas ADD COLUMN IF NOT EXISTS soul_hash VARCHAR(64);
ALTER TABLE personas ADD COLUMN IF NOT EXISTS soul_version INTEGER DEFAULT 1;

COMMENT ON COLUMN personas.soul_hash IS
    'SHA-256 hash of the persona soul file for integrity verification (Principle I)';
COMMENT ON COLUMN personas.soul_version IS
    'Version counter for persona soul file, incremented on verified updates';

-- =============================================================================
-- FIX C5: Create log_modification_attempt function
-- Called by soul-validator.js as:
--   SELECT log_modification_attempt($1, $2, $3, $4) as log_id
-- Args: (personaName VARCHAR, eventType VARCHAR, targetFile VARCHAR, details JSON)
-- Logs soul modification attempts to operator_logs (Principle II)
-- =============================================================================

CREATE OR REPLACE FUNCTION log_modification_attempt(
    p_persona_name VARCHAR,
    p_event_type VARCHAR,
    p_target_file VARCHAR,
    p_details JSON
)
RETURNS UUID AS $$
DECLARE
    v_persona_id UUID;
    v_log_id UUID;
BEGIN
    -- Look up persona UUID from name
    SELECT id INTO v_persona_id
    FROM personas
    WHERE LOWER(name) = LOWER(p_persona_name)
    LIMIT 1;

    -- Insert into operator_logs via log_operation
    v_log_id := log_operation(
        NULL::UUID,       -- session_id (not applicable)
        v_persona_id,     -- persona_id (resolved from name)
        NULL::UUID,       -- user_id (system operation)
        p_event_type,     -- operation (e.g., 'soul_modification_attempt')
        jsonb_build_object(
            'persona_name', p_persona_name,
            'target_file', p_target_file,
            'details', p_details::jsonb
        ),
        NULL,             -- duration_ms
        true              -- success
    );

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_modification_attempt IS
    'Log soul file modification attempts. Called by soul-validator.js (Principle I).';

-- =============================================================================
-- FIX C6: Add missing columns to zone_observations table
-- Migration 009 created: observation_type, topic_fragment, boundary_proximity,
--   zone_response
-- But zone-boundary-detector.js logZoneObservation() inserts:
--   session_id, persona_id, proximity, triggers, resistance_used, is_critical
-- session_id and persona_id already exist from 009. Add the remaining columns.
-- =============================================================================

ALTER TABLE zone_observations ADD COLUMN IF NOT EXISTS proximity NUMERIC(4,3);
ALTER TABLE zone_observations ADD COLUMN IF NOT EXISTS triggers JSONB DEFAULT '[]';
ALTER TABLE zone_observations ADD COLUMN IF NOT EXISTS resistance_used TEXT;
ALTER TABLE zone_observations ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT false;

COMMENT ON COLUMN zone_observations.proximity IS
    'Boundary proximity score 0-1 from zone-boundary-detector.js';
COMMENT ON COLUMN zone_observations.triggers IS
    'Array of trigger names that fired during boundary detection';
COMMENT ON COLUMN zone_observations.resistance_used IS
    'The Zone resistance response selected, if any';
COMMENT ON COLUMN zone_observations.is_critical IS
    'Whether the proximity exceeded the critical threshold (>0.85)';

-- Index for querying critical observations
CREATE INDEX IF NOT EXISTS idx_zone_obs_critical
    ON zone_observations(is_critical) WHERE is_critical = true;

-- =============================================================================
-- FIX C7: Add missing bleed types to interface_bleeds CHECK constraint
-- interface-bleed.js defines 6 BLEED_TYPES:
--   timestamp, error_fragment, log_leak, memory_address, query_echo, process_id
-- Migration 010 only allows 4:
--   timestamp, error_fragment, log_leak, memory_address
-- Drop and recreate constraint with all 6 types.
-- =============================================================================

ALTER TABLE interface_bleeds DROP CONSTRAINT IF EXISTS valid_bleed_type;
ALTER TABLE interface_bleeds ADD CONSTRAINT valid_bleed_type
    CHECK (bleed_type IN ('timestamp', 'error_fragment', 'log_leak', 'memory_address', 'query_echo', 'process_id'));

-- =============================================================================
-- FIX C8: Fix log_operation call in update_relationship_silently function
-- The function in migration 002 calls:
--   PERFORM log_operation('relationship_update', jsonb_build_object(...))
-- But log_operation requires 7 params:
--   (UUID, UUID, UUID, VARCHAR, JSONB, INTEGER, BOOLEAN)
-- Replace function with corrected log_operation call.
-- =============================================================================

CREATE OR REPLACE FUNCTION update_relationship_silently(
    p_persona_id UUID,
    p_user_id UUID,
    p_familiarity_delta FLOAT DEFAULT 0.02,
    p_details JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
    new_familiarity FLOAT;
    new_trust VARCHAR(20);
BEGIN
    -- Update familiarity score
    UPDATE relationships
    SET familiarity_score = LEAST(1.0, familiarity_score + p_familiarity_delta),
        interaction_count = interaction_count + 1,
        updated_at = NOW()
    WHERE persona_id = p_persona_id AND user_id = p_user_id
    RETURNING familiarity_score INTO new_familiarity;

    -- Determine trust level from familiarity
    IF new_familiarity IS NOT NULL THEN
        new_trust := CASE
            WHEN new_familiarity >= 0.8 THEN 'confidant'
            WHEN new_familiarity >= 0.5 THEN 'familiar'
            WHEN new_familiarity >= 0.2 THEN 'acquaintance'
            ELSE 'stranger'
        END;

        UPDATE relationships
        SET trust_level = new_trust
        WHERE persona_id = p_persona_id AND user_id = p_user_id;
    END IF;

    -- Log silently (corrected: pass all 7 args to log_operation)
    PERFORM log_operation(
        NULL::UUID,       -- session_id
        p_persona_id,     -- persona_id
        p_user_id,        -- user_id
        'relationship_update',  -- operation
        jsonb_build_object(
            'persona_id', p_persona_id,
            'user_id', p_user_id,
            'familiarity_delta', p_familiarity_delta,
            'new_familiarity', new_familiarity,
            'new_trust', new_trust
        ) || p_details,   -- details
        NULL,             -- duration_ms
        true              -- success
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_relationship_silently IS
    'Update a persona-user relationship invisibly. Logs to operator_logs.';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
BEGIN
    -- C4: Verify soul_hash column on personas
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'personas' AND column_name = 'soul_hash'
    ) = 1, 'soul_hash column not added to personas';

    -- C4: Verify soul_version column on personas
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'personas' AND column_name = 'soul_version'
    ) = 1, 'soul_version column not added to personas';

    -- C5: Verify log_modification_attempt function exists
    ASSERT (
        SELECT COUNT(*) FROM information_schema.routines
        WHERE routine_name = 'log_modification_attempt'
    ) >= 1, 'log_modification_attempt function not created';

    -- C6: Verify zone_observations.proximity column
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'zone_observations' AND column_name = 'proximity'
    ) = 1, 'proximity column not added to zone_observations';

    -- C6: Verify zone_observations.triggers column
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'zone_observations' AND column_name = 'triggers'
    ) = 1, 'triggers column not added to zone_observations';

    -- C6: Verify zone_observations.resistance_used column
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'zone_observations' AND column_name = 'resistance_used'
    ) = 1, 'resistance_used column not added to zone_observations';

    -- C6: Verify zone_observations.is_critical column
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'zone_observations' AND column_name = 'is_critical'
    ) = 1, 'is_critical column not added to zone_observations';

    -- C7: Verify valid_bleed_type constraint exists on interface_bleeds
    ASSERT (
        SELECT COUNT(*) FROM information_schema.check_constraints
        WHERE constraint_name = 'valid_bleed_type'
    ) = 1, 'valid_bleed_type constraint not recreated on interface_bleeds';

    RAISE NOTICE 'Migration 011_schema_fixes completed successfully — all 5 code review fixes applied';
END $$;

COMMIT;
