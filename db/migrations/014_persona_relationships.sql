-- =============================================================================
-- AEON Matrix - Migration 013: Persona-to-Persona Relationships
--
-- Adds persona_relationships table for tracking bonds between personas.
-- Supports bidirectional queries, relationship types, and strength scores.
--
-- Feature: Issue #37 - Persona-to-persona bonds
-- Constitution: Principle VI (Persona Relationships)
-- =============================================================================

BEGIN;

-- =============================================================================
-- TABLE: persona_relationships
-- =============================================================================

CREATE TABLE IF NOT EXISTS persona_relationships (
    id SERIAL PRIMARY KEY,
    persona_a VARCHAR(100) NOT NULL,
    persona_b VARCHAR(100) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL,
    strength FLOAT DEFAULT 0.5,
    context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(persona_a, persona_b, relationship_type),
    CONSTRAINT strength_range CHECK (strength >= 0.0 AND strength <= 1.0)
);

CREATE INDEX IF NOT EXISTS idx_persona_rel_a ON persona_relationships(persona_a);
CREATE INDEX IF NOT EXISTS idx_persona_rel_b ON persona_relationships(persona_b);

-- =============================================================================
-- TRIGGER: auto-update updated_at on modification
-- =============================================================================

CREATE TRIGGER persona_relationships_updated_at
    BEFORE UPDATE ON persona_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- SEED DATA: Canonical persona bonds
-- =============================================================================

INSERT INTO persona_relationships (persona_a, persona_b, relationship_type, strength, context) VALUES
    -- Portuguese Multitude (Pessoa and his heteronyms)
    ('pessoa', 'caeiro', 'creator', 0.9, 'The master — Pessoa''s ideal of pure perception'),
    ('pessoa', 'reis', 'creator', 0.85, 'The classicist — disciplined Epicurean odes'),
    ('pessoa', 'campos', 'creator', 0.85, 'The futurist — raw sensation and modernist fury'),
    ('pessoa', 'soares', 'semi_heteronym', 0.8, 'The bookkeeper of dreams — closest to Pessoa himself'),
    -- Strategists (The Corleone bond)
    ('vito', 'michael', 'father_son', 0.95, 'Blood and succession — the weight of the family'),
    -- Philosophers
    ('socrates', 'diogenes', 'predecessor_successor', 0.7, 'The gadfly and the dog — different paths to truth'),
    -- Enochian (Dee and the angels)
    ('dee', 'nalvage', 'summoner_entity', 0.8, 'The first and most trusted transmission'),
    ('dee', 'ave', 'summoner_entity', 0.75, 'The instructing angel — patient teacher'),
    ('dee', 'madimi', 'summoner_entity', 0.7, 'The child-spirit — unpredictable and playful'),
    -- Magicians (Crowley and the Abyss)
    ('crowley', 'choronzon', 'summoner_demon', 0.85, 'The crossing of the Abyss — dissolution and mastery'),
    -- Strategic allies
    ('suntzu', 'machiavelli', 'ally', 0.6, 'Eastern terrain meets Western power politics'),
    -- Mythic allies
    ('hermes', 'prometheus', 'ally', 0.7, 'Trickster and titan — different gifts to mortals'),
    -- Scientists
    ('tesla', 'lovelace', 'contemporary', 0.5, 'Visionaries across time — electricity meets computation')
ON CONFLICT (persona_a, persona_b, relationship_type) DO NOTHING;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
BEGIN
    -- Verify table exists
    ASSERT (
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = 'persona_relationships'
    ) = 1, 'persona_relationships table not created';

    -- Verify seed data
    ASSERT (
        SELECT COUNT(*) FROM persona_relationships
    ) >= 13, 'Seed data not inserted (expected at least 13 rows)';

    RAISE NOTICE 'Migration 013_persona_relationships completed successfully';
END $$;

COMMIT;
