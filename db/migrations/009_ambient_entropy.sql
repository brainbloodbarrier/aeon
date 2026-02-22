-- =============================================================================
-- AEON Matrix - Migration 009: Ambient Events + Entropy + Pynchon Layers
-- "Entropy is the measure of our ignorance of a system." — Pynchon
-- =============================================================================

-- Ambient event templates
CREATE TABLE IF NOT EXISTS ambient_event_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    template TEXT NOT NULL,
    frequency_weight FLOAT DEFAULT 1.0,
    time_of_night VARCHAR(20) DEFAULT 'any',
    min_entropy FLOAT DEFAULT 0.0,
    max_entropy FLOAT DEFAULT 1.0,
    triggers JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active ambient state (singleton)
CREATE TABLE IF NOT EXISTS active_ambient_state (
    id SERIAL PRIMARY KEY,
    current_music VARCHAR(255) DEFAULT 'Tom Jobim - Águas de Março',
    current_weather VARCHAR(100) DEFAULT 'humid, still',
    current_lighting VARCHAR(100) DEFAULT 'dim amber',
    patron_count INTEGER DEFAULT 3,
    notable_objects TEXT[] DEFAULT '{}',
    entropy_level FLOAT DEFAULT 0.0,
    decay_markers JSONB DEFAULT '[]',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO active_ambient_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Ambient event log
CREATE TABLE IF NOT EXISTS ambient_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    entropy_at_trigger FLOAT,
    session_id UUID
);

-- Preterite memories (Pynchon: the passed-over)
CREATE TABLE IF NOT EXISTS preterite_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    preterite_reason VARCHAR(100),
    election_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_surfaced TIMESTAMPTZ,
    surface_count INTEGER DEFAULT 0
);

-- Zone boundary observations
CREATE TABLE IF NOT EXISTS zone_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    observation_type VARCHAR(50) NOT NULL,
    topic_fragment TEXT,
    boundary_proximity FLOAT,
    zone_response TEXT,
    observed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ambient_templates_type ON ambient_event_templates(event_type);
CREATE INDEX IF NOT EXISTS idx_ambient_log_triggered ON ambient_event_log(triggered_at);
CREATE INDEX IF NOT EXISTS idx_preterite_persona ON preterite_memories(persona_id);
CREATE INDEX IF NOT EXISTS idx_zone_obs_persona ON zone_observations(persona_id);

-- Entropy functions
CREATE OR REPLACE FUNCTION increment_entropy(delta FLOAT DEFAULT 0.01)
RETURNS FLOAT AS $$
DECLARE new_entropy FLOAT;
BEGIN
    UPDATE active_ambient_state
    SET entropy_level = LEAST(entropy_level + delta, 1.0),
        decay_markers = decay_markers || jsonb_build_object('type', 'decay', 'delta', delta, 'ts', NOW()),
        last_updated = NOW()
    WHERE id = 1
    RETURNING entropy_level INTO new_entropy;
    RETURN COALESCE(new_entropy, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reset_entropy(new_level FLOAT DEFAULT 0.0) RETURNS VOID AS $$
BEGIN
    UPDATE active_ambient_state SET entropy_level = new_level, decay_markers = '[]'::jsonb, last_updated = NOW() WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- Views
CREATE OR REPLACE VIEW ambient_status AS
SELECT current_music, current_weather, current_lighting, patron_count, notable_objects, entropy_level,
    CASE WHEN entropy_level < 0.3 THEN 'stable' WHEN entropy_level < 0.5 THEN 'unsettled'
         WHEN entropy_level < 0.7 THEN 'decaying' WHEN entropy_level < 0.9 THEN 'fragmenting' ELSE 'dissolving' END as entropy_state,
    last_updated FROM active_ambient_state WHERE id = 1;

CREATE OR REPLACE VIEW surfaceable_preterite AS
SELECT pm.*, p.slug as persona_slug,
    CASE WHEN pm.surface_count = 0 THEN 0.3 WHEN pm.last_surfaced < NOW() - INTERVAL '7 days' THEN 0.2 ELSE 0.05 END as surface_probability
FROM preterite_memories pm JOIN personas p ON pm.persona_id = p.id WHERE pm.election_score < 0.3;

-- Seed ambient templates
INSERT INTO ambient_event_templates (event_type, template, frequency_weight, time_of_night, min_entropy) VALUES
('music_change', 'The jukebox shifts to Bowie — "Heroes" bleeds through the static.', 1.0, 'deep_night', 0.0),
('music_change', 'Static between stations. Something almost resolves. Doesn''t.', 0.5, 'deep_night', 0.6),
('patron_action', 'The barman polishes the same glass. Has been polishing it for hours.', 0.5, 'pre_dawn', 0.5),
('weather', 'Thunder, distant. The lights flicker once.', 0.6, 'any', 0.4),
('object', 'The clock on the wall shows 2 AM. It always shows 2 AM.', 0.3, 'any', 0.6),
('decay', 'The lights dim further. The edges of the room soften.', 0.4, 'any', 0.7),
('decay', 'Conversations fragment. Words don''t quite connect.', 0.3, 'pre_dawn', 0.8)
ON CONFLICT DO NOTHING;
