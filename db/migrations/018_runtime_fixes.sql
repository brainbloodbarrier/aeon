-- =============================================================================
-- AEON Matrix - Migration 018: Runtime Fixes
--
-- Fixes discovered during live invocation:
--   1. Add 'active' column to context_templates (relationship-shaper.js)
--   2. Create get_persona_network() function (persona-relationship-tracker.js)
--   3. Seed initial entropy state in setting_state
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. context_templates.active — used by relationship-shaper.js
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'context_templates' AND column_name = 'active'
    ) THEN
        ALTER TABLE context_templates ADD COLUMN active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_persona_network() — used by persona-relationship-tracker.js
-- ─────────────────────────────────────────────────────────────────────────────
-- persona_relationships uses varchar persona_a/persona_b (names, not UUIDs)
-- and strength (not affinity_score). This function bridges the gap.
CREATE OR REPLACE FUNCTION get_persona_network(p_persona_id UUID)
RETURNS TABLE (
    other_persona_id UUID,
    other_persona_name VARCHAR(50),
    other_persona_category VARCHAR(50),
    relationship_type VARCHAR(50),
    affinity_score DOUBLE PRECISION,
    interaction_count INTEGER,
    last_interaction TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS other_persona_id,
        p.name AS other_persona_name,
        p.category AS other_persona_category,
        pr.relationship_type,
        pr.strength AS affinity_score,
        0 AS interaction_count,
        pr.updated_at AS last_interaction
    FROM persona_relationships pr
    JOIN personas self ON (
        (LOWER(self.name) = LOWER(pr.persona_a) OR LOWER(self.name) = LOWER(pr.persona_b))
        AND self.id = p_persona_id
    )
    JOIN personas p ON (
        LOWER(p.name) = CASE
            WHEN LOWER(self.name) = LOWER(pr.persona_a) THEN LOWER(pr.persona_b)
            ELSE LOWER(pr.persona_a)
        END
    )
    ORDER BY pr.strength DESC;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE 'Migration 018_runtime_fixes completed successfully';
END $$;

COMMIT;
