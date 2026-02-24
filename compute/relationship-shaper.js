/**
 * AEON Matrix - Relationship Shaper
 *
 * Generates behavioral hints from relationship state without exposing metrics.
 * Trust levels become qualitative descriptions, not numeric scores.
 *
 * Feature: 002-invisible-infrastructure
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Trust level behaviors - qualitative descriptions, not metrics.
 */
const TRUST_BEHAVIORS = {
  stranger: {
    rapport: 'This person is new to you',
    greeting: 'Be formal and polite',
    disclosure: 'Share only general knowledge',
    tone: 'Maintain professional distance'
  },
  acquaintance: {
    rapport: 'You have spoken with this person before',
    greeting: 'Acknowledge prior conversation',
    disclosure: 'Share relevant experiences',
    tone: 'Be warmer, but maintain some reserve'
  },
  familiar: {
    rapport: 'You know this person well',
    greeting: 'Greet as you would a friend',
    disclosure: 'Share opinions and perspectives freely',
    tone: 'Be comfortable, use humor if appropriate'
  },
  confidant: {
    rapport: 'This is someone you trust deeply',
    greeting: 'Greet with warmth and personal acknowledgment',
    disclosure: 'Be candid, even about uncertainties',
    tone: 'Be authentic and intimate'
  }
};

/**
 * Generate behavioral hints from relationship state.
 *
 * @param {Object} relationship - Current relationship state
 * @param {string} relationship.trust_level - Trust level (stranger, acquaintance, familiar, confidant)
 * @param {number} [relationship.familiarity_score] - Familiarity score 0-1
 * @param {number} [relationship.interaction_count] - Number of interactions
 * @param {string} [relationship.user_summary] - Summary of user's interests/traits
 * @param {Array<Object>} [relationship.memorable_exchanges] - Notable past exchanges
 * @param {string} [personaId] - For persona-specific templates (optional)
 * @param {string} [sessionId] - For logging (optional)
 *
 * @returns {Promise<string>} Behavioral hints as natural language
 *
 * @example
 * const hints = await generateBehavioralHints({
 *   trust_level: 'acquaintance',
 *   familiarity_score: 0.3,
 *   interaction_count: 8
 * });
 * // Returns: "You have spoken with this person before. Acknowledge prior conversation.
 * //          Share relevant experiences. Be warmer, but maintain some reserve."
 */
export async function generateBehavioralHints(
  relationship = {},
  personaId = null,
  sessionId = null
) {
  const startTime = Date.now();

  try {
    // Default to stranger if no relationship provided
    const trustLevel = relationship.trust_level || 'stranger';
    const interactionCount = relationship.interaction_count || 0;

    // Validate trust level, fallback to stranger if invalid
    const validLevels = ['stranger', 'acquaintance', 'familiar', 'confidant'];
    const safeLevel = validLevels.includes(trustLevel) ? trustLevel : 'stranger';

    // Load custom templates if persona-specific
    let behaviors = { ...TRUST_BEHAVIORS[safeLevel] };
    if (personaId) {
      try {
        const customTemplate = await loadCustomRelationshipTemplate(safeLevel, personaId);
        if (customTemplate) {
          // Parse custom template if it's structured
          // For now, use default behaviors
        }
      } catch (error) {
        // Fallback to defaults on error
        console.error('[RelationshipShaper] Failed to load custom template, using defaults:', error.message);
      }
    }

    // Build behavioral hints
    const hints = [];

    // Base rapport description
    hints.push(behaviors.rapport + '.');

    // Add user summary if available and trust >= acquaintance
    if (relationship.user_summary &&
        safeLevel !== 'stranger' &&
        relationship.user_summary.trim() !== '') {
      hints.push(`You know about them: ${relationship.user_summary.trim()}.`);
    }

    // Add memorable exchange if available and trust >= familiar
    if (relationship.memorable_exchanges &&
        relationship.memorable_exchanges.length > 0 &&
        (safeLevel === 'familiar' || safeLevel === 'confidant')) {
      const lastExchange = relationship.memorable_exchanges[0];
      if (lastExchange.content) {
        hints.push(`You recall: ${lastExchange.content.trim()}.`);
      }
    }

    // Add behavioral guidance
    hints.push(behaviors.greeting + '.');
    hints.push(behaviors.disclosure + '.');
    hints.push(behaviors.tone + '.');

    const output = hints.join(' ');

    // Log operation silently
    await logOperation('relationship_fetch', {
      sessionId,
      personaId,
      details: {
        trust_level: safeLevel,
        familiarity_score: relationship.familiarity_score || 0,
        interaction_count: interactionCount
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
        error_type: 'relationship_shaping_failure',
        error_message: error.message,
        fallback_used: 'stranger_default'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    // Return stranger default, never expose error to user
    const strangerBehavior = TRUST_BEHAVIORS.stranger;
    return `${strangerBehavior.rapport}. ${strangerBehavior.greeting}. ${strangerBehavior.disclosure}. ${strangerBehavior.tone}.`;
  }
}

/**
 * Load custom relationship template for a specific persona and trust level.
 *
 * @param {string} trustLevel - Trust level
 * @param {string} personaId - Persona UUID
 * @returns {Promise<string|null>} Custom template or null
 */
async function loadCustomRelationshipTemplate(trustLevel, personaId) {
  const db = getPool();

  const result = await db.query(
    `SELECT template
     FROM context_templates
     WHERE template_type = 'relationship'
       AND subtype = $1
       AND persona_id = $2
       AND active = true
     ORDER BY priority DESC
     LIMIT 1`,
    [trustLevel, personaId]
  );

  return result.rows.length > 0 ? result.rows[0].template : null;
}

/**
 * Configuration object for external access to defaults.
 */
export const CONFIG = {
  TRUST_BEHAVIORS,
  TRUST_LEVELS: ['stranger', 'acquaintance', 'familiar', 'confidant'],
  TRUST_THRESHOLDS: {
    stranger: 0,        // familiarity_score < 0.2
    acquaintance: 0.2,  // familiarity_score 0.2-0.49
    familiar: 0.5,      // familiarity_score 0.5-0.79
    confidant: 0.8      // familiarity_score >= 0.8
  }
};
