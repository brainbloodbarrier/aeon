/**
 * AEON Matrix - Preterite Memory
 *
 * Implements the Pynchon layer: the theology of memory election.
 * Some memories are "elect" (remembered), others are "preterite" (passed over,
 * forgotten but not gone). Sometimes the preterite surfaces, fragmentary and corrupted.
 *
 * "There is always the invisible hand, the unseen, the preterite." - Pynchon
 *
 * Feature: Phase 1 - Pynchon Layer
 * Constitution: Principle II (Invisible Infrastructure)
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Election thresholds for memory classification.
 */
export const ELECTION_THRESHOLDS = {
  ELECT: 0.7,        // Definitely remembered
  BORDERLINE: 0.4,   // Might be remembered
  PRETERITE: 0.0     // Passed over (below 0.4)
};

/**
 * Election status enumeration.
 */
export const ELECTION_STATUS = {
  ELECT: 'elect',
  BORDERLINE: 'borderline',
  PRETERITE: 'preterite'
};

/**
 * Reasons a memory may be consigned to the preterite.
 */
export const PRETERITE_REASONS = {
  DEEMED_INSIGNIFICANT: 'deemed_insignificant',
  OVERSHADOWED: 'overshadowed',
  ENTROPY_CLAIMED: 'entropy_claimed',
  TOO_ORDINARY: 'too_ordinary',
  NO_WITNESS: 'no_witness',
  PATTERN_MISMATCH: 'pattern_mismatch'
};

/**
 * Surface chance: probability that preterite memories emerge.
 */
const SURFACE_PROBABILITY = 0.15;

/**
 * Corruption patterns for fragmentary memories.
 */
const CORRUPTION_PATTERNS = {
  ELLIPSIS_PREFIX: '...',
  ELLIPSIS_SUFFIX: '...',
  REDACTION: '[...]',
  UNCERTAINTY_MARKERS: [
    'or was it',
    'perhaps',
    'something about',
    'I think',
    'maybe'
  ]
};

/**
 * Surface framing templates.
 */
const SURFACE_FRAMES = [
  'Something surfaces. Half-remembered. Possibly imagined.',
  'From the sediment of forgotten moments:',
  'The preterite stirs. A fragment emerges:',
  'A memory unclaimed by the elect:',
  'From what was passed over:'
];

// =============================================================================
// Election Score Calculation
// =============================================================================

/**
 * Calculate election score for a memory.
 * Factors: emotional intensity, references, recency, length.
 *
 * @param {Object} memory - Memory object to score
 * @param {string} memory.content - Memory content
 * @param {number} [memory.importance_score] - Base importance (0.0-1.0)
 * @param {number} [memory.access_count] - Number of times accessed
 * @param {Date|string} [memory.created_at] - Creation timestamp
 * @param {Date|string} [memory.last_accessed] - Last access timestamp
 * @returns {number} Election score 0.0-1.0
 */
export function calculateElectionScore(memory) {
  if (!memory || !memory.content) {
    return 0;
  }

  const content = memory.content;
  let score = 0;

  // -------------------------------------------------------------------------
  // Factor 1: Emotional intensity (0.0 - 0.35)
  // -------------------------------------------------------------------------
  const emotionalPatterns = [
    /\b(love|hate|fear|joy|sorrow|anger|passion|despair)\b/i,
    /\b(beautiful|terrible|wonderful|horrific|magnificent)\b/i,
    /\b(never forget|always remember|changed|transformed)\b/i,
    /!+/,
    /\?{2,}/
  ];

  let emotionalHits = 0;
  for (const pattern of emotionalPatterns) {
    if (pattern.test(content)) {
      emotionalHits++;
    }
  }
  score += Math.min(emotionalHits * 0.07, 0.35);

  // -------------------------------------------------------------------------
  // Factor 2: References/connections (0.0 - 0.25)
  // -------------------------------------------------------------------------
  const referencePatterns = [
    /\b(you|they|we|us|them)\b/gi,
    /\b(said|told|asked|mentioned|discussed)\b/i,
    /\b(remember when|that time|the day)\b/i
  ];

  let referenceHits = 0;
  for (const pattern of referencePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      referenceHits += matches.length;
    }
  }
  score += Math.min(referenceHits * 0.03, 0.25);

  // -------------------------------------------------------------------------
  // Factor 3: Recency decay (0.0 - 0.2)
  // -------------------------------------------------------------------------
  if (memory.created_at) {
    const createdAt = new Date(memory.created_at);
    const now = new Date();
    const daysSince = (now - createdAt) / (1000 * 60 * 60 * 24);

    // Recent memories score higher, decay over 30 days
    if (daysSince < 1) {
      score += 0.2;
    } else if (daysSince < 7) {
      score += 0.15;
    } else if (daysSince < 30) {
      score += 0.1;
    } else if (daysSince < 90) {
      score += 0.05;
    }
    // Older than 90 days: no recency bonus
  }

  // -------------------------------------------------------------------------
  // Factor 4: Content length/substance (0.0 - 0.1)
  // -------------------------------------------------------------------------
  const words = content.split(/\s+/).length;
  if (words >= 20) {
    score += 0.1;
  } else if (words >= 10) {
    score += 0.05;
  }

  // -------------------------------------------------------------------------
  // Factor 5: Base importance if available (0.0 - 0.1)
  // -------------------------------------------------------------------------
  if (typeof memory.importance_score === 'number') {
    score += memory.importance_score * 0.1;
  }

  return Math.min(Math.max(score, 0), 1);
}

// =============================================================================
// Memory Election Classification
// =============================================================================

/**
 * Classify a memory's election status.
 *
 * @param {Object} memory - Memory object to classify
 * @returns {Object} Classification result
 * @returns {string} result.status - 'elect', 'borderline', or 'preterite'
 * @returns {string|null} result.reason - Reason for preterite status (if applicable)
 * @returns {number} result.score - Calculated election score
 * @returns {boolean} result.retrievable - Whether memory can be retrieved normally
 */
export function classifyMemoryElection(memory) {
  const score = calculateElectionScore(memory);

  // Elect: definitely remembered
  if (score >= ELECTION_THRESHOLDS.ELECT) {
    return {
      status: ELECTION_STATUS.ELECT,
      reason: null,
      score,
      retrievable: true
    };
  }

  // Borderline: might be remembered
  if (score >= ELECTION_THRESHOLDS.BORDERLINE) {
    return {
      status: ELECTION_STATUS.BORDERLINE,
      reason: null,
      score,
      retrievable: true
    };
  }

  // Preterite: passed over, determine reason
  const reason = determinePreteriteReason(memory, score);

  return {
    status: ELECTION_STATUS.PRETERITE,
    reason,
    score,
    retrievable: false
  };
}

/**
 * Determine why a memory was consigned to the preterite.
 *
 * @param {Object} memory - Memory object
 * @param {number} score - Election score
 * @returns {string} Preterite reason
 */
function determinePreteriteReason(memory, score) {
  const content = memory.content || '';

  // Too short, no substance
  if (content.split(/\s+/).length < 5) {
    return PRETERITE_REASONS.TOO_ORDINARY;
  }

  // No personal references
  if (!/\b(you|they|we|I|my|your|their)\b/i.test(content)) {
    return PRETERITE_REASONS.NO_WITNESS;
  }

  // Very low score indicates insignificance
  if (score < 0.1) {
    return PRETERITE_REASONS.DEEMED_INSIGNIFICANT;
  }

  // Old memory with low access
  if (memory.access_count === 0 && memory.created_at) {
    const daysSince = (new Date() - new Date(memory.created_at)) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) {
      return PRETERITE_REASONS.ENTROPY_CLAIMED;
    }
  }

  // Low importance suggests overshadowing
  if (memory.importance_score && memory.importance_score < 0.3) {
    return PRETERITE_REASONS.OVERSHADOWED;
  }

  // Default: pattern mismatch
  return PRETERITE_REASONS.PATTERN_MISMATCH;
}

// =============================================================================
// Preterite Storage
// =============================================================================

/**
 * Consign a memory to the preterite_memories table.
 * The original memory remains in memories table but marked as passed over.
 *
 * @param {Object} memory - Memory object with id
 * @param {string} reason - Preterite reason from PRETERITE_REASONS
 * @returns {Promise<string|null>} Preterite entry ID or null on failure
 */
export async function consignToPreterite(memory, reason, client = null) {
  const startTime = performance.now();

  try {
    const db = client || getSharedPool();

    // Store in preterite table
    const result = await db.query(
      `INSERT INTO preterite_memories (
        original_memory_id,
        persona_id,
        user_id,
        content,
        preterite_reason,
        original_score,
        consigned_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (original_memory_id) DO UPDATE SET
        preterite_reason = EXCLUDED.preterite_reason,
        original_score = EXCLUDED.original_score,
        consigned_at = NOW()
      RETURNING id`,
      [
        memory.id,
        memory.persona_id,
        memory.user_id,
        memory.content,
        reason,
        memory.importance_score || 0
      ]
    );

    const preteriteId = result.rows[0]?.id;

    // Fire-and-forget logging
    logOperation('preterite_consignment', {
      personaId: memory.persona_id,
      userId: memory.user_id,
      details: {
        original_memory_id: memory.id,
        preterite_id: preteriteId,
        reason,
        content_length: memory.content?.length || 0
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return preteriteId;

  } catch (error) {
    console.error('[PreteriteMemory] Error consigning to preterite:', error.message);

    logOperation('error_graceful', {
      personaId: memory.persona_id,
      userId: memory.user_id,
      details: {
        error_type: 'preterite_consignment_failure',
        error_message: error.message,
        original_memory_id: memory.id
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    return null;
  }
}

// =============================================================================
// Preterite Surfacing
// =============================================================================

/**
 * Attempt to surface preterite memories.
 * Has a 15% chance to retrieve fragments from the forgotten.
 *
 * @param {string} personaId - Persona UUID
 * @param {string} userId - User UUID
 * @param {number} [maxFragments=2] - Maximum fragments to surface
 * @returns {Promise<Object>} Surface result
 * @returns {boolean} result.surfaced - Whether anything surfaced
 * @returns {Array<Object>} result.fragments - Corrupted memory fragments
 */
export async function attemptSurface(personaId, userId, maxFragments = 2) {
  const startTime = performance.now();

  // Roll for surfacing chance
  const roll = Math.random();
  if (roll > SURFACE_PROBABILITY) {
    // Silent: the preterite remains submerged
    return {
      surfaced: false,
      fragments: [],
      roll
    };
  }

  try {
    const db = getSharedPool();

    // Retrieve random preterite memories
    const result = await db.query(
      `SELECT
        id,
        content,
        preterite_reason,
        original_score,
        consigned_at
      FROM preterite_memories
      WHERE persona_id = $1 AND user_id = $2
      ORDER BY RANDOM()
      LIMIT $3`,
      [personaId, userId, maxFragments]
    );

    if (result.rows.length === 0) {
      return {
        surfaced: false,
        fragments: [],
        roll
      };
    }

    // Corrupt each fragment
    const fragments = result.rows.map(row => ({
      id: row.id,
      original: row.content,
      corrupted: corruptFragment(row.content),
      reason: row.preterite_reason,
      consignedAt: row.consigned_at
    }));

    // Update surface count (fire-and-forget)
    const ids = result.rows.map(r => r.id);
    db.query(
      `UPDATE preterite_memories
       SET surface_count = surface_count + 1,
           last_surfaced = NOW()
       WHERE id = ANY($1)`,
      [ids]
    ).catch(() => {});

    // Log the surfacing
    logOperation('preterite_surface', {
      personaId,
      userId,
      details: {
        roll,
        fragments_surfaced: fragments.length,
        reasons: fragments.map(f => f.reason)
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return {
      surfaced: true,
      fragments,
      roll
    };

  } catch (error) {
    console.error('[PreteriteMemory] Error surfacing preterite:', error.message);

    logOperation('error_graceful', {
      personaId,
      userId,
      details: {
        error_type: 'preterite_surface_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    return {
      surfaced: false,
      fragments: [],
      roll
    };
  }
}

// =============================================================================
// Fragment Corruption
// =============================================================================

/**
 * Apply entropy to a memory fragment.
 * Creates a corrupted, fragmentary version.
 *
 * @param {string} content - Original memory content
 * @returns {string} Corrupted fragment
 *
 * @example
 * corruptFragment("They asked about philosophy and I explained Hegel's dialectic")
 * // Returns: "...you asked about [...] and I said something about fire... or was it [...] the memory corrupts at the edges..."
 */
export function corruptFragment(content) {
  if (!content || content.length < 10) {
    return `${CORRUPTION_PATTERNS.ELLIPSIS_PREFIX}something${CORRUPTION_PATTERNS.ELLIPSIS_SUFFIX}`;
  }

  const words = content.split(/\s+/);
  const corrupted = [];

  // Start with ellipsis
  corrupted.push(CORRUPTION_PATTERNS.ELLIPSIS_PREFIX);

  // Process words with random corruption
  let lastWasRedacted = false;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const roll = Math.random();

    // 30% chance to redact a word
    if (roll < 0.3 && !lastWasRedacted) {
      corrupted.push(CORRUPTION_PATTERNS.REDACTION);
      lastWasRedacted = true;
      continue;
    }

    // 15% chance to replace with uncertainty
    if (roll < 0.45 && words.length > 5) {
      const uncertainty = CORRUPTION_PATTERNS.UNCERTAINTY_MARKERS[
        Math.floor(Math.random() * CORRUPTION_PATTERNS.UNCERTAINTY_MARKERS.length)
      ];
      corrupted.push(`${uncertainty}`);
      lastWasRedacted = false;
      continue;
    }

    // 10% chance to scramble (swap with next)
    if (roll < 0.55 && i < words.length - 1 && Math.random() < 0.5) {
      corrupted.push(words[i + 1]);
      corrupted.push(word);
      i++; // Skip next word
      lastWasRedacted = false;
      continue;
    }

    // Keep word
    corrupted.push(word);
    lastWasRedacted = false;
  }

  // Truncate if too long
  if (corrupted.length > 20) {
    corrupted.splice(15);
    corrupted.push(CORRUPTION_PATTERNS.ELLIPSIS_SUFFIX);
    corrupted.push('the memory corrupts at the edges');
    corrupted.push(CORRUPTION_PATTERNS.ELLIPSIS_SUFFIX);
  } else {
    corrupted.push(CORRUPTION_PATTERNS.ELLIPSIS_SUFFIX);
  }

  return corrupted.join(' ').replace(/\s+/g, ' ').trim();
}

// =============================================================================
// Context Framing
// =============================================================================

/**
 * Frame preterite surface result for context injection.
 * Creates natural language framing for surfaced fragments.
 *
 * @param {Object} surfaceResult - Result from attemptSurface
 * @returns {string} Framed context or empty string
 *
 * @example
 * framePreteriteContext({ surfaced: true, fragments: [...] })
 * // Returns: "Something surfaces. Half-remembered. Possibly imagined.\n...you asked about [...] and I said..."
 */
export function framePreteriteContext(surfaceResult) {
  if (!surfaceResult || !surfaceResult.surfaced || !surfaceResult.fragments?.length) {
    return '';
  }

  // Select random frame
  const frame = SURFACE_FRAMES[Math.floor(Math.random() * SURFACE_FRAMES.length)];

  // Build output
  const lines = [frame, ''];

  for (const fragment of surfaceResult.fragments) {
    lines.push(`"${fragment.corrupted}"`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

// =============================================================================
// Batch Classification
// =============================================================================

/**
 * Classify and potentially consign a batch of memories.
 * Used during memory extraction to separate elect from preterite.
 *
 * @param {Array<Object>} memories - Memories to classify
 * @returns {Promise<Object>} Classification results
 * @returns {Array<Object>} result.elect - Memories to remember
 * @returns {Array<Object>} result.borderline - Memories that might be remembered
 * @returns {Array<Object>} result.preterite - Memories passed over
 */
export async function classifyBatch(memories) {
  const startTime = performance.now();

  const results = {
    elect: [],
    borderline: [],
    preterite: []
  };

  if (!memories || memories.length === 0) {
    return results;
  }

  for (const memory of memories) {
    const classification = classifyMemoryElection(memory);

    switch (classification.status) {
      case ELECTION_STATUS.ELECT:
        results.elect.push({ ...memory, election: classification });
        break;
      case ELECTION_STATUS.BORDERLINE:
        results.borderline.push({ ...memory, election: classification });
        break;
      case ELECTION_STATUS.PRETERITE:
        results.preterite.push({ ...memory, election: classification });
        // Consign to preterite table (fire-and-forget)
        if (memory.id) {
          consignToPreterite(memory, classification.reason).catch(() => {});
        }
        break;
    }
  }

  // Log batch classification
  logOperation('preterite_classification', {
    details: {
      total_memories: memories.length,
      elect_count: results.elect.length,
      borderline_count: results.borderline.length,
      preterite_count: results.preterite.length,
      preterite_reasons: results.preterite.map(m => m.election.reason)
    },
    durationMs: performance.now() - startTime,
    success: true
  }).catch(() => {});

  return results;
}

// =============================================================================
// Configuration Export
// =============================================================================

/**
 * Configuration object for external access.
 */
export const CONFIG = {
  ELECTION_THRESHOLDS,
  ELECTION_STATUS,
  PRETERITE_REASONS,
  SURFACE_PROBABILITY,
  SURFACE_FRAMES,
  CORRUPTION_PATTERNS
};
