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

import { logOperation } from './operator-logger.js';
import { generateEmbedding } from './embedding-provider.js';
import { hybridMemorySearch } from './memory-retrieval.js';
import { getPersonaMemories, framePersonaMemories } from './persona-memory.js';
import { attemptSurface, framePreteriteContext } from './preterite-memory.js';
import { MEMORY_ORCHESTRATOR } from './constants.js';

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
    // Generate embedding for the query (may return null if service is down)
    const queryEmbedding = await generateEmbedding(query);

    // Delegate to canonical RRF-based hybrid search in memory-retrieval.js
    const { rows, strategy } = await hybridMemorySearch(
      personaId, userId, queryEmbedding,
      { limit: MEMORY_ORCHESTRATOR.RETRIEVAL_LIMIT }
    );

    await logOperation('memory_retrieval', {
      sessionId,
      personaId,
      userId,
      details: {
        memories_selected: rows.length,
        total_available: rows.length,
        selection_strategy: strategy
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return rows;
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
      limit: MEMORY_ORCHESTRATOR.PERSONA_MEMORY_LIMIT,
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
