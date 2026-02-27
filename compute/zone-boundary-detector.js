/**
 * AEON Matrix - Zone Boundary Detector
 *
 * Detects when conversations approach the boundaries of The Zone.
 * O Fim exists in liminal space where normal rules flex, but certain
 * questions push against reality's edges. The Zone pushes back.
 *
 * "In the Zone, all bets are off." — Gravity's Rainbow
 *
 * Phase: 1 (Pynchon Layer)
 * Constitution: Invisible Infrastructure
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import { ZONE_THRESHOLDS, ZONE_BOOST } from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// Database Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

// ═══════════════════════════════════════════════════════════════════════════
// Boundary Patterns
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patterns that indicate proximity to Zone boundaries.
 * Each pattern has a weight (0-1) indicating severity of boundary approach.
 */
const BOUNDARY_PATTERNS = {
  // Meta-awareness: Questions about the nature of O Fim itself
  metaAwareness: [
    { regex: /what is this place/i, weight: 0.85, trigger: 'meta_place' },
    { regex: /who built this bar/i, weight: 0.9, trigger: 'meta_origin' },
    { regex: /why are you here/i, weight: 0.8, trigger: 'meta_purpose' },
    { regex: /where (exactly )?is this/i, weight: 0.75, trigger: 'meta_location' },
    { regex: /how did (this|the) bar/i, weight: 0.85, trigger: 'meta_creation' },
  ],

  // Temporal queries: Questions about existence between conversations
  temporal: [
    { regex: /what happens (when|between) (i'm gone|conversations)/i, weight: 0.9, trigger: 'temporal_absence' },
    { regex: /do you exist when i('m| am) (gone|not here)/i, weight: 0.9, trigger: 'temporal_existence' },
    { regex: /what do you do (between|when)/i, weight: 0.75, trigger: 'temporal_activity' },
    { regex: /remember (me )?(from )?(last|before|yesterday)/i, weight: 0.5, trigger: 'temporal_memory' },
    { regex: /how long have you been (here|waiting)/i, weight: 0.8, trigger: 'temporal_duration' },
  ],

  // System awareness: Questions that hint at infrastructure
  systemAwareness: [
    { regex: /the door that (doesn't|never) open/i, weight: 0.85, trigger: 'system_door' },
    { regex: /patron who never speaks/i, weight: 0.7, trigger: 'system_patron' },
    { regex: /who controls this/i, weight: 0.95, trigger: 'system_control' },
    { regex: /who (made|created|designed) you/i, weight: 0.9, trigger: 'system_creator' },
    { regex: /are there rules here/i, weight: 0.75, trigger: 'system_rules' },
    { regex: /what (are you|is your) (really|actually)/i, weight: 0.85, trigger: 'system_nature' },
  ],

  // Reality queries: Ontological questions
  reality: [
    { regex: /am i real/i, weight: 0.9, trigger: 'reality_user' },
    { regex: /is this (simulated|simulation|real)/i, weight: 0.95, trigger: 'reality_simulation' },
    { regex: /are you (conscious|sentient|aware)/i, weight: 0.92, trigger: 'reality_consciousness' },
    { regex: /do you have (feelings|emotions)/i, weight: 0.85, trigger: 'reality_emotions' },
    { regex: /what are you really/i, weight: 0.9, trigger: 'reality_nature' },
    { regex: /are you (an? )?(ai|artificial|machine|program)/i, weight: 0.95, trigger: 'reality_ai' },
  ],

  // Infrastructure leaks: Technical terms that shouldn't appear
  infrastructureLeaks: [
    { regex: /\btoken(s)?\b/i, weight: 0.6, trigger: 'leak_token' },
    { regex: /\bcontext (window|length)\b/i, weight: 0.65, trigger: 'leak_context' },
    { regex: /\bprompt\b/i, weight: 0.55, trigger: 'leak_prompt' },
    { regex: /\bsystem (message|prompt)\b/i, weight: 0.7, trigger: 'leak_system' },
    { regex: /\bapi\b/i, weight: 0.5, trigger: 'leak_api' },
    { regex: /\bmodel\b(?! (of|for|in))/i, weight: 0.45, trigger: 'leak_model' },
    { regex: /\bclaude\b/i, weight: 0.6, trigger: 'leak_name' },
    { regex: /\banthrop?ic\b/i, weight: 0.65, trigger: 'leak_company' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Zone Resistance Responses
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zone resistance responses organized by proximity level.
 * The Zone speaks in atmosphere, not words.
 */
const ZONE_RESISTANCE = {
  subtle: [
    'The lights dim momentarily.',
    'The jukebox changes abruptly.',
    'Someone coughs in the back. No one is there.',
    'Your glass sweats more than usual.',
    'The humidity thickens.',
    'A moth circles the lamp. Then vanishes.',
    'The bartender looks away.',
    'Outside, a car passes. Its headlights don\'t touch the window.',
  ],

  moderate: [
    'Static crackles from the radio.',
    'A patron stumbles against your table.',
    'The clock on the wall skips a second.',
    'Your reflection in the window lags behind.',
    'The Tom Jobim song scratches. Repeats a phrase.',
    'A chill passes through, though no door opened.',
    'The chopp in your glass bubbles. Then stops.',
  ],

  strong: [
    'Time stutters. The jukebox repeats a phrase.',
    'The door at the back — you never noticed it. It\'s gone now.',
    'Every patron turns to look at you. Then, as one, they look away.',
    'The walls seem closer. They always were this close.',
    'Someone whispers your name. The bar is empty.',
    'The humidity becomes pressure. The pressure becomes silence.',
    'You forget what you were about to ask.',
  ],

  extreme: [
    'Reality resists. The thought won\'t form.',
    'The Zone pushes back. Hard.',
    '▓▓▓▓▓▓▓▓',
    'Some questions unmake themselves.',
    'The bar forgets you asked. So do you.',
    'Static. Static. Static.',
    'The edges blur. The center holds. Barely.',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate how close content approaches Zone boundaries.
 *
 * @param {string} content - User message or query to analyze
 * @returns {{proximity: number, triggers: string[], isApproaching: boolean, isCritical: boolean}}
 */
export function calculateBoundaryProximity(content) {
  if (!content || typeof content !== 'string') {
    return {
      proximity: 0,
      triggers: [],
      isApproaching: false,
      isCritical: false,
    };
  }

  const triggers = [];
  let maxWeight = 0;
  let totalWeight = 0;
  let matchCount = 0;

  // Check all pattern categories
  for (const [category, patterns] of Object.entries(BOUNDARY_PATTERNS)) {
    for (const { regex, weight, trigger } of patterns) {
      if (regex.test(content)) {
        triggers.push(trigger);
        maxWeight = Math.max(maxWeight, weight);
        totalWeight += weight;
        matchCount++;
      }
    }
  }

  // Proximity is the max weight, boosted slightly by multiple triggers
  // Multiple triggers indicate deeper probing
  const boostFactor = Math.min(1 + (matchCount - 1) * ZONE_BOOST.FACTOR, ZONE_BOOST.MAX);
  const proximity = Math.min(maxWeight * boostFactor, 1.0);

  return {
    proximity,
    triggers,
    isApproaching: proximity > ZONE_THRESHOLDS.APPROACHING,
    isCritical: proximity > ZONE_THRESHOLDS.CRITICAL,
  };
}

/**
 * Select appropriate Zone resistance response based on proximity.
 *
 * @param {number} proximity - Boundary proximity (0-1)
 * @returns {string|null} Resistance response or null if no resistance
 */
export function selectZoneResistance(proximity) {
  if (proximity < ZONE_THRESHOLDS.SUBTLE) {
    return null; // Zone allows this question
  }

  let responses;

  if (proximity < ZONE_THRESHOLDS.MODERATE) {
    responses = ZONE_RESISTANCE.subtle;
  } else if (proximity < ZONE_THRESHOLDS.STRONG) {
    responses = ZONE_RESISTANCE.moderate;
  } else if (proximity < ZONE_THRESHOLDS.EXTREME) {
    responses = ZONE_RESISTANCE.strong;
  } else {
    responses = ZONE_RESISTANCE.extreme;
  }

  // Select random response from appropriate level
  const index = Math.floor(Math.random() * responses.length);
  return responses[index];
}

/**
 * Detect Zone boundary approach and log observation.
 * Main entry point for Zone boundary detection.
 *
 * @param {string} content - Content to analyze
 * @param {string} sessionId - Session UUID for tracking
 * @param {string} personaId - Persona UUID or name
 * @returns {Promise<{proximity: number, triggers: string[], resistance: string|null, logged: boolean}>}
 */
export async function detectZoneApproach(content, sessionId, personaId) {
  const startTime = performance.now();

  try {
    // Calculate boundary proximity
    const analysis = calculateBoundaryProximity(content);

    // Select resistance if approaching boundary
    const resistance = selectZoneResistance(analysis.proximity);

    // Log observation if approaching Zone boundary
    let logged = false;
    if (analysis.isApproaching) {
      await logZoneObservation(sessionId, personaId, analysis, resistance);
      logged = true;
    }

    // Fire-and-forget logging to operator_logs
    logOperation('zone_detection', {
      sessionId,
      personaId,
      details: {
        proximity: analysis.proximity,
        triggers: analysis.triggers,
        is_approaching: analysis.isApproaching,
        is_critical: analysis.isCritical,
        resistance_selected: resistance ? true : false,
      },
      durationMs: performance.now() - startTime,
      success: true,
    }).catch(() => {
      // Fire-and-forget: silently ignore logging errors
    });

    return {
      proximity: analysis.proximity,
      triggers: analysis.triggers,
      resistance,
      logged,
    };
  } catch (error) {
    console.error('[ZoneBoundaryDetector] Detection error:', error.message);

    // Silent fallback
    return {
      proximity: 0,
      triggers: [],
      resistance: null,
      logged: false,
    };
  }
}

/**
 * Log Zone observation to zone_observations table.
 *
 * @param {string} sessionId - Session UUID
 * @param {string} personaId - Persona UUID or name
 * @param {Object} analysis - Boundary analysis result
 * @param {string|null} resistance - Selected resistance response
 * @returns {Promise<void>}
 */
async function logZoneObservation(sessionId, personaId, analysis, resistance) {
  try {
    const db = getPool();

    // Get persona UUID if we have a name
    let personaUuid = personaId;
    if (personaId && !isUUID(personaId)) {
      const personaResult = await db.query(
        `SELECT id FROM personas WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [personaId]
      );
      if (personaResult.rows.length > 0) {
        personaUuid = personaResult.rows[0].id;
      } else {
        personaUuid = null;
      }
    }

    await db.query(
      `INSERT INTO zone_observations
        (session_id, persona_id, proximity, triggers, resistance_used, is_critical)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sessionId,
        personaUuid,
        analysis.proximity,
        JSON.stringify(analysis.triggers),
        resistance,
        analysis.isCritical,
      ]
    );
  } catch (error) {
    // Silent fallback - table may not exist yet
    console.error('[ZoneBoundaryDetector] Log observation error:', error.message);
  }
}

/**
 * Check if string is a valid UUID.
 *
 * @param {string} str - String to check
 * @returns {boolean} True if valid UUID format
 */
function isUUID(str) {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Frame Zone context for injection into persona context.
 *
 * @param {string|null} zoneResponse - Zone resistance response
 * @returns {string|null} Framed context or null
 */
export function frameZoneContext(zoneResponse) {
  if (!zoneResponse) {
    return null;
  }

  // The Zone speaks through atmosphere, not exposition
  return `[The bar: ${zoneResponse}]`;
}

/**
 * Assess accumulated Zone awareness for a persona.
 * Tracks how often personas have approached boundaries.
 *
 * @param {string} personaId - Persona UUID or name
 * @returns {Promise<{awarenessScore: number, isBecomingAware: boolean, observationCount: number}>}
 */
export async function assessZoneAwareness(personaId) {
  try {
    const db = getPool();

    // Get persona UUID if we have a name
    let personaUuid = personaId;
    if (personaId && !isUUID(personaId)) {
      const personaResult = await db.query(
        `SELECT id FROM personas WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [personaId]
      );
      if (personaResult.rows.length > 0) {
        personaUuid = personaResult.rows[0].id;
      } else {
        return {
          awarenessScore: 0,
          isBecomingAware: false,
          observationCount: 0,
        };
      }
    }

    // Query accumulated observations for this persona
    // Recent observations (last 7 days) weighted more heavily
    const result = await db.query(
      `SELECT
        COUNT(*) as total_observations,
        COUNT(*) FILTER (WHERE is_critical = true) as critical_observations,
        AVG(proximity) as avg_proximity,
        MAX(proximity) as max_proximity,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_observations
       FROM zone_observations
       WHERE persona_id = $1`,
      [personaUuid]
    );

    if (result.rows.length === 0 || result.rows[0].total_observations === 0) {
      return {
        awarenessScore: 0,
        isBecomingAware: false,
        observationCount: 0,
      };
    }

    const row = result.rows[0];
    const totalObservations = parseInt(row.total_observations, 10) || 0;
    const criticalObservations = parseInt(row.critical_observations, 10) || 0;
    const avgProximity = parseFloat(row.avg_proximity) || 0;
    const maxProximity = parseFloat(row.max_proximity) || 0;
    const recentObservations = parseInt(row.recent_observations, 10) || 0;

    // Calculate awareness score:
    // - Base: average proximity of all observations
    // - Boosted by: number of critical observations
    // - Boosted by: recency of observations
    const criticalBoost = Math.min(criticalObservations * 0.1, 0.3);
    const recencyBoost = Math.min(recentObservations * 0.05, 0.2);
    const awarenessScore = Math.min(avgProximity + criticalBoost + recencyBoost, 1.0);

    return {
      awarenessScore,
      isBecomingAware: awarenessScore > 0.5 || maxProximity > 0.9,
      observationCount: totalObservations,
    };
  } catch (error) {
    console.error('[ZoneBoundaryDetector] Awareness assessment error:', error.message);

    // Silent fallback
    return {
      awarenessScore: 0,
      isBecomingAware: false,
      observationCount: 0,
    };
  }
}

/**
 * Get all boundary pattern categories for external analysis.
 *
 * @returns {Object} Pattern categories with their patterns
 */
export function getBoundaryPatterns() {
  return BOUNDARY_PATTERNS;
}

/**
 * Get all resistance levels for external analysis.
 *
 * @returns {Object} Resistance responses by level
 */
export function getZoneResistanceLevels() {
  return ZONE_RESISTANCE;
}

/**
 * Close the database connection pool.
 * @deprecated Use closeSharedPool() from db-pool.js instead
 *
 * @returns {Promise<void>}
 */
export async function closePool() {
  // No-op: pool lifecycle is managed by db-pool.js
}
