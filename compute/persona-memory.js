/**
 * AEON Matrix - Persona Memory System
 *
 * Manages persona-specific memories and opinions independent of users.
 * What each voice knows, believes, and has learned from others.
 *
 * Feature: 007-persona-autonomy
 * Constitution: Principle VI (Persona Autonomy)
 */

import pg from 'pg';
const { Pool } = pg;

import { logOperation } from './operator-logger.js';

let pool = null;

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valid memory types for persona memories.
 */
export const MEMORY_TYPES = {
  opinion: 'opinion',     // Stance on a subject
  fact: 'fact',           // Established knowledge
  interaction: 'interaction', // What happened in a council/discussion
  insight: 'insight',     // A realization or epiphany
  learned: 'learned'      // Something learned from another persona
};

/**
 * Default importance scores by memory type.
 */
export const DEFAULT_IMPORTANCE = {
  opinion: 0.7,
  fact: 0.5,
  interaction: 0.6,
  insight: 0.8,
  learned: 0.6
};

/**
 * Maximum memories to retrieve per query.
 */
export const MAX_MEMORIES_PER_QUERY = 10;

// ═══════════════════════════════════════════════════════════════════════════
// Database Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get or create database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('[PersonaMemory] DATABASE_URL environment variable is required');
    }
    const connectionString = process.env.DATABASE_URL;

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('[PersonaMemory] Unexpected error on idle client', err);
    });
  }

  return pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// Memory Operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Store a persona's independent memory.
 *
 * @param {string} personaId - Persona UUID
 * @param {Object} memory - Memory to store
 * @param {string} memory.type - One of MEMORY_TYPES
 * @param {string} memory.content - Memory content
 * @param {string} [memory.context] - What prompted this memory
 * @param {number} [memory.importance] - Importance score 0.0-1.0
 * @param {string} [memory.sourcePersonaId] - Who they learned from (for 'learned' type)
 * @returns {Promise<Object>} Created memory record
 */
export async function storePersonaMemory(personaId, memory) {
  const startTime = performance.now();

  const {
    type,
    content,
    context = null,
    importance = DEFAULT_IMPORTANCE[type] || 0.5,
    sourcePersonaId = null
  } = memory;

  // Validate memory type
  if (!Object.values(MEMORY_TYPES).includes(type)) {
    throw new Error(`Invalid memory type: ${type}. Must be one of: ${Object.values(MEMORY_TYPES).join(', ')}`);
  }

  try {
    const db = getPool();

    const result = await db.query(`
      INSERT INTO persona_memories (
        persona_id, source_persona_id, memory_type, content, context, importance_score
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [personaId, sourcePersonaId, type, content, context, importance]);

    await logOperation('persona_memory_store', {
      personaId,
      details: {
        memory_type: type,
        content_length: content.length,
        importance,
        has_source: !!sourcePersonaId
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return result.rows[0];
  } catch (error) {
    console.error('[PersonaMemory] Error storing memory:', error.message);
    await logOperation('persona_memory_store', {
      personaId,
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });
    throw error;
  }
}

/**
 * Retrieve persona's memories by type and importance.
 *
 * @param {string} personaId - Persona UUID or name
 * @param {Object} [options] - Retrieval options
 * @param {string} [options.type] - Filter by memory type
 * @param {number} [options.limit] - Maximum memories to return
 * @param {number} [options.minImportance] - Minimum importance threshold
 * @returns {Promise<Array<Object>>} Array of memory objects
 */
export async function getPersonaMemories(personaId, options = {}) {
  const startTime = performance.now();

  const {
    type = null,
    limit = MAX_MEMORIES_PER_QUERY,
    minImportance = 0.0
  } = options;

  try {
    const db = getPool();

    // Build query based on options
    let query = `
      SELECT
        pm.*,
        sp.name as source_persona_name
      FROM persona_memories pm
      LEFT JOIN personas sp ON pm.source_persona_id = sp.id
      JOIN personas p ON pm.persona_id = p.id
      WHERE (p.id::text = $1 OR LOWER(p.name) = LOWER($1))
        AND pm.importance_score >= $2
    `;

    const params = [personaId, minImportance];

    if (type) {
      query += ` AND pm.memory_type = $${params.length + 1}`;
      params.push(type);
    }

    query += `
      ORDER BY pm.importance_score DESC, pm.created_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await db.query(query, params);

    // Update access counts for retrieved memories
    if (result.rows.length > 0) {
      const memoryIds = result.rows.map(m => m.id);
      await db.query(`
        UPDATE persona_memories
        SET access_count = access_count + 1, last_accessed = NOW()
        WHERE id = ANY($1)
      `, [memoryIds]);
    }

    await logOperation('persona_memory_retrieve', {
      personaId,
      details: {
        type_filter: type,
        min_importance: minImportance,
        retrieved_count: result.rows.length
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return result.rows;
  } catch (error) {
    console.error('[PersonaMemory] Error retrieving memories:', error.message);
    await logOperation('persona_memory_retrieve', {
      personaId,
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Opinion Operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Form or update a persona's opinion on a topic.
 *
 * @param {string} personaId - Persona UUID
 * @param {string} topic - Topic of opinion
 * @param {string} stance - The opinion itself
 * @param {number} [confidence=0.5] - Confidence level 0.0-1.0
 * @returns {Promise<Object>} Created/updated opinion record
 */
export async function formOpinion(personaId, topic, stance, confidence = 0.5) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Upsert opinion
    const result = await db.query(`
      INSERT INTO persona_opinions (persona_id, topic, stance, confidence)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (persona_id, topic) DO UPDATE
      SET
        stance = EXCLUDED.stance,
        confidence = EXCLUDED.confidence,
        expression_count = persona_opinions.expression_count + 1,
        last_expressed = NOW()
      RETURNING *
    `, [personaId, topic.toLowerCase().trim(), stance, confidence]);

    await logOperation('persona_opinion_form', {
      personaId,
      details: {
        topic,
        confidence,
        stance_length: stance.length
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return result.rows[0];
  } catch (error) {
    console.error('[PersonaMemory] Error forming opinion:', error.message);
    await logOperation('persona_opinion_form', {
      personaId,
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });
    throw error;
  }
}

/**
 * Get a persona's opinion on a specific topic.
 *
 * @param {string} personaId - Persona UUID or name
 * @param {string} topic - Topic to look up
 * @returns {Promise<Object|null>} Opinion object or null if none
 */
export async function getOpinion(personaId, topic) {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT po.*
      FROM persona_opinions po
      JOIN personas p ON po.persona_id = p.id
      WHERE (p.id::text = $1 OR LOWER(p.name) = LOWER($1))
        AND po.topic = $2
      LIMIT 1
    `, [personaId, topic.toLowerCase().trim()]);

    if (result.rows.length > 0) {
      // Update expression tracking
      await db.query(`
        UPDATE persona_opinions
        SET expression_count = expression_count + 1, last_expressed = NOW()
        WHERE id = $1
      `, [result.rows[0].id]);
    }

    return result.rows[0] || null;
  } catch (error) {
    console.error('[PersonaMemory] Error getting opinion:', error.message);
    return null;
  }
}

/**
 * Get all opinions for a persona.
 *
 * @param {string} personaId - Persona UUID or name
 * @param {number} [minConfidence=0.0] - Minimum confidence threshold
 * @returns {Promise<Array<Object>>} Array of opinion objects
 */
export async function getAllOpinions(personaId, minConfidence = 0.0) {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT po.*
      FROM persona_opinions po
      JOIN personas p ON po.persona_id = p.id
      WHERE (p.id::text = $1 OR LOWER(p.name) = LOWER($1))
        AND po.confidence >= $2
      ORDER BY po.confidence DESC, po.expression_count DESC
    `, [personaId, minConfidence]);

    return result.rows;
  } catch (error) {
    console.error('[PersonaMemory] Error getting opinions:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cross-Persona Learning
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Record that one persona learned something from another.
 * Used during council sessions when personas exchange insights.
 *
 * @param {string} learnerPersonaId - Persona who learned
 * @param {string} teacherPersonaId - Persona who taught
 * @param {string} content - What was learned
 * @param {string} [context] - Council session or interaction context
 * @returns {Promise<Object>} Created memory record
 */
export async function learnFromPersona(learnerPersonaId, teacherPersonaId, content, context = null) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Get teacher name for richer context
    const teacherResult = await db.query(`
      SELECT name FROM personas WHERE id = $1
    `, [teacherPersonaId]);

    const teacherName = teacherResult.rows[0]?.name || 'unknown';

    // Store as 'learned' type memory
    const memory = await storePersonaMemory(learnerPersonaId, {
      type: MEMORY_TYPES.learned,
      content,
      context: context || `Learned from ${teacherName}`,
      sourcePersonaId: teacherPersonaId,
      importance: 0.7  // Learning from others is relatively important
    });

    await logOperation('persona_cross_learning', {
      personaId: learnerPersonaId,
      details: {
        teacher_id: teacherPersonaId,
        teacher_name: teacherName,
        content_length: content.length
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return memory;
  } catch (error) {
    console.error('[PersonaMemory] Error recording learning:', error.message);
    await logOperation('persona_cross_learning', {
      personaId: learnerPersonaId,
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });
    throw error;
  }
}

/**
 * Get what a persona has learned from others.
 *
 * @param {string} personaId - Persona UUID or name
 * @param {string} [sourcePersonaId] - Filter by specific teacher
 * @param {number} [limit] - Maximum to return
 * @returns {Promise<Array<Object>>} Array of learned memories
 */
export async function getLearnedMemories(personaId, sourcePersonaId = null, limit = 5) {
  return getPersonaMemories(personaId, {
    type: MEMORY_TYPES.learned,
    limit
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard & Statistics
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get memory statistics for a persona (dashboard).
 *
 * @param {string} personaId - Persona UUID or name
 * @returns {Promise<Object>} Memory statistics
 */
export async function getPersonaMemoryStats(personaId) {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT
        COUNT(*) as total_memories,
        COUNT(*) FILTER (WHERE memory_type = 'opinion') as opinions,
        COUNT(*) FILTER (WHERE memory_type = 'fact') as facts,
        COUNT(*) FILTER (WHERE memory_type = 'interaction') as interactions,
        COUNT(*) FILTER (WHERE memory_type = 'insight') as insights,
        COUNT(*) FILTER (WHERE memory_type = 'learned') as learned,
        COALESCE(AVG(importance_score), 0) as avg_importance,
        COALESCE(SUM(access_count), 0) as total_accesses
      FROM persona_memories pm
      JOIN personas p ON pm.persona_id = p.id
      WHERE p.id::text = $1 OR LOWER(p.name) = LOWER($1)
    `, [personaId]);

    return result.rows[0];
  } catch (error) {
    console.error('[PersonaMemory] Error getting stats:', error.message);
    return {
      total_memories: 0,
      opinions: 0,
      facts: 0,
      interactions: 0,
      insights: 0,
      learned: 0,
      avg_importance: 0,
      total_accesses: 0
    };
  }
}

/**
 * Get memory overview for all personas (dashboard).
 *
 * @returns {Promise<Array<Object>>} Array of persona memory stats
 */
export async function getMemoryOverview() {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT * FROM persona_memory_stats
      ORDER BY total_memories DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('[PersonaMemory] Error getting overview:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Context Assembly Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Frame persona memories as natural language for context injection.
 * Used by context-assembler.js to include persona's independent knowledge.
 *
 * @param {Array<Object>} memories - Retrieved memory objects
 * @param {number} [maxTokens=200] - Token budget for framing
 * @returns {string} Framed memories as natural language
 */
export function framePersonaMemories(memories, maxTokens = 200) {
  if (!memories || memories.length === 0) {
    return '';
  }

  const frames = [];
  let estimatedTokens = 0;
  const tokensPerChar = 0.25;  // ~4 chars per token

  for (const memory of memories) {
    let frame = '';

    switch (memory.memory_type) {
      case 'opinion':
        frame = `You believe: "${memory.content}"`;
        break;
      case 'fact':
        frame = `You know: ${memory.content}`;
        break;
      case 'insight':
        frame = `You have realized: ${memory.content}`;
        break;
      case 'learned':
        frame = memory.source_persona_name
          ? `${memory.source_persona_name} taught you: "${memory.content}"`
          : `You learned: "${memory.content}"`;
        break;
      case 'interaction':
        frame = `You recall: ${memory.content}`;
        break;
      default:
        frame = memory.content;
    }

    const frameTokens = frame.length * tokensPerChar;
    if (estimatedTokens + frameTokens > maxTokens) {
      break;
    }

    frames.push(frame);
    estimatedTokens += frameTokens;
  }

  return frames.join('\n');
}
