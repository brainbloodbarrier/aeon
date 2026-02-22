-- =============================================================================
-- AEON Matrix - Migration 008: Temporal Consciousness
-- Constitution: Principle VII (Temporal Consciousness)
--
-- Personas experience continuous existence between sessions.
-- Time passes. Reflections accumulate. The bar remembers.
-- =============================================================================

-- Persona temporal state (tracks continuous existence)
CREATE TABLE IF NOT EXISTS persona_temporal_state (
    persona_id UUID PRIMARY KEY REFERENCES personas(id) ON DELETE CASCADE,
    last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_location VARCHAR(100) DEFAULT 'O Fim main room',
    current_activity TEXT,
    last_reflection TIMESTAMPTZ,
    temporal_continuity_score FLOAT DEFAULT 0.0,
    time_aware_memories JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Temporal events (reflections, observations during "downtime")
CREATE TABLE IF NOT EXISTS temporal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    context JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_temporal_events_persona ON temporal_events(persona_id);
CREATE INDEX IF NOT EXISTS idx_temporal_events_triggered ON temporal_events(triggered_at);
CREATE INDEX IF NOT EXISTS idx_temporal_state_last_active ON persona_temporal_state(last_active);

-- Function to update temporal state on activity
CREATE OR REPLACE FUNCTION touch_temporal_state(p_persona_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO persona_temporal_state (persona_id, last_active, updated_at)
    VALUES (p_persona_id, NOW(), NOW())
    ON CONFLICT (persona_id) DO UPDATE
    SET last_active = NOW(),
        updated_at = NOW(),
        temporal_continuity_score = LEAST(persona_temporal_state.temporal_continuity_score + 0.01, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at on persona_temporal_state
CREATE TRIGGER persona_temporal_state_updated_at
    BEFORE UPDATE ON persona_temporal_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- View for temporal gaps
CREATE OR REPLACE VIEW persona_temporal_gaps AS
SELECT
    p.id as persona_id,
    p.slug,
    pts.last_active,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(pts.last_active, NOW()))) / 3600 as hours_since_active,
    pts.current_location,
    pts.current_activity,
    COALESCE(pts.temporal_continuity_score, 0) as temporal_continuity_score
FROM personas p
LEFT JOIN persona_temporal_state pts ON p.id = pts.persona_id;
