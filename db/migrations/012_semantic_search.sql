-- =============================================================================
-- AEON Matrix - Migration 012: Semantic Search Enhancements
--
-- Adds optimizations for pgvector-based semantic memory retrieval:
--   - Partial index on memories with non-null embeddings for faster filtered queries
--   - Composite index for persona_id + user_id + embedding lookups
--
-- The embedding column and base ivfflat index already exist from 001_schema.sql.
-- =============================================================================

BEGIN;

-- =============================================================================
-- Partial index: only index rows that actually have embeddings.
-- Speeds up WHERE embedding IS NOT NULL queries in searchByEmbedding.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_memories_has_embedding
    ON memories(persona_id, user_id)
    WHERE embedding IS NOT NULL;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
BEGIN
    -- Verify partial index exists
    ASSERT (
        SELECT COUNT(*) FROM pg_indexes
        WHERE indexname = 'idx_memories_has_embedding'
    ) = 1, 'idx_memories_has_embedding index not created';

    RAISE NOTICE 'Migration 012_semantic_search completed successfully';
END $$;

COMMIT;
