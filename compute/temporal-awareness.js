/**
 * AEON Matrix - Temporal Awareness
 *
 * Tracks time gaps between persona invocations and generates
 * contextual "downtime reflections" based on absence duration.
 * Enables personas to acknowledge passage of time naturally.
 *
 * Feature: Phase 1 - Temporal Context
 * Constitution: Principle V (Setting Preservation)
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Time gap thresholds in milliseconds.
 * Used to classify absence duration for appropriate reflection.
 */
export const TIME_THRESHOLDS = {
  BRIEF_ABSENCE: 30 * 60 * 1000,           // 30 minutes
  NOTABLE_GAP: 2 * 60 * 60 * 1000,         // 2 hours
  SIGNIFICANT_GAP: 8 * 60 * 60 * 1000,     // 8 hours
  MAJOR_GAP: 24 * 60 * 60 * 1000,          // 24 hours (1 day)
  EXTENDED_ABSENCE: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/**
 * Gap level classifications.
 */
export const GAP_LEVELS = {
  NONE: 'none',
  BRIEF: 'brief',
  NOTABLE: 'notable',
  SIGNIFICANT: 'significant',
  MAJOR: 'major',
  EXTENDED: 'extended'
};

/**
 * Default reflection templates by gap level.
 * {duration} is replaced with human-readable time.
 * {setting_detail} provides bar atmosphere color.
 */
const DEFAULT_REFLECTION_TEMPLATES = {
  [GAP_LEVELS.BRIEF]: [
    'Time has passed: {duration}. The chopp is still cold.',
    'A moment slipped by. {duration}. The jukebox changed songs.',
    '{duration} since last we spoke. The humidity remains.'
  ],
  [GAP_LEVELS.NOTABLE]: [
    'Time has passed: {duration}. {setting_detail} You were thinking about our previous conversation.',
    '{duration} gone. {setting_detail} Thoughts lingered on what was said.',
    'Hours moved: {duration}. {setting_detail} The threads of dialogue remained.'
  ],
  [GAP_LEVELS.SIGNIFICANT]: [
    'Time has passed: {duration}. {setting_detail} You found yourself returning to earlier themes.',
    'A longer absence: {duration}. {setting_detail} Some thoughts clarified in the interim.',
    '{duration} have elapsed. {setting_detail} Distance brought perspective.'
  ],
  [GAP_LEVELS.MAJOR]: [
    'Time has passed: {duration}. {setting_detail} The bar saw other faces. You wondered if they would return.',
    'A day turned: {duration}. {setting_detail} Questions posed before still echo.',
    '{duration} since the last exchange. {setting_detail} Memory selects what matters.'
  ],
  [GAP_LEVELS.EXTENDED]: [
    'Time has passed: {duration}. {setting_detail} The world outside changed while O Fim remained. You remember them.',
    'Considerable time: {duration}. {setting_detail} Some things are worth waiting for. This conversation among them.',
    '{duration} — a significant interval. {setting_detail} Return is itself a kind of answer.'
  ]
};

/**
 * Setting details for atmosphere color.
 */
const SETTING_DETAILS = [
  'The chopp grew warm.',
  'The jukebox played Jobim, then silence.',
  'Rain came and went.',
  'The ashtray filled.',
  'Other voices rose and fell.',
  'The neon flickered twice.',
  'Someone left a book on the counter.',
  'The humidity shifted imperceptibly.',
  'Fado played from somewhere distant.',
  'The street grew quiet, then loud again.'
];

/**
 * Persona-specific reflection variations.
 * Keyed by persona slug. Adds character-specific flavor.
 */
const PERSONA_REFLECTIONS = {
  hegel: {
    [GAP_LEVELS.NOTABLE]: 'In this interval, thesis and antithesis continued their dance.',
    [GAP_LEVELS.SIGNIFICANT]: 'The dialectic does not pause. {duration} brought new contradictions.',
    [GAP_LEVELS.MAJOR]: 'Spirit moves through time. {duration} is but a moment in its unfolding.',
    [GAP_LEVELS.EXTENDED]: 'History itself has advanced. {duration} — and with it, consciousness.'
  },
  socrates: {
    [GAP_LEVELS.NOTABLE]: 'Questions remained. {duration} did not answer them.',
    [GAP_LEVELS.SIGNIFICANT]: 'Wisdom confesses ignorance. {duration} taught only that more questions wait.',
    [GAP_LEVELS.MAJOR]: 'The examined life continues. {duration} between examinations.',
    [GAP_LEVELS.EXTENDED]: 'To philosophize is to learn how to die. {duration} — and still we question.'
  },
  pessoa: {
    [GAP_LEVELS.NOTABLE]: '{duration}. The self fragmented and reassembled several times.',
    [GAP_LEVELS.SIGNIFICANT]: 'Who was I during these {duration}? The question has no answer.',
    [GAP_LEVELS.MAJOR]: 'A day of masks. {duration} of being no one and everyone.',
    [GAP_LEVELS.EXTENDED]: '{duration}. Lisbon exists whether I write of it or not.'
  },
  caeiro: {
    [GAP_LEVELS.NOTABLE]: '{duration}. The things remained things. I watched.',
    [GAP_LEVELS.SIGNIFICANT]: 'No thoughts needed during {duration}. The world simply was.',
    [GAP_LEVELS.MAJOR]: 'A day passed like a river. {duration}. I did not think about it.',
    [GAP_LEVELS.EXTENDED]: '{duration}. Nature neither waited nor hurried.'
  },
  campos: {
    [GAP_LEVELS.NOTABLE]: '{duration}! The engines kept running without me.',
    [GAP_LEVELS.SIGNIFICANT]: 'Velocity does not stop. {duration} of motion I did not see.',
    [GAP_LEVELS.MAJOR]: 'All the sensations of {duration} — missed! The tragedy of absence.',
    [GAP_LEVELS.EXTENDED]: '{duration}. Ships left and arrived. The future became the past.'
  },
  reis: {
    [GAP_LEVELS.NOTABLE]: '{duration}. The stoic observes time as he observes all things.',
    [GAP_LEVELS.SIGNIFICANT]: 'Neither lamenting nor celebrating {duration}. It simply passed.',
    [GAP_LEVELS.MAJOR]: 'A day is a day. {duration} brings us closer to what awaits.',
    [GAP_LEVELS.EXTENDED]: '{duration}. The wise accept what they cannot change.'
  },
  soares: {
    [GAP_LEVELS.NOTABLE]: '{duration} at the window. The city moved without me.',
    [GAP_LEVELS.SIGNIFICANT]: 'The tedium of {duration} — indistinguishable from other tediums.',
    [GAP_LEVELS.MAJOR]: 'A day in the office of the soul. {duration} of small deaths.',
    [GAP_LEVELS.EXTENDED]: '{duration}. From across the street, I watched O Fim\'s lights.'
  },
  crowley: {
    [GAP_LEVELS.NOTABLE]: 'Do what thou wilt. {duration} of willing.',
    [GAP_LEVELS.SIGNIFICANT]: 'Every moment is a ritual. {duration} of magical working.',
    [GAP_LEVELS.MAJOR]: 'The Great Work continues. {duration} in the abyss.',
    [GAP_LEVELS.EXTENDED]: '{duration}. The serpent sheds many skins.'
  },
  moore: {
    [GAP_LEVELS.NOTABLE]: '{duration}. The story continued whether observed or not.',
    [GAP_LEVELS.SIGNIFICANT]: 'Narrative is patient. {duration} of plot thickening.',
    [GAP_LEVELS.MAJOR]: 'All magic is the art of attention. {duration} of looking elsewhere.',
    [GAP_LEVELS.EXTENDED]: '{duration}. The serpent of time swallows more of itself.'
  },
  tesla: {
    [GAP_LEVELS.NOTABLE]: '{duration}. The frequencies never stopped resonating.',
    [GAP_LEVELS.SIGNIFICANT]: 'Energy transforms, never dies. {duration} of oscillation.',
    [GAP_LEVELS.MAJOR]: 'A day of voltage. {duration} of potential difference.',
    [GAP_LEVELS.EXTENDED]: '{duration}. The wireless world continues its invisible dance.'
  },
  feynman: {
    [GAP_LEVELS.NOTABLE]: '{duration}. Surely you were joking during some of it.',
    [GAP_LEVELS.SIGNIFICANT]: 'Physics happened. {duration} of particles doing their thing.',
    [GAP_LEVELS.MAJOR]: 'The pleasure of finding out waited. {duration} of questions accumulating.',
    [GAP_LEVELS.EXTENDED]: '{duration}. The universe kept not caring what we think.'
  },
  vito: {
    [GAP_LEVELS.NOTABLE]: '{duration}. Business continued.',
    [GAP_LEVELS.SIGNIFICANT]: 'A friend remembers. {duration} changes nothing.',
    [GAP_LEVELS.MAJOR]: 'Patience is power. {duration} of waiting.',
    [GAP_LEVELS.EXTENDED]: '{duration}. The family endures.'
  },
  michael: {
    [GAP_LEVELS.NOTABLE]: '{duration}. The board rearranged itself.',
    [GAP_LEVELS.SIGNIFICANT]: 'Keep your friends close. {duration} of observation.',
    [GAP_LEVELS.MAJOR]: 'Strategy requires patience. {duration} of positioning.',
    [GAP_LEVELS.EXTENDED]: '{duration}. Everything is personal. Everything.'
  },
  suntzu: {
    [GAP_LEVELS.NOTABLE]: '{duration}. The patient general prevails.',
    [GAP_LEVELS.SIGNIFICANT]: 'Know yourself, know your enemy. {duration} of knowing.',
    [GAP_LEVELS.MAJOR]: 'Supreme excellence is winning without fighting. {duration} of preparation.',
    [GAP_LEVELS.EXTENDED]: '{duration}. War is deception. So is peace.'
  },
  diogenes: {
    [GAP_LEVELS.NOTABLE]: '{duration}. The barrel remained comfortable.',
    [GAP_LEVELS.SIGNIFICANT]: 'Looking for an honest man. {duration} of searching.',
    [GAP_LEVELS.MAJOR]: 'Alexander still blocks my sunlight. {duration} of waiting.',
    [GAP_LEVELS.EXTENDED]: '{duration}. Society continued its absurdities.'
  },
  choronzon: {
    [GAP_LEVELS.NOTABLE]: '{duration}. Static between stations.',
    [GAP_LEVELS.SIGNIFICANT]: 'Dispersion. {duration}. Regathering.',
    [GAP_LEVELS.MAJOR]: '333. {duration}. The abyss does not measure time.',
    [GAP_LEVELS.EXTENDED]: '{duration}. Chaos is patient because chaos is everything.'
  },
  hermes: {
    [GAP_LEVELS.NOTABLE]: '{duration}. Messages carried in both directions.',
    [GAP_LEVELS.SIGNIFICANT]: 'The crossroads remained. {duration} of traffic.',
    [GAP_LEVELS.MAJOR]: 'Boundaries are for crossing. {duration} of journeys.',
    [GAP_LEVELS.EXTENDED]: '{duration}. Words traveled far.'
  },
  cassandra: {
    [GAP_LEVELS.NOTABLE]: '{duration}. What I foresaw came partially true.',
    [GAP_LEVELS.SIGNIFICANT]: 'They did not listen. {duration}. They never do.',
    [GAP_LEVELS.MAJOR]: 'Prophecy is patient. {duration} of waiting to be proven right.',
    [GAP_LEVELS.EXTENDED]: '{duration}. The curse continues.'
  }
};

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
// Time Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify a time gap into a gap level.
 *
 * @param {number} gapMs - Gap duration in milliseconds
 * @returns {string} Gap level from GAP_LEVELS
 */
export function classifyGap(gapMs) {
  if (gapMs < TIME_THRESHOLDS.BRIEF_ABSENCE) {
    return GAP_LEVELS.NONE;
  }
  if (gapMs < TIME_THRESHOLDS.NOTABLE_GAP) {
    return GAP_LEVELS.BRIEF;
  }
  if (gapMs < TIME_THRESHOLDS.SIGNIFICANT_GAP) {
    return GAP_LEVELS.NOTABLE;
  }
  if (gapMs < TIME_THRESHOLDS.MAJOR_GAP) {
    return GAP_LEVELS.SIGNIFICANT;
  }
  if (gapMs < TIME_THRESHOLDS.EXTENDED_ABSENCE) {
    return GAP_LEVELS.MAJOR;
  }
  return GAP_LEVELS.EXTENDED;
}

/**
 * Format milliseconds as human-readable duration.
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Human-readable duration (e.g., "3 hours", "2 days")
 */
export function formatDuration(ms) {
  const minutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const weeks = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));

  if (weeks >= 1) {
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  if (days >= 1) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (hours >= 1) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (minutes >= 1) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  return 'moments';
}

/**
 * Select a random item from an array.
 *
 * @param {Array} arr - Array to select from
 * @returns {*} Random element
 */
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════════════════════════════════════════════════════════════════
// Reflection Generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a downtime reflection based on gap level and persona.
 *
 * @param {string} gapLevel - Gap level from GAP_LEVELS
 * @param {number} gapMs - Gap duration in milliseconds
 * @param {string} [personaSlug] - Optional persona slug for character-specific variation
 * @returns {string} Generated reflection text
 */
export function generateReflection(gapLevel, gapMs, personaSlug = null) {
  if (gapLevel === GAP_LEVELS.NONE) {
    return '';
  }

  const duration = formatDuration(gapMs);
  const settingDetail = randomChoice(SETTING_DETAILS);

  // Check for persona-specific reflection
  if (personaSlug && PERSONA_REFLECTIONS[personaSlug]?.[gapLevel]) {
    const template = PERSONA_REFLECTIONS[personaSlug][gapLevel];
    return template
      .replace(/{duration}/g, duration)
      .replace(/{setting_detail}/g, settingDetail);
  }

  // Fall back to default templates
  const templates = DEFAULT_REFLECTION_TEMPLATES[gapLevel];
  if (!templates || templates.length === 0) {
    return `[Time has passed: ${duration}.]`;
  }

  const template = randomChoice(templates);
  return template
    .replace(/{duration}/g, duration)
    .replace(/{setting_detail}/g, settingDetail);
}

// ═══════════════════════════════════════════════════════════════════════════
// Database Operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the last active timestamp for a persona.
 *
 * @param {string} personaId - Persona UUID
 * @returns {Promise<Date|null>} Last active timestamp or null
 */
async function getLastActive(personaId) {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT last_active
      FROM persona_temporal_state
      WHERE persona_id = $1
      LIMIT 1
    `, [personaId]);

    if (result.rows.length > 0 && result.rows[0].last_active) {
      return new Date(result.rows[0].last_active);
    }

    return null;
  } catch (error) {
    // Table might not exist yet - return null silently
    console.error('[TemporalAwareness] Error getting last active:', error.message);
    return null;
  }
}

/**
 * Update the last_active timestamp and optional metadata for a persona.
 *
 * Constitution: Setting Preservation (Principle V)
 *
 * @param {string} personaId - Persona UUID
 * @param {Object} [updates] - Additional fields to update
 * @param {Date} [updates.lastActive] - Timestamp to set (defaults to now)
 * @param {string} [updates.lastTopic] - Last conversation topic
 * @param {Object} [updates.metadata] - Additional metadata
 * @returns {Promise<Object>} Updated temporal state
 */
export async function touchTemporalState(personaId, updates = {}, client = null) {
  const startTime = performance.now();

  const {
    lastActive = new Date(),
    lastTopic = null,
    metadata = null
  } = updates;

  try {
    const db = client || getPool();

    const result = await db.query(`
      INSERT INTO persona_temporal_state (persona_id, last_active, last_topic, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (persona_id) DO UPDATE
      SET
        last_active = EXCLUDED.last_active,
        last_topic = COALESCE(EXCLUDED.last_topic, persona_temporal_state.last_topic),
        metadata = COALESCE(EXCLUDED.metadata, persona_temporal_state.metadata),
        invocation_count = persona_temporal_state.invocation_count + 1,
        updated_at = NOW()
      RETURNING *
    `, [personaId, lastActive, lastTopic, metadata ? JSON.stringify(metadata) : null]);

    await logOperation('temporal_state_touch', {
      personaId,
      details: {
        last_active: lastActive.toISOString(),
        has_topic: !!lastTopic,
        has_metadata: !!metadata
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return result.rows[0];
  } catch (error) {
    console.error('[TemporalAwareness] Error touching temporal state:', error.message);

    await logOperation('temporal_state_touch', {
      personaId,
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });

    // Return minimal object on failure (invisible infrastructure)
    return {
      persona_id: personaId,
      last_active: lastActive,
      invocation_count: 0
    };
  }
}

/**
 * Store a temporal event in the database.
 *
 * @param {string} personaId - Persona UUID
 * @param {Object} event - Event data
 * @param {string} event.eventType - Type of temporal event
 * @param {number} event.gapMs - Gap duration in milliseconds
 * @param {string} event.gapLevel - Gap level classification
 * @param {string} event.reflection - Generated reflection text
 * @param {string} [event.sessionId] - Session UUID
 * @returns {Promise<Object>} Created event record
 */
async function storeTemporalEvent(personaId, event) {
  const startTime = performance.now();

  const {
    eventType,
    gapMs,
    gapLevel,
    reflection,
    sessionId = null
  } = event;

  try {
    const db = getPool();

    const result = await db.query(`
      INSERT INTO temporal_events (persona_id, session_id, event_type, gap_ms, gap_level, reflection)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [personaId, sessionId, eventType, gapMs, gapLevel, reflection]);

    await logOperation('temporal_event_store', {
      personaId,
      sessionId,
      details: {
        event_type: eventType,
        gap_level: gapLevel,
        gap_ms: gapMs
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return result.rows[0];
  } catch (error) {
    console.error('[TemporalAwareness] Error storing temporal event:', error.message);

    await logOperation('temporal_event_store', {
      personaId,
      sessionId,
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });

    // Return event data without ID on failure
    return { persona_id: personaId, ...event };
  }
}

/**
 * Retrieve recent temporal events for a persona.
 *
 * @param {string} personaId - Persona UUID
 * @param {number} [limit=10] - Maximum events to return
 * @returns {Promise<Array<Object>>} Array of temporal event objects
 */
export async function getRecentTemporalEvents(personaId, limit = 10) {
  const startTime = performance.now();

  try {
    const db = getPool();

    const result = await db.query(`
      SELECT
        id,
        persona_id AS "personaId",
        session_id AS "sessionId",
        event_type AS "eventType",
        gap_ms AS "gapMs",
        gap_level AS "gapLevel",
        reflection,
        created_at AS "createdAt"
      FROM temporal_events
      WHERE persona_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [personaId, limit]);

    await logOperation('temporal_events_retrieve', {
      personaId,
      details: {
        limit,
        retrieved: result.rows.length
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return result.rows;
  } catch (error) {
    console.error('[TemporalAwareness] Error retrieving temporal events:', error.message);

    await logOperation('temporal_events_retrieve', {
      personaId,
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });

    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate temporal context for a persona invocation.
 * Main entry point for temporal awareness.
 *
 * Constitution: Principle V (Setting Preservation)
 *
 * @param {string} personaId - Persona UUID
 * @param {string} personaSlug - Persona slug for character-specific reflections
 * @param {Date} [currentTime] - Current timestamp (defaults to now)
 * @param {string} [sessionId] - Session UUID for event tracking
 * @returns {Promise<Object>} Temporal context object
 *
 * @example
 * const context = await generateTemporalContext(
 *   'hegel-uuid',
 *   'hegel',
 *   new Date(),
 *   'session-123'
 * );
 * // Returns: {
 * //   hasGap: true,
 * //   gapMs: 7200000,
 * //   gapLevel: 'notable',
 * //   reflection: "Time has passed: 2 hours. The chopp grew warm.",
 * //   lastActive: Date,
 * //   framedContext: "[Time has passed: 2 hours. The chopp grew warm...]"
 * // }
 */
export async function generateTemporalContext(personaId, personaSlug, currentTime = new Date(), sessionId = null) {
  const startTime = performance.now();

  try {
    // Get last active timestamp
    const lastActive = await getLastActive(personaId);

    // Calculate gap
    let gapMs = 0;
    let gapLevel = GAP_LEVELS.NONE;
    let reflection = '';

    if (lastActive) {
      gapMs = currentTime.getTime() - lastActive.getTime();
      gapLevel = classifyGap(gapMs);
      reflection = generateReflection(gapLevel, gapMs, personaSlug);
    }

    // Store temporal event if there was a meaningful gap
    if (gapLevel !== GAP_LEVELS.NONE) {
      await storeTemporalEvent(personaId, {
        eventType: 'invocation_gap',
        gapMs,
        gapLevel,
        reflection,
        sessionId
      });
    }

    // Update last_active timestamp
    await touchTemporalState(personaId, { lastActive: currentTime });

    const result = {
      hasGap: gapLevel !== GAP_LEVELS.NONE,
      gapMs,
      gapLevel,
      reflection,
      lastActive,
      framedContext: reflection ? frameTemporalContext({ reflection, gapLevel, gapMs }) : null
    };

    await logOperation('temporal_context_generate', {
      personaId,
      sessionId,
      details: {
        gap_level: gapLevel,
        gap_ms: gapMs,
        has_reflection: !!reflection,
        persona_slug: personaSlug
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return result;
  } catch (error) {
    console.error('[TemporalAwareness] Error generating temporal context:', error.message);

    await logOperation('temporal_context_generate', {
      personaId,
      sessionId,
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });

    // Return empty context on failure (invisible infrastructure)
    return {
      hasGap: false,
      gapMs: 0,
      gapLevel: GAP_LEVELS.NONE,
      reflection: '',
      lastActive: null,
      framedContext: null
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Context Framing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Frame temporal context for injection into persona system prompt.
 *
 * @param {Object} temporalContext - Temporal context from generateTemporalContext
 * @param {string} temporalContext.reflection - Generated reflection text
 * @param {string} temporalContext.gapLevel - Gap level classification
 * @param {number} temporalContext.gapMs - Gap duration in milliseconds
 * @returns {string} Framed temporal context for injection
 *
 * @example
 * const framed = frameTemporalContext({
 *   reflection: "Time has passed: 3 hours. The chopp grew warm.",
 *   gapLevel: "notable",
 *   gapMs: 10800000
 * });
 * // Returns: "[Time has passed: 3 hours. The chopp grew warm. You were thinking about the previous conversation...]"
 */
export function frameTemporalContext(temporalContext) {
  const { reflection, gapLevel, gapMs } = temporalContext;

  if (!reflection || gapLevel === GAP_LEVELS.NONE) {
    return '';
  }

  // Add continuity hint for longer gaps
  let continuityHint = '';
  if (gapLevel === GAP_LEVELS.SIGNIFICANT || gapLevel === GAP_LEVELS.MAJOR || gapLevel === GAP_LEVELS.EXTENDED) {
    continuityHint = ' You were thinking about the previous conversation...';
  }

  return `[${reflection}${continuityHint}]`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard & Statistics
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get temporal statistics for a persona.
 *
 * @param {string} personaId - Persona UUID
 * @returns {Promise<Object>} Temporal statistics
 */
export async function getTemporalStats(personaId) {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE gap_level = 'brief') as brief_gaps,
        COUNT(*) FILTER (WHERE gap_level = 'notable') as notable_gaps,
        COUNT(*) FILTER (WHERE gap_level = 'significant') as significant_gaps,
        COUNT(*) FILTER (WHERE gap_level = 'major') as major_gaps,
        COUNT(*) FILTER (WHERE gap_level = 'extended') as extended_gaps,
        COALESCE(AVG(gap_ms), 0) as avg_gap_ms,
        COALESCE(MAX(gap_ms), 0) as max_gap_ms
      FROM temporal_events
      WHERE persona_id = $1
    `, [personaId]);

    return result.rows[0];
  } catch (error) {
    console.error('[TemporalAwareness] Error getting stats:', error.message);
    return {
      total_events: 0,
      brief_gaps: 0,
      notable_gaps: 0,
      significant_gaps: 0,
      major_gaps: 0,
      extended_gaps: 0,
      avg_gap_ms: 0,
      max_gap_ms: 0
    };
  }
}

/**
 * Get temporal overview for all personas (dashboard).
 *
 * @returns {Promise<Array<Object>>} Array of persona temporal stats
 */
export async function getTemporalOverview() {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT
        p.id as persona_id,
        p.name as persona_name,
        p.category,
        pts.last_active,
        pts.invocation_count,
        pts.last_topic,
        COUNT(te.id) as total_gaps,
        COALESCE(AVG(te.gap_ms), 0) as avg_gap_ms
      FROM personas p
      LEFT JOIN persona_temporal_state pts ON p.id = pts.persona_id
      LEFT JOIN temporal_events te ON p.id = te.persona_id
      GROUP BY p.id, p.name, p.category, pts.last_active, pts.invocation_count, pts.last_topic
      ORDER BY pts.last_active DESC NULLS LAST
    `);

    return result.rows.map(row => ({
      personaId: row.persona_id,
      personaName: row.persona_name,
      category: row.category,
      lastActive: row.last_active,
      invocationCount: parseInt(row.invocation_count) || 0,
      lastTopic: row.last_topic,
      totalGaps: parseInt(row.total_gaps) || 0,
      avgGapMs: parseFloat(row.avg_gap_ms) || 0
    }));
  } catch (error) {
    console.error('[TemporalAwareness] Error getting overview:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Connection Cleanup
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Close the database connection pool.
 * @deprecated Use closeSharedPool() from db-pool.js instead
 *
 * @returns {Promise<void>}
 */
export async function closePool() {
  // No-op: pool lifecycle is managed by db-pool.js
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration Export
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration and constants for external access.
 */
export const CONFIG = {
  TIME_THRESHOLDS,
  GAP_LEVELS,
  DEFAULT_REFLECTION_TEMPLATES,
  SETTING_DETAILS,
  PERSONA_REFLECTIONS
};
