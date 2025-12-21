/**
 * AEON Matrix - Entropy Tracker
 *
 * Tracks entropy/decay in O Fim - a Pynchon-inspired concept where
 * the bar gradually decays over time, affecting ambient events.
 *
 * Entropy increases over sessions and time. Higher entropy leads to
 * more decay events, fragmentation, and dissolution. Can be reset
 * through maintenance events (dawn, cleaning, rituals).
 *
 * Feature: Phase 1 - Entropy System
 * Constitution: Setting Preservation (Principle V)
 */

import pg from 'pg';
const { Pool } = pg;

import { logOperation } from './operator-logger.js';

let pool = null;

// =============================================================================
// Constants
// =============================================================================

/**
 * Entropy state thresholds.
 * Each threshold defines the upper bound for that state.
 */
export const ENTROPY_THRESHOLDS = {
  STABLE: 0.3,
  UNSETTLED: 0.5,
  DECAYING: 0.7,
  FRAGMENTING: 0.9,
  DISSOLVING: 1.0
};

/**
 * Entropy state names mapped to threshold ranges.
 */
export const ENTROPY_STATES = {
  STABLE: 'stable',
  UNSETTLED: 'unsettled',
  DECAYING: 'decaying',
  FRAGMENTING: 'fragmenting',
  DISSOLVING: 'dissolving'
};

/**
 * Default entropy configuration.
 */
export const ENTROPY_CONFIG = {
  baseSessionDelta: 0.02,    // Base entropy increase per session
  timeDecayFactor: 0.001,    // Entropy increase per hour of inactivity
  maxEntropy: 1.0,           // Maximum entropy level
  minEntropy: 0.0,           // Minimum entropy level
  defaultLevel: 0.15         // Starting entropy for new instances
};

/**
 * Effects by entropy state level.
 * Each state has an array of possible ambient effects.
 */
const ENTROPY_EFFECTS = {
  stable: [],
  unsettled: [
    'Conversations drift slightly off-topic.',
    'The music skips occasionally.'
  ],
  decaying: [
    'Words don\'t quite land where they\'re aimed.',
    'The lights flicker.'
  ],
  fragmenting: [
    'Sentences fragment mid-thought.',
    'Memory becomes unreliable.'
  ],
  dissolving: [
    'Reality softens at the edges.',
    'Everything tends toward silence.'
  ]
};

/**
 * Ambient markers for each entropy state.
 * Used in context injection.
 */
const ENTROPY_MARKERS = {
  stable: [
    'The chopp flows cold and steady.',
    'Tom Jobim plays softly from the jukebox.',
    'The humidity is comfortable tonight.'
  ],
  unsettled: [
    'Something in the air feels askew.',
    'The jukebox hesitates between songs.',
    'Shadows seem longer than they should be.'
  ],
  decaying: [
    'The edges of things blur if you look too long.',
    'Conversations echo strangely.',
    'The clock on the wall runs backwards occasionally.'
  ],
  fragmenting: [
    'Words arrive before they are spoken.',
    'The bar seems larger from the inside than the outside.',
    'Faces shift when you look away.'
  ],
  dissolving: [
    'The boundaries between here and elsewhere thin.',
    'Sound arrives from directions that don\'t exist.',
    'O Fim remembers itself differently each moment.'
  ]
};

// =============================================================================
// Database Connection
// =============================================================================

/**
 * Get or create database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('[EntropyTracker] DATABASE_URL environment variable is required');
    }
    const connectionString = process.env.DATABASE_URL;

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('[EntropyTracker] Unexpected error on idle client', err);
    });
  }

  return pool;
}

// =============================================================================
// State Classification
// =============================================================================

/**
 * Classify entropy level into named state.
 *
 * @param {number} level - Entropy level 0.0-1.0
 * @returns {'stable' | 'unsettled' | 'decaying' | 'fragmenting' | 'dissolving'} State name
 */
export function classifyEntropyState(level) {
  if (level < ENTROPY_THRESHOLDS.STABLE) {
    return ENTROPY_STATES.STABLE;
  } else if (level < ENTROPY_THRESHOLDS.UNSETTLED) {
    return ENTROPY_STATES.UNSETTLED;
  } else if (level < ENTROPY_THRESHOLDS.DECAYING) {
    return ENTROPY_STATES.DECAYING;
  } else if (level < ENTROPY_THRESHOLDS.FRAGMENTING) {
    return ENTROPY_STATES.FRAGMENTING;
  } else {
    return ENTROPY_STATES.DISSOLVING;
  }
}

// =============================================================================
// Core Entropy Operations
// =============================================================================

/**
 * Get current entropy state from database.
 *
 * Constitution: Principle V (Setting Preservation)
 *
 * @returns {Promise<Object>} Entropy state object
 * @property {number} level - Current entropy level 0.0-1.0
 * @property {string} state - Named state (stable, unsettled, etc.)
 * @property {string[]} markers - Current ambient markers
 * @property {Date} lastUpdated - When entropy was last updated
 */
export async function getEntropyState() {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Try to get current entropy from setting state table
    const result = await db.query(
      `SELECT
        entropy_level,
        updated_at
      FROM setting_state
      WHERE id = 1
      LIMIT 1`
    );

    let level = ENTROPY_CONFIG.defaultLevel;
    let lastUpdated = new Date();

    if (result.rows.length > 0) {
      level = parseFloat(result.rows[0].entropy_level) || ENTROPY_CONFIG.defaultLevel;
      lastUpdated = result.rows[0].updated_at || new Date();

      // Apply time-based entropy decay (increase over time)
      const hoursSinceUpdate = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
      const timeEntropy = hoursSinceUpdate * ENTROPY_CONFIG.timeDecayFactor;
      level = Math.min(ENTROPY_CONFIG.maxEntropy, level + timeEntropy);
    }

    const state = classifyEntropyState(level);
    const markers = ENTROPY_MARKERS[state] || ENTROPY_MARKERS.stable;

    // Fire-and-forget logging
    logOperation('entropy_fetch', {
      details: {
        level,
        state,
        markers_count: markers.length
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return {
      level,
      state,
      markers,
      lastUpdated
    };

  } catch (error) {
    console.error('[EntropyTracker] Error fetching entropy state:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      details: {
        error_type: 'entropy_fetch_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return sensible defaults on failure (invisible infrastructure)
    return {
      level: ENTROPY_CONFIG.defaultLevel,
      state: ENTROPY_STATES.STABLE,
      markers: ENTROPY_MARKERS.stable,
      lastUpdated: new Date()
    };
  }
}

/**
 * Increment entropy level.
 *
 * @param {number} delta - Amount to increase (default: baseSessionDelta)
 * @param {string} reason - Reason for increase (for logging)
 * @returns {Promise<Object>} Updated entropy state
 */
export async function incrementEntropy(delta = ENTROPY_CONFIG.baseSessionDelta, reason = 'session') {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Get current state
    const current = await getEntropyState();
    const previousLevel = current.level;
    const previousState = current.state;

    // Calculate new level
    const newLevel = Math.min(ENTROPY_CONFIG.maxEntropy, previousLevel + delta);
    const newState = classifyEntropyState(newLevel);
    const stateChanged = previousState !== newState;

    // Update database
    await db.query(
      `INSERT INTO setting_state (id, entropy_level, updated_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id)
       DO UPDATE SET entropy_level = $1, updated_at = NOW()`,
      [newLevel]
    );

    // Fire-and-forget logging
    logOperation('entropy_increment', {
      details: {
        previous_level: previousLevel,
        delta,
        new_level: newLevel,
        previous_state: previousState,
        new_state: newState,
        state_changed: stateChanged,
        reason
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    // Log state transition if occurred
    if (stateChanged) {
      logOperation('entropy_state_change', {
        details: {
          from_state: previousState,
          to_state: newState,
          at_level: newLevel,
          reason
        },
        durationMs: 0,
        success: true
      }).catch(() => {});
    }

    return {
      level: newLevel,
      state: newState,
      markers: ENTROPY_MARKERS[newState] || ENTROPY_MARKERS.stable,
      lastUpdated: new Date(),
      previousLevel,
      previousState,
      stateChanged
    };

  } catch (error) {
    console.error('[EntropyTracker] Error incrementing entropy:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      details: {
        error_type: 'entropy_increment_failure',
        error_message: error.message,
        attempted_delta: delta
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return current state on failure
    return await getEntropyState();
  }
}

/**
 * Reset entropy to specified level.
 * Used for maintenance events (dawn, cleaning, rituals).
 *
 * @param {number} newLevel - Level to reset to (default: minEntropy)
 * @param {string} reason - Reason for reset (for logging)
 * @returns {Promise<Object>} Updated entropy state
 */
export async function resetEntropy(newLevel = ENTROPY_CONFIG.minEntropy, reason = 'maintenance') {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Get current state for logging
    const current = await getEntropyState();
    const previousLevel = current.level;
    const previousState = current.state;

    // Clamp new level to valid range
    const clampedLevel = Math.max(
      ENTROPY_CONFIG.minEntropy,
      Math.min(ENTROPY_CONFIG.maxEntropy, newLevel)
    );
    const newState = classifyEntropyState(clampedLevel);
    const stateChanged = previousState !== newState;

    // Update database
    await db.query(
      `INSERT INTO setting_state (id, entropy_level, updated_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id)
       DO UPDATE SET entropy_level = $1, updated_at = NOW()`,
      [clampedLevel]
    );

    // Fire-and-forget logging
    logOperation('entropy_reset', {
      details: {
        previous_level: previousLevel,
        new_level: clampedLevel,
        previous_state: previousState,
        new_state: newState,
        state_changed: stateChanged,
        reason
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return {
      level: clampedLevel,
      state: newState,
      markers: ENTROPY_MARKERS[newState] || ENTROPY_MARKERS.stable,
      lastUpdated: new Date(),
      previousLevel,
      previousState,
      stateChanged
    };

  } catch (error) {
    console.error('[EntropyTracker] Error resetting entropy:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      details: {
        error_type: 'entropy_reset_failure',
        error_message: error.message,
        attempted_level: newLevel
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return current state on failure
    return await getEntropyState();
  }
}

// =============================================================================
// Effect Retrieval
// =============================================================================

/**
 * Get entropy effects for a given level.
 *
 * @param {number} level - Entropy level 0.0-1.0
 * @returns {string[]} Array of effect descriptions
 */
export function getEntropyEffects(level) {
  const state = classifyEntropyState(level);
  return ENTROPY_EFFECTS[state] || [];
}

/**
 * Get random effect for current entropy state.
 * Returns null if no effects (stable state).
 *
 * @param {number} level - Entropy level 0.0-1.0
 * @returns {string|null} Random effect description or null
 */
export function getRandomEffect(level) {
  const effects = getEntropyEffects(level);
  if (effects.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * effects.length);
  return effects[index];
}

/**
 * Get random marker for current entropy state.
 *
 * @param {number} level - Entropy level 0.0-1.0
 * @returns {string} Random ambient marker
 */
export function getRandomMarker(level) {
  const state = classifyEntropyState(level);
  const markers = ENTROPY_MARKERS[state] || ENTROPY_MARKERS.stable;
  const index = Math.floor(Math.random() * markers.length);
  return markers[index];
}

// =============================================================================
// Session Integration
// =============================================================================

/**
 * Apply entropy to a session and return context for injection.
 *
 * Constitution: Principle V (Setting Preservation)
 *
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Entropy context for session
 * @property {number} level - Current entropy level
 * @property {string} state - Named state
 * @property {string} marker - Selected ambient marker
 * @property {string|null} effect - Current effect (null if stable)
 * @property {boolean} shouldIncrement - Whether session should increment entropy
 */
export async function applySessionEntropy(sessionId) {
  const startTime = performance.now();

  try {
    // Get current entropy state
    const entropyState = await getEntropyState();
    const { level, state, markers } = entropyState;

    // Select random marker and effect
    const marker = markers[Math.floor(Math.random() * markers.length)];
    const effect = getRandomEffect(level);

    // Determine if this session should increment entropy
    // (Small probability based on current level - higher entropy = more likely)
    const incrementProbability = 0.3 + (level * 0.4); // 30% at 0, 70% at 1.0
    const shouldIncrement = Math.random() < incrementProbability;

    const context = {
      level,
      state,
      marker,
      effect,
      shouldIncrement
    };

    // Fire-and-forget logging
    logOperation('entropy_session_apply', {
      sessionId,
      details: {
        level,
        state,
        has_effect: !!effect,
        should_increment: shouldIncrement
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return context;

  } catch (error) {
    console.error('[EntropyTracker] Error applying session entropy:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'entropy_session_apply_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return stable defaults on failure
    return {
      level: ENTROPY_CONFIG.defaultLevel,
      state: ENTROPY_STATES.STABLE,
      marker: ENTROPY_MARKERS.stable[0],
      effect: null,
      shouldIncrement: false
    };
  }
}

// =============================================================================
// Context Framing
// =============================================================================

/**
 * Frame entropy context for persona injection.
 * Returns natural language description invisible to users.
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @param {Object} entropyContext - Context from applySessionEntropy
 * @param {number} entropyContext.level - Entropy level
 * @param {string} entropyContext.state - State name
 * @param {string} entropyContext.marker - Ambient marker
 * @param {string|null} entropyContext.effect - Current effect
 * @returns {string} Framed entropy context for injection
 */
export function frameEntropyContext(entropyContext) {
  const { state, marker, effect } = entropyContext;

  // Build the ambient context
  const lines = [];

  // Always include the marker
  lines.push(marker);

  // Add effect if present (non-stable states)
  if (effect) {
    lines.push(effect);
  }

  // Add state-specific ambient notes for higher entropy
  if (state === ENTROPY_STATES.FRAGMENTING || state === ENTROPY_STATES.DISSOLVING) {
    lines.push('The bar feels less certain of itself tonight.');
  }

  return lines.join(' ');
}

// =============================================================================
// Dashboard Queries
// =============================================================================

/**
 * Get entropy history for dashboard.
 *
 * @param {number} limit - Maximum entries to return (default 100)
 * @returns {Promise<Object[]>} Entropy change history
 */
export async function getEntropyHistory(limit = 100) {
  try {
    const db = getPool();

    const result = await db.query(
      `SELECT
        details->>'previous_level' AS "previousLevel",
        details->>'new_level' AS "newLevel",
        details->>'previous_state' AS "previousState",
        details->>'new_state' AS "newState",
        details->>'reason' AS reason,
        created_at AS "createdAt"
      FROM operator_logs
      WHERE operation IN ('entropy_increment', 'entropy_reset', 'entropy_state_change')
      ORDER BY created_at DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      previousLevel: parseFloat(row.previousLevel) || 0,
      newLevel: parseFloat(row.newLevel) || 0,
      previousState: row.previousState || 'stable',
      newState: row.newState || 'stable',
      reason: row.reason || 'unknown',
      createdAt: row.createdAt
    }));

  } catch (error) {
    console.error('[EntropyTracker] Error getting entropy history:', error.message);
    return [];
  }
}

/**
 * Get aggregate entropy statistics.
 *
 * @param {number} hours - Time window (default 24)
 * @returns {Promise<Object>} Entropy statistics
 */
export async function getEntropyStats(hours = 24) {
  try {
    const db = getPool();

    const result = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE operation = 'entropy_increment') AS increments,
        COUNT(*) FILTER (WHERE operation = 'entropy_reset') AS resets,
        COUNT(*) FILTER (WHERE operation = 'entropy_state_change') AS state_changes
      FROM operator_logs
      WHERE operation IN ('entropy_increment', 'entropy_reset', 'entropy_state_change')
        AND created_at > NOW() - ($1 || ' hours')::INTERVAL`,
      [hours]
    );

    const current = await getEntropyState();

    return {
      currentLevel: current.level,
      currentState: current.state,
      increments: parseInt(result.rows[0]?.increments) || 0,
      resets: parseInt(result.rows[0]?.resets) || 0,
      stateChanges: parseInt(result.rows[0]?.state_changes) || 0,
      timeWindow: hours
    };

  } catch (error) {
    console.error('[EntropyTracker] Error getting entropy stats:', error.message);
    return {
      currentLevel: ENTROPY_CONFIG.defaultLevel,
      currentState: ENTROPY_STATES.STABLE,
      increments: 0,
      resets: 0,
      stateChanges: 0,
      timeWindow: hours
    };
  }
}

// =============================================================================
// Connection Management
// =============================================================================

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
