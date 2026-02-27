/**
 * AEON Matrix - Persona Relationship Tracker
 *
 * Tracks relationships between personas independent of users.
 * The voices at O Fim know each other, have history, form bonds.
 *
 * Feature: 007-persona-autonomy
 * Constitution: Principle VI (Persona Autonomy)
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import {
  AFFINITY_THRESHOLDS,
  MAX_AFFINITY_DELTA
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// Re-export constants for backward compatibility
// ═══════════════════════════════════════════════════════════════════════════

export { AFFINITY_THRESHOLDS, MAX_AFFINITY_DELTA };

/**
 * Initial affinity values based on persona category relationships.
 */
export const CATEGORY_AFFINITIES = {
  // Same category: natural colleagues
  sameCategory: 0.3,

  // Cross-category affinities (bidirectional)
  'philosophers:philosophers': 0.4,      // Deep intellectual kinship
  'philosophers:strategists': -0.1,      // Method tension
  'philosophers:scientists': 0.2,        // Shared empiricism
  'philosophers:heteronyms': 0.3,        // Literary-philosophical bond
  'philosophers:magicians': 0.0,         // Neutral curiosity
  'philosophers:enochian': 0.0,          // Otherworldly distance

  'strategists:strategists': 0.3,        // Professional respect
  'strategists:scientists': 0.2,         // Applied methodology
  'strategists:heteronyms': -0.1,        // Pragmatism vs introspection
  'strategists:magicians': 0.1,          // Power recognizes power
  'strategists:enochian': 0.0,           // Otherworldly distance

  'scientists:scientists': 0.4,          // Method alignment
  'scientists:heteronyms': 0.1,          // Observation kinship
  'scientists:magicians': -0.2,          // Empiricism vs mysticism
  'scientists:enochian': -0.1,           // Rationality strain

  'heteronyms:heteronyms': 0.6,          // Pessoan literary bond
  'heteronyms:magicians': 0.2,           // Artistic sympathy
  'heteronyms:enochian': 0.1,            // Mystical appreciation

  'magicians:magicians': 0.3,            // Occult fellowship
  'magicians:enochian': 0.4,             // Spiritual connection

  'enochian:enochian': 0.5               // Celestial kinship
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
// Relationship Type Calculation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate relationship type from affinity score.
 *
 * @param {number} affinityScore - Affinity score -1.0 to 1.0
 * @returns {'adversary' | 'rival' | 'neutral' | 'colleague' | 'ally'} Relationship type
 */
export function calculateRelationshipType(affinityScore) {
  if (affinityScore >= AFFINITY_THRESHOLDS.ally) return 'ally';
  if (affinityScore >= AFFINITY_THRESHOLDS.colleague) return 'colleague';
  if (affinityScore <= AFFINITY_THRESHOLDS.adversary) return 'adversary';
  if (affinityScore <= AFFINITY_THRESHOLDS.rival) return 'rival';
  return 'neutral';
}

/**
 * Get initial affinity for a category pair.
 *
 * @param {string} categoryA - First persona category
 * @param {string} categoryB - Second persona category
 * @returns {number} Initial affinity score
 */
export function getInitialAffinity(categoryA, categoryB) {
  // Same category
  if (categoryA === categoryB) {
    return CATEGORY_AFFINITIES.sameCategory;
  }

  // Try both orderings
  const key1 = `${categoryA}:${categoryB}`;
  const key2 = `${categoryB}:${categoryA}`;

  if (key1 in CATEGORY_AFFINITIES) {
    return CATEGORY_AFFINITIES[key1];
  }
  if (key2 in CATEGORY_AFFINITIES) {
    return CATEGORY_AFFINITIES[key2];
  }

  // Default to neutral
  return 0.0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Relationship Operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get relationship between two personas.
 *
 * @param {string} personaAId - First persona UUID or name
 * @param {string} personaBId - Second persona UUID or name
 * @returns {Promise<Object|null>} Relationship object or null
 */
export async function getPersonaRelationship(personaAId, personaBId) {
  const startTime = performance.now();

  try {
    const db = getPool();

    const result = await db.query(`
      SELECT
        pr.*,
        pa.name as persona_a_name,
        pa.category as persona_a_category,
        pb.name as persona_b_name,
        pb.category as persona_b_category
      FROM persona_relationships pr
      JOIN personas pa ON pr.persona_a_id = pa.id
      JOIN personas pb ON pr.persona_b_id = pb.id
      WHERE (
        (pa.id::text = $1 OR LOWER(pa.name) = LOWER($1))
        AND (pb.id::text = $2 OR LOWER(pb.name) = LOWER($2))
      ) OR (
        (pa.id::text = $2 OR LOWER(pa.name) = LOWER($2))
        AND (pb.id::text = $1 OR LOWER(pb.name) = LOWER($1))
      )
      LIMIT 1
    `, [personaAId, personaBId]);

    await logOperation('persona_relationship_fetch', {
      details: {
        persona_a: personaAId,
        persona_b: personaBId,
        found: result.rows.length > 0
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return result.rows[0] || null;
  } catch (error) {
    console.error('[PersonaRelationshipTracker] Error fetching relationship:', error.message);
    await logOperation('persona_relationship_fetch', {
      details: { persona_a: personaAId, persona_b: personaBId, error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });
    return null;
  }
}

/**
 * Ensure a relationship exists between two personas.
 * Creates with initial affinity based on categories if not exists.
 *
 * @param {string} personaAId - First persona UUID
 * @param {string} personaBId - Second persona UUID
 * @returns {Promise<Object>} Relationship object
 */
export async function ensurePersonaRelationship(personaAId, personaBId) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // First, get persona categories for initial affinity
    const personasResult = await db.query(`
      SELECT id, name, category
      FROM personas
      WHERE id = $1 OR id = $2
    `, [personaAId, personaBId]);

    if (personasResult.rows.length < 2) {
      throw new Error('One or both personas not found');
    }

    const personaA = personasResult.rows.find(p => p.id === personaAId);
    const personaB = personasResult.rows.find(p => p.id === personaBId);

    const initialAffinity = getInitialAffinity(personaA.category, personaB.category);
    const initialType = calculateRelationshipType(initialAffinity);

    // Upsert relationship
    const result = await db.query(`
      INSERT INTO persona_relationships (
        persona_a_id, persona_b_id, affinity_score, relationship_type
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (persona_a_id, persona_b_id) DO UPDATE
      SET updated_at = NOW()
      RETURNING *
    `, [personaAId, personaBId, initialAffinity, initialType]);

    await logOperation('persona_relationship_ensure', {
      details: {
        persona_a: personaA.name,
        persona_b: personaB.name,
        initial_affinity: initialAffinity,
        initial_type: initialType
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return {
      ...result.rows[0],
      persona_a_name: personaA.name,
      persona_b_name: personaB.name,
      persona_a_category: personaA.category,
      persona_b_category: personaB.category
    };
  } catch (error) {
    console.error('[PersonaRelationshipTracker] Error ensuring relationship:', error.message);
    throw error;
  }
}

/**
 * Update affinity between two personas.
 *
 * @param {string} personaAId - First persona UUID
 * @param {string} personaBId - Second persona UUID
 * @param {number} delta - Affinity change (-1.0 to 1.0)
 * @param {string} [context] - What prompted this change
 * @returns {Promise<Object>} Updated relationship with type change info
 */
export async function updatePersonaAffinity(personaAId, personaBId, delta, context = null) {
  const startTime = performance.now();

  // Clamp delta to max change
  const clampedDelta = Math.max(-MAX_AFFINITY_DELTA, Math.min(MAX_AFFINITY_DELTA, delta));

  try {
    const db = getPool();

    // Use database function for atomic update
    const result = await db.query(`
      SELECT * FROM update_persona_affinity($1, $2, $3, $4)
    `, [personaAId, personaBId, clampedDelta, context]);

    const updated = result.rows[0];

    await logOperation('persona_affinity_update', {
      details: {
        persona_a: personaAId,
        persona_b: personaBId,
        delta: clampedDelta,
        new_affinity: updated.new_affinity,
        relationship_type: updated.relationship_type,
        type_changed: updated.type_changed,
        context
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return {
      relationshipId: updated.relationship_id,
      newAffinity: updated.new_affinity,
      relationshipType: updated.relationship_type,
      typeChanged: updated.type_changed
    };
  } catch (error) {
    console.error('[PersonaRelationshipTracker] Error updating affinity:', error.message);
    await logOperation('persona_affinity_update', {
      details: { persona_a: personaAId, persona_b: personaBId, error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });
    throw error;
  }
}

/**
 * Get all relationships for a persona (their "network").
 *
 * @param {string} personaId - Persona UUID or name
 * @returns {Promise<Array<Object>>} Array of relationship objects
 */
export async function getPersonaNetwork(personaId) {
  const startTime = performance.now();

  try {
    const db = getPool();

    // First resolve persona UUID if name given
    const personaResult = await db.query(`
      SELECT id FROM personas
      WHERE id::text = $1 OR LOWER(name) = LOWER($1)
      LIMIT 1
    `, [personaId]);

    if (personaResult.rows.length === 0) {
      return [];
    }

    const resolvedId = personaResult.rows[0].id;

    // Use database function for network retrieval
    const result = await db.query(`
      SELECT * FROM get_persona_network($1)
    `, [resolvedId]);

    await logOperation('persona_network_fetch', {
      personaId: resolvedId,
      details: {
        connection_count: result.rows.length
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return result.rows.map(row => ({
      personaId: row.other_persona_id,
      personaName: row.other_persona_name,
      category: row.other_persona_category,
      relationshipType: row.relationship_type,
      affinityScore: row.affinity_score,
      interactionCount: row.interaction_count,
      summary: row.relationship_summary
    }));
  } catch (error) {
    console.error('[PersonaRelationshipTracker] Error fetching network:', error.message);
    await logOperation('persona_network_fetch', {
      personaId,
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });
    return [];
  }
}

/**
 * Get network summary for dashboard display.
 *
 * @param {string} personaId - Persona UUID or name
 * @returns {Promise<Object>} Network summary with counts
 */
export async function getPersonaNetworkSummary(personaId) {
  const network = await getPersonaNetwork(personaId);

  const summary = {
    totalConnections: network.length,
    allies: network.filter(r => r.relationshipType === 'ally').length,
    colleagues: network.filter(r => r.relationshipType === 'colleague').length,
    neutrals: network.filter(r => r.relationshipType === 'neutral').length,
    rivals: network.filter(r => r.relationshipType === 'rival').length,
    adversaries: network.filter(r => r.relationshipType === 'adversary').length,
    averageAffinity: network.length > 0
      ? network.reduce((sum, r) => sum + r.affinityScore, 0) / network.length
      : 0,
    strongestBond: network.reduce((max, r) =>
      r.affinityScore > (max?.affinityScore || -2) ? r : max, null),
    strongestRivalry: network.reduce((min, r) =>
      r.affinityScore < (min?.affinityScore || 2) ? r : min, null)
  };

  return summary;
}

// ═══════════════════════════════════════════════════════════════════════════
// Seeding
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Seed initial relationships between all personas based on categories.
 * Creates bidirectional relationships with initial affinity scores.
 *
 * @returns {Promise<{created: number, skipped: number}>} Seeding results
 */
export async function seedPersonaRelationships() {
  const startTime = performance.now();
  let created = 0;
  let skipped = 0;

  try {
    const db = getPool();

    // Get all personas
    const personasResult = await db.query(`
      SELECT id, name, category FROM personas ORDER BY name
    `);

    const personas = personasResult.rows;

    // Create relationships for each pair
    for (let i = 0; i < personas.length; i++) {
      for (let j = i + 1; j < personas.length; j++) {
        const personaA = personas[i];
        const personaB = personas[j];

        const initialAffinity = getInitialAffinity(personaA.category, personaB.category);
        const initialType = calculateRelationshipType(initialAffinity);

        try {
          const result = await db.query(`
            INSERT INTO persona_relationships (
              persona_a_id, persona_b_id, affinity_score, relationship_type
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (persona_a_id, persona_b_id) DO NOTHING
            RETURNING id
          `, [personaA.id, personaB.id, initialAffinity, initialType]);

          if (result.rows.length > 0) {
            created++;
          } else {
            skipped++;
          }
        } catch (err) {
          // Skip on conflict
          skipped++;
        }
      }
    }

    await logOperation('persona_relationships_seed', {
      details: {
        total_personas: personas.length,
        relationships_created: created,
        relationships_skipped: skipped,
        total_possible: (personas.length * (personas.length - 1)) / 2
      },
      durationMs: performance.now() - startTime,
      success: true
    });

    return { created, skipped };
  } catch (error) {
    console.error('[PersonaRelationshipTracker] Error seeding relationships:', error.message);
    await logOperation('persona_relationships_seed', {
      details: { error: error.message },
      durationMs: performance.now() - startTime,
      success: false
    });
    throw error;
  }
}

/**
 * Get relationship overview for all personas (dashboard).
 *
 * @returns {Promise<Array<Object>>} Array of persona network summaries
 */
export async function getRelationshipOverview() {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT * FROM persona_network_summary
      ORDER BY total_connections DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('[PersonaRelationshipTracker] Error fetching overview:', error.message);
    return [];
  }
}

/**
 * Get strong relationships (high affinity bonds) for operator attention.
 *
 * @returns {Promise<Array<Object>>} Array of strong relationship objects
 */
export async function getStrongRelationships() {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT * FROM strong_relationships
    `);

    return result.rows;
  } catch (error) {
    console.error('[PersonaRelationshipTracker] Error fetching strong relationships:', error.message);
    return [];
  }
}
