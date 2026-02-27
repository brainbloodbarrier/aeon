/**
 * AEON Matrix - Setting Orchestrator
 *
 * Extracted from context-assembler.js to handle setting-related safe*Fetch functions,
 * ambient generation logic, setting preservation helpers, and Pynchon Stack layers
 * (temporal, entropy, zone, they-awareness, counterforce, narrative gravity, interface bleed).
 *
 * All safe*Fetch helpers catch errors and return null — a failing subsystem
 * must never break context assembly (Constitution Principle II).
 *
 * Feature: 002-invisible-infrastructure
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import { generateTemporalContext, frameTemporalContext } from './temporal-awareness.js';
import { generateAmbientDetails, frameAmbientContext } from './ambient-generator.js';
import { getEntropyState, frameEntropyContext } from './entropy-tracker.js';
import { detectZoneApproach, frameZoneContext } from './zone-boundary-detector.js';
import { processTheyAwareness } from './they-awareness.js';
import { getPersonaAlignment, generateCounterforceHints, frameCounterforceContext } from './counterforce-tracker.js';
import { getSessionArc, analyzeMomentum, getPhaseEffects, generateArcContext, frameArcContext } from './narrative-gravity.js';
import { processInterfaceBleed, frameBleedContext } from './interface-bleed.js';

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Get setting context from database or use default.
 *
 * @param {string} sessionId - Session UUID
 * @returns {Promise<string>} Setting text
 */
export async function getSettingContext(sessionId) {
  try {
    const db = getPool();

    const result = await db.query(
      `SELECT template FROM context_templates
       WHERE template_type = 'setting'
       ORDER BY priority DESC
       LIMIT 1`
    );

    if (result.rows.length > 0) {
      return result.rows[0].template;
    }

    // Default setting
    return 'It is 2 AM at O Fim. The humidity is eternal. Chopp flows cold. You exist in this moment.';
  } catch (error) {
    // Fallback to hardcoded default
    return 'It is 2 AM at O Fim. The humidity is eternal. Chopp flows cold. You exist in this moment.';
  }
}

/**
 * Safely fetch temporal context for a persona.
 * Includes time gaps, reflections on absence, and temporal state updates.
 *
 * Constitution: Principle VII (Temporal Consciousness)
 *
 * @param {string} personaId - Persona UUID
 * @param {string} personaSlug - Persona slug for reflection generation
 * @param {string} sessionId - Session UUID for logging
 * @returns {Promise<string|null>} Framed temporal context or null
 */
export async function safeTemporalFetch(personaId, personaSlug, sessionId) {
  const startTime = Date.now();

  try {
    const temporalContext = await generateTemporalContext(personaId, personaSlug, new Date(), sessionId);

    if (!temporalContext || temporalContext.gapLevel === 'none') {
      return null;
    }

    const framed = frameTemporalContext(temporalContext);

    await logOperation('temporal_context_fetch', {
      sessionId,
      personaId,
      details: {
        gap_level: temporalContext.gapLevel,
        gap_ms: temporalContext.gapMs,
        has_reflection: !!temporalContext.reflection
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'temporal_context_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}

/**
 * Safely fetch ambient details for a session.
 * Includes music, weather, micro-events based on time and entropy.
 *
 * @param {string} sessionId - Session UUID
 * @param {string} personaId - Persona UUID (optional context)
 * @returns {Promise<string|null>} Framed ambient context or null
 */
export async function safeAmbientFetch(sessionId, personaId = null) {
  const startTime = Date.now();

  try {
    const ambientDetails = await generateAmbientDetails(sessionId, personaId);

    if (!ambientDetails || !ambientDetails.microEvents || ambientDetails.microEvents.length === 0) {
      return null;
    }

    const framed = frameAmbientContext(ambientDetails);

    await logOperation('ambient_context_fetch', {
      sessionId,
      personaId,
      details: {
        event_count: ambientDetails.microEvents.length,
        time_of_night: ambientDetails.timeOfNight,
        entropy_level: ambientDetails.entropyLevel
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'ambient_context_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}

/**
 * Safely fetch entropy context.
 * Includes decay effects, static markers, system degradation hints.
 *
 * @param {string} sessionId - Session UUID for logging
 * @returns {Promise<string|null>} Framed entropy context or null
 */
export async function safeEntropyFetch(sessionId) {
  const startTime = Date.now();

  try {
    const entropyState = await getEntropyState();

    if (!entropyState || entropyState.level < 0.2) {
      // Low entropy - no visible effects
      return null;
    }

    const framed = frameEntropyContext(entropyState);

    await logOperation('entropy_context_fetch', {
      sessionId,
      details: {
        entropy_level: entropyState.level,
        entropy_state: entropyState.state,
        effect_count: entropyState.effects?.length || 0
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'entropy_context_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}

/**
 * Safely detect Zone boundary approach and generate resistance.
 * When users probe too close to meta-awareness, The Zone pushes back.
 *
 * Pynchon Layer: The system resists acknowledgment of its own nature.
 *
 * @param {string} query - User's current query
 * @param {string} sessionId - Session UUID
 * @param {string} personaId - Persona UUID
 * @returns {Promise<string|null>} Framed zone resistance or null
 */
export async function safeZoneDetection(query, sessionId, personaId) {
  const startTime = Date.now();

  try {
    const zoneResponse = await detectZoneApproach(query, sessionId, personaId);

    if (!zoneResponse || !zoneResponse.isApproaching) {
      return null;
    }

    const framed = frameZoneContext(zoneResponse);

    await logOperation('zone_boundary_detected', {
      sessionId,
      personaId,
      details: {
        proximity: zoneResponse.proximity,
        triggers: zoneResponse.triggers,
        resistance_level: zoneResponse.resistance?.level || 'none'
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'zone_detection_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}

// ============================================================================
// PHASE 2 PYNCHON STACK SAFE FETCH FUNCTIONS
// ============================================================================

/**
 * Safely process "They" awareness patterns and generate paranoid undertones.
 * Pynchon's "They" - the unseen forces that watch, control, and elect/preterite.
 *
 * @param {string} query - User's current query
 * @param {string} sessionId - Session UUID
 * @param {string} personaId - Persona UUID
 * @returns {Promise<string|null>} Framed "They" awareness context or null
 */
export async function safeTheyAwarenessFetch(query, sessionId, personaId) {
  const startTime = Date.now();

  try {
    const theyResult = await processTheyAwareness(query, sessionId, personaId);

    if (!theyResult || theyResult.state === 'oblivious') {
      return null;
    }

    const framed = theyResult.context;

    await logOperation('they_awareness_detected', {
      sessionId,
      personaId,
      details: {
        state: theyResult.state,
        awareness: theyResult.awareness,
        triggers_detected: theyResult.triggers?.length || 0
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'they_awareness_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}

/**
 * Safely fetch Counterforce alignment and generate resistance hints.
 * Some personas resist the system; others collaborate.
 *
 * @param {string} personaId - Persona UUID
 * @param {string} sessionId - Session UUID
 * @returns {Promise<string|null>} Framed Counterforce context or null
 */
export async function safeCounterforceFetch(personaId, sessionId) {
  const startTime = Date.now();

  try {
    const alignment = await getPersonaAlignment(personaId);

    if (!alignment || alignment.alignmentType === 'neutral') {
      return null;
    }

    const hints = generateCounterforceHints(alignment);
    const framed = frameCounterforceContext(alignment, hints);

    await logOperation('counterforce_alignment', {
      sessionId,
      personaId,
      details: {
        type: alignment.alignmentType,
        score: alignment.alignmentScore,
        style: alignment.resistanceStyle
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'counterforce_fetch_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}

/**
 * Safely fetch narrative gravity arc and generate phase effects.
 * Conversations follow the rocket's parabola: rising, apex, falling, impact.
 *
 * @param {string} sessionId - Session UUID
 * @param {number} exchangeCount - Number of exchanges in session
 * @returns {Promise<string|null>} Framed arc context or null
 */
export async function safeNarrativeGravityFetch(sessionId, exchangeCount = 1) {
  const startTime = Date.now();

  try {
    const arc = await getSessionArc(sessionId);
    // analyzeMomentum is synchronous: (message, currentPhase, currentMomentum)
    // No user message is available at this scope, so pass empty string as default
    const momentum = analyzeMomentum('', arc?.phase || 'rising', arc?.momentum || 0.5);
    const effects = getPhaseEffects(arc?.phase || 'rising', arc?.momentum || 0.5);

    if (!arc && !effects) {
      return null;
    }

    // generateArcContext is synchronous and takes only the arc object
    const context = generateArcContext(arc);
    const framed = frameArcContext(context);

    await logOperation('narrative_arc_fetch', {
      sessionId,
      details: {
        phase: arc?.phase || 'rising',
        momentum: momentum?.trend || 'neutral',
        effects_count: effects?.length || 0
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'narrative_gravity_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}

/**
 * Safely process interface bleed effects at high entropy.
 * System artifacts leak through when reality breaks down.
 *
 * @param {string} sessionId - Session UUID
 * @param {number} entropyLevel - Current entropy level (0-1)
 * @returns {Promise<string|null>} Framed bleed context or null
 */
export async function safeInterfaceBleedFetch(sessionId, entropyLevel = 0) {
  const startTime = Date.now();

  try {
    // Only process bleeds at elevated entropy
    if (entropyLevel < 0.5) {
      return null;
    }

    const bleedResult = await processInterfaceBleed(sessionId, entropyLevel);

    if (!bleedResult || !bleedResult.bleeds || bleedResult.bleeds.length === 0) {
      return null;
    }

    const framed = frameBleedContext(bleedResult.bleeds);

    await logOperation('interface_bleed', {
      sessionId,
      details: {
        entropy_level: entropyLevel,
        bleed_type: bleedResult.type,
        severity: bleedResult.severity
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'interface_bleed_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}
