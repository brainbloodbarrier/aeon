/**
 * AEON Matrix - Setting Preserver
 *
 * Handles loading, saving, and compiling user setting preferences for context assembly.
 * Enables the bar to remember each user's atmosphere preferences across sessions.
 *
 * Feature: 005-setting-preservation
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import { SETTING_CONFIG } from './constants.js';

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Default setting configuration.
 */
const DEFAULTS = {
  timeOfDay: SETTING_CONFIG.DEFAULT_TIME,
  location: SETTING_CONFIG.DEFAULT_LOCATION,
  tokenBudget: SETTING_CONFIG.DEFAULT_TOKEN_BUDGET
};

/**
 * Default setting template when no preferences exist.
 */
const DEFAULT_SETTING = 'It is 2 AM at O Fim. The humidity is eternal. Chopp flows cold. You exist in this moment.';

/**
 * Explicit mapping of preference keys to database columns.
 * Security: Prevents SQL injection by only allowing known column names.
 */
const COLUMN_MAP = {
  timeOfDay: 'time_of_day',
  musicPreference: 'music_preference',
  atmosphereDescriptors: 'atmosphere_descriptors',
  locationPreference: 'location_preference',
  customSettingText: 'custom_setting_text',
  systemConfig: 'system_config'
};

/**
 * Keys that require JSON serialization before storage.
 */
const JSON_COLUMNS = new Set(['atmosphereDescriptors', 'systemConfig']);

/**
 * Load stored setting preferences for a user.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} UserSettings object or null if not found
 */
export async function loadUserSettings(userId) {
  if (!userId) {
    return null;
  }

  try {
    const db = getPool();

    const result = await db.query(
      `SELECT
        user_id,
        time_of_day,
        music_preference,
        atmosphere_descriptors,
        location_preference,
        custom_setting_text,
        system_config,
        updated_at
      FROM user_settings
      WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      timeOfDay: row.time_of_day || DEFAULTS.timeOfDay,
      musicPreference: row.music_preference,
      atmosphereDescriptors: row.atmosphere_descriptors || {},
      locationPreference: row.location_preference,
      customSettingText: row.custom_setting_text,
      systemConfig: row.system_config || {},
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('[SettingPreserver] loadUserSettings error:', error.message);
    return null;
  }
}

/**
 * Save or update user setting preferences.
 * Uses upsert to create record if not exists.
 *
 * @param {string} userId - User UUID
 * @param {Object} preferences - Preferences to save
 * @param {string} [preferences.timeOfDay] - Preferred time of day
 * @param {string} [preferences.musicPreference] - Music preference
 * @param {Object} [preferences.atmosphereDescriptors] - Atmosphere settings as key-value pairs
 * @param {string} [preferences.locationPreference] - Preferred location in bar
 * @param {string} [preferences.customSettingText] - User's custom atmosphere text
 * @param {Object} [preferences.systemConfig] - Operator config overrides
 * @returns {Promise<{success: boolean, updatedFields: string[]}>}
 */
export async function saveUserSettings(userId, preferences) {
  if (!userId || !preferences || typeof preferences !== 'object') {
    return { success: false, updatedFields: [] };
  }

  try {
    const db = getPool();

    // Build columns and values from validated keys only (prevents SQL injection)
    const entries = Object.entries(preferences)
      .filter(([key, value]) => COLUMN_MAP[key] && value !== undefined);

    if (entries.length === 0) {
      return { success: true, updatedFields: [] };
    }

    // Extract validated column names and prepare values
    const columns = entries.map(([key]) => COLUMN_MAP[key]);
    const updatedFields = entries.map(([key]) => key);
    const values = [userId];

    entries.forEach(([key, value]) => {
      values.push(JSON_COLUMNS.has(key) ? JSON.stringify(value) : value);
    });

    // Build parameterized placeholders
    const insertColumns = ['user_id', ...columns].join(', ');
    const insertPlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const updateClauses = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');

    // Upsert query with explicit column names (no string manipulation)
    const query = `
      INSERT INTO user_settings (${insertColumns})
      VALUES (${insertPlaceholders})
      ON CONFLICT (user_id) DO UPDATE SET
        ${updateClauses},
        updated_at = NOW()
      RETURNING id
    `;

    await db.query(query, values);

    return { success: true, updatedFields };
  } catch (error) {
    console.error('[SettingPreserver] saveUserSettings error:', error.message);
    return { success: false, updatedFields: [] };
  }
}

/**
 * Load persona-specific location preference for a user-persona pair.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @returns {Promise<{preferredLocation: string|null, locationContext: string|null}|null>}
 */
export async function loadPersonaLocation(userId, personaId) {
  if (!userId || !personaId) {
    return null;
  }

  try {
    const db = getPool();

    const result = await db.query(
      `SELECT preferred_location, location_context
       FROM relationships
       WHERE user_id = $1 AND persona_id = $2`,
      [userId, personaId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      preferredLocation: result.rows[0].preferred_location,
      locationContext: result.rows[0].location_context
    };
  } catch (error) {
    console.error('[SettingPreserver] loadPersonaLocation error:', error.message);
    return null;
  }
}

/**
 * Save persona-specific location preference.
 * Only updates existing relationship records (does not create new ones).
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @param {Object} location - Location data
 * @param {string} [location.preferredLocation] - Preferred meeting location
 * @param {string} [location.locationContext] - Additional context
 * @returns {Promise<{success: boolean}>}
 */
export async function savePersonaLocation(userId, personaId, location) {
  if (!userId || !personaId || !location) {
    return { success: false };
  }

  try {
    const db = getPool();

    const updates = [];
    const values = [userId, personaId];
    let paramIndex = 3;

    if (location.preferredLocation !== undefined) {
      updates.push(`preferred_location = $${paramIndex++}`);
      values.push(location.preferredLocation);
    }

    if (location.locationContext !== undefined) {
      updates.push(`location_context = $${paramIndex++}`);
      values.push(location.locationContext);
    }

    if (updates.length === 0) {
      return { success: true };
    }

    const result = await db.query(
      `UPDATE relationships
       SET ${updates.join(', ')}
       WHERE user_id = $1 AND persona_id = $2
       RETURNING id`,
      values
    );

    // Returns false if relationship doesn't exist
    return { success: result.rowCount > 0 };
  } catch (error) {
    console.error('[SettingPreserver] savePersonaLocation error:', error.message);
    return { success: false };
  }
}

/**
 * Compile a personalized setting context string for context assembly.
 * This replaces getSettingContext() when user preferences exist.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @param {string} sessionId - Session UUID (for logging)
 * @returns {Promise<string>} Compiled setting text (max ~200 tokens)
 */
export async function compileUserSetting(userId, personaId, sessionId) {
  const startTime = Date.now();

  try {
    // Load user settings
    const settings = await loadUserSettings(userId);

    // Load persona-specific location
    const personaLocation = await loadPersonaLocation(userId, personaId);

    // If no preferences exist, return default
    if (!settings && !personaLocation) {
      await logOperation('setting_compile', {
        sessionId,
        personaId,
        userId,
        details: {
          personalized: false,
          source: 'default'
        },
        durationMs: Date.now() - startTime,
        success: true
      });

      return DEFAULT_SETTING;
    }

    // Compile personalized setting
    const compiled = compileSettingText(settings, personaLocation);

    // Enforce token budget
    const tokenBudget = settings?.systemConfig?.token_budget || DEFAULTS.tokenBudget;
    const truncated = truncateToTokens(compiled, tokenBudget);

    await logOperation('setting_compile', {
      sessionId,
      personaId,
      userId,
      details: {
        personalized: true,
        has_music: !!settings?.musicPreference,
        has_atmosphere: Object.keys(settings?.atmosphereDescriptors || {}).length > 0,
        has_location: !!(settings?.locationPreference || personaLocation?.preferredLocation),
        token_budget: tokenBudget,
        truncated: truncated.length < compiled.length
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return truncated;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'setting_compile_failure',
        error_message: error.message,
        fallback_used: 'default_setting'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return DEFAULT_SETTING;
  }
}

/**
 * Compile setting text from preferences.
 *
 * @param {Object|null} settings - User settings
 * @param {Object|null} personaLocation - Persona-specific location
 * @returns {string} Compiled setting text
 */
function compileSettingText(settings, personaLocation) {
  const parts = [];

  // Time of day
  const time = settings?.timeOfDay || DEFAULTS.timeOfDay;
  parts.push(`It is ${time} at ${DEFAULTS.location}.`);

  // Atmosphere descriptors
  if (settings?.atmosphereDescriptors) {
    const descriptors = settings.atmosphereDescriptors;
    const atmosphereParts = [];

    if (descriptors.humidity) {
      const humidity = descriptors.humidity === 'less' ? 'less humid tonight' :
                       descriptors.humidity === 'more' ? 'the humidity presses in' :
                       `the air feels ${descriptors.humidity}`;
      atmosphereParts.push(humidity);
    }

    if (descriptors.lighting) {
      const lighting = descriptors.lighting === 'candlelight' ? 'candlelight flickers' :
                       descriptors.lighting === 'dim' ? 'the lights are low' :
                       `the lighting is ${descriptors.lighting}`;
      atmosphereParts.push(lighting);
    }

    // Generic descriptors
    const skipKeys = ['humidity', 'lighting'];
    for (const [key, value] of Object.entries(descriptors)) {
      if (!skipKeys.includes(key) && value) {
        atmosphereParts.push(`${value} ${key}`);
      }
    }

    if (atmosphereParts.length > 0) {
      parts.push(atmosphereParts.join(', ') + '.');
    }
  }

  // Music preference
  if (settings?.musicPreference) {
    parts.push(`${settings.musicPreference} drifts from the jukebox.`);
  } else {
    parts.push('Chopp flows cold.');
  }

  // Location (persona-specific or general)
  const location = personaLocation?.preferredLocation || settings?.locationPreference;
  if (location) {
    const context = personaLocation?.locationContext;
    if (context) {
      parts.push(`You exist in this moment at your usual ${location}, ${context}.`);
    } else {
      parts.push(`You exist in this moment at your usual ${location}.`);
    }
  } else {
    parts.push('You exist in this moment.');
  }

  // Custom setting text (appended if exists)
  if (settings?.customSettingText) {
    parts.push(settings.customSettingText);
  }

  return parts.join(' ');
}

/**
 * Truncate text to approximately fit within token budget.
 * Rough approximation: 1 token ~ 4 characters.
 *
 * @param {string} text - Text to truncate
 * @param {number} maxTokens - Maximum tokens
 * @returns {string} Truncated text
 */
function truncateToTokens(text, maxTokens) {
  const maxChars = maxTokens * SETTING_CONFIG.CHARS_PER_TOKEN;
  if (text.length <= maxChars) {
    return text;
  }

  // Truncate at sentence boundary if possible
  const truncated = text.slice(0, maxChars);
  const lastSentence = truncated.lastIndexOf('.');

  if (lastSentence > maxChars * SETTING_CONFIG.SENTENCE_BOUNDARY_RATIO) {
    return truncated.slice(0, lastSentence + 1);
  }

  return truncated.trim();
}

/**
 * Get system configuration for a user.
 * Helper for external modules to read operator config overrides.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} System config or empty object
 */
export async function getSystemConfig(userId) {
  const settings = await loadUserSettings(userId);
  return settings?.systemConfig || {};
}

/**
 * Touch user settings to update timestamp (prevents 90-day purge).
 *
 * @param {string} userId - User UUID
 * @returns {Promise<void>}
 */
export async function touchUserSettings(userId) {
  if (!userId) return;

  try {
    const db = getPool();
    await db.query(
      `SELECT touch_user_settings($1)`,
      [userId]
    );
  } catch (error) {
    // Fire-and-forget
    console.error('[SettingPreserver] touchUserSettings error:', error.message);
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
