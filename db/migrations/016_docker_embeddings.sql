-- Migration 016: Docker Model Runner Embeddings
-- VECTOR(1536) → VECTOR(384), IVFFlat → HNSW
--
-- Migrates from OpenAI text-embedding-3-small (1536D) to Docker Model Runner
-- ai/all-minilm (384D). HNSW indexes work better than IVFFlat for small datasets.

BEGIN;

-- Drop vector indexes (can't alter dimension with indexes present)
DROP INDEX IF EXISTS idx_memories_embedding;
DROP INDEX IF EXISTS idx_interactions_input_embedding;
DROP INDEX IF EXISTS idx_memories_has_embedding;

-- NULL existing embeddings (1536D incompatible with 384D)
UPDATE memories SET embedding = NULL WHERE embedding IS NOT NULL;
UPDATE interactions SET input_embedding = NULL, response_embedding = NULL
  WHERE input_embedding IS NOT NULL OR response_embedding IS NOT NULL;

-- ALTER columns: 1536 → 384
ALTER TABLE memories ALTER COLUMN embedding TYPE VECTOR(384);
ALTER TABLE interactions ALTER COLUMN input_embedding TYPE VECTOR(384);
ALTER TABLE interactions ALTER COLUMN response_embedding TYPE VECTOR(384);

-- Recreate indexes using HNSW (better than IVFFlat for small datasets)
CREATE INDEX idx_memories_embedding ON memories
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_interactions_input_embedding ON interactions
    USING hnsw (input_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_memories_has_embedding
    ON memories(persona_id, user_id) WHERE embedding IS NOT NULL;

-- Verification
DO $$ BEGIN
  ASSERT (SELECT COUNT(*) FROM memories WHERE embedding IS NOT NULL) = 0;
  RAISE NOTICE 'Migration 016: VECTOR(1536)→VECTOR(384), IVFFlat→HNSW complete';
END $$;

COMMIT;
