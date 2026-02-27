/**
 * AEON Matrix - Memory Orchestrator
 *
 * Extracted from context-assembler.js to handle memory-related safe*Fetch functions,
 * memory framing logic, memory ranking/selection, and preterite surfacing.
 *
 * All safe*Fetch helpers catch errors and return null/empty — a failing subsystem
 * must never break context assembly (Constitution Principle II).
 *
 * Feature: 002-invisible-infrastructure
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import { generateEmbedding } from './memory-extractor.js';
import { getPersonaMemories, framePersonaMemories } from './persona-memory.js';
import { attemptSurface, framePreteriteContext } from './preterite-memory.js';

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Estimate token count for a text string.
 * Rough approximation: 1 token ~ 4 characters.
 *
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Truncate memories to fit within token budget.
 *
 * @param {string} memories - Framed memories text
 * @param {number} maxTokens - Maximum tokens allowed
 * @returns {string} Truncated memories
 */
export function truncateMemories(memories, maxTokens) {
  if (!memories) return '';

  const estimatedTokens = estimateTokens(memories);
  if (estimatedTokens <= maxTokens) {
    return memories;
  }

  // Truncate to approximate character count
  const maxChars = maxTokens * 4;
  const lines = memories.split('\n');
  let result = '';
  let currentLength = 0;

  for (const line of lines) {
    if (currentLength + line.length + 1 > maxChars) {
      break;
    }
    result += (result ? '\n' : '') + line;
    currentLength += line.length + 1;
  }

  return result;
}

/**
 * Safely retrieve memories with error handling.
 *
 * @param {string} personaId - Persona UUID
 * @param {string} userId - User UUID
 * @param {string} query - Current query
 * @param {string} sessionId - Session UUID
 * @returns {Promise<Array>} Memory objects or empty array
 */
export async function safeMemoryRetrieval(personaId, userId, query, sessionId) {
  const startTime = Date.now();

  try {
    const db = getPool();
    let strategy = 'importance_and_recency';
    let result;

    // Try hybrid retrieval if we can generate an embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    if (queryEmbedding) {
      // Hybrid: semantic similarity (60%) + importance (40%)
      result = await db.query(
        `SELECT id, memory_type, content, importance_score, created_at,
           (0.6 * (1.0 - (embedding <=> $3::vector)) + 0.4 * importance_score) AS hybrid_score
         FROM memories
         WHERE persona_id = $1 AND user_id = $2 AND embedding IS NOT NULL
         ORDER BY hybrid_score DESC
         LIMIT 10`,
        [personaId, userId, JSON.stringify(queryEmbedding)]
      );
      strategy = 'hybrid';

      // If no embedded memories exist yet, fall back to importance+recency
      if (result.rows.length === 0) {
        result = await db.query(
          `SELECT id, memory_type, content, importance_score, created_at
           FROM memories
           WHERE persona_id = $1 AND user_id = $2
           ORDER BY importance_score DESC, created_at DESC
           LIMIT 10`,
          [personaId, userId]
        );
        strategy = 'hybrid_fallback_to_importance';
      }
    } else {
      // No embedding available — use importance+recency
      result = await db.query(
        `SELECT id, memory_type, content, importance_score, created_at
         FROM memories
         WHERE persona_id = $1 AND user_id = $2
         ORDER BY importance_score DESC, created_at DESC
         LIMIT 10`,
        [personaId, userId]
      );
    }

    await logOperation('memory_retrieval', {
      sessionId,
      personaId,
      userId,
      details: {
        memories_selected: result.rows.length,
        total_available: result.rows.length,
        selection_strategy: strategy
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return result.rows;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'memory_retrieval_failure',
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
 * Fetch persona's independent memories (knowledge not tied to users).
 *
 * @param {string} personaId - Persona UUID
 * @param {number} personaMemoriesBudget - Token budget for persona memories
 * @param {string} sessionId - Session UUID for logging
 * @returns {Promise<string|null>} Framed persona memories or null
 */
export async function safePersonaMemoriesFetch(personaId, personaMemoriesBudget, sessionId = null) {
  const startTime = Date.now();

  try {
    // Get top memories by importance
    const memories = await getPersonaMemories(personaId, {
      limit: 5,
      minImportance: 0.5
    });

    if (!memories || memories.length === 0) {
      return null;
    }

    // Frame as natural language using persona-memory helper
    const framed = framePersonaMemories(memories, personaMemoriesBudget);

    await logOperation('persona_memories_fetch', {
      sessionId,
      personaId,
      details: {
        memories_included: memories.length,
        total_characters: framed?.length || 0
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'persona_memories_fetch_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}

/**
 * Safely attempt to surface preterite memories.
 * 15% chance per session for forgotten memories to emerge, corrupted by entropy.
 *
 * Pynchon Layer: The preterite--passed over, deemed insignificant--occasionally surfaces.
 *
 * @param {string} personaId - Persona UUID
 * @param {string} userId - User UUID
 * @param {string} sessionId - Session UUID for logging
 * @returns {Promise<string|null>} Framed preterite context or null
 */
export async function safePreteriteFetch(personaId, userId, sessionId) {
  const startTime = Date.now();

  try {
    const surfaceResult = await attemptSurface(personaId, userId, 2);

    if (!surfaceResult || !surfaceResult.surfaced) {
      return null;
    }

    const framed = framePreteriteContext(surfaceResult);

    await logOperation('preterite_surface', {
      sessionId,
      personaId,
      userId,
      details: {
        fragments_surfaced: surfaceResult.fragments?.length || 0,
        corruption_applied: true
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'preterite_surface_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}
