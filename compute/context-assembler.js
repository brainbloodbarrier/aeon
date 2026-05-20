/**
 * AEON Matrix - Context Assembler
 *
 * Orchestrates invisible context injection by assembling memories, drift corrections,
 * relationship hints, and setting context into a unified system prompt.
 *
 * Delegates to sub-orchestrators:
 * - memory-orchestrator.js: Memory retrieval, persona memories, preterite surfacing
 * - drift-orchestrator.js: Soul validation, drift analysis and correction
 * - setting-orchestrator.js: Setting, ambient, temporal, entropy, zone, Pynchon Phase 2
 *
 * All assembly operations are logged silently for operators but never exposed to users.
 *
 * Feature: 002-invisible-infrastructure
 */

import { getSharedPool } from './db-pool.js';
import { frameMemories } from './memory-framing.js';
import { generateBehavioralHints } from './relationship-shaper.js';
import { logOperation } from './operator-logger.js';
import { compileUserSetting } from './setting-preserver.js';
// Persona Autonomy imports (Constitution Principle VI)
import { getEntropyState } from './entropy-tracker.js';
import { validatePersonaName } from './persona-validator.js';
import { CONTEXT_BUDGET, PURGE_CONFIG } from './constants.js';
import { purgeStaleSettings } from '../scripts/purge-settings.js';
export { completeSession } from './session-orchestrator.js';
export { assembleCouncilContext } from './council-assembler.js';
import {
  DEFAULT_RELATIONSHIP,
  safeRelationshipFetch,
  safePersonaRelationsFetch
} from './relationship-orchestrator.js';

// Sub-orchestrator imports
import {
  safeMemoryRetrieval,
  safePersonaMemoriesFetch,
  safePreteriteFetch
} from './memory-orchestrator.js';

import { buildSystemPrompt } from './prompt-builder.js';

import {
  safeSoulValidation,
  safeDriftFetch
} from './drift-orchestrator.js';

import {
  safeTemporalFetch,
  safeAmbientFetch,
  safeEntropyFetch,
  safeZoneDetection,
  safeTheyAwarenessFetch,
  safeCounterforceFetch,
  safeNarrativeGravityFetch,
  safeInterfaceBleedFetch
} from './setting-orchestrator.js';

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

// ===================================================================
// Lazy Purge: Stale Settings Cleanup (Issue #28)
// ===================================================================

/** Interval between automatic purge runs (6 hours in ms). */
const PURGE_INTERVAL_MS = PURGE_CONFIG.INTERVAL_MS;

/** Timestamp of the last purge attempt. Starts at 0 to trigger on first eligible call. */
let lastPurgeTime = 0;

/**
 * Fire-and-forget lazy purge of stale settings.
 * Runs at most once every PURGE_INTERVAL_MS. Never throws or blocks the caller.
 */
function maybePurgeStaleSettings() {
  const now = Date.now();
  if (now - lastPurgeTime < PURGE_INTERVAL_MS) return;

  lastPurgeTime = now;

  // Fire-and-forget: no await, errors caught internally
  purgeStaleSettings(getPool())
    .then(result => {
      if (result.success && result.deletedCount > 0) {
        logOperation('lazy_purge_settings', {
          details: {
            deleted_count: result.deletedCount
          },
          success: true
        }).catch(() => {});
      }
    })
    .catch(() => {
      // Silent failure — purge is non-critical
    });
}

// Token budget imported from constants.js (CONTEXT_BUDGET)

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
    previousResponse = null
  } = params;

  const maxTokens = options.maxTokens || 3000;
  const includeSetting = options.includeSetting !== false;
  const includePynchon = options.includePynchon !== false;

  // Validate persona name if provided (security: directory traversal prevention)
  if (personaSlug) {
    validatePersonaName(personaSlug);
  }

  // Lazy purge: fire-and-forget cleanup of expired settings (Issue #28)
  maybePurgeStaleSettings();

  try {
    // Step 0: Validate soul file integrity (Constitution Principle I)
    const soulValid = await safeSoulValidation(personaSlug, sessionId);
    if (!soulValid) {
      // Soul tampered -- return null context with error flag
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
    const personaMemoriesContext = await safePersonaMemoriesFetch(personaId, CONTEXT_BUDGET.personaMemories, sessionId);

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

    // Step 9: Build token-budgeted system prompt
    const { systemPrompt, totalTokens, truncated } = await buildSystemPrompt(
      components, maxTokens, { sessionId, personaId, userId, startTime }
    );

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
/**
 * Configuration and defaults for external access.
 */
export const CONFIG = {
  CONTEXT_BUDGET,
  DEFAULT_RELATIONSHIP,
  DEFAULT_MAX_TOKENS: 3000
};
