/**
 * AEON Matrix - Relationship Tracker
 *
 * Tracks persona-user relationships with automatic familiarity progression
 * and trust level transitions. Implements Constitution Principle IV.
 *
 * Feature: 004-relationship-continuity
 * Constitution: Principle IV (Relationship Continuity)
 */

import pg from 'pg';
const { Pool } = pg;

import { logOperation } from './operator-logger.js';

let pool = null;

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trust level thresholds based on familiarity_score.
 * Constitution Principle IV defines progression:
 * stranger → acquaintance → familiar → confidant
 */
export const TRUST_THRESHOLDS = {
  stranger: 0,
  acquaintance: 0.2,
  familiar: 0.5,
  confidant: 0.8
};

/**
 * Familiarity calculation parameters.
 */
export const FAMILIARITY_CONFIG = {
  baseDelta: 0.02,          // Base familiarity increase per session
  maxDelta: 0.05,           // Maximum increase per session
  engagementFloor: 0.5,     // Minimum engagement multiplier
  engagementCeiling: 2.0    // Maximum engagement multiplier
};

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
    const connectionString = process.env.DATABASE_URL ||
      'postgres://architect:matrix_secret@localhost:5432/aeon_matrix';

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('[RelationshipTracker] Unexpected error on idle client', err);
    });
  }

  return pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// Trust Level Calculation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate trust level from familiarity score.
 *
 * @param {number} familiarityScore - Current familiarity 0.0-1.0
 * @returns {'stranger' | 'acquaintance' | 'familiar' | 'confidant'} Trust level
 */
export function calculateTrustLevel(familiarityScore) {
  if (familiarityScore >= TRUST_THRESHOLDS.confidant) return 'confidant';
  if (familiarityScore >= TRUST_THRESHOLDS.familiar) return 'familiar';
  if (familiarityScore >= TRUST_THRESHOLDS.acquaintance) return 'acquaintance';
  return 'stranger';
}

// ═══════════════════════════════════════════════════════════════════════════
// Engagement Score Calculation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate engagement score from session quality metrics.
 *
 * @param {Object} sessionQuality - Session quality metrics
 * @param {number} sessionQuality.messageCount - Number of messages in session
 * @param {number} sessionQuality.durationMs - Session duration in milliseconds
 * @param {boolean} sessionQuality.hasFollowUps - Whether session had follow-up questions
 * @param {number} sessionQuality.topicDepth - Topic depth 0-3 scale
 * @returns {number} Engagement score 0.5-2.0
 */
export function calculateEngagementScore(sessionQuality) {
  const { messageCount = 0, durationMs = 0, hasFollowUps = false, topicDepth = 0 } = sessionQuality;

  // Calculate individual components (each capped at 1.0)
  const messageComponent = Math.min(messageCount * 0.1, 1.0);
  const durationComponent = Math.min((durationMs / 60000) * 0.2, 1.0);
  const followUpComponent = hasFollowUps ? 0.5 : 0;
  const depthComponent = Math.min(topicDepth * 0.3, 0.9);

  // Sum and normalize to engagement range
  const rawScore = messageComponent + durationComponent + followUpComponent + depthComponent;

  // Normalize to 0.5-2.0 range
  const normalized = Math.max(
    FAMILIARITY_CONFIG.engagementFloor,
    Math.min(FAMILIARITY_CONFIG.engagementCeiling, rawScore)
  );

  return normalized;
}

/**
 * Calculate effective familiarity delta based on engagement.
 *
 * @param {number} engagementScore - Engagement score 0.5-2.0
 * @returns {number} Effective delta (capped at maxDelta)
 */
export function calculateEffectiveDelta(engagementScore) {
  const rawDelta = FAMILIARITY_CONFIG.baseDelta * engagementScore;
  return Math.min(rawDelta, FAMILIARITY_CONFIG.maxDelta);
}

// ═══════════════════════════════════════════════════════════════════════════
// Relationship Operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieve current relationship state.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @returns {Promise<Object|null>} Relationship object or null
 */
export async function getRelationship(userId, personaId) {
  const startTime = performance.now();

  try {
    const db = getPool();
    const result = await db.query(
      `SELECT
        id,
        persona_id AS "personaId",
        user_id AS "userId",
        familiarity_score AS "familiarityScore",
        trust_level AS "trustLevel",
        interaction_count AS "interactionCount",
        user_summary AS "userSummary",
        user_preferences AS "userPreferences",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM relationships
      WHERE user_id = $1 AND persona_id = $2
      LIMIT 1`,
      [userId, personaId]
    );

    const relationship = result.rows.length > 0 ? result.rows[0] : null;

    // Fire-and-forget logging
    logOperation('relationship_fetch', {
      personaId,
      userId,
      details: {
        found: !!relationship,
        trust_level: relationship?.trustLevel || null,
        familiarity_score: relationship?.familiarityScore || null
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return relationship;

  } catch (error) {
    console.error('[RelationshipTracker] Error fetching relationship:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      personaId,
      userId,
      details: {
        error_type: 'relationship_fetch_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    return null;
  }
}

/**
 * Get or create relationship record.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @returns {Promise<Object>} Relationship object (existing or new)
 */
export async function ensureRelationship(userId, personaId) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Try to get existing relationship
    const existing = await getRelationship(userId, personaId);
    if (existing) {
      return existing;
    }

    // Create new relationship
    const result = await db.query(
      `INSERT INTO relationships (user_id, persona_id, familiarity_score, trust_level, interaction_count)
       VALUES ($1, $2, 0.0, 'stranger', 0)
       RETURNING
         id,
         persona_id AS "personaId",
         user_id AS "userId",
         familiarity_score AS "familiarityScore",
         trust_level AS "trustLevel",
         interaction_count AS "interactionCount",
         user_summary AS "userSummary",
         user_preferences AS "userPreferences",
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [userId, personaId]
    );

    const relationship = result.rows[0];

    // Fire-and-forget logging
    logOperation('relationship_create', {
      personaId,
      userId,
      details: {
        trust_level: relationship.trustLevel,
        familiarity_score: relationship.familiarityScore
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return relationship;

  } catch (error) {
    console.error('[RelationshipTracker] Error ensuring relationship:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      personaId,
      userId,
      details: {
        error_type: 'relationship_ensure_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return default on failure (invisible infrastructure)
    return {
      id: null,
      personaId,
      userId,
      familiarityScore: 0,
      trustLevel: 'stranger',
      interactionCount: 0,
      userSummary: null,
      userPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

/**
 * Update familiarity score based on session quality.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @param {Object} sessionQuality - Session quality metrics
 * @returns {Promise<Object>} Update result with delta and trust changes
 */
export async function updateFamiliarity(userId, personaId, sessionQuality) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Get current state
    const current = await ensureRelationship(userId, personaId);
    const previousFamiliarity = current.familiarityScore;
    const previousTrustLevel = current.trustLevel;

    // Calculate new familiarity
    const engagementScore = calculateEngagementScore(sessionQuality);
    const effectiveDelta = calculateEffectiveDelta(engagementScore);
    const newFamiliarity = Math.min(1.0, Math.max(0.0, previousFamiliarity + effectiveDelta));

    // Calculate new trust level
    const newTrustLevel = calculateTrustLevel(newFamiliarity);
    const trustLevelChanged = previousTrustLevel !== newTrustLevel;

    // Update database
    await db.query(
      `UPDATE relationships
       SET
         familiarity_score = $1,
         trust_level = $2,
         interaction_count = interaction_count + 1,
         updated_at = NOW()
       WHERE user_id = $3 AND persona_id = $4`,
      [newFamiliarity, newTrustLevel, userId, personaId]
    );

    // Fire-and-forget logging for relationship update
    logOperation('relationship_update', {
      personaId,
      userId,
      details: {
        previous_familiarity: previousFamiliarity,
        new_familiarity: newFamiliarity,
        effective_delta: effectiveDelta,
        engagement_score: engagementScore,
        trust_level: newTrustLevel,
        session_quality: sessionQuality
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    // Log trust level change if occurred
    if (trustLevelChanged) {
      logOperation('trust_level_change', {
        personaId,
        userId,
        details: {
          old_level: previousTrustLevel,
          new_level: newTrustLevel,
          familiarity_score: newFamiliarity
        },
        durationMs: 0,
        success: true
      }).catch(() => {});
    }

    return {
      previousFamiliarity,
      newFamiliarity,
      effectiveDelta,
      trustLevelChanged,
      previousTrustLevel,
      newTrustLevel
    };

  } catch (error) {
    console.error('[RelationshipTracker] Error updating familiarity:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      personaId,
      userId,
      details: {
        error_type: 'familiarity_update_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return sensible defaults on failure
    return {
      previousFamiliarity: 0,
      newFamiliarity: 0,
      effectiveDelta: 0,
      trustLevelChanged: false,
      previousTrustLevel: 'stranger',
      newTrustLevel: 'stranger'
    };
  }
}

/**
 * Update user summary for a relationship.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @param {string} summary - New summary text
 * @returns {Promise<void>}
 */
export async function updateUserSummary(userId, personaId, summary) {
  const startTime = performance.now();

  try {
    const db = getPool();

    await db.query(
      `UPDATE relationships
       SET user_summary = $1, updated_at = NOW()
       WHERE user_id = $2 AND persona_id = $3`,
      [summary, userId, personaId]
    );

    // Fire-and-forget logging
    logOperation('user_summary_update', {
      personaId,
      userId,
      details: {
        summary_length: summary?.length || 0
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

  } catch (error) {
    console.error('[RelationshipTracker] Error updating user summary:', error.message);
    // Fire-and-forget: silently ignore errors
  }
}

/**
 * Update user preferences/patterns for a relationship.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @param {Object} patterns - Patterns to merge into preferences
 * @returns {Promise<void>}
 */
export async function updateUserPreferences(userId, personaId, patterns) {
  const startTime = performance.now();

  try {
    const db = getPool();

    await db.query(
      `UPDATE relationships
       SET user_preferences = user_preferences || $1::jsonb, updated_at = NOW()
       WHERE user_id = $2 AND persona_id = $3`,
      [JSON.stringify(patterns), userId, personaId]
    );

    // Fire-and-forget logging
    logOperation('user_preferences_update', {
      personaId,
      userId,
      details: {
        patterns_added: Object.keys(patterns).length
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

  } catch (error) {
    console.error('[RelationshipTracker] Error updating user preferences:', error.message);
    // Fire-and-forget: silently ignore errors
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Queries
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get aggregate relationship statistics.
 *
 * @param {number} hours - Time window for recent activity (default 24)
 * @returns {Promise<Object[]>} Relationship overview per persona
 */
export async function getRelationshipOverview(hours = 24) {
  const startTime = performance.now();

  try {
    const db = getPool();

    const result = await db.query(
      `SELECT
        ro.*,
        (
          SELECT COUNT(*)
          FROM relationships r
          WHERE r.persona_id = ro.persona_id
            AND r.updated_at > NOW() - ($1 || ' hours')::INTERVAL
        ) AS recent_activity
      FROM relationship_overview ro`,
      [hours]
    );

    // Transform to camelCase with trustDistribution
    const overview = result.rows.map(row => ({
      personaId: row.persona_id,
      personaName: row.persona_name,
      category: row.category,
      totalUsers: parseInt(row.total_users) || 0,
      avgFamiliarity: parseFloat(row.avg_familiarity) || 0,
      trustDistribution: {
        stranger: parseInt(row.strangers) || 0,
        acquaintance: parseInt(row.acquaintances) || 0,
        familiar: parseInt(row.familiars) || 0,
        confidant: parseInt(row.confidants) || 0
      },
      totalMemories: parseInt(row.total_memories) || 0,
      recentActivity: parseInt(row.recent_activity) || 0
    }));

    // Fire-and-forget logging
    logOperation('relationship_overview', {
      details: {
        hours,
        persona_count: overview.length
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return overview;

  } catch (error) {
    console.error('[RelationshipTracker] Error getting overview:', error.message);
    return [];
  }
}

/**
 * Get recent relationship activity.
 *
 * @param {number} hours - Time window (default 24)
 * @param {number} limit - Max results (default 100)
 * @returns {Promise<Object[]>} Recent relationship changes
 */
export async function getRecentActivity(hours = 24, limit = 100) {
  try {
    const db = getPool();

    const result = await db.query(
      `SELECT
        r.id AS "relationshipId",
        p.name AS "personaName",
        r.familiarity_score AS "familiarityScore",
        r.trust_level AS "trustLevel",
        r.interaction_count AS "interactionCount",
        r.updated_at AS "updatedAt"
      FROM relationships r
      JOIN personas p ON r.persona_id = p.id
      WHERE r.updated_at > NOW() - ($1 || ' hours')::INTERVAL
      ORDER BY r.updated_at DESC
      LIMIT $2`,
      [hours, limit]
    );

    return result.rows;

  } catch (error) {
    console.error('[RelationshipTracker] Error getting recent activity:', error.message);
    return [];
  }
}

/**
 * Get recent trust level transitions.
 *
 * @param {number} limit - Max results (default 50)
 * @returns {Promise<Object[]>} Trust level transitions
 */
export async function getTrustLevelTransitions(limit = 50) {
  try {
    const db = getPool();

    const result = await db.query(
      `SELECT * FROM trust_level_transitions LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      personaId: row.persona_id,
      personaName: row.persona_name,
      fromLevel: row.from_level,
      toLevel: row.to_level,
      atScore: parseFloat(row.at_score) || 0,
      createdAt: row.created_at
    }));

  } catch (error) {
    console.error('[RelationshipTracker] Error getting transitions:', error.message);
    return [];
  }
}

/**
 * Close the database connection pool.
 *
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
