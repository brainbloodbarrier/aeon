-- Migration: 006_setting_preservation.sql
-- Feature: Setting Preservation (Constitution Principle V)
-- Date: 2025-12-13
--
-- The bar itself remembers you. Its atmosphere adapts to returning patrons
-- while maintaining its essential character.
--
-- Adds user_settings table for global preferences and extends relationships
-- table with persona-specific location preferences.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. User Settings Table (NEW)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Atmosphere preferences
    time_of_day VARCHAR(50) DEFAULT '2 AM',
    music_preference VARCHAR(100) DEFAULT NULL,
    atmosphere_descriptors JSONB DEFAULT '{}',
    location_preference VARCHAR(100) DEFAULT NULL,
    custom_setting_text TEXT DEFAULT NULL,

    -- Operator configuration overrides
    system_config JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One settings record per user
    CONSTRAINT user_settings_user_unique UNIQUE (user_id)
);

COMMENT ON TABLE user_settings IS
  'Global setting preferences per user. The bar remembers your atmosphere.';
COMMENT ON COLUMN user_settings.time_of_day IS
  'Preferred time of day (default: "2 AM", can be "dawn", "midnight", etc.)';
COMMENT ON COLUMN user_settings.music_preference IS
  'Preferred music (e.g., "Fado", "Bowie", "silence")';
COMMENT ON COLUMN user_settings.atmosphere_descriptors IS
  'Sensory preferences as JSON: {"humidity": "less", "lighting": "candlelight"}';
COMMENT ON COLUMN user_settings.location_preference IS
  'Preferred spot in bar (e.g., "corner booth", "bar counter")';
COMMENT ON COLUMN user_settings.custom_setting_text IS
  'User''s own description of ideal atmosphere';
COMMENT ON COLUMN user_settings.system_config IS
  'Operator config overrides: {"token_budget": 300, "drift_enabled": false}';
COMMENT ON COLUMN user_settings.updated_at IS
  'Last activity timestamp - used for 90-day retention purge';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Extend Relationships Table with Location Preferences
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE relationships
ADD COLUMN IF NOT EXISTS preferred_location VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS location_context TEXT DEFAULT NULL;

COMMENT ON COLUMN relationships.preferred_location IS
  'Where this persona-user pair meets (e.g., "bar counter", "corner booth")';
COMMENT ON COLUMN relationships.location_context IS
  'Additional context (e.g., "where Hegel holds court", "by the window")';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Indexes for Performance
-- ═══════════════════════════════════════════════════════════════════════════

-- Fast user settings lookup (implicit from UNIQUE constraint, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- Retention purge queries on updated_at
CREATE INDEX IF NOT EXISTS idx_user_settings_updated ON user_settings(updated_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Parameterized Setting Template (Seed Data)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add personalized template with higher priority than default
INSERT INTO context_templates (template_type, subtype, template, priority)
VALUES (
    'setting',
    'personalized',
    'It is {time} at {location}. {atmosphere}. {music}. You exist in this moment.',
    20
)
ON CONFLICT (template_type, subtype) WHERE persona_id IS NULL
DO UPDATE SET template = EXCLUDED.template, priority = EXCLUDED.priority;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Purge Stale Settings Function (90-day retention)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION purge_stale_settings()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete settings not updated in 90 days
    WITH deleted AS (
        DELETE FROM user_settings
        WHERE updated_at < NOW() - INTERVAL '90 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    -- Log the purge operation (invisible to users)
    INSERT INTO operator_logs (operation, details, success)
    VALUES (
        'settings_purge',
        jsonb_build_object(
            'records_deleted', deleted_count,
            'retention_days', 90,
            'purge_timestamp', NOW()
        ),
        true
    );

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION purge_stale_settings IS
  'Remove user_settings records not updated in 90 days. Run daily via cron.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Helper Function: Touch User Settings (Update timestamp)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION touch_user_settings(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE user_settings
    SET updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION touch_user_settings IS
  'Update the updated_at timestamp to prevent 90-day purge';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Views for Operator Monitoring
-- ═══════════════════════════════════════════════════════════════════════════

-- Settings overview for operator dashboard
CREATE OR REPLACE VIEW user_settings_overview AS
SELECT
    COUNT(*) AS total_users_with_settings,
    COUNT(*) FILTER (WHERE music_preference IS NOT NULL) AS users_with_music_pref,
    COUNT(*) FILTER (WHERE location_preference IS NOT NULL) AS users_with_location_pref,
    COUNT(*) FILTER (WHERE custom_setting_text IS NOT NULL) AS users_with_custom_text,
    AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400)::INTEGER AS avg_days_since_update
FROM user_settings;

COMMENT ON VIEW user_settings_overview IS
  'Aggregate statistics on user setting preferences for operator monitoring';

-- Recent setting activity
CREATE OR REPLACE VIEW setting_activity AS
SELECT
    us.id,
    u.identifier AS user_identifier,
    us.time_of_day,
    us.music_preference,
    us.location_preference,
    us.updated_at
FROM user_settings us
JOIN users u ON us.user_id = u.id
WHERE us.updated_at > NOW() - INTERVAL '24 hours'
ORDER BY us.updated_at DESC
LIMIT 100;

COMMENT ON VIEW setting_activity IS
  'Recent setting changes within 24-hour window for monitoring';

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Verification
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    -- Verify user_settings table exists
    ASSERT (
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = 'user_settings'
    ) = 1, 'user_settings table not created';

    -- Verify relationships columns added
    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'relationships' AND column_name = 'preferred_location'
    ) = 1, 'preferred_location column not added to relationships';

    ASSERT (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'relationships' AND column_name = 'location_context'
    ) = 1, 'location_context column not added to relationships';

    -- Verify personalized template exists
    ASSERT (
        SELECT COUNT(*) FROM context_templates
        WHERE template_type = 'setting' AND subtype = 'personalized'
    ) = 1, 'Personalized setting template not created';

    RAISE NOTICE 'Migration 006_setting_preservation completed successfully';
END $$;

COMMIT;
