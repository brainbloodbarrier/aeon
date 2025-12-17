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

import pg from 'pg';
import { frameMemories } from './memory-framing.js';
import { generateBehavioralHints } from './relationship-shaper.js';
import { generateDriftCorrection } from './drift-correction.js';
import { logOperation, logOperationBatch } from './operator-logger.js';
import { ensureRelationship, updateFamiliarity } from './relationship-tracker.js';
import { extractSessionMemories, storeSessionMemories } from './memory-extractor.js';
import { compileUserSetting } from './setting-preserver.js';
import { extractAndSaveSettings } from './setting-extractor.js';
// Persona Autonomy imports (Constitution Principle VI)
import { getPersonaNetwork } from './persona-relationship-tracker.js';
import { getPersonaMemories, framePersonaMemories, getAllOpinions } from './persona-memory.js';
const { Pool } = pg;

let pool = null;

/**
 * Get or create database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('[ContextAssembler] DATABASE_URL environment variable is required');
    }
    const connectionString = process.env.DATABASE_URL;

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  return pool;
}

/**
 * Token budget allocation for context components.
 * Updated for Constitution Principle VI (Persona Autonomy).
 */
const CONTEXT_BUDGET = {
  soulMarkers: 500,        // Highest priority - persona voice markers
  relationship: 300,       // Behavioral hints (user relationship)
  personaRelations: 200,   // Persona-to-persona relationships (NEW - Principle VI)
  setting: 200,            // Bar atmosphere
  driftCorrection: 200,    // Voice corrections
  memories: 1200,          // Framed memories (reduced to make room)
  personaMemories: 200,    // Persona's independent knowledge (NEW - Principle VI)
  buffer: 200              // Safety margin
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

    // Retrieve recent memories for this persona-user pair
    const result = await db.query(
      `SELECT id, memory_type, content, importance_score, created_at
       FROM memories
       WHERE persona_id = $1 AND user_id = $2
       ORDER BY importance_score DESC, created_at DESC
       LIMIT 10`,
      [personaId, userId]
    );

    await logOperation('memory_retrieval', {
      sessionId,
      personaId,
      userId,
      details: {
        memories_selected: result.rows.length,
        total_available: result.rows.length,
        selection_strategy: 'importance_and_recency'
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
         AND active = true
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
 * @param {Object} params - Assembly parameters
 * @param {string} params.personaId - UUID of the persona being invoked
 * @param {string} params.userId - UUID of the user
 * @param {string} params.query - Current user query
 * @param {string} params.sessionId - UUID for this invocation session
 * @param {Object} [params.options] - Optional configuration
 * @param {number} [params.options.maxTokens=3000] - Maximum context tokens
 * @param {boolean} [params.options.includeSetting=true] - Include bar setting
 * @param {Object} [params.previousResponse] - Previous persona response for drift detection
 * @param {Object} [params.soulMarkers] - Soul voice markers for drift detection
 *
 * @returns {Promise<Object>} AssembledContext object
 *
 * @example
 * const context = await assembleContext({
 *   personaId: 'abc-123',
 *   userId: 'user-456',
 *   query: 'What is the nature of being?',
 *   sessionId: 'session-789'
 * });
 */
export async function assembleContext(params) {
  const startTime = Date.now();
  const {
    personaId,
    userId,
    query,
    sessionId,
    options = {},
    previousResponse = null,
    soulMarkers = null
  } = params;

  const maxTokens = options.maxTokens || 3000;
  const includeSetting = options.includeSetting !== false;

  try {
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

    if (previousResponse && soulMarkers) {
      // Note: drift-detection.js runs in sandbox, so we'd need to integrate differently
      // For now, we'll skip actual drift detection and just provide the interface
      // This would be called via MCP in production
      driftCorrection = null;
      driftScore = null;
    }

    // Step 5: Get personalized setting context (replaces static getSettingContext)
    const setting = includeSetting
      ? await compileUserSetting(userId, personaId, sessionId)
      : null;

    // Step 6: Fetch persona autonomy components (Constitution Principle VI)
    // These are persona-independent knowledge and inter-persona relationships
    const personaRelations = await safePersonaRelationsFetch(personaId, null, sessionId);
    const personaMemories = await safePersonaMemoriesFetch(personaId, sessionId);

    // Step 7: Assemble within token budget
    const components = {
      memories: framedMemories || null,
      relationship: relationshipHints || null,
      personaRelations: personaRelations || null,
      personaMemories: personaMemories || null,
      driftCorrection: driftCorrection || null,
      setting: setting || null
    };

    // Calculate token usage
    let totalTokens = 0;
    totalTokens += estimateTokens(components.relationship);
    totalTokens += estimateTokens(components.personaRelations);
    totalTokens += estimateTokens(components.personaMemories);
    totalTokens += estimateTokens(components.setting);
    totalTokens += estimateTokens(components.driftCorrection);

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
    // Order: setting → user relationship → persona relationships → memories → persona memories → drift
    const parts = [];

    if (components.setting) {
      parts.push(components.setting);
    }

    if (components.relationship) {
      parts.push('\n' + components.relationship);
    }

    if (components.personaRelations) {
      parts.push('\n' + components.personaRelations);
    }

    if (components.memories) {
      parts.push('\n' + components.memories);
    }

    if (components.personaMemories) {
      parts.push('\n' + components.personaMemories);
    }

    if (components.driftCorrection) {
      parts.push('\n' + components.driftCorrection);
    }

    const systemPrompt = parts.join('').trim();
    totalTokens = estimateTokens(systemPrompt);

    // Step 7: Log context assembly
    await logOperation('context_assembly', {
      sessionId,
      personaId,
      userId,
      details: {
        total_tokens: totalTokens,
        components_included: Object.keys(components).filter(k => components[k]),
        budget_remaining: maxTokens - totalTokens
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
        assemblyDurationMs: Date.now() - startTime
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
        driftCorrection: null,
        setting: 'It is 2 AM at O Fim. The humidity is eternal. Chopp flows cold.'
      },
      metadata: {
        sessionId,
        totalTokens: 20,
        truncated: false,
        memoriesIncluded: 0,
        driftScore: null,
        trustLevel: 'stranger',
        assemblyDurationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Complete a session by updating relationship and extracting memories.
 * Called at session end to track familiarity progression and store memorable content.
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

    // NOTE: These operations are not wrapped in a single transaction because
    // each module manages its own connection. This is a design trade-off:
    // - Pro: Modules remain decoupled and independently testable
    // - Pro: Partial failures don't block other operations
    // - Con: If process crashes mid-completion, state may be partially updated
    // The idempotency check above mitigates the most common issue (duplicate processing).

    // Update familiarity (may trigger trust level change)
    const relationshipResult = await updateFamiliarity(userId, personaId, sessionQuality);

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
    if (memories.length > 0) {
      await storeSessionMemories(userId, personaId, memories);
      memoriesStored = memories.length;
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
    });

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
        settings_extracted: settingResult.fieldsUpdated.length > 0,
        settings_fields: settingResult.fieldsUpdated
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return {
      relationship: relationshipResult,
      memoriesStored,
      settingsExtracted: settingResult.fieldsUpdated,
      sessionQuality
    };

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
      sessionQuality: null,
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
 * @param {Object} params - Council assembly parameters
 * @param {string} params.personaId - UUID of the persona being assembled for
 * @param {string} params.personaName - Name of the persona
 * @param {string} params.userId - UUID of the user (optional for councils)
 * @param {string[]} params.participantIds - UUIDs of all council participants
 * @param {string[]} params.participantNames - Names of all council participants
 * @param {string} params.sessionId - Council session UUID
 * @param {string} params.topic - Council topic/question
 * @param {string} params.councilType - Type: 'council', 'dialectic', 'familia', etc.
 * @param {Object} [params.councilState] - Current council state machine position
 * @returns {Promise<Object>} Council context for this persona
 *
 * @example
 * const context = await assembleCouncilContext({
 *   personaId: 'hegel-uuid',
 *   personaName: 'Hegel',
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
    userId,
    participantIds,
    participantNames,
    sessionId,
    topic,
    councilType,
    councilState = null
  } = params;

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

    // Step 5: Assemble components
    const components = {
      councilFrame,
      personaRelations: personaRelations || null,
      personaMemories: personaMemories || null,
      userRelationship: userRelationship ? `The one who called this council: ${userRelationship.trust_level}.` : null
    };

    // Step 6: Build system prompt
    const parts = [];

    parts.push(councilFrame);

    if (components.personaRelations) {
      parts.push('\n' + components.personaRelations);
    }

    if (components.personaMemories) {
      parts.push('\n' + components.personaMemories);
    }

    if (components.userRelationship) {
      parts.push('\n' + components.userRelationship);
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
        assemblyDurationMs: Date.now() - startTime
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
        fallback: true
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
