/**
 * AEON Matrix - Memory Retrieval
 *
 * Provides semantic search over persona memories using pgvector embeddings,
 * with automatic fallback to keyword-based text search when embedding
 * generation fails (missing API key, network error, etc.).
 *
 * Constitution Principle II: All infrastructure operations are invisible.
 * Constitution Principle IV: Relationship continuity through memory.
 *
 * @module compute/memory-retrieval
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import { generateEmbedding } from './memory-extractor.js';
import { SEMANTIC_SEARCH } from './constants.js';

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Search memories by semantic similarity using pgvector embeddings.
 *
 * Generates an embedding for the query text, then uses cosine distance (<=>)
 * to find the most similar memories. Falls back to text search if embedding
 * generation fails.
 *
 * @param {string} query - The search query text
 * @param {Object} options - Search options
 * @param {string} options.personaId - Persona UUID to scope results
 * @param {string} options.userId - User UUID to scope results
 * @param {number} [options.limit] - Max results (default: SEMANTIC_SEARCH.DEFAULT_LIMIT)
 * @param {number} [options.minSimilarity] - Min cosine similarity threshold (default: SEMANTIC_SEARCH.MIN_SIMILARITY)
 * @param {string} [options.sessionId] - Session UUID for logging
 * @returns {Promise<Array<Object>>} Matching memories sorted by relevance, or empty array on error
 */
export async function searchByEmbedding(query, options = {}) {
  const {
    personaId,
    userId,
    limit = SEMANTIC_SEARCH.DEFAULT_LIMIT,
    minSimilarity = SEMANTIC_SEARCH.MIN_SIMILARITY,
    sessionId = null
  } = options;

  const startTime = Date.now();

  try {
    // Attempt to generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    if (queryEmbedding) {
      return await _semanticSearch(queryEmbedding, {
        personaId,
        userId,
        limit,
        minSimilarity,
        sessionId,
        startTime
      });
    }

    // Fallback: embedding generation failed (no API key, error, etc.)
    await logOperation('semantic_search_fallback', {
      sessionId,
      personaId,
      userId,
      details: {
        reason: 'embedding_generation_failed',
        fallback: 'text_search'
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return await _textSearch(query, { personaId, userId, limit, sessionId, startTime });
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'semantic_search_failure',
        error_message: error.message,
        fallback_used: 'empty_array'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return [];
  }
}

/**
 * Perform cosine-similarity search using pgvector.
 *
 * @param {number[]} queryEmbedding - 1536-dimension embedding vector
 * @param {Object} opts - Internal options
 * @returns {Promise<Array<Object>>} Matching memories
 * @private
 */
async function _semanticSearch(queryEmbedding, opts) {
  const { personaId, userId, limit, minSimilarity, sessionId, startTime } = opts;
  const db = getPool();

  // cosine distance: <=> returns 0 (identical) to 2 (opposite)
  // similarity = 1 - distance
  const result = await db.query(
    `SELECT
       id, memory_type, content, importance_score, created_at,
       (1.0 - (embedding <=> $3::vector)) AS similarity,
       (${SEMANTIC_SEARCH.SEMANTIC_WEIGHT} * (1.0 - (embedding <=> $3::vector))
        + ${SEMANTIC_SEARCH.IMPORTANCE_WEIGHT} * importance_score) AS hybrid_score
     FROM memories
     WHERE persona_id = $1
       AND user_id = $2
       AND embedding IS NOT NULL
       AND (1.0 - (embedding <=> $3::vector)) >= $4
     ORDER BY hybrid_score DESC
     LIMIT $5`,
    [personaId, userId, JSON.stringify(queryEmbedding), minSimilarity, limit]
  );

  await logOperation('semantic_search', {
    sessionId,
    personaId,
    userId,
    details: {
      strategy: 'embedding',
      results_count: result.rows.length,
      min_similarity_threshold: minSimilarity
    },
    durationMs: Date.now() - startTime,
    success: true
  });

  return result.rows;
}

/**
 * Fallback text-based search using SQL ILIKE pattern matching.
 *
 * @param {string} query - Search query text
 * @param {Object} opts - Internal options
 * @returns {Promise<Array<Object>>} Matching memories
 * @private
 */
async function _textSearch(query, opts) {
  const { personaId, userId, limit, sessionId, startTime } = opts;
  const db = getPool();

  // Split query into words, filter very short words
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  if (queryWords.length === 0) {
    // No meaningful keywords — fall back to importance+recency ranking
    const result = await db.query(
      `SELECT id, memory_type, content, importance_score, created_at
       FROM memories
       WHERE persona_id = $1 AND user_id = $2
       ORDER BY importance_score DESC, created_at DESC
       LIMIT $3`,
      [personaId, userId, limit]
    );

    await logOperation('semantic_search', {
      sessionId,
      personaId,
      userId,
      details: {
        strategy: 'importance_recency',
        results_count: result.rows.length,
        reason: 'no_meaningful_keywords'
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return result.rows;
  }

  // Build keyword matching: count how many query words appear in content
  // Using parameterized ILIKE for each word
  const conditions = queryWords.map((_, i) => `content ILIKE $${i + 3}`);
  const matchCount = conditions.map(c => `CASE WHEN ${c} THEN 1 ELSE 0 END`).join(' + ');
  const params = [personaId, userId, ...queryWords.map(w => `%${w}%`), limit];

  const result = await db.query(
    `SELECT id, memory_type, content, importance_score, created_at,
       (${matchCount}) AS keyword_matches
     FROM memories
     WHERE persona_id = $1 AND user_id = $2
       AND (${conditions.join(' OR ')})
     ORDER BY keyword_matches DESC, importance_score DESC
     LIMIT $${params.length}`,
    params
  );

  await logOperation('semantic_search', {
    sessionId,
    personaId,
    userId,
    details: {
      strategy: 'text_search',
      results_count: result.rows.length,
      keywords_used: queryWords.length
    },
    durationMs: Date.now() - startTime,
    success: true
  });

  return result.rows;
}

/**
 * Select the most relevant memories for injection from a pre-loaded set.
 *
 * Strategy: Hybrid approach
 * 1. Always include the most important memory (anchor)
 * 2. Include recent memories for continuity
 * 3. Fill remaining slots with semantically relevant memories (keyword match)
 *
 * @param {Array} memories - All available memories
 * @param {string} query - Current user question
 * @param {number} max - Maximum memories to return
 * @returns {Array} Selected memories
 */
export function selectMemories(memories, query, max) {
  if (memories.length === 0) return [];
  if (memories.length <= max) return memories;

  const selected = [];
  const used = new Set();

  // SLOT 1: Most important memory (the anchor)
  const mostImportant = memories.reduce((best, m) =>
    m.importance_score > best.importance_score ? m : best
  );
  selected.push(mostImportant);
  used.add(mostImportant.id);

  // SLOTS 2-3: Most recent memories (continuity)
  const byRecency = [...memories]
    .filter(m => !used.has(m.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  for (let i = 0; i < 2 && i < byRecency.length && selected.length < max; i++) {
    selected.push(byRecency[i]);
    used.add(byRecency[i].id);
  }

  // REMAINING SLOTS: Keyword relevance
  const remaining = memories.filter(m => !used.has(m.id));

  if (remaining.length > 0) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const scored = remaining.map(m => ({
      memory: m,
      score: queryWords.filter(w =>
        m.content.toLowerCase().includes(w)
      ).length
    }));

    scored.sort((a, b) => b.score - a.score);

    for (const { memory } of scored) {
      if (selected.length >= max) break;
      selected.push(memory);
    }
  }

  return selected;
}
