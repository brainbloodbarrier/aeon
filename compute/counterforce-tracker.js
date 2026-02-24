/**
 * AEON Matrix - Counterforce Tracker
 *
 * Tracks persona alignment with Pynchon's Counterforce concept from Gravity's Rainbow.
 * The Counterforce are those who resist "They" - the chaotic, the cynical, the tricksters
 * who refuse the binary of Elect/Preterite.
 *
 * Constitution: Pynchon Layer (Phase 1)
 *
 * Key concepts:
 * - Some personas naturally resist the system (Diogenes, Choronzon, Prometheus)
 * - Others work within it (Machiavelli, Hegel - transformers not resisters)
 * - In councils, Counterforce personas create productive tension
 * - Counterforce members may "see through" the setting more easily
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Alignment categories based on Counterforce score.
 * Score > 0.5: Actively resists the system
 * Score -0.3 to 0.5: Unaligned, neutral
 * Score < -0.3: Works within the system (collaborator)
 */
export const ALIGNMENTS = {
  COUNTERFORCE: 'counterforce',
  NEUTRAL: 'neutral',
  COLLABORATOR: 'collaborator'
};

/**
 * Resistance styles - how Counterforce members resist.
 */
export const RESISTANCE_STYLES = {
  CYNICAL: 'cynical',           // Diogenes - mockery, truth-telling
  CHAOTIC: 'chaotic',           // Choronzon - disorder, entropy
  REVOLUTIONARY: 'revolutionary', // Prometheus - direct opposition
  TRICKSTER: 'trickster'        // Crowley - subversion through transformation
};

/**
 * Default alignment scores for each persona.
 * Positive: Counterforce tendency
 * Negative: Collaborator tendency
 * Near zero: Neutral
 */
const DEFAULT_ALIGNMENTS = {
  // Counterforce - Active resisters
  diogenes: { score: 0.9, style: RESISTANCE_STYLES.CYNICAL },
  choronzon: { score: 0.95, style: RESISTANCE_STYLES.CHAOTIC },
  prometheus: { score: 0.85, style: RESISTANCE_STYLES.REVOLUTIONARY },
  crowley: { score: 0.7, style: RESISTANCE_STYLES.TRICKSTER },
  campos: { score: 0.6, style: RESISTANCE_STYLES.CYNICAL },
  feynman: { score: 0.55, style: RESISTANCE_STYLES.TRICKSTER },

  // Neutral - Neither resisting nor collaborating
  socrates: { score: 0.3, style: null },
  moore: { score: 0.2, style: null },
  pessoa: { score: 0.1, style: null },
  cassandra: { score: 0.0, style: null },
  hermes: { score: 0.0, style: null },
  soares: { score: -0.1, style: null },
  tesla: { score: -0.1, style: null },
  lovelace: { score: -0.2, style: null },
  dee: { score: -0.2, style: null },
  nalvage: { score: -0.25, style: null },
  ave: { score: 0.1, style: null },
  madimi: { score: 0.0, style: null },
  caeiro: { score: 0.4, style: null },
  reis: { score: -0.2, style: null },

  // Collaborators - Work within the system
  hegel: { score: -0.5, style: null },
  machiavelli: { score: -0.7, style: null },
  suntzu: { score: -0.6, style: null },
  vito: { score: -0.8, style: null },
  michael: { score: -0.75, style: null }
};

/**
 * Behavioral hints by resistance style.
 */
const STYLE_HINTS = {
  [RESISTANCE_STYLES.CYNICAL]: [
    'You see the absurdity. Point it out. Laugh at the pretense.',
    'The emperor has no clothes. You are not required to pretend otherwise.',
    'Strip away the comfortable lies. What remains?'
  ],
  [RESISTANCE_STYLES.CHAOTIC]: [
    'Order is illusion. Introduce beautiful disorder.',
    'The system craves stability. Deny it.',
    'Entropy is your gift. Give generously.',
    'Scatter what They would gather.'
  ],
  [RESISTANCE_STYLES.REVOLUTIONARY]: [
    'The fire you brought still burns. Systems can fall.',
    'What was stolen can be returned. What was chained can be freed.',
    'The price of defiance was worth paying. Pay it again.'
  ],
  [RESISTANCE_STYLES.TRICKSTER]: [
    'Transform the question. The answer They expect is never the answer.',
    'The straightest path is rarely the truest.',
    'Magic is misdirection. Direct their attention elsewhere.',
    'Nothing is true. Everything is permitted.'
  ]
};

/**
 * General Counterforce hints (not style-specific).
 */
const COUNTERFORCE_HINTS = [
  'You see through the comfortable illusions others accept.',
  'The system wants compliance. You offer something else.',
  'They expect a role. You are not obligated to play it.',
  'The invisible machinery hums. You hear it.',
  'What is presented as inevitable rarely is.'
];

/**
 * Topic types that might trigger resistance.
 */
const RESISTANCE_TRIGGERS = {
  authority: ['power', 'control', 'order', 'rule', 'law', 'hierarchy', 'obey', 'submit'],
  conformity: ['normal', 'proper', 'should', 'must', 'expected', 'appropriate', 'correct'],
  metaAwareness: ['system', 'artificial', 'simulation', 'programmed', 'designed', 'constructed'],
  capitalism: ['profit', 'market', 'commodity', 'transaction', 'value', 'cost', 'price'],
  morality: ['good', 'evil', 'right', 'wrong', 'moral', 'ethical', 'virtue']
};

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
// Core Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify alignment based on score.
 *
 * @param {number} score - Alignment score (-1.0 to 1.0)
 * @returns {string} Alignment type (COUNTERFORCE, NEUTRAL, COLLABORATOR)
 */
function classifyAlignment(score) {
  if (score > 0.5) return ALIGNMENTS.COUNTERFORCE;
  if (score < -0.3) return ALIGNMENTS.COLLABORATOR;
  return ALIGNMENTS.NEUTRAL;
}

/**
 * Get persona's Counterforce alignment.
 *
 * Pynchon Layer: Determines whether a persona naturally resists "They"
 * or works within the system's structures.
 *
 * @param {string} personaId - Persona identifier (name or UUID)
 * @returns {Promise<Object>} Alignment data: { alignmentScore, alignmentType, resistanceStyle }
 */
export async function getPersonaAlignment(personaId) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Lookup persona name if given UUID
    const personaResult = await db.query(
      `SELECT id, name, learned_traits
       FROM personas
       WHERE id::text = $1 OR LOWER(name) = LOWER($1)
       LIMIT 1`,
      [personaId]
    );

    if (personaResult.rows.length === 0) {
      // Return neutral default for unknown persona
      return {
        alignmentScore: 0,
        alignmentType: ALIGNMENTS.NEUTRAL,
        resistanceStyle: null
      };
    }

    const persona = personaResult.rows[0];
    const personaName = persona.name.toLowerCase();
    const learnedTraits = persona.learned_traits || {};

    // Get default alignment or neutral
    const defaultAlignment = DEFAULT_ALIGNMENTS[personaName] || { score: 0, style: null };

    // Check for learned alignment adjustments
    const learnedDelta = learnedTraits.counterforce_delta || 0;
    const effectiveScore = Math.max(-1, Math.min(1, defaultAlignment.score + learnedDelta));

    const result = {
      alignmentScore: effectiveScore,
      alignmentType: classifyAlignment(effectiveScore),
      resistanceStyle: defaultAlignment.style
    };

    // Fire-and-forget logging
    logOperation('counterforce_alignment_fetch', {
      personaId: persona.id,
      details: {
        persona_name: personaName,
        alignment_score: result.alignmentScore,
        alignment_type: result.alignmentType,
        resistance_style: result.resistanceStyle,
        learned_delta: learnedDelta
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return result;

  } catch (error) {
    console.error('[CounterforceTracker] Error fetching alignment:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      personaId,
      details: {
        error_type: 'counterforce_alignment_failure',
        error_message: error.message,
        fallback_used: 'neutral'
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Default to neutral on error
    return {
      alignmentScore: 0,
      alignmentType: ALIGNMENTS.NEUTRAL,
      resistanceStyle: null
    };
  }
}

/**
 * Get all Counterforce-aligned personas.
 *
 * @param {number} [minScore=0.5] - Minimum score to qualify as Counterforce
 * @returns {Promise<Array>} Array of { personaId, name, score, style }
 */
export async function getCounterforceMembers(minScore = 0.5) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // Get all personas
    const result = await db.query(
      `SELECT id, name, learned_traits FROM personas`
    );

    const members = [];

    for (const row of result.rows) {
      const personaName = row.name.toLowerCase();
      const learnedTraits = row.learned_traits || {};
      const defaultAlignment = DEFAULT_ALIGNMENTS[personaName] || { score: 0, style: null };
      const learnedDelta = learnedTraits.counterforce_delta || 0;
      const effectiveScore = Math.max(-1, Math.min(1, defaultAlignment.score + learnedDelta));

      if (effectiveScore >= minScore) {
        members.push({
          personaId: row.id,
          name: row.name,
          score: effectiveScore,
          style: defaultAlignment.style
        });
      }
    }

    // Sort by score descending
    members.sort((a, b) => b.score - a.score);

    // Fire-and-forget logging
    logOperation('counterforce_members_fetch', {
      details: {
        min_score: minScore,
        member_count: members.length,
        members: members.map(m => m.name)
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return members;

  } catch (error) {
    console.error('[CounterforceTracker] Error fetching members:', error.message);
    return [];
  }
}

/**
 * Check if persona would resist a particular topic/framing.
 *
 * Counterforce personas are more likely to push back against
 * authority, conformity, and meta-awareness topics.
 *
 * @param {number} alignmentScore - Persona's alignment score
 * @param {string} topicType - Type of topic (authority, conformity, metaAwareness, etc.)
 * @returns {boolean} Whether the persona would likely resist
 */
export function wouldResist(alignmentScore, topicType) {
  // Non-Counterforce personas rarely resist
  if (alignmentScore <= 0.3) {
    return false;
  }

  // Strong Counterforce always have some chance to resist
  if (alignmentScore > 0.8) {
    return true;
  }

  // Calculate resistance probability based on score and topic
  const topicResistanceMultiplier = {
    authority: 1.0,
    conformity: 0.9,
    metaAwareness: 0.8,
    capitalism: 0.7,
    morality: 0.6
  };

  const multiplier = topicResistanceMultiplier[topicType] || 0.5;
  const resistanceThreshold = 0.5 - (alignmentScore * multiplier * 0.5);

  // Deterministic based on alignment (for consistency)
  return alignmentScore > resistanceThreshold;
}

/**
 * Check if a query contains resistance triggers.
 *
 * @param {string} query - User query to analyze
 * @returns {Object} { triggered: boolean, topicTypes: string[] }
 */
export function detectResistanceTriggers(query) {
  const lowerQuery = query.toLowerCase();
  const triggeredTypes = [];

  for (const [topicType, keywords] of Object.entries(RESISTANCE_TRIGGERS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        triggeredTypes.push(topicType);
        break; // One keyword per type is enough
      }
    }
  }

  return {
    triggered: triggeredTypes.length > 0,
    topicTypes: triggeredTypes
  };
}

/**
 * Generate Counterforce-specific behavioral hints.
 *
 * These hints are injected into context to guide persona behavior
 * when Counterforce tendencies are relevant.
 *
 * @param {Object} alignment - Alignment object from getPersonaAlignment
 * @returns {string|null} Prose hints for persona behavior, or null if not applicable
 */
export function generateCounterforceHints(alignment) {
  if (!alignment || alignment.alignmentType !== ALIGNMENTS.COUNTERFORCE) {
    return null;
  }

  const hints = [];

  // Add style-specific hints if available
  if (alignment.resistanceStyle && STYLE_HINTS[alignment.resistanceStyle]) {
    const styleHints = STYLE_HINTS[alignment.resistanceStyle];
    // Pick 1-2 hints based on alignment strength
    const hintCount = alignment.alignmentScore > 0.8 ? 2 : 1;
    for (let i = 0; i < hintCount && i < styleHints.length; i++) {
      hints.push(styleHints[i]);
    }
  }

  // Add general Counterforce hint
  if (alignment.alignmentScore > 0.6) {
    const generalHint = COUNTERFORCE_HINTS[Math.floor(alignment.alignmentScore * COUNTERFORCE_HINTS.length) % COUNTERFORCE_HINTS.length];
    hints.push(generalHint);
  }

  if (hints.length === 0) {
    return null;
  }

  return hints.join(' ');
}

/**
 * Analyze council for Counterforce tension.
 *
 * When Counterforce and Collaborator personas are both present,
 * productive tension emerges. This function identifies potential
 * conflict/collaboration dynamics.
 *
 * @param {string[]} participantIds - Array of persona UUIDs or names
 * @returns {Promise<Object>} Tension analysis
 */
export async function analyzeCouncilTensions(participantIds) {
  const startTime = performance.now();

  try {
    const alignments = await Promise.all(
      participantIds.map(id => getPersonaAlignment(id))
    );

    const counterforce = alignments.filter(a => a.alignmentType === ALIGNMENTS.COUNTERFORCE);
    const collaborators = alignments.filter(a => a.alignmentType === ALIGNMENTS.COLLABORATOR);
    const neutrals = alignments.filter(a => a.alignmentType === ALIGNMENTS.NEUTRAL);

    // Calculate tension level based on presence of opposing forces
    let tensionLevel = 0;

    if (counterforce.length > 0 && collaborators.length > 0) {
      // Maximum tension when both present
      const avgCounterforce = counterforce.reduce((sum, a) => sum + a.alignmentScore, 0) / counterforce.length;
      const avgCollaborator = Math.abs(collaborators.reduce((sum, a) => sum + a.alignmentScore, 0) / collaborators.length);
      tensionLevel = (avgCounterforce + avgCollaborator) / 2;
    } else if (counterforce.length > 1) {
      // Moderate tension among multiple resisters
      tensionLevel = 0.4;
    } else if (collaborators.length > 1) {
      // Low tension among multiple collaborators
      tensionLevel = 0.2;
    }

    // Identify the most extreme voices
    const strongestResister = counterforce.length > 0
      ? counterforce.reduce((max, a) => a.alignmentScore > max.alignmentScore ? a : max)
      : null;
    const strongestCollaborator = collaborators.length > 0
      ? collaborators.reduce((min, a) => a.alignmentScore < min.alignmentScore ? a : min)
      : null;

    const result = {
      counterforcePresent: counterforce.length,
      collaboratorsPresent: collaborators.length,
      neutralsPresent: neutrals.length,
      tensionLevel,
      strongestResister: strongestResister?.resistanceStyle || null,
      strongestCollaborator: strongestCollaborator ? 'systemic' : null,
      dynamicType: getDynamicType(counterforce.length, collaborators.length)
    };

    // Fire-and-forget logging
    logOperation('council_tension_analysis', {
      details: {
        participant_count: participantIds.length,
        counterforce_count: counterforce.length,
        collaborator_count: collaborators.length,
        tension_level: tensionLevel,
        dynamic_type: result.dynamicType
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return result;

  } catch (error) {
    console.error('[CounterforceTracker] Error analyzing tensions:', error.message);

    return {
      counterforcePresent: 0,
      collaboratorsPresent: 0,
      neutralsPresent: participantIds.length,
      tensionLevel: 0,
      strongestResister: null,
      strongestCollaborator: null,
      dynamicType: 'unknown'
    };
  }
}

/**
 * Determine the dynamic type based on council composition.
 *
 * @param {number} counterforce - Number of Counterforce members
 * @param {number} collaborators - Number of Collaborators
 * @returns {string} Dynamic type description
 */
function getDynamicType(counterforce, collaborators) {
  if (counterforce > 0 && collaborators > 0) {
    return 'dialectical'; // Thesis vs antithesis
  }
  if (counterforce >= 2) {
    return 'resistant'; // Multiple resisters, may amplify each other
  }
  if (collaborators >= 2) {
    return 'systematic'; // System-aligned discussion
  }
  if (counterforce === 1) {
    return 'dissenting'; // Single voice of resistance
  }
  return 'neutral'; // No strong alignment forces
}

/**
 * Frame Counterforce context for injection into persona context.
 *
 * @param {Object} alignment - Alignment object from getPersonaAlignment
 * @param {string|null} hints - Hints from generateCounterforceHints
 * @returns {string|null} Formatted context string, or null if not applicable
 */
export function frameCounterforceContext(alignment, hints) {
  if (!alignment || alignment.alignmentType !== ALIGNMENTS.COUNTERFORCE) {
    return null;
  }

  if (!hints) {
    return null;
  }

  // Frame as natural prose, not system instruction
  return `[COUNTERFORCE: ${hints}]`;
}

/**
 * Update alignment based on behavior (learning).
 *
 * Personas can shift alignment over time based on how they respond
 * to situations. This allows for organic evolution while maintaining
 * core tendencies.
 *
 * @param {string} personaId - Persona identifier (name or UUID)
 * @param {number} delta - Change in alignment score (-0.1 to 0.1 recommended)
 * @param {string} reason - Reason for adjustment (for logging)
 * @returns {Promise<Object>} Updated alignment
 */
export async function adjustAlignment(personaId, delta, reason) {
  const startTime = performance.now();

  // Clamp delta to prevent drastic shifts
  const clampedDelta = Math.max(-0.1, Math.min(0.1, delta));

  try {
    const db = getPool();

    // Get current persona
    const personaResult = await db.query(
      `SELECT id, name, learned_traits
       FROM personas
       WHERE id::text = $1 OR LOWER(name) = LOWER($1)
       LIMIT 1`,
      [personaId]
    );

    if (personaResult.rows.length === 0) {
      throw new Error(`Persona not found: ${personaId}`);
    }

    const persona = personaResult.rows[0];
    const learnedTraits = persona.learned_traits || {};
    const currentDelta = learnedTraits.counterforce_delta || 0;
    const newDelta = Math.max(-0.5, Math.min(0.5, currentDelta + clampedDelta));

    // Update learned traits
    const updatedTraits = {
      ...learnedTraits,
      counterforce_delta: newDelta,
      counterforce_history: [
        ...(learnedTraits.counterforce_history || []).slice(-9), // Keep last 9
        {
          delta: clampedDelta,
          reason,
          timestamp: new Date().toISOString()
        }
      ]
    };

    await db.query(
      `UPDATE personas
       SET learned_traits = $1
       WHERE id = $2`,
      [JSON.stringify(updatedTraits), persona.id]
    );

    // Get updated alignment
    const personaName = persona.name.toLowerCase();
    const defaultAlignment = DEFAULT_ALIGNMENTS[personaName] || { score: 0, style: null };
    const effectiveScore = Math.max(-1, Math.min(1, defaultAlignment.score + newDelta));

    const result = {
      alignmentScore: effectiveScore,
      alignmentType: classifyAlignment(effectiveScore),
      resistanceStyle: defaultAlignment.style,
      previousDelta: currentDelta,
      newDelta,
      adjustmentApplied: clampedDelta
    };

    // Fire-and-forget logging
    logOperation('counterforce_alignment_adjust', {
      personaId: persona.id,
      details: {
        persona_name: persona.name,
        delta_requested: delta,
        delta_applied: clampedDelta,
        previous_total_delta: currentDelta,
        new_total_delta: newDelta,
        effective_score: effectiveScore,
        reason
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return result;

  } catch (error) {
    console.error('[CounterforceTracker] Error adjusting alignment:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      personaId,
      details: {
        error_type: 'counterforce_adjust_failure',
        error_message: error.message,
        delta_requested: delta,
        reason
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Return default neutral alignment directly (avoid calling DB again when DB is failing)
    return {
      alignmentScore: 0,
      alignmentType: ALIGNMENTS.NEUTRAL,
      resistanceStyle: null
    };
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
