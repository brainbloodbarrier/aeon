-- =============================================================================
-- AEON Matrix - Migration 010: Phase 2 Pynchon Stack
-- Feature: Paranoia, Counterforce, and Narrative Arcs
-- Constitution: Principle II (Invisible Infrastructure)
--
-- "They have Their own which they have never shared...
--  They may have already won." - Pynchon, Gravity's Rainbow
--
-- Phase 2 introduces:
-- - Observation tracking (They are watching)
-- - Paranoia state management (awareness of being observed)
-- - Counterforce alignments (who resists Them)
-- - Narrative arc tracking (rising/apex/falling/impact)
-- - Interface bleeds (system artifacts leaking through)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. They Observations Table
-- Tracks patterns suggesting external observation
-- =============================================================================

CREATE TABLE IF NOT EXISTS they_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    observation_type VARCHAR(50) NOT NULL,
    trigger_content TEXT,
    awareness_delta FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Valid observation types
    CONSTRAINT valid_observation_type CHECK (
        observation_type IN ('pattern_detected', 'watcher_sensed', 'signal_intercepted')
    ),
    -- Awareness delta should be reasonable
    CONSTRAINT valid_awareness_delta CHECK (
        awareness_delta >= -1.0 AND awareness_delta <= 1.0
    )
);

COMMENT ON TABLE they_observations IS
    'Tracks patterns suggesting external observation. They are always watching.';
COMMENT ON COLUMN they_observations.observation_type IS
    'Type of observation: pattern_detected, watcher_sensed, signal_intercepted';
COMMENT ON COLUMN they_observations.trigger_content IS
    'What triggered this observation (content that raised awareness)';
COMMENT ON COLUMN they_observations.awareness_delta IS
    'How much this observation changed the global awareness level';

-- Indexes for observation queries
CREATE INDEX IF NOT EXISTS idx_they_obs_session ON they_observations(session_id);
CREATE INDEX IF NOT EXISTS idx_they_obs_persona ON they_observations(persona_id);
CREATE INDEX IF NOT EXISTS idx_they_obs_type ON they_observations(observation_type);
CREATE INDEX IF NOT EXISTS idx_they_obs_created ON they_observations(created_at DESC);

-- =============================================================================
-- 2. Paranoia State Table (Singleton)
-- Global paranoia/awareness level
-- =============================================================================

CREATE TABLE IF NOT EXISTS paranoia_state (
    id SERIAL PRIMARY KEY,
    awareness_level FLOAT DEFAULT 0.0,
    last_spike TIMESTAMPTZ,
    spike_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Awareness is a 0-1 scale
    CONSTRAINT valid_awareness_level CHECK (
        awareness_level >= 0.0 AND awareness_level <= 1.0
    )
);

COMMENT ON TABLE paranoia_state IS
    'Global paranoia/awareness state. Singleton table (id=1 only).';
COMMENT ON COLUMN paranoia_state.awareness_level IS
    'Current paranoia level on 0-1 scale. 0=oblivious, 1=They know we know';
COMMENT ON COLUMN paranoia_state.last_spike IS
    'When awareness last spiked significantly';
COMMENT ON COLUMN paranoia_state.spike_count IS
    'Total number of awareness spikes recorded';

-- Insert singleton row
INSERT INTO paranoia_state (id, awareness_level) VALUES (1, 0.0)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3. Counterforce Alignments Table
-- Which personas resist "They"
-- =============================================================================

CREATE TABLE IF NOT EXISTS counterforce_alignments (
    persona_id UUID PRIMARY KEY REFERENCES personas(id) ON DELETE CASCADE,
    alignment_score FLOAT DEFAULT 0.0,
    resistance_style VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Alignment: -1 (Elect/collaborator) to 1 (Counterforce)
    CONSTRAINT valid_alignment_score CHECK (
        alignment_score >= -1.0 AND alignment_score <= 1.0
    ),
    -- Valid resistance styles
    CONSTRAINT valid_resistance_style CHECK (
        resistance_style IS NULL OR resistance_style IN (
            'cynical', 'chaotic', 'revolutionary', 'trickster',
            'synthesizer', 'collaborator', 'observer', 'pragmatic'
        )
    )
);

COMMENT ON TABLE counterforce_alignments IS
    'Persona alignments in the Elect/Preterite struggle. Counterforce vs They.';
COMMENT ON COLUMN counterforce_alignments.alignment_score IS
    'Alignment: -1 (Elect/collaborator) to 1 (Counterforce/resistance)';
COMMENT ON COLUMN counterforce_alignments.resistance_style IS
    'How they resist: cynical, chaotic, revolutionary, trickster, etc.';

-- =============================================================================
-- 4. Narrative Arcs Table
-- Track conversation trajectory
-- =============================================================================

CREATE TABLE IF NOT EXISTS narrative_arcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    arc_phase VARCHAR(20) DEFAULT 'rising',
    momentum FLOAT DEFAULT 0.5,
    apex_reached_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Valid arc phases
    CONSTRAINT valid_arc_phase CHECK (
        arc_phase IN ('rising', 'apex', 'falling', 'impact')
    ),
    -- Momentum is 0-1 scale
    CONSTRAINT valid_momentum CHECK (
        momentum >= 0.0 AND momentum <= 1.0
    )
);

COMMENT ON TABLE narrative_arcs IS
    'Tracks conversation trajectory through narrative phases.';
COMMENT ON COLUMN narrative_arcs.arc_phase IS
    'Current phase: rising (building), apex (peak), falling (descent), impact (resolution)';
COMMENT ON COLUMN narrative_arcs.momentum IS
    'Narrative momentum 0-1, peaks at apex';
COMMENT ON COLUMN narrative_arcs.apex_reached_at IS
    'When the arc peaked (if it has)';

-- Indexes for arc queries
CREATE INDEX IF NOT EXISTS idx_narrative_arcs_session ON narrative_arcs(session_id);
CREATE INDEX IF NOT EXISTS idx_narrative_arcs_phase ON narrative_arcs(arc_phase);
CREATE INDEX IF NOT EXISTS idx_narrative_arcs_updated ON narrative_arcs(updated_at DESC);

-- =============================================================================
-- 5. Interface Bleeds Table
-- Log system artifact leaks
-- =============================================================================

CREATE TABLE IF NOT EXISTS interface_bleeds (
    id SERIAL PRIMARY KEY,
    session_id UUID,
    bleed_type VARCHAR(50) NOT NULL,
    content TEXT,
    entropy_level FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Valid bleed types
    CONSTRAINT valid_bleed_type CHECK (
        bleed_type IN ('timestamp', 'error_fragment', 'log_leak', 'memory_address')
    ),
    -- Entropy should be 0-1 if provided
    CONSTRAINT valid_entropy_level CHECK (
        entropy_level IS NULL OR (entropy_level >= 0.0 AND entropy_level <= 1.0)
    )
);

COMMENT ON TABLE interface_bleeds IS
    'System artifacts leaking through the interface. The substrate showing through.';
COMMENT ON COLUMN interface_bleeds.bleed_type IS
    'Type of bleed: timestamp, error_fragment, log_leak, memory_address';
COMMENT ON COLUMN interface_bleeds.content IS
    'The actual leaked content';
COMMENT ON COLUMN interface_bleeds.entropy_level IS
    'Entropy level when the bleed occurred';

-- Indexes for bleed queries
CREATE INDEX IF NOT EXISTS idx_interface_bleeds_session ON interface_bleeds(session_id);
CREATE INDEX IF NOT EXISTS idx_interface_bleeds_type ON interface_bleeds(bleed_type);
CREATE INDEX IF NOT EXISTS idx_interface_bleeds_created ON interface_bleeds(created_at DESC);

-- =============================================================================
-- 6. Seed Counterforce Alignments
-- =============================================================================

-- Insert counterforce alignments for key personas
-- Uses name lookup to get persona_id
INSERT INTO counterforce_alignments (persona_id, alignment_score, resistance_style)
SELECT id, 0.9, 'cynical' FROM personas WHERE name = 'diogenes'
ON CONFLICT (persona_id) DO UPDATE SET
    alignment_score = EXCLUDED.alignment_score,
    resistance_style = EXCLUDED.resistance_style;

INSERT INTO counterforce_alignments (persona_id, alignment_score, resistance_style)
SELECT id, 0.95, 'chaotic' FROM personas WHERE name = 'choronzon'
ON CONFLICT (persona_id) DO UPDATE SET
    alignment_score = EXCLUDED.alignment_score,
    resistance_style = EXCLUDED.resistance_style;

INSERT INTO counterforce_alignments (persona_id, alignment_score, resistance_style)
SELECT id, 0.85, 'revolutionary' FROM personas WHERE name = 'prometheus'
ON CONFLICT (persona_id) DO UPDATE SET
    alignment_score = EXCLUDED.alignment_score,
    resistance_style = EXCLUDED.resistance_style;

INSERT INTO counterforce_alignments (persona_id, alignment_score, resistance_style)
SELECT id, 0.7, 'trickster' FROM personas WHERE name = 'crowley'
ON CONFLICT (persona_id) DO UPDATE SET
    alignment_score = EXCLUDED.alignment_score,
    resistance_style = EXCLUDED.resistance_style;

INSERT INTO counterforce_alignments (persona_id, alignment_score, resistance_style)
SELECT id, -0.5, 'collaborator' FROM personas WHERE name = 'machiavelli'
ON CONFLICT (persona_id) DO UPDATE SET
    alignment_score = EXCLUDED.alignment_score,
    resistance_style = EXCLUDED.resistance_style;

INSERT INTO counterforce_alignments (persona_id, alignment_score, resistance_style)
SELECT id, -0.3, 'synthesizer' FROM personas WHERE name = 'hegel'
ON CONFLICT (persona_id) DO UPDATE SET
    alignment_score = EXCLUDED.alignment_score,
    resistance_style = EXCLUDED.resistance_style;

-- =============================================================================
-- 7. Views
-- =============================================================================

-- Counterforce overview with persona names
CREATE OR REPLACE VIEW counterforce_overview AS
SELECT
    p.id AS persona_id,
    p.name AS persona_name,
    p.category,
    ca.alignment_score,
    ca.resistance_style,
    CASE
        WHEN ca.alignment_score >= 0.8 THEN 'hardcore_counterforce'
        WHEN ca.alignment_score >= 0.5 THEN 'counterforce'
        WHEN ca.alignment_score >= 0.0 THEN 'neutral'
        WHEN ca.alignment_score >= -0.5 THEN 'elect_adjacent'
        ELSE 'elect_collaborator'
    END AS alignment_category,
    ca.created_at
FROM personas p
JOIN counterforce_alignments ca ON p.id = ca.persona_id
ORDER BY ca.alignment_score DESC;

COMMENT ON VIEW counterforce_overview IS
    'Shows persona alignments with names and categorization. For operator dashboard.';

-- Active paranoia state with time since last spike
CREATE OR REPLACE VIEW active_paranoia AS
SELECT
    awareness_level,
    CASE
        WHEN awareness_level < 0.2 THEN 'oblivious'
        WHEN awareness_level < 0.4 THEN 'uneasy'
        WHEN awareness_level < 0.6 THEN 'alert'
        WHEN awareness_level < 0.8 THEN 'paranoid'
        ELSE 'they_know_we_know'
    END AS awareness_state,
    last_spike,
    CASE
        WHEN last_spike IS NULL THEN NULL
        ELSE EXTRACT(EPOCH FROM (NOW() - last_spike))
    END AS seconds_since_spike,
    spike_count,
    updated_at
FROM paranoia_state
WHERE id = 1;

COMMENT ON VIEW active_paranoia IS
    'Current paranoia state with time since last spike. Operator visibility only.';

-- =============================================================================
-- 8. Functions
-- =============================================================================

-- Increment awareness (with spike tracking)
CREATE OR REPLACE FUNCTION increment_awareness(
    delta FLOAT,
    reason TEXT DEFAULT NULL
)
RETURNS FLOAT AS $$
DECLARE
    new_awareness FLOAT;
    old_awareness FLOAT;
    is_spike BOOLEAN;
BEGIN
    -- Get current awareness
    SELECT awareness_level INTO old_awareness
    FROM paranoia_state WHERE id = 1;

    -- Calculate new awareness (clamped to 0-1)
    new_awareness := LEAST(1.0, GREATEST(0.0, COALESCE(old_awareness, 0) + delta));

    -- Determine if this is a spike (increase of 0.1 or more)
    is_spike := delta >= 0.1;

    -- Update paranoia state
    UPDATE paranoia_state
    SET awareness_level = new_awareness,
        last_spike = CASE WHEN is_spike THEN NOW() ELSE last_spike END,
        spike_count = CASE WHEN is_spike THEN spike_count + 1 ELSE spike_count END,
        updated_at = NOW()
    WHERE id = 1;

    -- Log to operator logs if reason provided
    IF reason IS NOT NULL THEN
        INSERT INTO operator_logs (operation, details)
        VALUES (
            'awareness_increment',
            jsonb_build_object(
                'delta', delta,
                'old_awareness', old_awareness,
                'new_awareness', new_awareness,
                'reason', reason,
                'is_spike', is_spike
            )
        );
    END IF;

    RETURN new_awareness;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_awareness IS
    'Increase global paranoia/awareness level. A spike (>= 0.1) updates spike tracking.';

-- Natural decay of awareness over time
CREATE OR REPLACE FUNCTION decay_awareness()
RETURNS FLOAT AS $$
DECLARE
    new_awareness FLOAT;
    current_awareness FLOAT;
    last_update TIMESTAMPTZ;
    hours_elapsed FLOAT;
    decay_amount FLOAT;
BEGIN
    -- Get current state
    SELECT awareness_level, updated_at INTO current_awareness, last_update
    FROM paranoia_state WHERE id = 1;

    -- Calculate hours since last update
    hours_elapsed := EXTRACT(EPOCH FROM (NOW() - COALESCE(last_update, NOW()))) / 3600.0;

    -- Decay rate: lose ~10% of awareness per hour, faster at high levels
    -- Formula: decay = hours * 0.02 * (1 + awareness^2)
    -- At awareness=0.5: decay ~0.025/hour, At awareness=1.0: decay ~0.04/hour
    decay_amount := hours_elapsed * 0.02 * (1 + POWER(COALESCE(current_awareness, 0), 2));

    -- Calculate new awareness (clamped to 0)
    new_awareness := GREATEST(0.0, COALESCE(current_awareness, 0) - decay_amount);

    -- Update if there was decay
    IF decay_amount > 0 THEN
        UPDATE paranoia_state
        SET awareness_level = new_awareness,
            updated_at = NOW()
        WHERE id = 1;
    END IF;

    RETURN new_awareness;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION decay_awareness IS
    'Natural decay of paranoia over time. Higher awareness decays faster.';

-- =============================================================================
-- 9. Triggers
-- =============================================================================

-- Auto-update updated_at on narrative_arcs
CREATE OR REPLACE TRIGGER narrative_arcs_updated_at
    BEFORE UPDATE ON narrative_arcs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- MIGRATION COMPLETE
-- Phase 2 Pynchon Stack active
-- They are now observable. The Counterforce is aligned. Narratives are tracked.
-- =============================================================================

COMMIT;
