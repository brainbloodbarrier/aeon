/**
 * AEON Matrix - Memory Extractor
 *
 * Extracts memorable exchanges from completed sessions and stores them
 * for future relationship context. Implements Constitution Principle IV.
 *
 * Feature: 004-relationship-continuity
 * Constitution: Principle IV (Relationship Continuity)
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import {
  EXTRACTION_CONFIG,
  IMPORTANCE_WEIGHTS,
  MEMORY_STORAGE,
  MEMORY_IMPORTANCE
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// Re-export constants for backward compatibility
// ═══════════════════════════════════════════════════════════════════════════

export { EXTRACTION_CONFIG, IMPORTANCE_WEIGHTS };

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
// Pattern Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Personal disclosure patterns.
 */
const PERSONAL_PATTERNS = [
  /\bi\s+(am|was|have|had|feel|felt|think|thought|believe|want|need|like|love|hate)\b/i,
  /\bmy\s+(life|work|job|family|friend|partner|wife|husband|child|problem|goal|dream)\b/i,
  /\bi('m|'ve|'d)\s+/i,
  /\bpersonally\b/i,
  /\bfor me\b/i
];

/**
 * Question depth patterns (follow-ups, clarifications).
 */
const DEPTH_PATTERNS = [
  /\bwhat\s+about\b/i,
  /\bcan\s+you\s+explain\b/i,
  /\bhow\s+does\s+that\b/i,
  /\bwhy\s+is\s+that\b/i,
  /\bmore\s+about\b/i,
  /\bspecifically\b/i,
  /\bfor\s+example\b/i
];

/**
 * Topic significance keywords (philosophical, strategic, technical depth).
 */
const SIGNIFICANCE_PATTERNS = [
  /\bphilosophy\b/i,
  /\bmeaning\s+of\b/i,
  /\bexistential\b/i,
  /\bstrategy\b/i,
  /\barchitecture\b/i,
  /\bdialectic\b/i,
  /\bsynthesis\b/i,
  /\bfundamental\b/i,
  /\bprinciple\b/i
];

/**
 * Detect patterns in a message.
 *
 * @param {string} content - Message content
 * @returns {string[]} Detected pattern types
 */
function detectPatterns(content) {
  const patterns = [];

  // Check personal disclosure
  for (const pattern of PERSONAL_PATTERNS) {
    if (pattern.test(content)) {
      patterns.push('personal');
      break;
    }
  }

  // Check question depth
  for (const pattern of DEPTH_PATTERNS) {
    if (pattern.test(content)) {
      patterns.push('depth');
      break;
    }
  }

  // Check topic significance
  for (const pattern of SIGNIFICANCE_PATTERNS) {
    if (pattern.test(content)) {
      patterns.push('significance');
      break;
    }
  }

  // Check for preference indicators
  if (/\b(prefer|favorite|always|usually|never)\b/i.test(content)) {
    patterns.push('preference');
  }

  // Check for factual statements about self
  if (/\bi\s+(work|live|study|graduated|majored)\b/i.test(content)) {
    patterns.push('fact');
  }

  return patterns;
}

// ═══════════════════════════════════════════════════════════════════════════
// Memory Analysis
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze messages for memorable content.
 *
 * @param {Array<{role: string, content: string}>} messages - Session messages
 * @returns {Array<Object>} Memory candidates with patterns and importance
 */
export function analyzeForMemories(messages) {
  const candidates = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Only analyze user messages
    if (msg.role !== 'user') continue;

    const patterns = detectPatterns(msg.content);

    if (patterns.length > 0) {
      candidates.push({
        sourceIndex: i,
        content: msg.content,
        patterns,
        estimatedImportance: patterns.length * MEMORY_IMPORTANCE.PATTERN_WEIGHT
      });
    }
  }

  return candidates;
}

/**
 * Calculate importance score for a memory candidate.
 *
 * @param {string[]} patterns - Detected patterns
 * @param {Object} sessionData - Session metadata
 * @returns {number} Importance score 0.0-1.0
 */
export function calculateImportance(patterns, sessionData) {
  let score = 0;

  // Personal disclosure weight
  if (patterns.includes('personal')) {
    score += IMPORTANCE_WEIGHTS.personalDisclosure;
  }

  // Question depth weight
  if (patterns.includes('depth')) {
    score += IMPORTANCE_WEIGHTS.questionDepth;
  }

  // Topic significance weight
  if (patterns.includes('significance')) {
    score += IMPORTANCE_WEIGHTS.topicSignificance;
  }

  // Session length bonus
  if (sessionData) {
    const durationMinutes = (sessionData.endedAt - sessionData.startedAt) / 60000;
    if (durationMinutes > 5) {
      score += IMPORTANCE_WEIGHTS.sessionLength;
    }
  }

  return Math.min(1.0, score);
}

/**
 * Classify memory type from content and patterns.
 *
 * @param {string} content - Memory content
 * @param {string[]} patterns - Detected patterns
 * @returns {'interaction' | 'learning' | 'insight'} Memory type (DB-compatible)
 */
export function classifyMemoryType(content, patterns) {
  // Insight: How to interact (preferences, style)
  if (patterns.includes('preference')) {
    return 'insight';
  }

  // Learning: General knowledge about user (facts)
  if (patterns.includes('fact')) {
    return 'learning';
  }

  // Default: Interaction (specific exchange)
  return 'interaction';
}

/**
 * Summarize an exchange segment.
 *
 * @param {Array<{role: string, content: string}>} messages - Full message array
 * @param {number} startIndex - Start of exchange
 * @param {number} endIndex - End of exchange
 * @returns {string} Summarized content
 */
export function summarizeExchange(messages, startIndex, endIndex) {
  const relevantMessages = messages.slice(startIndex, endIndex + 1);

  // Extract key content from user messages
  const userContent = relevantMessages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');

  // Create third-person summary
  let summary = '';

  // Check for personal info
  const workMatch = userContent.match(/i\s+(work|am\s+a|work\s+as)\s+([^.!?]+)/i);
  if (workMatch) {
    summary = `They work as ${workMatch[2].trim()}.`;
  }

  const interestMatch = userContent.match(/i\s+(like|love|enjoy|am\s+interested\s+in)\s+([^.!?]+)/i);
  if (interestMatch) {
    summary += ` They are interested in ${interestMatch[2].trim()}.`;
  }

  // If no specific match, create generic summary
  if (!summary) {
    // Take first significant sentence
    const firstSentence = userContent.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length > 20) {
      summary = `They discussed: "${firstSentence.substring(0, EXTRACTION_CONFIG.memoryMaxLength - 20)}..."`;
    } else {
      summary = `Exchange about ${userContent.substring(0, 100)}...`;
    }
  }

  // Enforce character limit
  if (summary.length > EXTRACTION_CONFIG.memoryMaxLength) {
    summary = summary.substring(0, EXTRACTION_CONFIG.memoryMaxLength - 3) + '...';
  }

  return summary.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Memory Extraction
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract memorable content from a completed session.
 *
 * @param {Object} sessionData - Session transcript and metadata
 * @returns {Promise<Array<Object>>} Extracted memories
 */
export async function extractSessionMemories(sessionData) {
  const startTime = performance.now();

  try {
    const { messages = [], sessionId, userId, personaId } = sessionData;

    // Check minimum message threshold
    if (messages.length < EXTRACTION_CONFIG.minMessages) {
      return [];
    }

    // Analyze for memorable patterns
    const candidates = analyzeForMemories(messages);

    if (candidates.length === 0) {
      return [];
    }

    // Calculate importance and filter
    const scoredCandidates = candidates.map(candidate => ({
      ...candidate,
      importance: calculateImportance(candidate.patterns, sessionData),
      memoryType: classifyMemoryType(candidate.content, candidate.patterns)
    })).filter(c => c.importance >= EXTRACTION_CONFIG.importanceThreshold);

    // Sort by importance and take top N
    scoredCandidates.sort((a, b) => b.importance - a.importance);
    const topCandidates = scoredCandidates.slice(0, EXTRACTION_CONFIG.maxMemoriesPerSession);

    // Generate summaries
    const memories = topCandidates.map(candidate => ({
      content: summarizeExchange(messages, candidate.sourceIndex, Math.min(candidate.sourceIndex + 2, messages.length - 1)),
      memoryType: candidate.memoryType,
      importance: candidate.importance,
      extractedFrom: sessionId
    }));

    // Fire-and-forget logging
    logOperation('memory_extraction', {
      sessionId,
      personaId,
      userId,
      details: {
        message_count: messages.length,
        candidates_found: candidates.length,
        memories_extracted: memories.length,
        memory_types: memories.map(m => m.memoryType),
        avg_importance: memories.length > 0
          ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length
          : 0
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return memories;

  } catch (error) {
    console.error('[MemoryExtractor] Error extracting memories:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      sessionId: sessionData?.sessionId,
      personaId: sessionData?.personaId,
      userId: sessionData?.userId,
      details: {
        error_type: 'memory_extraction_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Embedding Generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate an embedding vector for text content.
 * Gracefully returns null when OPENAI_API_KEY is absent.
 *
 * @param {string} text - Text to embed (truncated to 8000 chars)
 * @returns {Promise<number[]|null>} 1536-dimension embedding vector, or null
 */
export async function generateEmbedding(text) {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!text || text.length < MEMORY_STORAGE.MIN_EMBED_LENGTH) return null;

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, MEMORY_STORAGE.EMBEDDING_TEXT_LIMIT)
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('[MemoryExtractor] Embedding generation failed:', error.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Memory Storage
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Store a single memory to the database.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @param {Object} memory - Memory to store
 * @returns {Promise<string|null>} Memory ID or null on failure
 */
export async function storeMemory(userId, personaId, memory) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Generate embedding if API key available (graceful degradation)
    const embedding = await generateEmbedding(memory.content);

    let result;
    if (embedding) {
      result = await db.query(
        `INSERT INTO memories (user_id, persona_id, content, memory_type, importance, embedding)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [userId, personaId, memory.content, memory.memoryType, memory.importance, JSON.stringify(embedding)]
      );
    } else {
      result = await db.query(
        `INSERT INTO memories (user_id, persona_id, content, memory_type, importance)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [userId, personaId, memory.content, memory.memoryType, memory.importance]
      );
    }

    const memoryId = result.rows[0].id;

    // Fire-and-forget logging
    logOperation('memory_store', {
      personaId,
      userId,
      details: {
        memory_id: memoryId,
        memory_type: memory.memoryType,
        importance: memory.importance,
        content_length: memory.content?.length || 0
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return memoryId;

  } catch (error) {
    console.error('[MemoryExtractor] Error storing memory:', error.message);
    logOperation('error_graceful', {
      personaId,
      userId,
      details: {
        error_type: 'memory_store_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});
    return null;
  }
}

/**
 * Batch store multiple memories.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @param {Array<Object>} memories - Memories to store
 * @returns {Promise<string[]>} Memory IDs
 */
export async function storeSessionMemories(userId, personaId, memories, client = null) {
  const startTime = performance.now();

  if (!memories || memories.length === 0) {
    return [];
  }

  // Batch size validation: PostgreSQL has a 65,535 parameter limit
  // With 5 parameters per memory, max safe batch is 13,000
  if (memories.length > MEMORY_STORAGE.MAX_BATCH_SIZE) {
    console.warn(`[MemoryExtractor] Batch size ${memories.length} exceeds limit, truncating to ${MEMORY_STORAGE.MAX_BATCH_SIZE}`);
    memories = memories.slice(0, MEMORY_STORAGE.MAX_BATCH_SIZE);
  }

  try {
    const db = client || getPool();
    const ids = [];

    // Build batch insert
    const values = memories.map((m, i) => {
      const offset = i * 5;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    }).join(', ');

    const params = memories.flatMap(m => [userId, personaId, m.content, m.memoryType, m.importance]);

    const result = await db.query(
      `INSERT INTO memories (user_id, persona_id, content, memory_type, importance)
       VALUES ${values}
       RETURNING id`,
      params
    );

    ids.push(...result.rows.map(r => r.id));

    // Fire-and-forget logging
    logOperation('memory_store', {
      personaId,
      userId,
      details: {
        memory_count: ids.length,
        memory_types: memories.map(m => m.memoryType),
        avg_importance: memories.reduce((sum, m) => sum + m.importance, 0) / memories.length
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return ids;

  } catch (error) {
    console.error('[MemoryExtractor] Error storing memories:', error.message);
    logOperation('error_graceful', {
      personaId,
      userId,
      details: {
        error_type: 'memory_store_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Memory Retrieval
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieve recent memories for context.
 *
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID
 * @param {number} limit - Max memories to return (default 3)
 * @returns {Promise<Array<Object>>} Recent memories
 */
export async function getRecentMemories(userId, personaId, limit = 3) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Get memories ordered by importance and recency
    const result = await db.query(
      `SELECT
        id,
        content,
        memory_type AS "memoryType",
        importance,
        created_at AS "createdAt",
        access_count AS "accessCount"
      FROM memories
      WHERE user_id = $1 AND persona_id = $2
      ORDER BY importance DESC, created_at DESC
      LIMIT $3`,
      [userId, personaId, limit]
    );

    const memories = result.rows;

    // Update access tracking (fire-and-forget)
    if (memories.length > 0) {
      const ids = memories.map(m => m.id);
      db.query(
        `UPDATE memories
         SET access_count = access_count + 1, last_accessed = NOW()
         WHERE id = ANY($1)`,
        [ids]
      ).catch(() => {});
    }

    // Fire-and-forget logging
    logOperation('memory_retrieval', {
      personaId,
      userId,
      details: {
        memories_retrieved: memories.length,
        memory_types: memories.map(m => m.memoryType)
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return memories;

  } catch (error) {
    console.error('[MemoryExtractor] Error retrieving memories:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pattern Extraction (US4)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract recurring patterns from session data.
 *
 * @param {Object} sessionData - Session transcript and metadata
 * @returns {Object} Extracted patterns
 */
export function extractPatterns(sessionData) {
  const { messages = [] } = sessionData;
  const patterns = {
    topics: [],
    style: {},
    updatedAt: new Date().toISOString()
  };

  // Extract topics from user messages
  const userMessages = messages.filter(m => m.role === 'user');
  const allContent = userMessages.map(m => m.content).join(' ').toLowerCase();

  // Simple topic extraction (word frequency)
  const words = allContent.split(/\W+/).filter(w => w.length > 4);
  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Top topics
  patterns.topics = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Detect communication style
  const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / (userMessages.length || 1);
  patterns.style.verbosity = avgLength > 200 ? 'verbose' : avgLength > 50 ? 'moderate' : 'concise';
  patterns.style.questionRatio = userMessages.filter(m => m.content.includes('?')).length / (userMessages.length || 1);

  return patterns;
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
