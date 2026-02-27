/**
 * AEON Matrix - Ambient Generator
 *
 * Generates dynamic environmental details for O Fim bar.
 * Handles music shifts, weather changes, patron actions, notable objects,
 * and entropy-driven decay events.
 *
 * "It is always 2 AM at O Fim. The humidity is eternal."
 *
 * Feature: Phase 1 - Ambient Environment
 * Constitution: Principle II (Invisible Infrastructure), Principle V (Setting Preservation)
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import { ENTROPY_THRESHOLDS, AMBIENT_CONFIG } from './constants.js';

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Music templates for the jukebox.
 */
const MUSIC_TEMPLATES = [
  'Tom Jobim drifts from the jukebox',
  'Bowie plays softly. "Heroes" tonight',
  'Fado, mournful and distant',
  'The jukebox hums between songs',
  'Static between stations. Something almost resolves',
  'Chet Baker, barely audible',
  'The needle drags. The song repeats'
];

/**
 * Weather templates for the eternal Rio night.
 */
const WEATHER_TEMPLATES = [
  'Humid, still',
  'Rain drums on the awning',
  'Thunder, distant',
  'The air is thick and warm',
  'A cool breeze, rare and fleeting',
  'The humidity presses in',
  'Fog drifts past the windows'
];

/**
 * Lighting templates for the bar.
 */
const LIGHTING_TEMPLATES = [
  'dim amber',
  'candlelight flickers',
  'the neon buzzes',
  'shadows gather in corners',
  'the lights are low'
];

/**
 * Micro-event templates by category.
 */
const MICRO_EVENT_TEMPLATES = {
  patron: [
    'Someone laughs. It echoes longer than it should.',
    'The barman polishes the same glass. Has been polishing it for hours.',
    'A stranger enters, pauses at the threshold, leaves.',
    'Two patrons argue quietly in Portuguese.',
    'Someone raises a glass to no one.',
    'A patron stares at the door. Waiting.'
  ],
  object: [
    'The clock on the wall shows 2 AM. It always shows 2 AM.',
    'A newspaper on the counter. The date is smudged.',
    'An empty chair at the bar. Someone was just there.',
    'The ashtray overflows with memories.',
    'A half-finished drink. The ice has not melted.',
    'The mirror behind the bar shows more patrons than there are.'
  ],
  decay: [
    'The lights dim further. The edges of the room soften.',
    'Conversations fragment. Words don\'t quite connect.',
    'The jukebox skips. Repeats. Repeats.',
    'The walls seem closer. Or further.',
    'Time stutters.',
    'The air tastes like static.'
  ],
  atmosphere: [
    'Chopp flows cold.',
    'Smoke curls toward the ceiling, defying the fans.',
    'The humidity is eternal.',
    'The night stretches.',
    'Outside, Rio dreams.'
  ]
};

/**
 * Entropy state thresholds and labels (derived from centralized constants).
 */
const ENTROPY_STATES_RANGES = {
  stable: { min: 0, max: ENTROPY_THRESHOLDS.STABLE },
  unsettled: { min: ENTROPY_THRESHOLDS.STABLE, max: ENTROPY_THRESHOLDS.UNSETTLED },
  decaying: { min: ENTROPY_THRESHOLDS.UNSETTLED, max: ENTROPY_THRESHOLDS.DECAYING },
  fragmenting: { min: ENTROPY_THRESHOLDS.DECAYING, max: ENTROPY_THRESHOLDS.FRAGMENTING },
  dissolving: { min: ENTROPY_THRESHOLDS.FRAGMENTING, max: ENTROPY_THRESHOLDS.DISSOLVING }
};

/**
 * Calculate the time of night based on real-world hours.
 * O Fim exists in eternal night - day hours default to deep_night.
 *
 * @returns {string} 'deep_night' | 'pre_dawn' | 'twilight'
 */
export function getTimeOfNight() {
  const hour = new Date().getHours();

  if (hour >= 0 && hour < 4) {
    return 'deep_night';
  } else if (hour >= 4 && hour < 6) {
    return 'pre_dawn';
  } else if ((hour >= 6 && hour < 8) || (hour >= 20 && hour <= 23)) {
    return 'twilight';
  } else {
    // Day hours: O Fim is eternal night
    return 'deep_night';
  }
}

/**
 * Get entropy state label from entropy level.
 *
 * @param {number} entropyLevel - Current entropy level (0.0 - 1.0)
 * @returns {string} Entropy state label
 */
function getEntropyState(entropyLevel) {
  if (entropyLevel < ENTROPY_THRESHOLDS.STABLE) return 'stable';
  if (entropyLevel < ENTROPY_THRESHOLDS.UNSETTLED) return 'unsettled';
  if (entropyLevel < ENTROPY_THRESHOLDS.DECAYING) return 'decaying';
  if (entropyLevel < ENTROPY_THRESHOLDS.FRAGMENTING) return 'fragmenting';
  return 'dissolving';
}

/**
 * Get current ambient state from database view.
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @returns {Promise<Object|null>} Current ambient state or null on error
 */
export async function getAmbientState() {
  try {
    const db = getPool();

    const result = await db.query('SELECT * FROM ambient_status');

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      currentMusic: row.current_music,
      currentWeather: row.current_weather,
      currentLighting: row.current_lighting,
      patronCount: row.patron_count,
      notableObjects: row.notable_objects || [],
      entropyLevel: parseFloat(row.entropy_level) || 0,
      entropyState: row.entropy_state,
      lastUpdated: row.last_updated
    };
  } catch (error) {
    console.error('[AmbientGenerator] getAmbientState error:', error.message);
    return null;
  }
}

/**
 * Update ambient state in the database.
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @param {Object} updates - Fields to update
 * @param {string} [updates.music] - New music track
 * @param {string} [updates.weather] - New weather state
 * @param {string} [updates.lighting] - New lighting state
 * @param {number} [updates.patronCount] - Number of patrons
 * @param {string[]} [updates.notableObjects] - Notable objects array
 * @returns {Promise<{success: boolean}>}
 */
export async function updateAmbientState(updates) {
  if (!updates || typeof updates !== 'object') {
    return { success: false };
  }

  try {
    const db = getPool();

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (updates.music !== undefined) {
      setClauses.push(`current_music = $${paramIndex++}`);
      values.push(updates.music);
    }

    if (updates.weather !== undefined) {
      setClauses.push(`current_weather = $${paramIndex++}`);
      values.push(updates.weather);
    }

    if (updates.lighting !== undefined) {
      setClauses.push(`current_lighting = $${paramIndex++}`);
      values.push(updates.lighting);
    }

    if (updates.patronCount !== undefined) {
      setClauses.push(`patron_count = $${paramIndex++}`);
      values.push(updates.patronCount);
    }

    if (updates.notableObjects !== undefined) {
      setClauses.push(`notable_objects = $${paramIndex++}`);
      values.push(updates.notableObjects);
    }

    if (setClauses.length === 0) {
      return { success: true };
    }

    setClauses.push('last_updated = NOW()');

    await db.query(
      `UPDATE active_ambient_state SET ${setClauses.join(', ')} WHERE id = 1`,
      values
    );

    return { success: true };
  } catch (error) {
    console.error('[AmbientGenerator] updateAmbientState error:', error.message);
    return { success: false };
  }
}

/**
 * Select weighted micro-events based on time of night and entropy.
 *
 * Higher entropy unlocks decay events. Time of night influences selection.
 *
 * @param {string} timeOfNight - 'deep_night' | 'pre_dawn' | 'twilight'
 * @param {number} entropy - Current entropy level (0.0 - 1.0)
 * @param {number} count - Number of events to select
 * @returns {Promise<string[]>} Selected event templates
 */
export async function selectWeightedEvents(timeOfNight, entropy, count = 2) {
  const startTime = Date.now();

  try {
    const db = getPool();

    // Try to get templates from database
    const result = await db.query(
      `SELECT template, frequency_weight, event_type, min_entropy
       FROM ambient_event_templates
       WHERE (time_of_night = $1 OR time_of_night = 'any')
         AND min_entropy <= $2
         AND max_entropy >= $2
       ORDER BY random() * frequency_weight DESC
       LIMIT $3`,
      [timeOfNight, entropy, count]
    );

    if (result.rows.length > 0) {
      await logOperation('ambient_events_selected', {
        details: {
          source: 'database',
          count: result.rows.length,
          timeOfNight,
          entropy
        },
        durationMs: Date.now() - startTime,
        success: true
      });

      return result.rows.map(row => row.template);
    }

    // Fallback to in-memory templates
    return selectFallbackEvents(timeOfNight, entropy, count);
  } catch (error) {
    console.error('[AmbientGenerator] selectWeightedEvents error:', error.message);
    // Fallback to in-memory templates
    return selectFallbackEvents(timeOfNight, entropy, count);
  }
}

/**
 * Select events from in-memory templates (fallback).
 *
 * @param {string} timeOfNight - Time of night
 * @param {number} entropy - Entropy level
 * @param {number} count - Number of events
 * @returns {string[]} Selected events
 */
function selectFallbackEvents(timeOfNight, entropy, count) {
  const availableCategories = ['patron', 'object', 'atmosphere'];

  // Unlock decay events at higher entropy
  if (entropy >= 0.5) {
    availableCategories.push('decay');
  }

  // Weight decay more heavily at high entropy
  if (entropy >= 0.7) {
    availableCategories.push('decay');
  }

  const selected = [];
  const usedEvents = new Set();

  for (let i = 0; i < count; i++) {
    const category = availableCategories[Math.floor(Math.random() * availableCategories.length)];
    const templates = MICRO_EVENT_TEMPLATES[category];
    const template = templates[Math.floor(Math.random() * templates.length)];

    if (!usedEvents.has(template)) {
      usedEvents.add(template);
      selected.push(template);
    }
  }

  return selected;
}

/**
 * Generate ambient details for a session.
 *
 * Constitution: Principle II (Invisible Infrastructure), Principle V (Setting Preservation)
 *
 * @param {string} sessionId - Session identifier
 * @param {string} [personaId] - Optional persona identifier for persona-specific events
 * @returns {Promise<Object>} Ambient details object
 */
export async function generateAmbientDetails(sessionId, personaId = null) {
  const startTime = Date.now();

  try {
    // Get current ambient state from database
    const ambientState = await getAmbientState();

    const timeOfNight = getTimeOfNight();
    const entropyLevel = ambientState?.entropyLevel ?? 0;
    const entropyState = getEntropyState(entropyLevel);

    // Select music based on state or pick from templates
    const music = ambientState?.currentMusic || selectRandom(MUSIC_TEMPLATES);

    // Select weather based on state or pick from templates
    const weather = ambientState?.currentWeather || selectRandom(WEATHER_TEMPLATES);

    // Select lighting based on state or pick from templates
    const lighting = ambientState?.currentLighting || selectRandom(LIGHTING_TEMPLATES);

    // Select micro-events weighted by entropy
    const microEventCount = entropyLevel >= 0.5 ? 3 : 2;
    const microEvents = await selectWeightedEvents(timeOfNight, entropyLevel, microEventCount);

    const details = {
      timeOfNight,
      music,
      weather,
      lighting,
      entropyLevel,
      entropyState,
      patronCount: ambientState?.patronCount ?? 3,
      notableObjects: ambientState?.notableObjects ?? [],
      microEvents
    };

    await logOperation('ambient_generation', {
      sessionId,
      personaId,
      details: {
        timeOfNight,
        entropyLevel,
        entropyState,
        microEventCount: microEvents.length
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return details;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'ambient_generation_failure',
        error_message: error.message,
        fallback_used: 'default_ambient'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    // Return sensible defaults on error
    return {
      timeOfNight: 'deep_night',
      music: 'Tom Jobim drifts from the jukebox',
      weather: 'Humid, still',
      lighting: 'dim amber',
      entropyLevel: 0,
      entropyState: 'stable',
      patronCount: 3,
      notableObjects: [],
      microEvents: ['Chopp flows cold.']
    };
  }
}

/**
 * Frame ambient details as natural language for context injection.
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @param {Object} ambientDetails - Details from generateAmbientDetails()
 * @returns {string} Natural language ambient context
 *
 * @example
 * const framed = frameAmbientContext(details);
 * // "It is 2 AM, deep in the night, at O Fim. Humid, still. The jukebox plays
 * //  Tom Jobim. Someone laughs. It echoes longer than it should."
 */
export function frameAmbientContext(ambientDetails) {
  if (!ambientDetails) {
    return 'It is 2 AM at O Fim. The humidity is eternal. Chopp flows cold. You exist in this moment.';
  }

  const {
    timeOfNight,
    music,
    weather,
    lighting,
    entropyLevel,
    entropyState,
    microEvents
  } = ambientDetails;

  const parts = [];

  // Opening: Time and place
  const timeDescriptor = formatTimeOfNight(timeOfNight);
  parts.push(`It is 2 AM, ${timeDescriptor}, at O Fim.`);

  // Weather
  parts.push(`${weather}.`);

  // Lighting at higher entropy
  if (entropyLevel >= 0.3 && lighting) {
    parts.push(formatLighting(lighting) + '.');
  }

  // Music
  parts.push(`The jukebox plays ${music.replace(/^The jukebox plays /, '').replace(/drifts from the jukebox$/, '')}.`);

  // Micro-events
  if (microEvents && microEvents.length > 0) {
    for (const event of microEvents) {
      // Ensure proper punctuation
      const formatted = event.endsWith('.') || event.endsWith('?') || event.endsWith('!')
        ? event
        : event + '.';
      parts.push(formatted);
    }
  }

  // Entropy flavor at high levels
  if (entropyState === 'fragmenting' || entropyState === 'dissolving') {
    parts.push('The edges of things seem uncertain.');
  }

  return parts.join(' ');
}

/**
 * Format time of night for prose.
 *
 * @param {string} timeOfNight - Time period
 * @returns {string} Formatted descriptor
 */
function formatTimeOfNight(timeOfNight) {
  switch (timeOfNight) {
    case 'deep_night':
      return 'deep in the night';
    case 'pre_dawn':
      return 'in the hours before dawn';
    case 'twilight':
      return 'at the edge of night';
    default:
      return 'deep in the night';
  }
}

/**
 * Format lighting for prose.
 *
 * @param {string} lighting - Lighting descriptor
 * @returns {string} Formatted lighting
 */
function formatLighting(lighting) {
  if (lighting.includes('flicker') || lighting.includes('buzz') || lighting.includes('gather')) {
    return lighting.charAt(0).toUpperCase() + lighting.slice(1);
  }
  return `The lighting is ${lighting}`;
}

/**
 * Select a random element from an array.
 *
 * @param {Array} arr - Array to select from
 * @returns {*} Random element
 */
function selectRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Log an ambient event to the event log.
 *
 * @param {string} eventType - Type of event
 * @param {string} content - Event content
 * @param {string} [sessionId] - Session identifier
 * @returns {Promise<void>}
 */
export async function logAmbientEvent(eventType, content, sessionId = null) {
  try {
    const db = getPool();
    const ambientState = await getAmbientState();

    await db.query(
      `INSERT INTO ambient_event_log (event_type, content, entropy_at_trigger, session_id)
       VALUES ($1, $2, $3, $4)`,
      [eventType, content, ambientState?.entropyLevel ?? 0, sessionId]
    );
  } catch (error) {
    console.error('[AmbientGenerator] logAmbientEvent error:', error.message);
  }
}

/**
 * Increment entropy level in the database.
 *
 * @param {number} [delta=0.01] - Amount to increment
 * @returns {Promise<number>} New entropy level
 */
export async function incrementEntropy(delta = 0.01) {
  try {
    const db = getPool();
    const result = await db.query('SELECT increment_entropy($1) as new_entropy', [delta]);
    return parseFloat(result.rows[0]?.new_entropy) || 0;
  } catch (error) {
    console.error('[AmbientGenerator] incrementEntropy error:', error.message);
    return 0;
  }
}

/**
 * Reset entropy level in the database.
 *
 * @param {number} [newLevel=0] - New entropy level
 * @returns {Promise<void>}
 */
export async function resetEntropy(newLevel = 0) {
  try {
    const db = getPool();
    await db.query('SELECT reset_entropy($1)', [newLevel]);
  } catch (error) {
    console.error('[AmbientGenerator] resetEntropy error:', error.message);
  }
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
