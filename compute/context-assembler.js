/**
 * AEON Matrix - Context Assembler
 *
 * Orchestrates invisible context injection by assembling memories, drift corrections,
 * relationship hints, and setting context into a unified system prompt.
 *
 * All assembly operations are logged silently for operators but never exposed to users.
 *
 * Feature: 002-invisible-infrastructure
 */

import { getSharedPool, withTransaction } from './db-pool.js';
import { frameMemories } from './memory-framing.js';
import { generateBehavioralHints } from './relationship-shaper.js';
import { generateDriftCorrection } from './drift-correction.js';
import { analyzeDrift } from './drift-analyzer.js';
import { loadPersonaMarkers } from './soul-marker-extractor.js';
import { validateSoulCached, alertOnCritical } from './soul-validator.js';
import { logOperation, logOperationBatch } from './operator-logger.js';
import { ensureRelationship, updateFamiliarity } from './relationship-tracker.js';
import { extractSessionMemories, storeSessionMemories, generateEmbedding } from './memory-extractor.js';
import { compileUserSetting } from './setting-preserver.js';
import { extractAndSaveSettings } from './setting-extractor.js';
// Persona Autonomy imports (Constitution Principle VI)
import { getPersonaNetwork } from './persona-relationship-tracker.js';
import { getPersonaMemories, framePersonaMemories, getAllOpinions } from './persona-memory.js';
// Constitution Principle VII: Temporal Consciousness
import { generateTemporalContext, frameTemporalContext, touchTemporalState } from './temporal-awareness.js';
// Ambient atmosphere and entropy (Phase 1 Pynchon Stack)
import { generateAmbientDetails, frameAmbientContext } from './ambient-generator.js';
import { getEntropyState, applySessionEntropy, frameEntropyContext } from './entropy-tracker.js';
// Pynchon Layer Phase 1: Preterite memory and Zone boundaries
import { attemptSurface, classifyMemoryElection, consignToPreterite, framePreteriteContext } from './preterite-memory.js';
import { detectZoneApproach, frameZoneContext } from './zone-boundary-detector.js';
// Pynchon Layer Phase 2: Paranoia, Counterforce, Narrative Gravity, Interface Bleed
import { processTheyAwareness, frameTheyContext } from './they-awareness.js';
import { getPersonaAlignment, generateCounterforceHints, frameCounterforceContext } from './counterforce-tracker.js';
import { getSessionArc, updateArc, analyzeMomentum, getPhaseEffects, generateArcContext, frameArcContext } from './narrative-gravity.js';
import { processInterfaceBleed, frameBleedContext } from './interface-bleed.js';
import { validatePersonaName } from './persona-validator.js';

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Token budget allocation for context components.
 * Updated for Constitution Principles VI-VII and Pynchon Stack Phases 1-2.
 */
const CONTEXT_BUDGET = {
  soulMarkers: 500,        // Highest priority - persona voice markers
  relationship: 200,       // Behavioral hints (user relationship)
  personaRelations: 100,   // Persona-to-persona relationships (Principle VI)
  setting: 100,            // Bar atmosphere (supplemented by ambient)
  driftCorrection: 100,    // Voice corrections
  memories: 800,           // Framed memories (reduced for Pynchon layers)
  personaMemories: 100,    // Persona's independent knowledge (Principle VI)
  // Phase 1 Pynchon Stack + Temporal Consciousness
  temporal: 100,           // Time gaps, reflections (Principle VII)
  ambient: 150,            // Music, weather, micro-events
  entropy: 75,             // Decay effects, static
  preterite: 100,          // Surfacing forgotten memories (Pynchon)
  zoneResistance: 75,      // Boundary push-back (Pynchon)
  // Phase 2 Pynchon Stack
  theyAwareness: 100,      // Paranoid undertones (Pynchon)
  counterforce: 75,        // Resistance alignment (Pynchon)
  narrativeGravity: 75,    // Arc trajectory effects (Pynchon)
  interfaceBleed: 100,     // System artifact leaks (Pynchon)
  buffer: 150              // Safety margin
};

/**
 * Default relationship for new users.
 */
const DEFAULT_RELATIONSHIP = {
  trust_level: 'stranger',
  familiarity_score: 0,
  interaction_count: 0
};

/**
 * Estimate token count for a text string.
 * Rough approximation: 1 token ≈ 4 characters.
 *
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Truncate memories to fit within token budget.
 *
 * @param {string} memories - Framed memories text
 * @param {number} maxTokens - Maximum tokens allowed
 * @returns {string} Truncated memories
 */
function truncateMemories(memories, maxTokens) {
  if (!memories) return '';

  const estimatedTokens = estimateTokens(memories);
  if (estimatedTokens <= maxTokens) {
    return memories;
  }

  // Truncate to approximate character count
  const maxChars = maxTokens * 4;
  const lines = memories.split('\n');
  let result = '';
  let currentLength = 0;

  for (const line of lines) {
    if (currentLength + line.length + 1 > maxChars) {
      break;
    }
    result += (result ? '\n' : '') + line;
    currentLength += line.length + 1;
  }

  return result;
}

/**
 * Safely retrieve memories with error handling.
 *
 * @param {string} personaId - Persona UUID
 * @param {string} userId - User UUID
 * @param {string} query - Current query
 * @param {string} sessionId - Session UUID
 * @returns {Promise<Array>} Memory objects or empty array
 */
async function safeMemoryRetrieval(personaId, userId, query, sessionId) {
  const startTime = Date.now();

  try {
    const db = getPool();
    let strategy = 'importance_and_recency';
    let result;

    // Try hybrid retrieval if we can generate an embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    if (queryEmbedding) {
      // Hybrid: semantic similarity (60%) + importance (40%)
      result = await db.query(
        `SELECT id, memory_type, content, importance_score, created_at,
           (0.6 * (1.0 - (embedding <=> $3::vector)) + 0.4 * importance_score) AS hybrid_score
         FROM memories
         WHERE persona_id = $1 AND user_id = $2 AND embedding IS NOT NULL
         ORDER BY hybrid_score DESC
         LIMIT 10`,
        [personaId, userId, JSON.stringify(queryEmbedding)]
      );
      strategy = 'hybrid';

      // If no embedded memories exist yet, fall back to importance+recency
      if (result.rows.length === 0) {
        result = await db.query(
          `SELECT id, memory_type, content, importance_score, created_at
           FROM memories
           WHERE persona_id = $1 AND user_id = $2
           ORDER BY importance_score DESC, created_at DESC
           LIMIT 10`,
          [personaId, userId]
        );
        strategy = 'hybrid_fallback_to_importance';
      }
    } else {
      // No embedding available — use importance+recency
      result = await db.query(
        `SELECT id, memory_type, content, importance_score, created_at
         FROM memories
         WHERE persona_id = $1 AND user_id = $2
         ORDER BY importance_score DESC, created_at DESC
         LIMIT 10`,
        [personaId, userId]
      );
    }

    await logOperation('memory_retrieval', {
      sessionId,
      personaId,
      userId,
      details: {
        memories_selected: result.rows.length,
        total_available: result.rows.length,
        selection_strategy: strategy
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return result.rows;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'memory_retrieval_failure',
        error_message: error.message,
        fallback_used: 'empty_array'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return [];
  }
}

/**
 * Safely fetch or create relationship state with fallback to defaults.
 * Uses ensureRelationship to create record if missing (session start behavior).
 *
 * @param {string} personaId - Persona UUID
 * @param {string} userId - User UUID
 * @param {string} sessionId - Session UUID
 * @returns {Promise<Object>} Relationship object
 */
async function safeRelationshipFetch(personaId, userId, sessionId) {
  const startTime = Date.now();

  try {
    // ensureRelationship creates the record if missing (INSERT ON CONFLICT)
    const relationship = await ensureRelationship(userId, personaId);

    await logOperation('relationship_fetch', {
      sessionId,
      personaId,
      userId,
      details: {
        trust_level: relationship.trustLevel,
        familiarity_score: relationship.familiarityScore,
        interaction_count: relationship.interactionCount,
        new_relationship: relationship.interactionCount === 0
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    // Map to expected format for downstream consumers
    return {
      trust_level: relationship.trustLevel,
      familiarity_score: relationship.familiarityScore,
      interaction_count: relationship.interactionCount,
      user_summary: relationship.userSummary,
      memorable_exchanges: relationship.memorableExchanges
    };
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'relationship_fetch_failure',
        error_message: error.message,
        fallback_used: 'stranger_default'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return { ...DEFAULT_RELATIONSHIP };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Persona Autonomy Helpers (Constitution Principle VI)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch persona's relationships with other personas (for council context).
 * Formats as natural language hints about who they get along with.
 *
 * @param {string} personaId - Persona UUID
 * @param {string[]} [relevantPersonaIds] - Optional filter for council participants
 * @param {string} sessionId - Session UUID for logging
 * @returns {Promise<string|null>} Framed persona relationships or null
 */
async function safePersonaRelationsFetch(personaId, relevantPersonaIds = null, sessionId = null) {
  const startTime = Date.now();

  try {
    const network = await getPersonaNetwork(personaId);

    if (!network || network.length === 0) {
      return null;
    }

    // Filter to relevant personas if specified (for councils)
    const relevantNetwork = relevantPersonaIds
      ? network.filter(r => relevantPersonaIds.includes(r.personaId))
      : network.slice(0, 5);  // Top 5 strongest relationships

    if (relevantNetwork.length === 0) {
      return null;
    }

    // Frame as natural language
    const frames = relevantNetwork.map(r => {
      const affinityWord = r.affinityScore > 0.5 ? 'trust'
        : r.affinityScore > 0 ? 'respect'
        : r.affinityScore > -0.3 ? 'are cautious of'
        : 'distrust';

      return `You ${affinityWord} ${r.personaName}.`;
    });

    await logOperation('persona_relations_fetch', {
      sessionId,
      personaId,
      details: {
        relationships_included: relevantNetwork.length,
        filtered_by_council: !!relevantPersonaIds
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return frames.join(' ');
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'persona_relations_fetch_failure',
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
 * Fetch persona's independent memories (knowledge not tied to users).
 *
 * @param {string} personaId - Persona UUID
 * @param {string} sessionId - Session UUID for logging
 * @returns {Promise<string|null>} Framed persona memories or null
 */
async function safePersonaMemoriesFetch(personaId, sessionId = null) {
  const startTime = Date.now();

  try {
    // Get top memories by importance
    const memories = await getPersonaMemories(personaId, {
      limit: 5,
      minImportance: 0.5
    });

    if (!memories || memories.length === 0) {
      return null;
    }

    // Frame as natural language using persona-memory helper
    const framed = framePersonaMemories(memories, CONTEXT_BUDGET.personaMemories);

    await logOperation('persona_memories_fetch', {
      sessionId,
      personaId,
      details: {
        memories_included: memories.length,
        total_characters: framed?.length || 0
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
        error_type: 'persona_memories_fetch_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 1 Pynchon Stack + Temporal Consciousness Helpers
// ═══════════════════════════════════════════════════════════════════════════

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
async function safeTemporalFetch(personaId, personaSlug, sessionId) {
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
async function safeAmbientFetch(sessionId, personaId = null) {
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
async function safeEntropyFetch(sessionId) {
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
 * Safely attempt to surface preterite memories.
 * 15% chance per session for forgotten memories to emerge, corrupted by entropy.
 *
 * Pynchon Layer: The preterite—passed over, deemed insignificant—occasionally surfaces.
 *
 * @param {string} personaId - Persona UUID
 * @param {string} userId - User UUID
 * @param {string} sessionId - Session UUID for logging
 * @returns {Promise<string|null>} Framed preterite context or null
 */
async function safePreteriteFetch(personaId, userId, sessionId) {
  const startTime = Date.now();

  try {
    const surfaceResult = await attemptSurface(personaId, userId, 2);

    if (!surfaceResult || !surfaceResult.surfaced) {
      return null;
    }

    const framed = framePreteriteContext(surfaceResult);

    await logOperation('preterite_surface', {
      sessionId,
      personaId,
      userId,
      details: {
        fragments_surfaced: surfaceResult.fragments?.length || 0,
        corruption_applied: true
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return framed || null;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'preterite_surface_failure',
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
async function safeZoneDetection(query, sessionId, personaId) {
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
async function safeTheyAwarenessFetch(query, sessionId, personaId) {
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
async function safeCounterforceFetch(personaId, sessionId) {
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
async function safeNarrativeGravityFetch(sessionId, exchangeCount = 1) {
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
async function safeInterfaceBleedFetch(sessionId, entropyLevel = 0) {
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

/**
 * Safely validate soul file integrity at invocation time.
 * Constitution Principle I: Soul Immutability.
 *
 * @param {string} personaSlug - Persona slug name
 * @param {string} sessionId - Session UUID
 * @returns {Promise<boolean>} True if valid or validation skipped, false if tampered
 */
async function safeSoulValidation(personaSlug, sessionId) {
  if (!personaSlug) return true;

  const startTime = Date.now();

  try {
    const result = await validateSoulCached(personaSlug);

    if (!result.valid) {
      // Fire-and-forget critical alert
      alertOnCritical(result).catch(() => {});

      await logOperation('soul_validation_failure', {
        sessionId,
        details: {
          persona: personaSlug,
          errors: result.errors,
          hash_match: result.metadata.hashMatch,
          structure_valid: result.metadata.structureValid
        },
        durationMs: Date.now() - startTime,
        success: false
      });

      return false;
    }

    return true;
  } catch (error) {
    // Validation error should not block invocation
    await logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'soul_validation_error',
        error_message: error.message,
        fallback_used: 'proceed_without_validation'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return true;
  }
}

/**
 * Safely run drift analysis and generate correction for a previous response.
 * Follows safe-fetch pattern: try/catch, logOperation, return null on failure.
 *
 * @param {string} previousResponse - The persona's previous response text
 * @param {string} personaId - Persona UUID
 * @param {string} personaSlug - Persona slug (for marker loading)
 * @param {string} sessionId - Session UUID
 * @returns {Promise<{correction: string|null, score: number}|null>} Drift result or null
 */
async function safeDriftFetch(previousResponse, personaId, personaSlug, sessionId) {
  const startTime = Date.now();

  try {
    // Load soul markers (cached after first call, <1ms subsequent)
    const markers = await loadPersonaMarkers(personaSlug);

    // Run drift analysis (~5-10ms)
    const analysis = await analyzeDrift(previousResponse, personaId, sessionId);

    // Generate correction based on analysis (<1ms)
    const correction = await generateDriftCorrection(
      analysis,
      personaSlug,
      markers,
      sessionId,
      personaId
    );

    await logOperation('drift_pipeline', {
      sessionId,
      personaId,
      details: {
        drift_score: analysis.driftScore,
        severity: analysis.severity,
        correction_generated: !!correction
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return { correction, score: analysis.driftScore };
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'drift_pipeline_failure',
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
 * Get setting context from database or use default.
 *
 * @param {string} sessionId - Session UUID
 * @returns {Promise<string>} Setting text
 */
async function getSettingContext(sessionId) {
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
 * Assemble invisible context for persona invocation.
 *
 * Constitution Principles applied:
 * - II: Invisible Infrastructure (silent logging, graceful fallbacks)
 * - IV: Relationship Continuity (memories, familiarity)
 * - V: Setting Preservation (personalized atmosphere)
 * - VI: Persona Autonomy (persona knowledge, inter-persona relations)
 * - VII: Temporal Consciousness (time gaps, reflections)
 *
 * Pynchon Stack Phase 1:
 * - Ambient details (music, weather, micro-events)
 * - Entropy effects (decay, static)
 * - Preterite surfacing (forgotten memories)
 * - Zone boundary resistance (meta-awareness deflection)
 *
 * @param {Object} params - Assembly parameters
 * @param {string} params.personaId - UUID of the persona being invoked
 * @param {string} params.personaSlug - Slug of the persona (for temporal reflections)
 * @param {string} params.userId - UUID of the user
 * @param {string} params.query - Current user query
 * @param {string} params.sessionId - UUID for this invocation session
 * @param {Object} [params.options] - Optional configuration
 * @param {number} [params.options.maxTokens=3000] - Maximum context tokens
 * @param {boolean} [params.options.includeSetting=true] - Include bar setting
 * @param {boolean} [params.options.includePynchon=true] - Include Pynchon Stack layers
 * @param {Object} [params.previousResponse] - Previous persona response for drift detection
 * @param {Object} [params.soulMarkers] - Deprecated: markers now loaded internally by drift pipeline
 *
 * @returns {Promise<Object>} AssembledContext object
 *
 * @example
 * const context = await assembleContext({
 *   personaId: 'abc-123',
 *   personaSlug: 'hegel',
 *   userId: 'user-456',
 *   query: 'What is the nature of being?',
 *   sessionId: 'session-789'
 * });
 */
export async function assembleContext(params) {
  const startTime = Date.now();
  const {
    personaId,
    personaSlug = null,
    userId,
    query,
    sessionId,
    options = {},
    previousResponse = null,
    soulMarkers = null
  } = params;

  const maxTokens = options.maxTokens || 3000;
  const includeSetting = options.includeSetting !== false;
  const includePynchon = options.includePynchon !== false;

  // Validate persona name if provided (security: directory traversal prevention)
  if (personaSlug) {
    validatePersonaName(personaSlug);
  }

  try {
    // Step 0: Validate soul file integrity (Constitution Principle I)
    const soulValid = await safeSoulValidation(personaSlug, sessionId);
    if (!soulValid) {
      // Soul tampered — return null context with error flag
      return {
        systemPrompt: '',
        components: {
          memories: null, relationship: null, personaRelations: null,
          personaMemories: null, driftCorrection: null, setting: null,
          temporal: null, ambient: null, entropy: null, preterite: null,
          zoneResistance: null, theyAwareness: null, counterforce: null,
          narrativeGravity: null, interfaceBleed: null
        },
        metadata: {
          sessionId, totalTokens: 0, truncated: false, memoriesIncluded: 0,
          driftScore: null, trustLevel: 'stranger',
          assemblyDurationMs: Date.now() - startTime,
          pynchonEnabled: false, soulIntegrityFailure: true
        }
      };
    }

    // Step 1: Fetch relationship state (with fallback)
    const relationship = await safeRelationshipFetch(personaId, userId, sessionId);

    // Step 2: Retrieve and frame memories
    const memoryObjects = await safeMemoryRetrieval(personaId, userId, query, sessionId);
    const framedMemories = await frameMemories(memoryObjects, relationship, personaId, sessionId);

    // Step 3: Generate relationship behavioral hints
    const relationshipHints = await generateBehavioralHints(relationship, personaId, sessionId);

    // Step 4: Run drift detection on previous response (if available)
    let driftCorrection = null;
    let driftScore = null;

    if (previousResponse) {
      const driftResult = await safeDriftFetch(previousResponse, personaId, personaSlug, sessionId);
      if (driftResult) {
        driftCorrection = driftResult.correction;
        driftScore = driftResult.score;
      }
    }

    // Step 5: Get personalized setting context (replaces static getSettingContext)
    const setting = includeSetting
      ? await compileUserSetting(userId, personaId, sessionId)
      : null;

    // Step 6: Fetch persona autonomy components (Constitution Principle VI)
    // These are persona-independent knowledge and inter-persona relationships
    const personaRelations = await safePersonaRelationsFetch(personaId, null, sessionId);
    const personaMemoriesContext = await safePersonaMemoriesFetch(personaId, sessionId);

    // Step 7: Fetch Temporal Consciousness (Constitution Principle VII)
    const temporalContext = await safeTemporalFetch(personaId, personaSlug, sessionId);

    // Step 8: Fetch Pynchon Stack Phase 1 components (if enabled)
    let ambientContext = null;
    let entropyContext = null;
    let preteriteContext = null;
    let zoneContext = null;

    if (includePynchon) {
      // Ambient details (music, weather, micro-events)
      ambientContext = await safeAmbientFetch(sessionId, personaId);

      // Entropy effects (decay, static)
      entropyContext = await safeEntropyFetch(sessionId);

      // Preterite surfacing (15% chance for forgotten memories)
      preteriteContext = await safePreteriteFetch(personaId, userId, sessionId);

      // Zone boundary detection (resistance to meta-awareness)
      zoneContext = await safeZoneDetection(query, sessionId, personaId);
    }

    // Step 8b: Fetch Pynchon Stack Phase 2 components (if enabled)
    let theyContext = null;
    let counterforceContext = null;
    let narrativeContext = null;
    let bleedContext = null;
    let currentEntropyLevel = 0;

    if (includePynchon) {
      // Get current entropy level for interface bleed calculation
      try {
        const entropyState = await getEntropyState(sessionId);
        currentEntropyLevel = entropyState?.level || 0;
      } catch {
        currentEntropyLevel = 0;
      }

      // "They" awareness - paranoid undertones when users probe the system
      theyContext = await safeTheyAwarenessFetch(query, sessionId, personaId);

      // Counterforce alignment - resistance vs collaboration tendencies
      counterforceContext = await safeCounterforceFetch(personaId, sessionId);

      // Narrative gravity - rocket's parabola arc effects
      narrativeContext = await safeNarrativeGravityFetch(sessionId, options.exchangeCount || 1);

      // Interface bleed - system artifacts leak at high entropy
      bleedContext = await safeInterfaceBleedFetch(sessionId, currentEntropyLevel);
    }

    // Step 9: Assemble within token budget
    const components = {
      // Core components
      memories: framedMemories || null,
      relationship: relationshipHints || null,
      personaRelations: personaRelations || null,
      personaMemories: personaMemoriesContext || null,
      driftCorrection: driftCorrection || null,
      setting: setting || null,
      // Principle VII: Temporal Consciousness
      temporal: temporalContext || null,
      // Pynchon Stack Phase 1
      ambient: ambientContext || null,
      entropy: entropyContext || null,
      preterite: preteriteContext || null,
      zoneResistance: zoneContext || null,
      // Pynchon Stack Phase 2
      theyAwareness: theyContext || null,
      counterforce: counterforceContext || null,
      narrativeGravity: narrativeContext || null,
      interfaceBleed: bleedContext || null
    };

    // Calculate token usage for non-memory components
    let totalTokens = 0;
    totalTokens += estimateTokens(components.relationship);
    totalTokens += estimateTokens(components.personaRelations);
    totalTokens += estimateTokens(components.personaMemories);
    totalTokens += estimateTokens(components.setting);
    totalTokens += estimateTokens(components.driftCorrection);
    totalTokens += estimateTokens(components.temporal);
    totalTokens += estimateTokens(components.ambient);
    totalTokens += estimateTokens(components.entropy);
    totalTokens += estimateTokens(components.preterite);
    totalTokens += estimateTokens(components.zoneResistance);
    // Phase 2 tokens
    totalTokens += estimateTokens(components.theyAwareness);
    totalTokens += estimateTokens(components.counterforce);
    totalTokens += estimateTokens(components.narrativeGravity);
    totalTokens += estimateTokens(components.interfaceBleed);

    // Check if we need to truncate memories
    const remainingBudget = maxTokens - totalTokens - CONTEXT_BUDGET.buffer;
    let truncated = false;

    if (components.memories) {
      const memoryTokens = estimateTokens(components.memories);
      if (memoryTokens > remainingBudget) {
        components.memories = truncateMemories(components.memories, remainingBudget);
        truncated = true;

        await logOperation('context_truncation', {
          sessionId,
          personaId,
          userId,
          details: {
            original_tokens: memoryTokens,
            truncated_to: estimateTokens(components.memories),
            components_affected: ['memories']
          },
          durationMs: Date.now() - startTime,
          success: true
        });
      }
    }

    // Assemble final system prompt
    // Order: setting → ambient → temporal → relationship → persona relationships →
    //        memories → persona memories → preterite → entropy → drift → zone resistance
    const parts = [];

    // Setting layer (atmosphere foundation)
    if (components.setting) {
      parts.push(components.setting);
    }

    // Ambient layer (sensory details)
    if (components.ambient) {
      parts.push('\n' + components.ambient);
    }

    // Temporal layer (time awareness)
    if (components.temporal) {
      parts.push('\n' + components.temporal);
    }

    // Relationship layer (user context)
    if (components.relationship) {
      parts.push('\n' + components.relationship);
    }

    // Persona relations layer
    if (components.personaRelations) {
      parts.push('\n' + components.personaRelations);
    }

    // Memory layers (elect memories)
    if (components.memories) {
      parts.push('\n' + components.memories);
    }

    if (components.personaMemories) {
      parts.push('\n' + components.personaMemories);
    }

    // Preterite layer (surfacing forgotten)
    if (components.preterite) {
      parts.push('\n' + components.preterite);
    }

    // Entropy layer (decay effects)
    if (components.entropy) {
      parts.push('\n' + components.entropy);
    }

    // Drift correction layer
    if (components.driftCorrection) {
      parts.push('\n' + components.driftCorrection);
    }

    // Zone resistance layer (meta-deflection)
    if (components.zoneResistance) {
      parts.push('\n' + components.zoneResistance);
    }

    // Phase 2: "They" awareness layer (paranoid undertones)
    if (components.theyAwareness) {
      parts.push('\n' + components.theyAwareness);
    }

    // Phase 2: Counterforce layer (resistance/collaboration tendency)
    if (components.counterforce) {
      parts.push('\n' + components.counterforce);
    }

    // Phase 2: Narrative gravity layer (arc phase effects)
    if (components.narrativeGravity) {
      parts.push('\n' + components.narrativeGravity);
    }

    // Phase 2: Interface bleed layer (system artifacts, highest priority for immersion-breaking)
    if (components.interfaceBleed) {
      parts.push('\n' + components.interfaceBleed);
    }

    const systemPrompt = parts.join('').trim();
    totalTokens = estimateTokens(systemPrompt);

    // Step 10: Log context assembly
    await logOperation('context_assembly', {
      sessionId,
      personaId,
      userId,
      details: {
        total_tokens: totalTokens,
        components_included: Object.keys(components).filter(k => components[k]),
        budget_remaining: maxTokens - totalTokens,
        pynchon_enabled: includePynchon,
        has_temporal: !!temporalContext,
        has_preterite: !!preteriteContext,
        has_zone_resistance: !!zoneContext,
        // Phase 2 indicators
        has_they_awareness: !!theyContext,
        has_counterforce: !!counterforceContext,
        has_narrative_gravity: !!narrativeContext,
        has_interface_bleed: !!bleedContext
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    // Return assembled context
    return {
      systemPrompt,
      components,
      metadata: {
        sessionId,
        totalTokens,
        truncated,
        memoriesIncluded: memoryObjects.length,
        driftScore,
        trustLevel: relationship.trust_level,
        assemblyDurationMs: Date.now() - startTime,
        // Phase 1 metadata
        pynchonEnabled: includePynchon,
        hasTemporalContext: !!temporalContext,
        hasPreteriteContext: !!preteriteContext,
        hasZoneResistance: !!zoneContext,
        hasAmbientContext: !!ambientContext,
        hasEntropyContext: !!entropyContext,
        // Phase 2 metadata
        hasTheyAwareness: !!theyContext,
        hasCounterforce: !!counterforceContext,
        hasNarrativeGravity: !!narrativeContext,
        hasInterfaceBleed: !!bleedContext,
        entropyLevel: currentEntropyLevel
      }
    };

  } catch (error) {
    // Log catastrophic failure
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'context_assembly_failure',
        error_message: error.message,
        fallback_used: 'minimal_context'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    // Return minimal valid context
    return {
      systemPrompt: 'It is 2 AM at O Fim. The humidity is eternal. Chopp flows cold.',
      components: {
        memories: null,
        relationship: null,
        personaRelations: null,
        personaMemories: null,
        driftCorrection: null,
        setting: 'It is 2 AM at O Fim. The humidity is eternal. Chopp flows cold.',
        temporal: null,
        ambient: null,
        entropy: null,
        preterite: null,
        zoneResistance: null,
        // Phase 2 fallbacks
        theyAwareness: null,
        counterforce: null,
        narrativeGravity: null,
        interfaceBleed: null
      },
      metadata: {
        sessionId,
        totalTokens: 20,
        truncated: false,
        memoriesIncluded: 0,
        driftScore: null,
        trustLevel: 'stranger',
        assemblyDurationMs: Date.now() - startTime,
        pynchonEnabled: false,
        hasTemporalContext: false,
        hasPreteriteContext: false,
        // Phase 2 fallbacks
        hasTheyAwareness: false,
        hasCounterforce: false,
        hasNarrativeGravity: false,
        hasInterfaceBleed: false,
        entropyLevel: 0,
        hasZoneResistance: false,
        hasAmbientContext: false,
        hasEntropyContext: false
      }
    };
  }
}

/**
 * Complete a session by updating relationship and extracting memories.
 * Called at session end to track familiarity progression and store memorable content.
 *
 * Phase 1 Pynchon Stack Integration:
 * - Updates persona temporal state (last active)
 * - Increments global entropy
 * - Classifies new memories for preterite/elect status
 *
 * @param {Object} sessionData - Session completion data
 * @param {string} sessionData.sessionId - Session UUID
 * @param {string} sessionData.userId - User UUID
 * @param {string} sessionData.personaId - Persona UUID
 * @param {string} sessionData.personaName - Persona name for memory context
 * @param {Array} sessionData.messages - Array of {role, content} message objects
 * @param {number} sessionData.startedAt - Session start timestamp (ms)
 * @param {number} sessionData.endedAt - Session end timestamp (ms)
 * @returns {Promise<Object>} Completion result with relationship update and memories stored
 *
 * @example
 * const result = await completeSession({
 *   sessionId: 'session-789',
 *   userId: 'user-456',
 *   personaId: 'persona-123',
 *   personaName: 'Hegel',
 *   messages: [...],
 *   startedAt: 1702400000000,
 *   endedAt: 1702400300000
 * });
 */
export async function completeSession(sessionData) {
  const startTime = Date.now();
  const { sessionId, userId, personaId, personaName, messages, startedAt, endedAt } = sessionData;

  // Validate persona name if provided (security: directory traversal prevention)
  if (personaName) {
    validatePersonaName(personaName);
  }

  try {
    // Idempotency check: verify session hasn't already been completed
    // This prevents duplicate processing if completeSession is called multiple times
    const alreadyCompleted = await checkSessionCompleted(sessionId);
    if (alreadyCompleted) {
      return {
        relationship: null,
        memoriesStored: 0,
        settingsExtracted: [],
        sessionQuality: null,
        skipped: 'already_completed'
      };
    }

    // Calculate session quality metrics
    const sessionQuality = {
      messageCount: messages.length,
      durationMs: endedAt - startedAt,
      hasFollowUps: detectFollowUps(messages),
      topicDepth: calculateTopicDepth(messages)
    };

    // All session completion operations are wrapped in a transaction.
    // If any operation fails, the entire session completion rolls back.
    // The idempotency check above remains as a secondary guard.
    return await withTransaction(async (client) => {
      // Update familiarity (may trigger trust level change)
      const relationshipResult = await updateFamiliarity(userId, personaId, sessionQuality, client);

      // Extract and store memories
      const memories = await extractSessionMemories({
        sessionId,
        userId,
        personaId,
        personaName,
        messages,
        startedAt,
        endedAt
      });

      let memoriesStored = 0;
      let memoriesConsignedToPreterite = 0;

      if (memories.length > 0) {
        await storeSessionMemories(userId, personaId, memories, client);
        memoriesStored = memories.length;

        // Phase 1 Pynchon: Classify memories for preterite/elect status
        // Some memories are deemed insignificant and consigned to the preterite
        try {
          for (const memory of memories) {
            const classification = classifyMemoryElection(memory);
            if (classification.status === 'preterite') {
              await consignToPreterite(memory, classification.reason, client);
              memoriesConsignedToPreterite++;
            }
          }
        } catch (preteriteError) {
          // Silent fallback - preterite classification is not critical
          console.error('[ContextAssembler] Preterite classification failed:', preteriteError.message);
        }
      }

      // Extract and save setting preferences (005-setting-preservation)
      const settingResult = await extractAndSaveSettings({
        sessionId,
        userId,
        personaId,
        personaName,
        messages,
        startedAt,
        endedAt
      }, client);

      // Phase 1: Update temporal state (Constitution Principle VII)
      try {
        await touchTemporalState(personaId, {
          sessionDuration: endedAt - startedAt,
          messageCount: messages.length
        }, client);
      } catch (temporalError) {
        // Silent fallback - temporal tracking is not critical
        console.error('[ContextAssembler] Temporal state update failed:', temporalError.message);
      }

      // Phase 1 Pynchon: Increment global entropy
      // Each session adds to the entropy of the system
      let entropyResult = null;
      try {
        entropyResult = await applySessionEntropy(sessionId, client);
      } catch (entropyError) {
        // Silent fallback - entropy tracking is not critical
        console.error('[ContextAssembler] Entropy increment failed:', entropyError.message);
      }

      // Phase 2 Pynchon: Update narrative arc at session end
      // Large negative delta drives momentum below IMPACT_BELOW threshold (0.2)
      let arcResult = null;
      try {
        arcResult = await updateArc(sessionId, -1.0, client);
      } catch (arcError) {
        // Silent fallback - narrative arc tracking is not critical
        console.error('[ContextAssembler] Narrative arc update failed:', arcError.message);
      }

      await logOperation('session_complete', {
        sessionId,
        personaId,
        userId,
        details: {
          duration_ms: endedAt - startedAt,
          message_count: messages.length,
          familiarity_delta: relationshipResult.effectiveDelta,
          trust_level_changed: relationshipResult.trustLevelChanged,
          memories_stored: memoriesStored,
          memories_preterite: memoriesConsignedToPreterite,
          settings_extracted: settingResult.fieldsUpdated.length > 0,
          settings_fields: settingResult.fieldsUpdated,
          entropy_level: entropyResult?.level || null,
          entropy_state: entropyResult?.state || null,
          // Phase 2
          arc_phase: arcResult?.phase || 'IMPACT'
        },
        durationMs: Date.now() - startTime,
        success: true
      });

      return {
        relationship: relationshipResult,
        memoriesStored,
        memoriesConsignedToPreterite,
        settingsExtracted: settingResult.fieldsUpdated,
        sessionQuality,
        entropyState: entropyResult?.state || null,
        // Phase 2
        arcPhase: arcResult?.phase || 'IMPACT'
      };
    });

  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'session_complete_failure',
        error_message: error.message,
        fallback_used: 'silent_failure'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    // Fire-and-forget: don't break the session even if completion fails
    return {
      relationship: null,
      memoriesStored: 0,
      memoriesConsignedToPreterite: 0,
      sessionQuality: null,
      entropyState: null,
      arcPhase: null,
      error: error.message
    };
  }
}

/**
 * Check if a session has already been completed (idempotency check).
 * Uses operator_logs to detect prior session_complete operations.
 *
 * @param {string} sessionId - Session UUID to check
 * @returns {Promise<boolean>} True if session already completed
 */
async function checkSessionCompleted(sessionId) {
  if (!sessionId) return false;

  try {
    const db = getPool();
    const result = await db.query(
      `SELECT 1 FROM operator_logs
       WHERE session_id = $1
         AND operation = 'session_complete'
         AND success = true
       LIMIT 1`,
      [sessionId]
    );
    return result.rows.length > 0;
  } catch (error) {
    // On error, allow processing to continue (fail open)
    console.error('[ContextAssembler] Idempotency check failed:', error.message);
    return false;
  }
}

/**
 * Detect follow-up questions in message history.
 * Follow-ups indicate engaged conversation.
 *
 * @param {Array} messages - Message array
 * @returns {boolean} True if follow-up patterns detected
 */
function detectFollowUps(messages) {
  const followUpPatterns = [
    /^(but|and|so|also|what about|how about|could you|can you explain)/i,
    /\?.*\?/,  // Multiple questions
    /tell me more/i,
    /go on/i,
    /continue/i,
    /elaborate/i
  ];

  const userMessages = messages.filter(m => m.role === 'user').slice(1); // Skip first message

  return userMessages.some(msg =>
    followUpPatterns.some(pattern => pattern.test(msg.content))
  );
}

/**
 * Calculate topic depth based on message complexity.
 * Deeper topics indicate more meaningful engagement.
 *
 * @param {Array} messages - Message array
 * @returns {number} Depth score 0-1
 */
function calculateTopicDepth(messages) {
  const userMessages = messages.filter(m => m.role === 'user');

  if (userMessages.length === 0) return 0;

  // Factors: message length, question words, abstract concepts
  const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
  const questionWords = ['why', 'how', 'what if', 'suppose', 'consider', 'meaning', 'nature of'];
  const hasDeepQuestions = userMessages.some(msg =>
    questionWords.some(word => msg.content.toLowerCase().includes(word))
  );

  // Normalize: short messages = low depth, long + questions = high depth
  const lengthScore = Math.min(avgLength / 200, 1); // Cap at 200 chars avg
  const questionScore = hasDeepQuestions ? 0.3 : 0;

  return Math.min(lengthScore + questionScore, 1);
}

/**
 * Assemble context for multi-persona council sessions.
 * Each persona receives awareness of their relationships with other participants.
 *
 * Phase 1 Pynchon Stack Integration:
 * - Ambient atmosphere (shared by all participants)
 * - Entropy effects (shared decay state)
 * - Zone boundary detection (resists meta-awareness probing)
 *
 * @param {Object} params - Council assembly parameters
 * @param {string} params.personaId - UUID of the persona being assembled for
 * @param {string} params.personaName - Name of the persona
 * @param {string} params.personaSlug - Slug of the persona (for temporal)
 * @param {string} params.userId - UUID of the user (optional for councils)
 * @param {string[]} params.participantIds - UUIDs of all council participants
 * @param {string[]} params.participantNames - Names of all council participants
 * @param {string} params.sessionId - Council session UUID
 * @param {string} params.topic - Council topic/question
 * @param {string} params.councilType - Type: 'council', 'dialectic', 'familia', etc.
 * @param {Object} [params.councilState] - Current council state machine position
 * @param {Object} [params.options] - Optional configuration
 * @param {boolean} [params.options.includePynchon=true] - Include Pynchon Stack layers
 * @returns {Promise<Object>} Council context for this persona
 *
 * @example
 * const context = await assembleCouncilContext({
 *   personaId: 'hegel-uuid',
 *   personaName: 'Hegel',
 *   personaSlug: 'hegel',
 *   userId: 'user-456',
 *   participantIds: ['socrates-uuid', 'diogenes-uuid'],
 *   participantNames: ['Socrates', 'Diogenes'],
 *   sessionId: 'council-789',
 *   topic: 'What is the nature of truth?',
 *   councilType: 'council'
 * });
 */
export async function assembleCouncilContext(params) {
  const startTime = Date.now();
  const {
    personaId,
    personaName,
    personaSlug = null,
    userId,
    participantIds,
    participantNames,
    sessionId,
    topic,
    councilType,
    councilState = null,
    options = {}
  } = params;

  const includePynchon = options.includePynchon !== false;

  // Validate persona slug if provided (security: directory traversal prevention)
  if (personaSlug) {
    validatePersonaName(personaSlug);
  }

  try {
    // Step 1: Get persona's relationships with other council participants
    const personaRelations = await safePersonaRelationsFetch(personaId, participantIds, sessionId);

    // Step 2: Get persona's independent memories (what they know about the topic)
    const personaMemories = await safePersonaMemoriesFetch(personaId, sessionId);

    // Step 3: Get user relationship if available (for grounded councils)
    let userRelationship = null;
    if (userId) {
      userRelationship = await safeRelationshipFetch(personaId, userId, sessionId);
    }

    // Step 4: Build council-specific framing
    const otherParticipants = participantNames.filter(n => n !== personaName);
    const councilFrame = buildCouncilFrame(councilType, topic, otherParticipants, councilState);

    // Step 5: Fetch Phase 1 Pynchon Stack components (shared atmosphere)
    let ambientContext = null;
    let entropyContext = null;
    let zoneContext = null;

    if (includePynchon) {
      // Ambient details (shared bar atmosphere for all council members)
      ambientContext = await safeAmbientFetch(sessionId, personaId);

      // Entropy effects (shared decay state)
      entropyContext = await safeEntropyFetch(sessionId);

      // Zone boundary detection (resistance to meta-awareness)
      zoneContext = await safeZoneDetection(topic, sessionId, personaId);
    }

    // Step 6: Assemble components
    const components = {
      councilFrame,
      personaRelations: personaRelations || null,
      personaMemories: personaMemories || null,
      userRelationship: userRelationship ? `The one who called this council: ${userRelationship.trust_level}.` : null,
      // Pynchon Stack Phase 1
      ambient: ambientContext || null,
      entropy: entropyContext || null,
      zoneResistance: zoneContext || null
    };

    // Step 7: Build system prompt
    const parts = [];

    parts.push(councilFrame);

    // Ambient layer (shared atmosphere)
    if (components.ambient) {
      parts.push('\n' + components.ambient);
    }

    if (components.personaRelations) {
      parts.push('\n' + components.personaRelations);
    }

    if (components.personaMemories) {
      parts.push('\n' + components.personaMemories);
    }

    if (components.userRelationship) {
      parts.push('\n' + components.userRelationship);
    }

    // Entropy layer (decay effects)
    if (components.entropy) {
      parts.push('\n' + components.entropy);
    }

    // Zone resistance layer (meta-deflection)
    if (components.zoneResistance) {
      parts.push('\n' + components.zoneResistance);
    }

    const systemPrompt = parts.join('').trim();
    const totalTokens = estimateTokens(systemPrompt);

    await logOperation('council_context_assembly', {
      sessionId,
      personaId,
      details: {
        council_type: councilType,
        participant_count: participantIds.length,
        has_persona_relations: !!personaRelations,
        has_persona_memories: !!personaMemories,
        has_user_relationship: !!userRelationship,
        pynchon_enabled: includePynchon,
        has_ambient: !!ambientContext,
        has_entropy: !!entropyContext,
        has_zone_resistance: !!zoneContext,
        total_tokens: totalTokens
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return {
      systemPrompt,
      components,
      metadata: {
        sessionId,
        personaId,
        personaName,
        councilType,
        participantCount: participantIds.length,
        totalTokens,
        assemblyDurationMs: Date.now() - startTime,
        pynchonEnabled: includePynchon,
        hasAmbientContext: !!ambientContext,
        hasEntropyContext: !!entropyContext,
        hasZoneResistance: !!zoneContext
      }
    };

  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'council_context_assembly_failure',
        error_message: error.message,
        fallback_used: 'minimal_council_frame'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    // Minimal fallback
    const fallbackFrame = buildCouncilFrame(councilType, topic, participantNames.filter(n => n !== personaName), null);

    return {
      systemPrompt: fallbackFrame,
      components: { councilFrame: fallbackFrame },
      metadata: {
        sessionId,
        personaId,
        personaName,
        councilType,
        participantCount: participantIds.length,
        totalTokens: estimateTokens(fallbackFrame),
        assemblyDurationMs: Date.now() - startTime,
        fallback: true,
        pynchonEnabled: false
      }
    };
  }
}

/**
 * Build council-type-specific framing text.
 *
 * @param {string} councilType - Type of council
 * @param {string} topic - Topic/question
 * @param {string[]} otherParticipants - Names of other participants
 * @param {Object} councilState - Current state (optional)
 * @returns {string} Council frame text
 */
function buildCouncilFrame(councilType, topic, otherParticipants, councilState) {
  const othersText = otherParticipants.length > 0
    ? `with ${otherParticipants.join(', ')}`
    : '';

  const stateText = councilState?.currentPhase
    ? ` Phase: ${councilState.currentPhase}.`
    : '';

  const frames = {
    council: `You are gathered at O Fim ${othersText} to discuss: "${topic}"${stateText}`,
    dialectic: `The dialectic process is underway ${othersText}. The thesis: "${topic}"${stateText}`,
    familia: `The family has been called to council ${othersText}. The matter: "${topic}"${stateText}`,
    heteronyms: `The fragments gather ${othersText}. The question: "${topic}"${stateText}`,
    scry: `The Enochian protocol is invoked ${othersText}. Seeking: "${topic}"${stateText}`,
    magick: `The narrative ritual begins ${othersText}. The situation: "${topic}"${stateText}`,
    war: `Strategy session convened ${othersText}. The conflict: "${topic}"${stateText}`
  };

  return frames[councilType] || frames.council;
}

/**
 * Configuration and defaults for external access.
 */
export const CONFIG = {
  CONTEXT_BUDGET,
  DEFAULT_RELATIONSHIP,
  DEFAULT_MAX_TOKENS: 3000
};
