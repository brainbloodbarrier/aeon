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

import { getSharedPool, withTransaction } from './db-pool.js';
import { frameMemories } from './memory-framing.js';
import { generateBehavioralHints } from './relationship-shaper.js';
import { logOperation, logOperationBatch } from './operator-logger.js';
import { ensureRelationship, updateFamiliarity } from './relationship-tracker.js';
import { extractSessionMemories, storeSessionMemories } from './memory-extractor.js';
import { compileUserSetting } from './setting-preserver.js';
import { extractAndSaveSettings } from './setting-extractor.js';
// Persona Autonomy imports (Constitution Principle VI)
import { getPersonaNetwork } from './persona-relationship-tracker.js';
// Constitution Principle VII: Temporal Consciousness (session completion only)
import { touchTemporalState } from './temporal-awareness.js';
// Entropy (session completion only)
import { getEntropyState, applySessionEntropy } from './entropy-tracker.js';
// Pynchon Layer Phase 1: Preterite memory classification (session completion only)
import { classifyMemoryElection, consignToPreterite } from './preterite-memory.js';
// Pynchon Layer Phase 2: Narrative Gravity (session completion only)
import { updateArc } from './narrative-gravity.js';
import { validatePersonaName } from './persona-validator.js';
import { CONTEXT_BUDGET } from './constants.js';

// Sub-orchestrator imports
import {
  estimateTokens,
  truncateMemories,
  safeMemoryRetrieval,
  safePersonaMemoriesFetch,
  safePreteriteFetch
} from './memory-orchestrator.js';

import {
  safeSoulValidation,
  safeDriftFetch
} from './drift-orchestrator.js';

import {
  getSettingContext,
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

// Token budget imported from constants.js (CONTEXT_BUDGET)

/**
 * Default relationship for new users.
 */
const DEFAULT_RELATIONSHIP = {
  trust_level: 'stranger',
  familiarity_score: 0,
  interaction_count: 0
};

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

// ===================================================================
// Persona Autonomy Helpers (Constitution Principle VI)
// ===================================================================

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
    // Order: setting -> ambient -> temporal -> relationship -> persona relationships ->
    //        memories -> persona memories -> preterite -> entropy -> drift -> zone resistance
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
    const personaMemories = await safePersonaMemoriesFetch(personaId, CONTEXT_BUDGET.personaMemories, sessionId);

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
