/**
 * AEON Matrix - Setting Extractor
 *
 * Extracts setting preferences from conversation text at session end using pattern matching.
 * Identifies music preferences, atmosphere descriptors, location mentions, and time-of-day requests.
 *
 * Feature: 005-setting-preservation
 */

import { logOperation } from './operator-logger.js';
import { saveUserSettings, savePersonaLocation } from './setting-preserver.js';

/**
 * Pattern definitions for extracting setting preferences.
 * Each category contains patterns that capture relevant user preferences.
 */
export const SETTING_PATTERNS = {
  music: [
    // Explicit preferences
    /(?:play|prefer|like|love)\s+(?:some\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:music|playing)/i,
    /(?:wish|want)\s+(?:the\s+)?(?:jukebox\s+)?(?:played?|playing)\s+([A-Za-z]+)/i,
    /jukebox\s+(?:plays?|playing|played)\s+([A-Za-z]+)/i,
    // Known artists/genres (direct match)
    /\b(fado|jobim|bowie|tom\s+waits|jazz|classical|ambient|blues|silence)\b/i
  ],

  atmosphere: [
    // Explicit modifiers
    /(?:prefer|like|want)\s+(?:it\s+)?(?:to\s+be\s+)?(?:more\s+)?(\w+)/i,
    /(?:less|more)\s+(humid(?:ity)?|bright|dim|warm|cool|quiet|loud)/gi,
    // Direct descriptors
    /\b(candlelight|dim\s+light(?:ing)?|bright(?:er)?|humid|dry|warm(?:er)?|cool(?:er)?|quiet(?:er)?|loud(?:er)?)\b/i
  ],

  location: [
    // Specific locations
    /\b(corner\s+booth|bar\s+counter|window\s+seat|back\s+table|front\s+table)\b/i,
    /(?:my|the)\s+usual\s+(spot|place|seat|booth|table)/i,
    /(?:sit(?:ting)?|seated?)\s+(?:at|in|by)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i,
    /prefer\s+(?:the\s+)?(\w+\s+(?:booth|counter|seat|table))/i
  ],

  timeOfDay: [
    // Hypothetical time changes
    /(?:what\s+if|imagine|prefer)\s+(?:it\s+)?(?:were?|was|is)\s+(dawn|dusk|midnight|noon|morning|evening)/i,
    // Direct time preferences
    /(?:prefer|like)\s+(?:it\s+)?(?:at\s+)?(dawn|dusk|midnight|noon|morning|evening|sunrise|sunset)/i,
    // Direct mentions in setting context
    /\b(dawn|dusk|midnight|noon|sunrise|sunset)\b/i
  ],

  personaLocation: [
    // "[Persona] at/by the [location]"
    /\b(Hegel|Socrates|Diogenes|Pessoa|Caeiro|Reis|Campos|Soares|Moore|Dee|Crowley|Tesla|Feynman|Lovelace|Vito|Michael|Machiavelli)\s+(?:at|by|near)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i
  ]
};

/**
 * Known atmosphere descriptors for validation.
 */
const ATMOSPHERE_KEYS = {
  humidity: ['humid', 'humidity', 'dry', 'damp', 'moist'],
  lighting: ['candlelight', 'dim', 'bright', 'dark', 'light', 'lighting'],
  temperature: ['warm', 'warmer', 'cool', 'cooler', 'cold', 'hot'],
  sound: ['quiet', 'quieter', 'loud', 'louder', 'silent']
};

/**
 * Map raw descriptor to category.
 */
function categorizeDescriptor(descriptor) {
  const lower = descriptor.toLowerCase();
  for (const [category, keywords] of Object.entries(ATMOSPHERE_KEYS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return 'general';
}

/**
 * Extract setting preferences from conversation messages.
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation history
 * @returns {Object} ExtractedPreferences object
 */
export function extractSettingPreferences(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return createEmptyPreferences();
  }

  // Only process user messages
  const userMessages = messages
    .filter(m => m.role === 'user' && typeof m.content === 'string')
    .map(m => m.content);

  if (userMessages.length === 0) {
    return createEmptyPreferences();
  }

  const combinedText = userMessages.join(' ');

  // Extract each preference type
  const musicPreference = extractMusic(combinedText);
  const atmosphereDescriptors = extractAtmosphere(combinedText);
  const locationPreference = extractLocation(combinedText);
  const timeOfDay = extractTimeOfDay(combinedText);
  const personaLocations = extractPersonaLocations(combinedText);

  // Calculate confidence based on number and quality of matches
  const confidence = calculateConfidence({
    musicPreference,
    atmosphereDescriptors,
    locationPreference,
    timeOfDay,
    personaLocations
  });

  return {
    musicPreference,
    atmosphereDescriptors,
    locationPreference,
    timeOfDay,
    personaLocations,
    confidence
  };
}

/**
 * Create empty preferences object.
 */
function createEmptyPreferences() {
  return {
    musicPreference: null,
    atmosphereDescriptors: {},
    locationPreference: null,
    timeOfDay: null,
    personaLocations: [],
    confidence: 0
  };
}

/**
 * Extract music preference from text.
 */
function extractMusic(text) {
  for (const pattern of SETTING_PATTERNS.music) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Capitalize first letter
      const music = match[1].trim();
      return music.charAt(0).toUpperCase() + music.slice(1).toLowerCase();
    }
  }
  return null;
}

/**
 * Extract atmosphere descriptors from text.
 */
function extractAtmosphere(text) {
  const descriptors = {};

  for (const pattern of SETTING_PATTERNS.atmosphere) {
    // Handle global patterns
    if (pattern.flags.includes('g')) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const descriptor = match[1].toLowerCase();
          const category = categorizeDescriptor(descriptor);

          // Detect "less" or "more" modifier
          const fullMatch = match[0].toLowerCase();
          if (fullMatch.includes('less')) {
            descriptors[category] = 'less';
          } else if (fullMatch.includes('more')) {
            descriptors[category] = 'more';
          } else {
            descriptors[category] = descriptor;
          }
        }
      }
    } else {
      const match = text.match(pattern);
      if (match && match[1]) {
        const descriptor = match[1].toLowerCase();
        const category = categorizeDescriptor(descriptor);

        // Special handling for candlelight
        if (descriptor === 'candlelight' || descriptor.includes('candle')) {
          descriptors.lighting = 'candlelight';
        } else {
          descriptors[category] = descriptor;
        }
      }
    }
  }

  return descriptors;
}

/**
 * Extract location preference from text.
 */
function extractLocation(text) {
  for (const pattern of SETTING_PATTERNS.location) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase().trim();
    }
  }
  return null;
}

/**
 * Extract time of day preference from text.
 */
function extractTimeOfDay(text) {
  for (const pattern of SETTING_PATTERNS.timeOfDay) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase().trim();
    }
  }
  return null;
}

/**
 * Extract persona-specific locations from text.
 */
function extractPersonaLocations(text) {
  const locations = [];

  for (const pattern of SETTING_PATTERNS.personaLocation) {
    const regex = new RegExp(pattern.source, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1] && match[2]) {
        locations.push({
          personaName: match[1],
          location: match[2].toLowerCase().trim(),
          context: null
        });
      }
    }
  }

  // Deduplicate by persona name (last mention wins)
  const uniqueLocations = [];
  const seen = new Set();
  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i];
    if (!seen.has(loc.personaName.toLowerCase())) {
      seen.add(loc.personaName.toLowerCase());
      uniqueLocations.unshift(loc);
    }
  }

  return uniqueLocations;
}

/**
 * Calculate confidence score based on extracted preferences.
 */
function calculateConfidence(prefs) {
  let score = 0;
  let matches = 0;

  // Each preference type contributes to confidence
  if (prefs.musicPreference) {
    score += 0.8;
    matches++;
  }

  if (Object.keys(prefs.atmosphereDescriptors).length > 0) {
    score += 0.2 * Object.keys(prefs.atmosphereDescriptors).length;
    matches++;
  }

  if (prefs.locationPreference) {
    score += 0.7;
    matches++;
  }

  if (prefs.timeOfDay) {
    score += 0.6;
    matches++;
  }

  if (prefs.personaLocations.length > 0) {
    score += 0.5;
    matches++;
  }

  if (matches === 0) return 0;

  // Normalize to 0-1 range
  return Math.min(score / matches, 1);
}

/**
 * Extract preferences from session and save to database.
 * Intended for session-end processing.
 *
 * @param {Object} sessionData - Session completion data
 * @param {string} sessionData.sessionId - Session UUID
 * @param {string} sessionData.userId - User UUID
 * @param {string} sessionData.personaId - Persona UUID
 * @param {string} sessionData.personaName - Persona name
 * @param {Array} sessionData.messages - Conversation messages
 * @param {number} sessionData.startedAt - Session start timestamp
 * @param {number} sessionData.endedAt - Session end timestamp
 * @returns {Promise<Object>} Extraction result
 */
export async function extractAndSaveSettings(sessionData, client = null) {
  const startTime = Date.now();

  // Input validation: ensure sessionData is a valid object with required fields
  if (!sessionData || typeof sessionData !== 'object') {
    return { extracted: null, saved: { userSettings: false, personaLocation: false }, fieldsUpdated: [] };
  }

  const { sessionId, userId, personaId, personaName, messages } = sessionData;

  // Validate messages array exists and is non-empty
  if (!Array.isArray(messages) || messages.length === 0) {
    return { extracted: null, saved: { userSettings: false, personaLocation: false }, fieldsUpdated: [] };
  }

  // Validate required IDs
  if (!userId || !personaId) {
    return { extracted: null, saved: { userSettings: false, personaLocation: false }, fieldsUpdated: [] };
  }

  try {
    // Extract preferences
    const extracted = extractSettingPreferences(messages);

    const result = {
      extracted,
      saved: {
        userSettings: false,
        personaLocation: false
      },
      fieldsUpdated: []
    };

    // Don't save if confidence is too low
    if (extracted.confidence < 0.3) {
      await logOperation('setting_extraction', {
        sessionId,
        personaId,
        userId,
        details: {
          confidence: extracted.confidence,
          skipped: true,
          reason: 'low_confidence'
        },
        durationMs: Date.now() - startTime,
        success: true
      });

      return result;
    }

    // Build preferences object for saving
    const prefsToSave = {};

    if (extracted.musicPreference) {
      prefsToSave.musicPreference = extracted.musicPreference;
    }

    if (Object.keys(extracted.atmosphereDescriptors).length > 0) {
      prefsToSave.atmosphereDescriptors = extracted.atmosphereDescriptors;
    }

    if (extracted.locationPreference) {
      prefsToSave.locationPreference = extracted.locationPreference;
    }

    if (extracted.timeOfDay) {
      prefsToSave.timeOfDay = extracted.timeOfDay;
    }

    // Save user settings if any preferences extracted
    if (Object.keys(prefsToSave).length > 0) {
      const saveResult = await saveUserSettings(userId, prefsToSave);
      result.saved.userSettings = saveResult.success;
      result.fieldsUpdated = saveResult.updatedFields;
    }

    // Save persona-specific location if detected for current persona
    const currentPersonaLocation = extracted.personaLocations.find(
      pl => pl.personaName.toLowerCase() === personaName?.toLowerCase()
    );

    if (currentPersonaLocation) {
      const locationResult = await savePersonaLocation(userId, personaId, {
        preferredLocation: currentPersonaLocation.location,
        locationContext: currentPersonaLocation.context
      });
      result.saved.personaLocation = locationResult.success;
    }

    await logOperation('setting_extraction', {
      sessionId,
      personaId,
      userId,
      details: {
        confidence: extracted.confidence,
        fields_extracted: Object.keys(prefsToSave),
        persona_location_detected: !!currentPersonaLocation,
        saved_user_settings: result.saved.userSettings,
        saved_persona_location: result.saved.personaLocation
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return result;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'setting_extraction_failure',
        error_message: error.message,
        fallback_used: 'skip_extraction'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return {
      extracted: createEmptyPreferences(),
      saved: {
        userSettings: false,
        personaLocation: false
      },
      fieldsUpdated: []
    };
  }
}
