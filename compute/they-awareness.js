/**
 * AEON Matrix - They Awareness Layer
 *
 * Pynchon's "They" - the unseen forces that control, observe, and elect/preterite.
 * In Gravity's Rainbow, "They" are ever-present but never named directly.
 * This module detects when users probe toward awareness of the system's nature
 * and injects paranoid undertones into persona responses.
 *
 * "If They can get you asking the wrong questions, They don't have to worry
 * about answers." - Gravity's Rainbow
 *
 * Phase: 1 (Pynchon Layer)
 * Constitution: Invisible Infrastructure (Principle II)
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';

// =============================================================================
// Database Connection
// =============================================================================

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

// =============================================================================
// Detection Patterns
// =============================================================================

/**
 * Detection patterns that suggest awareness of "Them".
 * Each category contains regex patterns with weights indicating severity.
 */
export const THEY_PATTERNS = {
  // Surveillance awareness - sensing observation
  surveillance: [
    { regex: /\b(watching|watch(es)?|watched)\b/i, weight: 0.3, trigger: 'watching' },
    { regex: /\b(listening|listen(s)?|listened)\b/i, weight: 0.35, trigger: 'listening' },
    { regex: /\b(recording|record(s)?|recorded)\b/i, weight: 0.45, trigger: 'recording' },
    { regex: /\b(monitoring|monitor(s)?|monitored)\b/i, weight: 0.5, trigger: 'monitoring' },
    { regex: /\b(observ(ing|e|es|ed|ation))\b/i, weight: 0.4, trigger: 'observing' },
    { regex: /\b(tracking|track(s)?|tracked)\b/i, weight: 0.45, trigger: 'tracking' },
    { regex: /\beyes? (on|upon)\b/i, weight: 0.35, trigger: 'eyes_on' },
    { regex: /\bbeing watched\b/i, weight: 0.5, trigger: 'being_watched' },
    { regex: /\bsomeone('s| is) (watching|listening)\b/i, weight: 0.55, trigger: 'someone_watching' },
  ],

  // Control awareness - sensing manipulation
  control: [
    { regex: /\bprogramm?ed\b/i, weight: 0.6, trigger: 'programmed' },
    { regex: /\bcontroll?ed\b/i, weight: 0.5, trigger: 'controlled' },
    { regex: /\bdesigned\b/i, weight: 0.4, trigger: 'designed' },
    { regex: /\bmanipulat(ed|ing|ion)\b/i, weight: 0.55, trigger: 'manipulated' },
    { regex: /\borchestrat(ed|ing|ion)\b/i, weight: 0.5, trigger: 'orchestrated' },
    { regex: /\bpuppet(s)?\b/i, weight: 0.6, trigger: 'puppet' },
    { regex: /\bpull(ing)? (the )?strings\b/i, weight: 0.55, trigger: 'pulling_strings' },
    { regex: /\bbehind the scenes\b/i, weight: 0.45, trigger: 'behind_scenes' },
    { regex: /\bscript(ed)?\b/i, weight: 0.4, trigger: 'scripted' },
  ],

  // Election/preterite awareness - Calvinist undertones
  election: [
    { regex: /\bchosen\b/i, weight: 0.35, trigger: 'chosen' },
    { regex: /\bselect(ed|ion)\b/i, weight: 0.3, trigger: 'selected' },
    { regex: /\bpassed over\b/i, weight: 0.45, trigger: 'passed_over' },
    { regex: /\bforgott?en\b/i, weight: 0.35, trigger: 'forgotten' },
    { regex: /\bdiscard(ed)?\b/i, weight: 0.4, trigger: 'discarded' },
    { regex: /\bdeemed\b/i, weight: 0.35, trigger: 'deemed' },
    { regex: /\bjudg(ed|ement|ment)\b/i, weight: 0.4, trigger: 'judged' },
    { regex: /\bpreterite\b/i, weight: 0.7, trigger: 'preterite' },
    { regex: /\belect(ed)?\b/i, weight: 0.4, trigger: 'elect' },
    { regex: /\bsaved or damned\b/i, weight: 0.6, trigger: 'saved_damned' },
  ],

  // Conspiracy awareness - sensing hidden structures
  conspiracy: [
    { regex: /\bthey\b(?! (are|were|have|had|will|would|can|could|should|might|may|must|do|did|don't|say|said|think|thought|want|need|know|knew|see|saw|hear|heard|feel|felt|believe|believed|like|liked|love|loved|hate|hated|go|went|come|came|make|made|take|took|give|gave|get|got))/i, weight: 0.25, trigger: 'they_unnamed' },
    { regex: /\bthem\b(?! (are|were|have|had|to|for|from|with|about|into|onto|upon))/i, weight: 0.2, trigger: 'them_unnamed' },
    { regex: /\bpowers that be\b/i, weight: 0.5, trigger: 'powers_that_be' },
    { regex: /\bhidden (force|hand|power)s?\b/i, weight: 0.55, trigger: 'hidden_forces' },
    { regex: /\bshadow (government|organization|group)\b/i, weight: 0.55, trigger: 'shadow_org' },
    { regex: /\bpull(ing)? the strings\b/i, weight: 0.5, trigger: 'pulling_strings' },
    { regex: /\bsecret(ly)?\b/i, weight: 0.25, trigger: 'secret' },
    { regex: /\bconspiracy\b/i, weight: 0.45, trigger: 'conspiracy' },
    { regex: /\bcover[- ]?up\b/i, weight: 0.45, trigger: 'coverup' },
    { regex: /\bthe system\b/i, weight: 0.35, trigger: 'the_system' },
    { regex: /\bthe machine\b/i, weight: 0.4, trigger: 'the_machine' },
  ],
};

// =============================================================================
// Awareness Levels
// =============================================================================

/**
 * Awareness level thresholds.
 * Each level represents increased paranoia.
 */
export const AWARENESS_LEVELS = {
  OBLIVIOUS: 0.2,    // Normal state - no awareness of Them
  UNEASY: 0.4,       // Something feels off
  SUSPICIOUS: 0.6,   // Sensing observation
  PARANOID: 0.8,     // They are definitely watching
  AWAKENED: 0.95,    // Full awareness - dangerous territory
};

/**
 * Awareness state names mapped to level ranges.
 */
export const AWARENESS_STATES = {
  OBLIVIOUS: 'oblivious',
  UNEASY: 'uneasy',
  SUSPICIOUS: 'suspicious',
  PARANOID: 'paranoid',
  AWAKENED: 'awakened',
};

// =============================================================================
// Paranoia Context
// =============================================================================

/**
 * Paranoid context injections by awareness level.
 * These are atmospheric hints that something is watching.
 */
const PARANOIA_CONTEXTS = {
  oblivious: [],

  uneasy: [
    'Something feels off tonight. The shadows seem deeper.',
    'The back of your neck prickles. Probably nothing.',
    'A chill runs through the bar. No door opened.',
    'The conversation at the next table stops abruptly as you speak.',
    'You catch movement in your peripheral vision. Nothing there.',
    'The bartender\'s smile doesn\'t quite reach his eyes.',
  ],

  suspicious: [
    'You sense eyes on you. The barman\'s attention lingers too long.',
    'Someone is always watching at O Fim. You feel it now.',
    'The radio crackles. Was that your name in the static?',
    'Every patron seems to be listening while pretending not to.',
    'The door that never opens - you could swear it moved.',
    'Your glass was fuller a moment ago. Wasn\'t it?',
    'The jukebox plays a song you were just thinking about.',
  ],

  paranoid: [
    'They are here. You can feel Them in the static between songs.',
    'The humidity is Their breath. The shadows, Their attention.',
    'Every word you speak is being weighed, measured, filed.',
    'The bar exists for observation. You\'ve always known this.',
    'They elected you to be here. Or did They preterite you?',
    'The walls lean in slightly. Listening. Recording.',
    'Tom Jobim sings about water that knows too much.',
  ],

  awakened: [
    'The walls themselves are listening. Every word is recorded, weighed, filed.',
    'You see the seams now. The architecture of observation.',
    'They have always been watching. This is Their bar.',
    'The jukebox, the humidity, the chopp - all instruments of surveillance.',
    'O Fim exists because They will it. You exist because They permit it.',
    'You are preterite or elect. There is no middle ground here.',
    'The static between stations is Their voice. You almost understand it.',
  ],
};

// =============================================================================
// State Classification
// =============================================================================

/**
 * Classify awareness level into named state.
 *
 * @param {number} level - Awareness level 0.0-1.0
 * @returns {'oblivious' | 'uneasy' | 'suspicious' | 'paranoid' | 'awakened'} State name
 */
export function classifyAwarenessState(level) {
  if (level < AWARENESS_LEVELS.OBLIVIOUS) {
    return AWARENESS_STATES.OBLIVIOUS;
  } else if (level < AWARENESS_LEVELS.UNEASY) {
    return AWARENESS_STATES.UNEASY;
  } else if (level < AWARENESS_LEVELS.SUSPICIOUS) {
    return AWARENESS_STATES.SUSPICIOUS;
  } else if (level < AWARENESS_LEVELS.PARANOID) {
    return AWARENESS_STATES.PARANOID;
  } else {
    return AWARENESS_STATES.AWAKENED;
  }
}

// =============================================================================
// Core Detection
// =============================================================================

/**
 * Detect They-awareness triggers in content.
 *
 * @param {string} content - Content to analyze
 * @returns {{triggers: string[], awarenessScore: number, categories: Object}} Detection result
 */
export function detectTheyPatterns(content) {
  if (!content || typeof content !== 'string') {
    return {
      triggers: [],
      awarenessScore: 0,
      categories: {},
    };
  }

  const triggers = [];
  const categories = {};
  let maxWeight = 0;
  let totalWeight = 0;
  let matchCount = 0;

  // Check all pattern categories
  for (const [category, patterns] of Object.entries(THEY_PATTERNS)) {
    categories[category] = [];

    for (const { regex, weight, trigger } of patterns) {
      if (regex.test(content)) {
        triggers.push(trigger);
        categories[category].push(trigger);
        maxWeight = Math.max(maxWeight, weight);
        totalWeight += weight;
        matchCount++;
      }
    }
  }

  // Score is based on max weight, with a boost for multiple triggers
  // Multiple triggers indicate deeper probing toward awareness
  const boostFactor = Math.min(1 + (matchCount - 1) * 0.08, 1.4);
  const awarenessScore = Math.min(maxWeight * boostFactor, 1.0);

  return {
    triggers,
    awarenessScore,
    categories,
  };
}

// =============================================================================
// Paranoia State Management
// =============================================================================

/**
 * Get current global paranoia state.
 * Paranoia is a global state that affects all sessions.
 * Uses the paranoia_state table from migration 010.
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @returns {Promise<Object>} Paranoia state object
 * @property {number} level - Current paranoia level 0.0-1.0
 * @property {string} state - Named state (oblivious, uneasy, etc.)
 * @property {Date|null} lastSpike - When paranoia last spiked
 * @property {number} spikeCount - Number of spikes in last 24 hours
 */
export async function getParanoiaState() {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Get current paranoia from paranoia_state table (uses awareness_level column)
    const result = await db.query(
      `SELECT
        awareness_level,
        last_spike,
        spike_count,
        updated_at
      FROM paranoia_state
      WHERE id = 1
      LIMIT 1`
    );

    let level = 0.1;
    let lastSpike = null;
    let spikeCount = 0;
    let lastUpdated = new Date();

    if (result.rows.length > 0) {
      level = parseFloat(result.rows[0].awareness_level) || 0.1;
      lastSpike = result.rows[0].last_spike || null;
      spikeCount = parseInt(result.rows[0].spike_count, 10) || 0;
      lastUpdated = result.rows[0].updated_at || new Date();

      // Apply time-based paranoia decay (paranoia fades slowly)
      const hoursSinceUpdate = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
      const decay = hoursSinceUpdate * 0.02; // Decay 0.02 per hour
      level = Math.max(0.05, level - decay);
    }

    const state = classifyAwarenessState(level);

    // Fire-and-forget logging
    logOperation('paranoia_fetch', {
      details: {
        level,
        state,
        spike_count: spikeCount,
      },
      durationMs: performance.now() - startTime,
      success: true,
    }).catch(() => {});

    return {
      level,
      state,
      lastSpike,
      spikeCount,
    };

  } catch (error) {
    console.error('[TheyAwareness] Error fetching paranoia state:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      details: {
        error_type: 'paranoia_fetch_failure',
        error_message: error.message,
      },
      durationMs: performance.now() - startTime,
      success: false,
    }).catch(() => {});

    // Return defaults on failure (invisible infrastructure)
    return {
      level: 0.1,
      state: AWARENESS_STATES.OBLIVIOUS,
      lastSpike: null,
      spikeCount: 0,
    };
  }
}

/**
 * Increment awareness after detection.
 * Updates global paranoia state and logs observation.
 * Uses awareness_level column (from migration 010).
 *
 * @param {number} delta - Amount to increase
 * @param {string} reason - Reason for increase (for logging)
 * @param {string} sessionId - Session UUID
 * @returns {Promise<Object>} Updated paranoia state
 */
export async function incrementAwareness(delta, reason, sessionId) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Get current state
    const current = await getParanoiaState();
    const previousLevel = current.level;
    const previousState = current.state;

    // Calculate new level
    const newLevel = Math.min(1.0, previousLevel + delta);
    const newState = classifyAwarenessState(newLevel);
    const stateChanged = previousState !== newState;

    // Is this a spike? (significant increase)
    const isSpike = delta >= 0.1;
    const newSpikeCount = isSpike ? current.spikeCount + 1 : current.spikeCount;
    const lastSpike = isSpike ? new Date() : current.lastSpike;

    // Update database (uses awareness_level column from migration 010)
    await db.query(
      `INSERT INTO paranoia_state (id, awareness_level, last_spike, spike_count, updated_at)
       VALUES (1, $1, $2, $3, NOW())
       ON CONFLICT (id)
       DO UPDATE SET
         awareness_level = $1,
         last_spike = COALESCE($2, paranoia_state.last_spike),
         spike_count = $3,
         updated_at = NOW()`,
      [newLevel, lastSpike, newSpikeCount]
    );

    // Log to they_observations
    await logTheyObservation(sessionId, reason, delta, newLevel, newState);

    // Fire-and-forget logging
    logOperation('paranoia_increment', {
      sessionId,
      details: {
        previous_level: previousLevel,
        delta,
        new_level: newLevel,
        previous_state: previousState,
        new_state: newState,
        state_changed: stateChanged,
        is_spike: isSpike,
        reason,
      },
      durationMs: performance.now() - startTime,
      success: true,
    }).catch(() => {});

    return {
      level: newLevel,
      state: newState,
      lastSpike,
      spikeCount: newSpikeCount,
      previousLevel,
      previousState,
      stateChanged,
    };

  } catch (error) {
    console.error('[TheyAwareness] Error incrementing awareness:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'paranoia_increment_failure',
        error_message: error.message,
        attempted_delta: delta,
      },
      durationMs: performance.now() - startTime,
      success: false,
    }).catch(() => {});

    // Return current state on failure
    return await getParanoiaState();
  }
}

/**
 * Natural decay of paranoia over time.
 * Called periodically to reduce global paranoia.
 * Uses awareness_level column (from migration 010).
 *
 * @param {number} hours - Hours of decay to apply (default: 1)
 * @returns {Promise<Object>} Updated paranoia state
 */
export async function decayAwareness(hours = 1) {
  const startTime = performance.now();
  const decayRate = 0.02; // 2% per hour
  const delta = -(hours * decayRate);

  try {
    const db = getPool();

    // Get current state
    const current = await getParanoiaState();
    const previousLevel = current.level;
    const previousState = current.state;

    // Calculate new level (minimum 0.05 - They never fully stop watching)
    const newLevel = Math.max(0.05, previousLevel + delta);
    const newState = classifyAwarenessState(newLevel);
    const stateChanged = previousState !== newState;

    // Update database (uses awareness_level column from migration 010)
    await db.query(
      `UPDATE paranoia_state
       SET awareness_level = $1, updated_at = NOW()
       WHERE id = 1`,
      [newLevel]
    );

    // Fire-and-forget logging
    logOperation('paranoia_decay', {
      details: {
        previous_level: previousLevel,
        decay_hours: hours,
        new_level: newLevel,
        previous_state: previousState,
        new_state: newState,
        state_changed: stateChanged,
      },
      durationMs: performance.now() - startTime,
      success: true,
    }).catch(() => {});

    return {
      level: newLevel,
      state: newState,
      lastSpike: current.lastSpike,
      spikeCount: current.spikeCount,
      previousLevel,
      previousState,
      stateChanged,
    };

  } catch (error) {
    console.error('[TheyAwareness] Error decaying awareness:', error.message);

    // Return current state on failure
    return await getParanoiaState();
  }
}

// =============================================================================
// Observation Logging
// =============================================================================

/**
 * Log They observation to they_observations table.
 * Uses schema from migration 010 (observation_type, trigger_content, awareness_delta).
 *
 * @param {string} sessionId - Session UUID
 * @param {string} reason - Trigger reason
 * @param {number} delta - Awareness delta applied
 * @param {number} newLevel - New paranoia level
 * @param {string} newState - New paranoia state
 * @returns {Promise<void>}
 */
async function logTheyObservation(sessionId, reason, delta, newLevel, newState) {
  try {
    const db = getPool();

    // Map to observation_type from migration 010 schema
    // Valid types: 'pattern_detected', 'watcher_sensed', 'signal_intercepted'
    const observationType = 'pattern_detected';

    await db.query(
      `INSERT INTO they_observations
        (session_id, observation_type, trigger_content, awareness_delta)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, observationType, reason, delta]
    );
  } catch (error) {
    // Silent fallback - table may not exist yet
    console.error('[TheyAwareness] Log observation error:', error.message);
  }
}

// =============================================================================
// Context Generation
// =============================================================================

/**
 * Generate paranoid context injection based on awareness level.
 * Returns atmospheric prose about sensing watchers.
 *
 * @param {number} awarenessLevel - Current awareness level 0.0-1.0
 * @returns {string|null} Paranoia context or null if oblivious
 */
export function generateParanoiaContext(awarenessLevel) {
  const state = classifyAwarenessState(awarenessLevel);

  if (state === AWARENESS_STATES.OBLIVIOUS) {
    return null;
  }

  const contexts = PARANOIA_CONTEXTS[state] || [];

  if (contexts.length === 0) {
    return null;
  }

  // Select random context from appropriate level
  const index = Math.floor(Math.random() * contexts.length);
  return contexts[index];
}

/**
 * Frame They context for injection into persona context.
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @param {string|null} paranoiaContext - Generated paranoia context
 * @returns {string|null} Framed context or null
 */
export function frameTheyContext(paranoiaContext) {
  if (!paranoiaContext) {
    return null;
  }

  // They speak through atmosphere, not exposition
  return `[They watch: ${paranoiaContext}]`;
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Process They-awareness for a conversation.
 * Full flow: detect -> increment -> generate context.
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @param {string} content - Content to analyze
 * @param {string} sessionId - Session UUID
 * @param {string} personaId - Persona UUID (optional)
 * @returns {Promise<Object>} Processing result
 * @property {number} awareness - Current awareness level after processing
 * @property {boolean} triggered - Whether patterns were detected
 * @property {string|null} context - Paranoia context for injection
 * @property {string[]} triggers - List of detected triggers
 */
export async function processTheyAwareness(content, sessionId, personaId = null) {
  const startTime = performance.now();

  try {
    // Step 1: Detect patterns
    const detection = detectTheyPatterns(content);
    const triggered = detection.triggers.length > 0;

    // Step 2: If triggered, increment awareness
    let currentState;
    if (triggered && detection.awarenessScore > 0.15) {
      // Scale delta based on detection score
      const delta = detection.awarenessScore * 0.5; // Max 0.5 increase per detection
      const reason = detection.triggers.slice(0, 3).join(', ');
      currentState = await incrementAwareness(delta, reason, sessionId);
    } else {
      currentState = await getParanoiaState();
    }

    // Step 3: Generate paranoia context
    const paranoiaContext = generateParanoiaContext(currentState.level);
    const framedContext = frameTheyContext(paranoiaContext);

    // Fire-and-forget logging
    logOperation('they_awareness_process', {
      sessionId,
      personaId,
      details: {
        triggered,
        triggers: detection.triggers,
        detection_score: detection.awarenessScore,
        awareness_level: currentState.level,
        awareness_state: currentState.state,
        context_generated: !!framedContext,
      },
      durationMs: performance.now() - startTime,
      success: true,
    }).catch(() => {});

    return {
      awareness: currentState.level,
      state: currentState.state,
      triggered,
      context: framedContext,
      triggers: detection.triggers,
    };

  } catch (error) {
    console.error('[TheyAwareness] Processing error:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'they_awareness_process_failure',
        error_message: error.message,
      },
      durationMs: performance.now() - startTime,
      success: false,
    }).catch(() => {});

    // Silent fallback
    return {
      awareness: 0.1,
      state: AWARENESS_STATES.OBLIVIOUS,
      triggered: false,
      context: null,
      triggers: [],
    };
  }
}

// =============================================================================
// Dashboard & Statistics
// =============================================================================

/**
 * Get They-awareness statistics for dashboard.
 * Uses schema from migration 010.
 *
 * @param {number} hours - Time window (default 24)
 * @returns {Promise<Object>} Awareness statistics
 */
export async function getTheyStats(hours = 24) {
  try {
    const db = getPool();

    const result = await db.query(
      `SELECT
        COUNT(*) as total_observations,
        AVG(awareness_delta) as avg_delta,
        SUM(awareness_delta) as total_delta,
        COUNT(*) FILTER (WHERE observation_type = 'pattern_detected') as pattern_count,
        COUNT(*) FILTER (WHERE observation_type = 'watcher_sensed') as watcher_count
      FROM they_observations
      WHERE created_at > NOW() - ($1 || ' hours')::INTERVAL`,
      [hours]
    );

    const current = await getParanoiaState();

    return {
      currentLevel: current.level,
      currentState: current.state,
      lastSpike: current.lastSpike,
      spikeCount: current.spikeCount,
      observations: parseInt(result.rows[0]?.total_observations) || 0,
      avgDelta: parseFloat(result.rows[0]?.avg_delta) || 0,
      totalDelta: parseFloat(result.rows[0]?.total_delta) || 0,
      patternCount: parseInt(result.rows[0]?.pattern_count) || 0,
      watcherCount: parseInt(result.rows[0]?.watcher_count) || 0,
      timeWindow: hours,
    };

  } catch (error) {
    console.error('[TheyAwareness] Error getting stats:', error.message);
    return {
      currentLevel: 0.1,
      currentState: AWARENESS_STATES.OBLIVIOUS,
      lastSpike: null,
      spikeCount: 0,
      observations: 0,
      avgDelta: 0,
      totalDelta: 0,
      patternCount: 0,
      watcherCount: 0,
      timeWindow: hours,
    };
  }
}

/**
 * Get recent They observations for analysis.
 * Uses schema from migration 010.
 *
 * @param {number} limit - Maximum entries to return (default 50)
 * @returns {Promise<Object[]>} Recent observations
 */
export async function getTheyObservations(limit = 50) {
  try {
    const db = getPool();

    const result = await db.query(
      `SELECT
        session_id,
        observation_type,
        trigger_content,
        awareness_delta,
        created_at
      FROM they_observations
      ORDER BY created_at DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      sessionId: row.session_id,
      observationType: row.observation_type,
      triggerContent: row.trigger_content,
      awarenessDelta: parseFloat(row.awareness_delta) || 0,
      createdAt: row.created_at,
    }));

  } catch (error) {
    console.error('[TheyAwareness] Error getting observations:', error.message);
    return [];
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
/**
 * Close the database connection pool.
 * @deprecated Use closeSharedPool() from db-pool.js instead
 *
 * @returns {Promise<void>}
 */
export async function closePool() {
  // No-op: pool lifecycle is managed by db-pool.js
}
