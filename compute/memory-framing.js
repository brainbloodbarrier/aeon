/**
 * AEON Matrix - Memory Framing
 *
 * Transforms raw memory objects into natural language persona recollection.
 * Memories appear as genuine thoughts, not database lookups.
 *
 * Feature: 002-invisible-infrastructure
 */

import pg from 'pg';
import { logOperation } from './operator-logger.js';
const { Pool } = pg;

let pool = null;

/**
 * Get or create database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL ||
      'postgres://architect:matrix_secret@localhost:5432/aeon_matrix';

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  return pool;
}

/**
 * Default templates by memory type.
 * {content} is replaced with memory content.
 * {user_ref} is replaced based on trust level.
 */
const DEFAULT_TEMPLATES = {
  interaction: 'You recall {user_ref} mentioning: "{content}"',
  relationship: 'You remember this about them: {content}',
  insight: 'A thought surfaces from your experience: {content}',
  learning: 'You have come to understand: {content}',
  general: 'From your memory: {content}'
};

/**
 * User reference by trust level.
 */
const USER_REFERENCES = {
  stranger: 'a visitor',
  acquaintance: 'your acquaintance',
  familiar: 'your friend',
  confidant: 'your trusted companion'
};

/**
 * Frame a single memory as natural language.
 *
 * @param {Object} memory - Memory object from database
 * @param {string} memory.memory_type - Type of memory
 * @param {string} memory.content - Memory content
 * @param {string} template - Template string with placeholders
 * @param {string} userRef - How to reference the user
 *
 * @returns {string} Framed memory text
 */
function frameMemory(memory, template, userRef) {
  if (!memory.content || memory.content.trim() === '') {
    return '';
  }

  // Truncate content if too long (max 300 chars per frame)
  let content = memory.content.trim();
  if (content.length > 300) {
    content = content.substring(0, 297) + '...';
  }

  // Replace placeholders
  let framed = template
    .replace(/{content}/g, content)
    .replace(/{user_ref}/g, userRef);

  return framed;
}

/**
 * Frame memories as natural language for persona context.
 *
 * @param {Array<Object>} memories - Retrieved memory objects
 * @param {Object} relationship - Current relationship state
 * @param {string} relationship.trust_level - Trust level (stranger, acquaintance, familiar, confidant)
 * @param {string} [personaId] - For persona-specific templates (optional)
 * @param {string} [sessionId] - For logging (optional)
 *
 * @returns {Promise<string>} Framed memories as natural language
 *
 * @example
 * const framed = await frameMemories(
 *   [{ memory_type: 'interaction', content: 'discussed Kant last week' }],
 *   { trust_level: 'acquaintance' }
 * );
 * // Returns: "You recall your acquaintance mentioning: \"discussed Kant last week\""
 */
export async function frameMemories(memories, relationship, personaId = null, sessionId = null) {
  const startTime = Date.now();

  try {
    // Handle empty memories gracefully
    if (!memories || memories.length === 0) {
      await logOperation('memory_framing', {
        sessionId,
        personaId,
        details: {
          memories_framed: 0,
          templates_used: [],
          total_characters: 0
        },
        durationMs: Date.now() - startTime,
        success: true
      });
      return '';
    }

    // Get user reference based on trust level
    const trustLevel = relationship?.trust_level || 'stranger';
    const userRef = USER_REFERENCES[trustLevel] || USER_REFERENCES.stranger;

    // Load custom templates if persona-specific
    const templates = { ...DEFAULT_TEMPLATES };
    if (personaId) {
      try {
        const customTemplates = await loadCustomTemplates(personaId);
        Object.assign(templates, customTemplates);
      } catch (error) {
        // Fallback to defaults on error
        console.error('[MemoryFraming] Failed to load custom templates, using defaults:', error.message);
      }
    }

    // Frame each memory
    const framedMemories = [];
    const templatesUsed = new Set();

    for (const memory of memories) {
      const memoryType = memory.memory_type || 'general';
      const template = templates[memoryType] || templates.general;
      templatesUsed.add(memoryType);

      const framed = frameMemory(memory, template, userRef);
      if (framed) {
        framedMemories.push(framed);
      }
    }

    const output = framedMemories.join('\n');

    // Log operation silently
    await logOperation('memory_framing', {
      sessionId,
      personaId,
      details: {
        memories_framed: framedMemories.length,
        templates_used: Array.from(templatesUsed),
        total_characters: output.length
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return output;

  } catch (error) {
    // Log error gracefully
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'memory_framing_failure',
        error_message: error.message,
        fallback_used: 'empty_string'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    // Return empty string, never expose error to user
    return '';
  }
}

/**
 * Load custom templates for a specific persona from database.
 *
 * @param {string} personaId - Persona UUID
 * @returns {Promise<Object>} Custom templates keyed by memory type
 */
async function loadCustomTemplates(personaId) {
  const db = getPool();

  const result = await db.query(
    `SELECT subtype, template
     FROM context_templates
     WHERE template_type = 'memory'
       AND persona_id = $1
       AND active = true
     ORDER BY priority DESC`,
    [personaId]
  );

  const customTemplates = {};
  for (const row of result.rows) {
    if (row.subtype) {
      customTemplates[row.subtype] = row.template;
    }
  }

  return customTemplates;
}

/**
 * Configuration object for external access to defaults.
 */
export const CONFIG = {
  DEFAULT_TEMPLATES,
  USER_REFERENCES,
  MAX_MEMORY_CHARS: 300
};
