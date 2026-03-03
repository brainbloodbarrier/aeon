/**
 * AEON Matrix - Memory Retrieval
 *
 * Canonical owner of hybrid memory search. Uses Reciprocal Rank Fusion (RRF)
 * to merge two independently ranked lists — vector similarity (HNSW-indexed)
 * and importance+recency — instead of a weighted linear combination that
 * prevents index usage.
 *
 * Each CTE uses a bare ORDER BY operator (embedding <=> $3::vector or
 * importance_score DESC) so pgvector's HNSW index is actually leveraged.
 *
 * Constitution Principle II: All infrastructure operations are invisible.
 * Constitution Principle IV: Relationship continuity through memory.
 *
 * @module compute/memory-retrieval
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import { generateEmbedding } from './embedding-provider.js';
import { SEMANTIC_SEARCH, RRF_CONFIG, HNSW_CONFIG } from './constants.js';

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Execute a query function within a transaction that sets optimal HNSW index
 * parameters via SET LOCAL (scoped to the current transaction only).
 *
 * pgvector 0.8.0+ iterative_scan prevents under-fetching when post-filter
 * selectivity (e.g. persona_id + user_id) reduces candidates below LIMIT.
 *
 * @param {Object} db - PostgreSQL pool/client with query() method
 * @param {Function} queryFn - Async function that performs the actual search query
 * @returns {Promise<*>} Result of queryFn
 * @private
 */
async function withHnswConfig(db, queryFn) {
  await db.query('BEGIN');
  try {
    await db.query(`SET LOCAL hnsw.iterative_scan = '${HNSW_CONFIG.ITERATIVE_SCAN}'`);
    if (HNSW_CONFIG.EF_SEARCH !== 40) {
      await db.query(`SET LOCAL hnsw.ef_search = ${HNSW_CONFIG.EF_SEARCH}`);
    }
    const result = await queryFn();
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

/**
 * Hybrid memory search using Reciprocal Rank Fusion (RRF).
 *
 * Runs two separate ranked queries — one by vector cosine distance (uses HNSW
 * index) and one by importance+recency — then fuses them with RRF scoring:
 *   rrf_score = 1/(k + vector_rank) + 1/(k + importance_rank)
 *
 * Falls back to importance+recency when no embedding is available, and to
 * importance-only when RRF returns zero rows (brand-new user with no embedded
 * memories yet).
 *
 * @param {string} personaId - Persona UUID
 * @param {string} userId - User UUID
 * @param {number[]|null} queryEmbedding - 384-D embedding vector (or null)
 * @param {Object} [options={}] - Search options
 * @param {number} [options.limit] - Max results (default: SEMANTIC_SEARCH.DEFAULT_LIMIT)
 * @param {number} [options.overFetchMultiplier] - CTE over-fetch factor (default: RRF_CONFIG.OVER_FETCH_MULTIPLIER)
 * @param {number} [options.rrf_k] - RRF smoothing constant (default: RRF_CONFIG.K)
 * @returns {Promise<{rows: Array<Object>, strategy: string}>} Matching memories and strategy used
 */
export async function hybridMemorySearch(personaId, userId, queryEmbedding, options = {}) {
  const {
    limit = SEMANTIC_SEARCH.DEFAULT_LIMIT,
    overFetchMultiplier = RRF_CONFIG.OVER_FETCH_MULTIPLIER,
    rrf_k = RRF_CONFIG.K
  } = options;

  const db = getPool();
  const overFetchLimit = limit * overFetchMultiplier;

  if (!queryEmbedding) {
    // Fallback: importance + recency when no embedding available.
    // `limit` is a numeric constant from SEMANTIC_SEARCH — safe to interpolate.
    const result = await db.query(
      `SELECT id, memory_type, content, importance_score, created_at
       FROM memories
       WHERE persona_id = $1 AND user_id = $2
       ORDER BY importance_score DESC, created_at DESC
       LIMIT ${limit}`,
      [personaId, userId]
    );
    return { rows: result.rows, strategy: 'importance_recency' };
  }

  // RRF: Two separate ranked lists fused by reciprocal rank.
  // Each CTE uses a bare ORDER BY that enables HNSW index usage.
  // Wrapped in withHnswConfig to set iterative_scan for filtered queries.
  //
  // overFetchLimit, rrf_k, and limit are all numeric constants derived from
  // RRF_CONFIG / SEMANTIC_SEARCH (not user input) — template literal
  // interpolation is correct and intentional; parameterizing them would
  // degrade PG query planning with no security benefit.
  const result = await withHnswConfig(db, () => db.query(
    `WITH vector_search AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $3::vector) AS rank
        FROM memories
        WHERE persona_id = $1 AND user_id = $2 AND embedding IS NOT NULL
        ORDER BY embedding <=> $3::vector
        LIMIT ${overFetchLimit}
     ),
     importance_search AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY importance_score DESC, created_at DESC) AS rank
        FROM memories
        WHERE persona_id = $1 AND user_id = $2
        ORDER BY importance_score DESC, created_at DESC
        LIMIT ${overFetchLimit}
     )
     SELECT m.id, m.memory_type, m.content, m.importance_score, m.created_at,
            COALESCE(1.0 / (${rrf_k} + v.rank), 0) + COALESCE(1.0 / (${rrf_k} + i.rank), 0) AS rrf_score
     FROM vector_search v
     FULL OUTER JOIN importance_search i ON v.id = i.id
     JOIN memories m ON m.id = COALESCE(v.id, i.id)
     ORDER BY rrf_score DESC
     LIMIT ${limit}`,
    [personaId, userId, JSON.stringify(queryEmbedding)]
  ));

  // If RRF returned nothing (brand new user), fallback to importance+recency
  if (result.rows.length === 0) {
    const fallback = await db.query(
      `SELECT id, memory_type, content, importance_score, created_at
       FROM memories
       WHERE persona_id = $1 AND user_id = $2
       ORDER BY importance_score DESC, created_at DESC
       LIMIT ${limit}`,
      [personaId, userId]
    );
    return { rows: fallback.rows, strategy: 'rrf_fallback_to_importance' };
  }

  return { rows: result.rows, strategy: 'rrf_hybrid' };
}

/**
 * Search memories by semantic similarity using pgvector embeddings.
 *
 * Generates an embedding for the query text, then delegates to
 * hybridMemorySearch for RRF-based retrieval. Falls back to text search
 * if embedding generation fails.
 *
 * @param {string} query - The search query text
 * @param {Object} options - Search options
 * @param {string} options.personaId - Persona UUID to scope results
 * @param {string} options.userId - User UUID to scope results
 * @param {number} [options.limit] - Max results (default: SEMANTIC_SEARCH.DEFAULT_LIMIT)
 * @param {number} [options.minSimilarity] - Unused (kept for API compat), filtering now implicit via RRF ranking
 * @param {string} [options.sessionId] - Session UUID for logging
 * @returns {Promise<Array<Object>>} Matching memories sorted by relevance, or empty array on error
 */
export async function searchByEmbedding(query, options = {}) {
  const {
    personaId,
    userId,
    limit = SEMANTIC_SEARCH.DEFAULT_LIMIT,
    sessionId = null
  } = options;

  const startTime = Date.now();

  try {
    // Attempt to generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    if (queryEmbedding) {
      const { rows, strategy } = await hybridMemorySearch(
        personaId, userId, queryEmbedding, { limit }
      );

      await logOperation('semantic_search', {
        sessionId,
        personaId,
        userId,
        details: {
          strategy,
          results_count: rows.length
        },
        durationMs: Date.now() - startTime,
        success: true
      });

      return rows;
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
