-- =============================================================================
-- AEON Matrix - Migration 002: Schema Recovery (Consolidated)
-- Recovers missing schema elements from migrations 002-005 and 007
--
-- These migrations were lost from the repository. This consolidated migration
-- recreates all missing tables, columns, and functions that downstream
-- migrations (006, 008, 009, 010) depend on.
--
-- Recovery covers:
--   - operator_logs table (Constitution Principle II: Invisible Infrastructure)
--   - context_templates table (Constitution Principle II: Context Assembly)
--   - personas.slug column (referenced by views in 008, 009)
--   - personas.drift_check_enabled column (Constitution Principle III: Voice Fidelity)
--   - personas.drift_threshold column (Constitution Principle III: Voice Fidelity)
--   - drift_alerts extensions (session_id, severity, warnings columns)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. OPERATOR LOGS TABLE (was migration 003)
-- Constitution Principle II: Invisible Infrastructure
-- Silent logging — never exposed to users or personas
-- =============================================================================

CREATE TABLE IF NOT EXISTS operator_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    operation VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    duration_ms INTEGER,
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE operator_logs IS
    'Silent operator logging. Never exposed to users or personas (Principle II).';
COMMENT ON COLUMN operator_logs.operation IS
    'Operation name (e.g., settings_purge, awareness_increment, drift_correction)';
COMMENT ON COLUMN operator_logs.session_id IS
    'Session UUID for idempotency checks and correlation';
COMMENT ON COLUMN operator_logs.persona_id IS
    'Persona involved in the operation';
COMMENT ON COLUMN operator_logs.user_id IS
    'User involved in the operation';
COMMENT ON COLUMN operator_logs.details IS
    'Structured details of the operation as JSONB';
COMMENT ON COLUMN operator_logs.duration_ms IS
    'Operation duration in milliseconds';
COMMENT ON COLUMN operator_logs.success IS
    'Whether the operation completed successfully';

CREATE INDEX IF NOT EXISTS idx_operator_logs_operation
    ON operator_logs(operation);
CREATE INDEX IF NOT EXISTS idx_operator_logs_created
    ON operator_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_logs_session
    ON operator_logs(session_id);

-- =============================================================================
-- 2. CONTEXT TEMPLATES TABLE (was migration 003)
-- Constitution Principle II: Context Assembly
-- Natural language framing templates for invisible context injection
-- =============================================================================

CREATE TABLE IF NOT EXISTS context_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_type VARCHAR(50) NOT NULL,
    subtype VARCHAR(50) NOT NULL,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    template TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE context_templates IS
    'Natural language framing templates for context assembly (Principle II).';
COMMENT ON COLUMN context_templates.template_type IS
    'Template category (e.g., setting, relationship, memory, drift_correction)';
COMMENT ON COLUMN context_templates.subtype IS
    'Template subcategory (e.g., default, personalized, familiar)';
COMMENT ON COLUMN context_templates.persona_id IS
    'If set, this template is persona-specific. NULL = universal template.';
COMMENT ON COLUMN context_templates.priority IS
    'Higher priority templates override lower ones (default 0)';

-- Unique constraint for universal templates (persona_id IS NULL):
-- Only one template per (template_type, subtype) when not persona-specific
CREATE UNIQUE INDEX IF NOT EXISTS idx_context_templates_universal
    ON context_templates (template_type, subtype)
    WHERE persona_id IS NULL;

-- Unique constraint for persona-specific templates:
-- Only one template per (template_type, subtype, persona_id) combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_context_templates_persona
    ON context_templates (template_type, subtype, persona_id)
    WHERE persona_id IS NOT NULL;

-- Lookup index
CREATE INDEX IF NOT EXISTS idx_context_templates_type
    ON context_templates(template_type);

-- Seed default context templates
INSERT INTO context_templates (template_type, subtype, template, priority)
VALUES
    ('setting', 'default',
     'It is 2 AM at O Fim. The humidity is eternal. {music}. The jukebox hums.',
     0),
    ('relationship', 'stranger',
     'A new face at the bar. {persona} regards them with {attitude}.',
     0),
    ('relationship', 'acquaintance',
     '{persona} recognizes the visitor. A nod of acknowledgment.',
     10),
    ('relationship', 'familiar',
     '{persona} sees an old conversation partner. The usual spot.',
     20),
    ('relationship', 'confidant',
     '{persona} and this one have history. Words carry weight between them.',
     30),
    ('drift_correction', 'default',
     '[Inner voice: Remember who you are. {correction}]',
     0),
    ('memory', 'default',
     '{persona} recalls: {memory_content}',
     0)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. ADD MISSING COLUMNS TO PERSONAS TABLE (was migrations 003-004)
-- =============================================================================

-- 3a. slug column — used by views in migrations 008 and 009
-- Lowercased, spaces converted to hyphens
ALTER TABLE personas
    ADD COLUMN IF NOT EXISTS slug VARCHAR(50);

COMMENT ON COLUMN personas.slug IS
    'URL-friendly identifier derived from name (lowercase, hyphens for spaces)';

-- Populate slug from existing name values
-- Names in seed data are already lowercase single words, but handle general case
UPDATE personas
SET slug = LOWER(REPLACE(name, ' ', '-'))
WHERE slug IS NULL;

-- 3b. drift_check_enabled — per-persona drift checking toggle
ALTER TABLE personas
    ADD COLUMN IF NOT EXISTS drift_check_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN personas.drift_check_enabled IS
    'Whether voice drift checking is enabled for this persona (Principle III)';

-- 3c. drift_threshold — custom WARNING threshold per persona
ALTER TABLE personas
    ADD COLUMN IF NOT EXISTS drift_threshold NUMERIC(3,2) DEFAULT 0.30;

COMMENT ON COLUMN personas.drift_threshold IS
    'Custom drift WARNING threshold (default 0.30). Severity levels: STABLE<=0.1, MINOR<=0.3, WARNING<=0.5, CRITICAL>0.5';

-- =============================================================================
-- 4. EXTEND DRIFT_ALERTS TABLE (was migration 003)
-- Add columns referenced in CLAUDE.md Voice Fidelity section
-- The base table already exists from 001_schema.sql
-- =============================================================================

ALTER TABLE drift_alerts
    ADD COLUMN IF NOT EXISTS session_id UUID;

ALTER TABLE drift_alerts
    ADD COLUMN IF NOT EXISTS severity VARCHAR(20);

ALTER TABLE drift_alerts
    ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]';

COMMENT ON COLUMN drift_alerts.session_id IS
    'Session during which drift was detected';
COMMENT ON COLUMN drift_alerts.severity IS
    'Drift severity: STABLE, MINOR, WARNING, CRITICAL';
COMMENT ON COLUMN drift_alerts.warnings IS
    'Array of specific drift warnings detected';

CREATE INDEX IF NOT EXISTS idx_drift_alerts_session
    ON drift_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_severity
    ON drift_alerts(severity);

-- =============================================================================
-- 5. HELPER FUNCTIONS (was migrations 003-005)
-- =============================================================================

-- log_operation: Convenience function for silent operator logging
-- Accepts 7 args matching operator-logger.js: session_id, persona_id, user_id, operation, details, duration_ms, success
CREATE OR REPLACE FUNCTION log_operation(
    p_session_id UUID,
    p_persona_id UUID,
    p_user_id UUID,
    p_operation VARCHAR,
    p_details JSONB DEFAULT '{}',
    p_duration_ms INTEGER DEFAULT NULL,
    p_success BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO operator_logs (session_id, persona_id, user_id, operation, details, duration_ms, success)
    VALUES (p_session_id, p_persona_id, p_user_id, p_operation, p_details, p_duration_ms, p_success)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_operation IS
    'Insert a silent operator log entry. Returns the log entry UUID.';

-- get_context_template: Retrieve best-matching template
CREATE OR REPLACE FUNCTION get_context_template(
    p_template_type VARCHAR,
    p_subtype VARCHAR,
    p_persona_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    result_template TEXT;
BEGIN
    -- Try persona-specific template first, then fall back to universal
    SELECT template INTO result_template
    FROM context_templates
    WHERE template_type = p_template_type
      AND subtype = p_subtype
      AND (persona_id = p_persona_id OR persona_id IS NULL)
    ORDER BY
        CASE WHEN persona_id IS NOT NULL THEN 0 ELSE 1 END,
        priority DESC
    LIMIT 1;

    RETURN result_template;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_context_template IS
    'Get the best-matching context template. Persona-specific overrides universal.';

-- update_relationship_silently: Update relationship without user visibility
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

    -- Log silently
    PERFORM log_operation('relationship_update', jsonb_build_object(
        'persona_id', p_persona_id,
        'user_id', p_user_id,
        'familiarity_delta', p_familiarity_delta,
        'new_familiarity', new_familiarity,
        'new_trust', new_trust
    ) || p_details);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_relationship_silently IS
    'Update a persona-user relationship invisibly. Logs to operator_logs.';

-- get_trust_level: Quick trust level lookup
CREATE OR REPLACE FUNCTION get_trust_level(
    p_persona_id UUID,
    p_user_id UUID
)
RETURNS VARCHAR AS $$
DECLARE
    result VARCHAR(20);
BEGIN
    SELECT trust_level INTO result
    FROM relationships
    WHERE persona_id = p_persona_id AND user_id = p_user_id;

    RETURN COALESCE(result, 'stranger');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_trust_level IS
    'Get the trust level for a persona-user relationship. Returns stranger if none exists.';

-- get_persona_drift_stats: Drift statistics for a persona over N hours
CREATE OR REPLACE FUNCTION get_persona_drift_stats(
    p_persona_id UUID,
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    total_checks BIGINT,
    avg_drift_score FLOAT,
    max_drift_score FLOAT,
    critical_count BIGINT,
    warning_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_checks,
        AVG(da.drift_score)::FLOAT as avg_drift_score,
        MAX(da.drift_score)::FLOAT as max_drift_score,
        COUNT(*) FILTER (WHERE da.severity = 'CRITICAL')::BIGINT as critical_count,
        COUNT(*) FILTER (WHERE da.severity = 'WARNING')::BIGINT as warning_count
    FROM drift_alerts da
    WHERE da.persona_id = p_persona_id
      AND da.detected_at > NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_persona_drift_stats IS
    'Get drift statistics for a persona over the last N hours.';

-- =============================================================================
-- 6. VIEWS (was migrations 003-005)
-- =============================================================================

-- Operator session summary
CREATE OR REPLACE VIEW operator_session_summary AS
SELECT
    operation,
    COUNT(*) as operation_count,
    COUNT(*) FILTER (WHERE success = true) as success_count,
    COUNT(*) FILTER (WHERE success = false) as failure_count,
    MAX(created_at) as last_occurrence
FROM operator_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY operation
ORDER BY operation_count DESC;

COMMENT ON VIEW operator_session_summary IS
    'Summary of operator log entries in the last 24 hours.';

-- Recent drift corrections
CREATE OR REPLACE VIEW recent_drift_corrections AS
SELECT
    ol.id,
    ol.details->>'persona' as persona,
    ol.details->>'drift_score' as drift_score,
    ol.details->>'severity' as severity,
    ol.created_at
FROM operator_logs ol
WHERE ol.operation = 'drift_correction'
  AND ol.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ol.created_at DESC;

COMMENT ON VIEW recent_drift_corrections IS
    'Recent drift correction events from the last 24 hours.';

-- Context budget usage
CREATE OR REPLACE VIEW context_budget_usage AS
SELECT
    ol.details->>'persona' as persona,
    AVG((ol.details->>'tokens_used')::INTEGER) as avg_tokens,
    MAX((ol.details->>'tokens_used')::INTEGER) as max_tokens,
    COUNT(*) as assembly_count
FROM operator_logs ol
WHERE ol.operation = 'context_assembly'
  AND ol.created_at > NOW() - INTERVAL '24 hours'
GROUP BY ol.details->>'persona'
ORDER BY avg_tokens DESC;

COMMENT ON VIEW context_budget_usage IS
    'Context assembly token budget usage in the last 24 hours.';

-- Persona drift summary
CREATE OR REPLACE VIEW persona_drift_summary AS
SELECT
    p.id as persona_id,
    p.name,
    p.slug,
    p.drift_check_enabled,
    p.drift_threshold,
    p.voice_drift_score as current_drift,
    COUNT(da.id) as total_alerts,
    COUNT(da.id) FILTER (WHERE da.resolved_at IS NULL) as unresolved_alerts,
    MAX(da.detected_at) as last_alert
FROM personas p
LEFT JOIN drift_alerts da ON p.id = da.persona_id
GROUP BY p.id;

COMMENT ON VIEW persona_drift_summary IS
    'Per-persona drift monitoring summary with alert counts.';

-- Trending violations
CREATE OR REPLACE VIEW trending_violations AS
SELECT
    da.persona_id,
    p.name as persona_name,
    p.slug as persona_slug,
    da.severity,
    COUNT(*) as violation_count,
    AVG(da.drift_score) as avg_drift_score
FROM drift_alerts da
JOIN personas p ON da.persona_id = p.id
WHERE da.detected_at > NOW() - INTERVAL '24 hours'
  AND da.severity IN ('WARNING', 'CRITICAL')
GROUP BY da.persona_id, p.name, p.slug, da.severity
ORDER BY violation_count DESC;

COMMENT ON VIEW trending_violations IS
    'Trending drift violations in the last 24 hours.';

-- Drift time series
CREATE OR REPLACE VIEW drift_time_series AS
SELECT
    da.persona_id,
    p.name as persona_name,
    date_trunc('hour', da.detected_at) as hour_bucket,
    AVG(da.drift_score) as avg_drift,
    MAX(da.drift_score) as max_drift,
    COUNT(*) as check_count
FROM drift_alerts da
JOIN personas p ON da.persona_id = p.id
WHERE da.detected_at > NOW() - INTERVAL '48 hours'
GROUP BY da.persona_id, p.name, date_trunc('hour', da.detected_at)
ORDER BY hour_bucket DESC;

COMMENT ON VIEW drift_time_series IS
    'Hourly drift score averages for time-series monitoring.';

-- Relationship overview
CREATE OR REPLACE VIEW relationship_overview AS
SELECT
    p.name as persona_name,
    p.slug as persona_slug,
    u.identifier as user_identifier,
    r.trust_level,
    r.familiarity_score,
    r.interaction_count,
    r.updated_at as last_interaction
FROM relationships r
JOIN personas p ON r.persona_id = p.id
JOIN users u ON r.user_id = u.id
ORDER BY r.updated_at DESC;

COMMENT ON VIEW relationship_overview IS
    'Overview of all persona-user relationships with trust levels.';

-- Relationship activity
CREATE OR REPLACE VIEW relationship_activity AS
SELECT
    p.name as persona_name,
    u.identifier as user_identifier,
    r.trust_level,
    r.familiarity_score,
    r.interaction_count,
    r.updated_at
FROM relationships r
JOIN personas p ON r.persona_id = p.id
JOIN users u ON r.user_id = u.id
WHERE r.updated_at > NOW() - INTERVAL '24 hours'
ORDER BY r.updated_at DESC
LIMIT 100;

COMMENT ON VIEW relationship_activity IS
    'Recent relationship activity within 24-hour window.';

-- Trust level transitions (shows relationships near level boundaries)
CREATE OR REPLACE VIEW trust_level_transitions AS
SELECT
    p.name as persona_name,
    u.identifier as user_identifier,
    r.trust_level as current_level,
    r.familiarity_score,
    CASE
        WHEN r.familiarity_score >= 0.75 AND r.trust_level != 'confidant' THEN 'near_confidant'
        WHEN r.familiarity_score >= 0.45 AND r.trust_level = 'acquaintance' THEN 'near_familiar'
        WHEN r.familiarity_score >= 0.18 AND r.trust_level = 'stranger' THEN 'near_acquaintance'
        ELSE 'stable'
    END as transition_status
FROM relationships r
JOIN personas p ON r.persona_id = p.id
JOIN users u ON r.user_id = u.id
WHERE r.familiarity_score > 0;

COMMENT ON VIEW trust_level_transitions IS
    'Relationships approaching trust level boundaries.';

-- =============================================================================
-- 7. INDEXES (supplemental, was migrations 004-005)
-- =============================================================================

-- Memory lookup by user+persona (for relationship continuity)
CREATE INDEX IF NOT EXISTS idx_memories_user_persona
    ON memories(user_id, persona_id);

-- =============================================================================
-- 8. VERIFICATION
-- =============================================================================

DO $$
BEGIN
    -- Verify operator_logs table
    ASSERT (
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = 'operator_logs'
    ) = 1, 'operator_logs table not created';

    -- Verify context_templates table
    ASSERT (
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = 'context_templates'
    ) = 1, 'context_templates table not created';

    -- Verify personas.slug column
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'personas' AND column_name = 'slug'
    ) = 1, 'slug column not added to personas';

    -- Verify personas.drift_check_enabled column
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'personas' AND column_name = 'drift_check_enabled'
    ) = 1, 'drift_check_enabled column not added to personas';

    -- Verify personas.drift_threshold column
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'personas' AND column_name = 'drift_threshold'
    ) = 1, 'drift_threshold column not added to personas';

    -- Verify drift_alerts extensions
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'drift_alerts' AND column_name = 'session_id'
    ) = 1, 'session_id column not added to drift_alerts';

    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'drift_alerts' AND column_name = 'severity'
    ) = 1, 'severity column not added to drift_alerts';

    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'drift_alerts' AND column_name = 'warnings'
    ) = 1, 'warnings column not added to drift_alerts';

    -- Verify operator_logs.session_id column
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'operator_logs' AND column_name = 'session_id'
    ) = 1, 'session_id column not added to operator_logs';

    RAISE NOTICE 'Migration 002_recovery completed successfully — all missing schema elements restored';
END $$;

COMMIT;
