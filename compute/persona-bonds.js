/**
 * AEON Matrix - Persona Bonds
 *
 * Manages persona-to-persona relationships: retrieval, creation, and updates.
 * All queries are bidirectional — if persona A has a bond with B,
 * querying from either direction returns the relationship.
 *
 * Feature: Issue #37 - Persona-to-persona bonds
 * Constitution: Principle VI (Persona Relationships)
 *
 * @module compute/persona-bonds
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';

/**
 * Get all bonds for a persona (both directions).
 *
 * @param {string} personaName - Persona name to look up
 * @returns {Promise<Array|null>} Array of bond objects, or null on error
 */
export async function getBonds(personaName) {
  const start = Date.now();
  try {
    const pool = getSharedPool();
    const result = await pool.query(
      `SELECT * FROM persona_relationships
       WHERE persona_a = $1 OR persona_b = $1
       ORDER BY strength DESC`,
      [personaName]
    );

    await logOperation('persona_bonds_get_all', {
      details: { persona: personaName, count: result.rows.length },
      durationMs: Date.now() - start
    });

    return result.rows;
  } catch (error) {
    await logOperation('persona_bonds_get_all', {
      details: { persona: personaName, error: error.message },
      durationMs: Date.now() - start,
      success: false
    });
    return null;
  }
}

/**
 * Get the specific relationship(s) between two personas.
 *
 * @param {string} personaA - First persona name
 * @param {string} personaB - Second persona name
 * @returns {Promise<Array|null>} Array of bond objects between the two, or null on error
 */
export async function getBondBetween(personaA, personaB) {
  const start = Date.now();
  try {
    const pool = getSharedPool();
    const result = await pool.query(
      `SELECT * FROM persona_relationships
       WHERE (persona_a = $1 AND persona_b = $2)
          OR (persona_a = $2 AND persona_b = $1)
       ORDER BY strength DESC`,
      [personaA, personaB]
    );

    await logOperation('persona_bonds_get_between', {
      details: { personaA, personaB, count: result.rows.length },
      durationMs: Date.now() - start
    });

    return result.rows;
  } catch (error) {
    await logOperation('persona_bonds_get_between', {
      details: { personaA, personaB, error: error.message },
      durationMs: Date.now() - start,
      success: false
    });
    return null;
  }
}

/**
 * Create or update a bond between two personas.
 *
 * @param {string} personaA - First persona name
 * @param {string} personaB - Second persona name
 * @param {string} type - Relationship type (e.g. 'creator', 'ally', 'father_son')
 * @param {number} strength - Bond strength (0.0 - 1.0)
 * @param {string|null} [context=null] - Optional context description
 * @returns {Promise<Object|null>} The upserted bond object, or null on error
 */
export async function updateBond(personaA, personaB, type, strength, context = null) {
  const start = Date.now();
  try {
    const pool = getSharedPool();
    const result = await pool.query(
      `INSERT INTO persona_relationships (persona_a, persona_b, relationship_type, strength, context)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (persona_a, persona_b, relationship_type)
       DO UPDATE SET strength = $4, context = $5, updated_at = NOW()
       RETURNING *`,
      [personaA, personaB, type, strength, context]
    );

    await logOperation('persona_bonds_update', {
      details: { personaA, personaB, type, strength },
      durationMs: Date.now() - start
    });

    return result.rows[0] || null;
  } catch (error) {
    await logOperation('persona_bonds_update', {
      details: { personaA, personaB, type, error: error.message },
      durationMs: Date.now() - start,
      success: false
    });
    return null;
  }
}

/**
 * Get the strongest bonds for a persona, limited to top N.
 *
 * @param {string} personaName - Persona name to look up
 * @param {number} [limit=5] - Maximum number of bonds to return
 * @returns {Promise<Array|null>} Array of top bond objects, or null on error
 */
export async function getStrongestBonds(personaName, limit = 5) {
  const start = Date.now();
  try {
    const pool = getSharedPool();
    const result = await pool.query(
      `SELECT * FROM persona_relationships
       WHERE persona_a = $1 OR persona_b = $1
       ORDER BY strength DESC
       LIMIT $2`,
      [personaName, limit]
    );

    await logOperation('persona_bonds_strongest', {
      details: { persona: personaName, limit, count: result.rows.length },
      durationMs: Date.now() - start
    });

    return result.rows;
  } catch (error) {
    await logOperation('persona_bonds_strongest', {
      details: { persona: personaName, limit, error: error.message },
      durationMs: Date.now() - start,
      success: false
    });
    return null;
  }
}
