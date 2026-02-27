/**
 * AEON Matrix - Narrative Gravity
 *
 * Tracks conversation arc following Pynchon's rocket parabola from Gravity's Rainbow.
 * The rocket's trajectory is the central metaphor: rising, reaching apex, then the
 * inevitable fall. Conversations at O Fim follow the same arc.
 *
 * "A screaming comes across the sky." - Pynchon
 *
 * At APEX: Maximum insight potential, crystallization moment
 * On DESCENT: Entropy increases, clarity fades, preterite surfaces more
 * At IMPACT: Conversation exhausts itself, reset needed
 *
 * Feature: Pynchon Layer - Narrative Arc
 * Constitution: Principle II (Invisible Infrastructure)
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import {
  ARC_PHASES,
  PHASE_THRESHOLDS,
  MOMENTUM_CONFIG,
  PHASE_EFFECTS,
  IMPACT_RECOVERY_LIMIT
} from './constants.js';

// =============================================================================
// Re-export constants for backward compatibility
// =============================================================================

export { ARC_PHASES, PHASE_THRESHOLDS };

/**
 * Patterns that increase momentum.
 */
const MOMENTUM_BOOSTERS = {
  deepQuestions: {
    patterns: [
      /\bwhy\b.*\?/i,
      /\bwhat does .* mean\b/i,
      /\bhow do you (?:feel|think|see)\b/i,
      /\bwhat is the nature of\b/i,
      /\bexplain .* to me\b/i,
      /\bI (?:don't|do not) understand\b/i
    ],
    delta: 0.08
  },
  philosophicalProbing: {
    patterns: [
      /\b(?:truth|meaning|existence|consciousness|reality|being)\b/i,
      /\b(?:essence|soul|spirit|dialectic|synthesis)\b/i,
      /\b(?:paradox|contradiction|infinite|eternal)\b/i,
      /\b(?:freedom|will|destiny|fate|death)\b/i
    ],
    delta: 0.06
  },
  emotionalEngagement: {
    patterns: [
      /\b(?:love|hate|fear|hope|despair|joy|sorrow)\b/i,
      /\b(?:beautiful|terrible|magnificent|profound)\b/i,
      /!{2,}/,
      /\?{2,}/
    ],
    delta: 0.05
  },
  followUpDepth: {
    patterns: [
      /\bbut (?:what|why|how)\b/i,
      /\band (?:what about|how does)\b/i,
      /\btell me more\b/i,
      /\belaborate\b/i,
      /\bgo on\b/i,
      /\bcontinue\b/i
    ],
    delta: 0.04
  }
};

/**
 * Patterns that decrease momentum.
 */
const MOMENTUM_DRAINS = {
  surfaceQuestions: {
    patterns: [
      /\bwhat is your (?:name|favorite)\b/i,
      /\bhow are you\b/i,
      /\bwhat (?:time|day) is it\b/i,
      /\bcan you\b/i
    ],
    delta: -0.03
  },
  fatigueSignals: {
    patterns: [
      /\banyway\b/i,
      /\bwhatever\b/i,
      /\bnever ?mind\b/i,
      /\bforget it\b/i,
      /\bi guess\b/i,
      /\bdoesn't matter\b/i
    ],
    delta: -0.08
  },
  repetition: {
    patterns: [
      /\bagain\b/i,
      /\brepeat\b/i,
      /\bsame (?:thing|question)\b/i
    ],
    delta: -0.05
  },
  disengagement: {
    patterns: [
      /\bok\b$/i,
      /^ok$/i,
      /\bsure\b$/i,
      /^sure$/i,
      /\bfine\b$/i,
      /^fine$/i,
      /\byeah\b$/i,
      /^yeah$/i
    ],
    delta: -0.06
  },
  topicExhaustion: {
    patterns: [
      /\benough (?:about|of) (?:this|that)\b/i,
      /\blet's (?:move on|change|talk about something)\b/i,
      /\bmoving on\b/i
    ],
    delta: -0.1
  }
};

/**
 * Arc context prose by phase.
 */
const ARC_CONTEXT_PROSE = {
  [ARC_PHASES.RISING]: [
    'The question deepens. Something is building.',
    'Momentum gathers like storm clouds over Rio.',
    'The conversation ascends. The jukebox plays a little louder.',
    'Each exchange adds weight to the arc.'
  ],
  [ARC_PHASES.APEX]: [
    'A crystalline moment. The insight is here, now.',
    'The peak. Everything is clear from this height.',
    'The rocket hangs suspended at its apex. Time dilates.',
    'Maximum altitude. The truth is visible, briefly.'
  ],
  [ARC_PHASES.FALLING]: [
    'The peak has passed. Clarity recedes like tide.',
    'Descent begins. Entropy creeps in at the edges.',
    'The trajectory bends earthward. Something is lost in translation.',
    'Gravity reasserts itself. The fall is gentle but inevitable.'
  ],
  [ARC_PHASES.IMPACT]: [
    'The conversation has spent itself. Only echoes remain.',
    'Impact. The arc is complete. Reset or disperse.',
    'Ground zero. The exchange has exhausted its potential.',
    'Nothing left but the crater where meaning once was.'
  ]
};

// PHASE_EFFECTS imported from constants.js

// =============================================================================
// Phase Classification
// =============================================================================

/**
 * Classify momentum into arc phase.
 *
 * @param {number} momentum - Momentum value 0.0-1.0
 * @param {string} currentPhase - Current phase (for hysteresis)
 * @returns {string} Phase name from ARC_PHASES
 */
function classifyPhase(momentum, currentPhase) {
  // From APEX, only transition to FALLING if below falling threshold
  if (currentPhase === ARC_PHASES.APEX) {
    if (momentum < PHASE_THRESHOLDS.FALLING_BELOW) {
      return ARC_PHASES.FALLING;
    }
    return ARC_PHASES.APEX;
  }

  // From FALLING, transition to IMPACT if very low
  if (currentPhase === ARC_PHASES.FALLING) {
    if (momentum < PHASE_THRESHOLDS.IMPACT_BELOW) {
      return ARC_PHASES.IMPACT;
    }
    // Can rise back if momentum increases
    if (momentum >= PHASE_THRESHOLDS.APEX_MIN) {
      return ARC_PHASES.APEX;
    }
    return ARC_PHASES.FALLING;
  }

  // From IMPACT, stay at IMPACT (requires reset)
  if (currentPhase === ARC_PHASES.IMPACT) {
    return ARC_PHASES.IMPACT;
  }

  // From RISING (or initial), check thresholds
  if (momentum >= PHASE_THRESHOLDS.APEX_MIN) {
    return ARC_PHASES.APEX;
  }

  if (momentum < PHASE_THRESHOLDS.IMPACT_BELOW) {
    return ARC_PHASES.IMPACT;
  }

  if (momentum < PHASE_THRESHOLDS.FALLING_BELOW) {
    return ARC_PHASES.FALLING;
  }

  return ARC_PHASES.RISING;
}

// =============================================================================
// Session Arc Operations
// =============================================================================

/**
 * Get or create narrative arc for session.
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @param {string} sessionId - Session UUID
 * @returns {Promise<Object>} Arc state
 * @property {string} phase - Current phase from ARC_PHASES
 * @property {number} momentum - Current momentum 0.0-1.0
 * @property {Date|null} apexReachedAt - When apex was first reached (if ever)
 * @property {Date} createdAt - Arc creation time
 * @property {number} messageCount - Number of messages processed
 */
export async function getSessionArc(sessionId) {
  const startTime = performance.now();

  try {
    const db = getSharedPool();

    // Try to get existing arc
    const result = await db.query(
      `SELECT
        arc_phase,
        momentum,
        apex_reached_at,
        created_at,
        updated_at
      FROM narrative_arcs
      WHERE session_id = $1
      LIMIT 1`,
      [sessionId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        phase: row.arc_phase,
        momentum: parseFloat(row.momentum),
        apexReachedAt: row.apex_reached_at,
        createdAt: row.created_at,
        messageCount: 0, // Not tracked in current schema
        updatedAt: row.updated_at
      };
    }

    // Create new arc
    const insertResult = await db.query(
      `INSERT INTO narrative_arcs (
        session_id,
        arc_phase,
        momentum
      ) VALUES ($1, $2, $3)
      RETURNING arc_phase, momentum, apex_reached_at, created_at, updated_at`,
      [sessionId, ARC_PHASES.RISING, MOMENTUM_CONFIG.initialMomentum]
    );

    const newArc = insertResult.rows[0];

    // Fire-and-forget logging
    logOperation('arc_created', {
      sessionId,
      details: {
        initial_phase: newArc.arc_phase,
        initial_momentum: newArc.momentum
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return {
      phase: newArc.arc_phase,
      momentum: parseFloat(newArc.momentum),
      apexReachedAt: newArc.apex_reached_at,
      createdAt: newArc.created_at,
      messageCount: 0,
      updatedAt: newArc.updated_at
    };

  } catch (error) {
    console.error('[NarrativeGravity] Error getting session arc:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'arc_fetch_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return default arc on failure (invisible infrastructure)
    return {
      phase: ARC_PHASES.RISING,
      momentum: MOMENTUM_CONFIG.initialMomentum,
      apexReachedAt: null,
      createdAt: new Date(),
      messageCount: 0,
      updatedAt: new Date()
    };
  }
}

/**
 * Analyze message to determine momentum change.
 *
 * @param {string} message - User message to analyze
 * @param {string} currentPhase - Current arc phase
 * @param {number} currentMomentum - Current momentum value
 * @returns {Object} Momentum analysis
 * @property {number} delta - Change in momentum
 * @property {string} reason - Primary reason for change
 * @property {string[]} boosts - Boosters that matched
 * @property {string[]} drains - Drains that matched
 */
export function analyzeMomentum(message, currentPhase, currentMomentum) {
  if (!message || typeof message !== 'string') {
    return {
      delta: -MOMENTUM_CONFIG.baseDecay,
      reason: 'no_message',
      boosts: [],
      drains: []
    };
  }

  let delta = -MOMENTUM_CONFIG.baseDecay; // Natural decay
  const boosts = [];
  const drains = [];

  // Check boosters
  for (const [name, config] of Object.entries(MOMENTUM_BOOSTERS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(message)) {
        delta += config.delta;
        boosts.push(name);
        break; // Only count each category once
      }
    }
  }

  // Check drains
  for (const [name, config] of Object.entries(MOMENTUM_DRAINS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(message)) {
        delta += config.delta; // Already negative
        drains.push(name);
        break; // Only count each category once
      }
    }
  }

  // Determine primary reason
  let reason = 'neutral';
  if (boosts.length > drains.length) {
    reason = boosts[0];
  } else if (drains.length > 0) {
    reason = drains[0];
  }

  // Phase-specific modifiers
  if (currentPhase === ARC_PHASES.IMPACT) {
    // At impact, very hard to regain momentum
    delta = Math.min(delta, IMPACT_RECOVERY_LIMIT);
  }

  return {
    delta,
    reason,
    boosts,
    drains
  };
}

/**
 * Update arc state with momentum delta.
 *
 * @param {string} sessionId - Session UUID
 * @param {number} momentumDelta - Change in momentum
 * @returns {Promise<Object>} Updated arc state
 * @property {string} newPhase - Phase after update
 * @property {number} newMomentum - Momentum after update
 * @property {boolean} phaseChanged - Whether phase transitioned
 * @property {string|null} previousPhase - Phase before update (if changed)
 */
export async function updateArc(sessionId, momentumDelta, client = null) {
  const startTime = performance.now();

  try {
    const db = client || getSharedPool();

    // Get current arc
    const currentArc = await getSessionArc(sessionId);
    const previousPhase = currentArc.phase;
    const previousMomentum = currentArc.momentum;

    // Calculate new momentum (clamped)
    const newMomentum = Math.max(
      MOMENTUM_CONFIG.minMomentum,
      Math.min(MOMENTUM_CONFIG.maxMomentum, previousMomentum + momentumDelta)
    );

    // Determine new phase
    const newPhase = classifyPhase(newMomentum, previousPhase);
    const phaseChanged = newPhase !== previousPhase;

    // Check if apex was reached for first time
    let apexReachedAt = currentArc.apexReachedAt;
    if (newPhase === ARC_PHASES.APEX && !apexReachedAt) {
      apexReachedAt = new Date();
    }

    // Update database
    await db.query(
      `UPDATE narrative_arcs
       SET arc_phase = $1,
           momentum = $2,
           apex_reached_at = COALESCE(apex_reached_at, $3),
           updated_at = NOW()
       WHERE session_id = $4`,
      [newPhase, newMomentum, apexReachedAt, sessionId]
    );

    // Log phase transition if occurred
    if (phaseChanged) {
      logOperation('arc_phase_transition', {
        sessionId,
        details: {
          from_phase: previousPhase,
          to_phase: newPhase,
          momentum: newMomentum,
          delta: momentumDelta
        },
        durationMs: performance.now() - startTime,
        success: true
      }).catch(() => {});
    }

    // Fire-and-forget update logging
    logOperation('arc_update', {
      sessionId,
      details: {
        previous_momentum: previousMomentum,
        delta: momentumDelta,
        new_momentum: newMomentum,
        phase: newPhase,
        phase_changed: phaseChanged
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return {
      newPhase,
      newMomentum,
      phaseChanged,
      previousPhase: phaseChanged ? previousPhase : null,
      apexReachedAt
    };

  } catch (error) {
    console.error('[NarrativeGravity] Error updating arc:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'arc_update_failure',
        error_message: error.message,
        attempted_delta: momentumDelta
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return minimal fallback
    return {
      newPhase: ARC_PHASES.RISING,
      newMomentum: MOMENTUM_CONFIG.initialMomentum,
      phaseChanged: false,
      previousPhase: null,
      apexReachedAt: null
    };
  }
}

// =============================================================================
// Phase Effects
// =============================================================================

/**
 * Get phase-specific effects for other systems.
 *
 * @param {string} phase - Current phase from ARC_PHASES
 * @param {number} momentum - Current momentum value
 * @returns {Object} Phase effects
 * @property {number} entropyModifier - Modifier for entropy system
 * @property {number} preteriteChance - Chance of preterite surfacing
 * @property {number} insightBonus - Bonus/penalty to insight clarity
 */
export function getPhaseEffects(phase, momentum) {
  const baseEffects = PHASE_EFFECTS[phase] || PHASE_EFFECTS[ARC_PHASES.RISING];

  // Scale effects by momentum within phase
  const momentumFactor = momentum;

  return {
    entropyModifier: baseEffects.entropyModifier,
    preteriteChance: baseEffects.preteriteChance * (1 + (1 - momentumFactor) * 0.5),
    insightBonus: baseEffects.insightBonus * momentumFactor
  };
}

// =============================================================================
// Context Generation
// =============================================================================

/**
 * Generate arc-aware context prose.
 *
 * @param {Object} arc - Arc state from getSessionArc
 * @returns {string} Prose about conversation trajectory
 */
export function generateArcContext(arc) {
  if (!arc || !arc.phase) {
    return '';
  }

  const phrasesForPhase = ARC_CONTEXT_PROSE[arc.phase] || ARC_CONTEXT_PROSE[ARC_PHASES.RISING];
  const index = Math.floor(Math.random() * phrasesForPhase.length);

  return phrasesForPhase[index];
}

/**
 * Frame arc context for context assembly injection.
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @param {string} arcContext - Context from generateArcContext
 * @returns {string} Framed context for injection
 */
export function frameArcContext(arcContext) {
  if (!arcContext) {
    return '';
  }

  return `[Arc: ${arcContext}]`;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if arc is at apex moment (for special handling).
 *
 * @param {Object} arc - Arc state from getSessionArc
 * @returns {boolean} Whether arc is at apex
 */
export function isApexMoment(arc) {
  return arc && arc.phase === ARC_PHASES.APEX;
}

/**
 * Reset arc for new session or fresh start.
 *
 * @param {string} sessionId - Session UUID
 * @returns {Promise<Object>} Fresh arc state
 */
export async function resetArc(sessionId) {
  const startTime = performance.now();

  try {
    const db = getSharedPool();

    // Delete existing arc if any
    await db.query(
      `DELETE FROM narrative_arcs WHERE session_id = $1`,
      [sessionId]
    );

    // Create fresh arc
    const result = await db.query(
      `INSERT INTO narrative_arcs (
        session_id,
        arc_phase,
        momentum
      ) VALUES ($1, $2, $3)
      RETURNING arc_phase, momentum, apex_reached_at, created_at, updated_at`,
      [sessionId, ARC_PHASES.RISING, MOMENTUM_CONFIG.initialMomentum]
    );

    const newArc = result.rows[0];

    // Fire-and-forget logging
    logOperation('arc_reset', {
      sessionId,
      details: {
        initial_phase: newArc.arc_phase,
        initial_momentum: newArc.momentum
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return {
      phase: newArc.arc_phase,
      momentum: parseFloat(newArc.momentum),
      apexReachedAt: newArc.apex_reached_at,
      createdAt: newArc.created_at,
      messageCount: 0,
      updatedAt: newArc.updated_at
    };

  } catch (error) {
    console.error('[NarrativeGravity] Error resetting arc:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'arc_reset_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return default arc on failure
    return {
      phase: ARC_PHASES.RISING,
      momentum: MOMENTUM_CONFIG.initialMomentum,
      apexReachedAt: null,
      createdAt: new Date(),
      messageCount: 0,
      updatedAt: new Date()
    };
  }
}

// =============================================================================
// Dashboard Queries
// =============================================================================

/**
 * Get arc statistics for dashboard.
 *
 * @param {number} hours - Time window (default 24)
 * @returns {Promise<Object>} Arc statistics
 */
export async function getArcStats(hours = 24) {
  try {
    const db = getSharedPool();

    const result = await db.query(
      `SELECT
        COUNT(*) AS total_arcs,
        COUNT(*) FILTER (WHERE arc_phase = 'rising') AS rising_count,
        COUNT(*) FILTER (WHERE arc_phase = 'apex') AS apex_count,
        COUNT(*) FILTER (WHERE arc_phase = 'falling') AS falling_count,
        COUNT(*) FILTER (WHERE arc_phase = 'impact') AS impact_count,
        AVG(momentum) AS avg_momentum,
        COUNT(*) FILTER (WHERE apex_reached_at IS NOT NULL) AS reached_apex
      FROM narrative_arcs
      WHERE updated_at > NOW() - ($1 || ' hours')::INTERVAL`,
      [hours]
    );

    const row = result.rows[0] || {};

    return {
      totalArcs: parseInt(row.total_arcs) || 0,
      risingCount: parseInt(row.rising_count) || 0,
      apexCount: parseInt(row.apex_count) || 0,
      fallingCount: parseInt(row.falling_count) || 0,
      impactCount: parseInt(row.impact_count) || 0,
      avgMomentum: parseFloat(row.avg_momentum) || 0,
      reachedApex: parseInt(row.reached_apex) || 0,
      timeWindow: hours
    };

  } catch (error) {
    console.error('[NarrativeGravity] Error getting arc stats:', error.message);
    return {
      totalArcs: 0,
      risingCount: 0,
      apexCount: 0,
      fallingCount: 0,
      impactCount: 0,
      avgMomentum: 0,
      reachedApex: 0,
      timeWindow: hours
    };
  }
}

/**
 * Get recent phase transitions for dashboard.
 *
 * @param {number} limit - Maximum entries (default 50)
 * @returns {Promise<Object[]>} Recent transitions
 */
export async function getRecentTransitions(limit = 50) {
  try {
    const db = getSharedPool();

    const result = await db.query(
      `SELECT
        details->>'from_phase' AS "fromPhase",
        details->>'to_phase' AS "toPhase",
        details->>'momentum' AS momentum,
        session_id AS "sessionId",
        created_at AS "createdAt"
      FROM operator_logs
      WHERE operation = 'arc_phase_transition'
      ORDER BY created_at DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      fromPhase: row.fromPhase,
      toPhase: row.toPhase,
      momentum: parseFloat(row.momentum) || 0,
      sessionId: row.sessionId,
      createdAt: row.createdAt
    }));

  } catch (error) {
    console.error('[NarrativeGravity] Error getting recent transitions:', error.message);
    return [];
  }
}

// =============================================================================
// Configuration Export
// =============================================================================

/**
 * Configuration object for external access.
 */
export const CONFIG = {
  ARC_PHASES,
  PHASE_THRESHOLDS,
  MOMENTUM_CONFIG,
  PHASE_EFFECTS
};
