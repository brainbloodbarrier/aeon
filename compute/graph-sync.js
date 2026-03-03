/**
 * AEON Matrix - Graph Sync
 *
 * Syncs PostgreSQL data to Neo4j graph representation.
 * Creates nodes for personas and users, edges for relationships.
 * Uses UNWIND for batched Cypher operations.
 * All operations are fire-and-forget safe.
 */

import { getSharedPool } from './db-pool.js';
import { runCypher, getNeo4jDriver } from './neo4j-pool.js';
import { logOperation } from './operator-logger.js';
import { NEO4J_CONFIG } from './constants.js';

/**
 * Sync all personas from PostgreSQL to Neo4j nodes.
 * @returns {Promise<{synced: number}|null>}
 */
export async function syncPersonasToGraph() {
  try {
    const pool = getSharedPool();
    const result = await pool.query('SELECT id, name, category FROM personas');

    if (result.rows.length === 0) return { synced: 0 };

    const cyResult = await runCypher(
      `UNWIND $rows AS row
       MERGE (p:Persona {id: row.id})
       SET p.name = row.name, p.category = row.category`,
      { rows: result.rows.map(r => ({ id: r.id, name: r.name, category: r.category })) }
    );

    return { synced: cyResult ? result.rows.length : 0 };
  } catch (error) {
    console.error('[GraphSync] syncPersonasToGraph failed:', error.message);
    logOperation('error_graceful', {
      details: { error_type: 'graph_sync_personas', error_message: error.message },
      success: false
    }).catch(() => {});
    return null;
  }
}

/**
 * Sync a user's relationships to Neo4j edges.
 * @param {string} userId
 * @returns {Promise<{synced: number}|null>}
 */
export async function syncUserRelationshipsToGraph(userId) {
  try {
    const pool = getSharedPool();
    const result = await pool.query(
      `SELECT r.user_id, r.persona_id, r.trust_level, r.familiarity_score,
              r.interaction_count, p.name as persona_name
       FROM relationships r
       JOIN personas p ON p.id = r.persona_id
       WHERE r.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return { synced: 0 };

    const cyResult = await runCypher(
      `MERGE (u:User {id: $userId})
       WITH u
       UNWIND $rels AS rel
       MATCH (p:Persona {id: rel.personaId})
       MERGE (u)-[r:KNOWS]->(p)
       SET r.trust_level = rel.trust, r.familiarity = rel.fam, r.interactions = rel.count`,
      {
        userId,
        rels: result.rows.map(r => ({
          personaId: r.persona_id,
          trust: r.trust_level,
          fam: r.familiarity_score,
          count: r.interaction_count
        }))
      }
    );

    return { synced: cyResult ? result.rows.length : 0 };
  } catch (error) {
    console.error('[GraphSync] syncUserRelationshipsToGraph failed:', error.message);
    logOperation('error_graceful', {
      details: { error_type: 'graph_sync_user_rels', error_message: error.message, user_id: userId },
      success: false
    }).catch(() => {});
    return null;
  }
}

/**
 * Sync inter-persona relationships to Neo4j.
 * @returns {Promise<{synced: number}|null>}
 */
export async function syncPersonaRelationshipsToGraph() {
  try {
    const pool = getSharedPool();
    const result = await pool.query(
      `SELECT pb.persona_id_a, pb.persona_id_b, pb.affinity_score, pb.bond_type
       FROM persona_bonds pb`
    );

    if (result.rows.length === 0) return { synced: 0 };

    const cyResult = await runCypher(
      `UNWIND $bonds AS bond
       MATCH (a:Persona {id: bond.idA}), (b:Persona {id: bond.idB})
       MERGE (a)-[r:RELATES_TO]->(b)
       SET r.type = bond.type, r.strength = bond.strength`,
      {
        bonds: result.rows.map(r => ({
          idA: r.persona_id_a,
          idB: r.persona_id_b,
          type: r.bond_type || 'neutral',
          strength: r.affinity_score
        }))
      }
    );

    return { synced: cyResult ? result.rows.length : 0 };
  } catch (error) {
    // persona_bonds table may not exist if migration 014 hasn't run (42P01 = undefined_table)
    if (error.code === '42P01') {
      return { synced: 0 };
    }
    console.error('[GraphSync] syncPersonaRelationshipsToGraph failed:', error.message);
    logOperation('error_graceful', {
      details: { error_type: 'graph_sync_persona_rels', error_message: error.message },
      success: false
    }).catch(() => {});
    return null;
  }
}

/**
 * Full graph sync: personas + user relationships + persona bonds.
 * @returns {Promise<Object|null>} Sync summary or null on failure
 */
export async function fullGraphSync() {
  const startTime = Date.now();

  try {
    // Sync personas and inter-persona relationships in parallel
    const [personas, personaRels] = await Promise.all([
      syncPersonasToGraph(),
      syncPersonaRelationshipsToGraph()
    ]);

    // Sync user relationships in batched parallel chunks
    const pool = getSharedPool();
    const users = await pool.query('SELECT DISTINCT user_id FROM relationships ORDER BY user_id');
    let userRelsSynced = 0;

    const batchSize = NEO4J_CONFIG.SYNC_BATCH_SIZE;
    for (let i = 0; i < users.rows.length; i += batchSize) {
      const batch = users.rows.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(row => syncUserRelationshipsToGraph(row.user_id))
      );
      for (const result of results) {
        if (result) userRelsSynced += result.synced;
      }
    }

    const summary = {
      personas_synced: personas?.synced ?? null,
      persona_relationships_synced: personaRels?.synced ?? null,
      user_relationships_synced: userRelsSynced,
      duration_ms: Date.now() - startTime
    };

    logOperation('full_graph_sync', {
      details: summary,
      success: true
    }).catch(() => {});

    return summary;
  } catch (error) {
    console.error('[GraphSync] fullGraphSync failed:', error.message);
    logOperation('error_graceful', {
      details: { error_type: 'full_graph_sync_failure', error_message: error.message },
      success: false
    }).catch(() => {});
    return null;
  }
}

/**
 * Safe wrapper for graph sync — fire-and-forget.
 * Called at session completion. Returns null on any error.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function safeGraphSync(userId) {
  try {
    if (!userId) return null;
    if (!getNeo4jDriver()) return null;

    const result = await syncUserRelationshipsToGraph(userId);

    logOperation('safe_graph_sync', {
      details: { user_id: userId, synced: result?.synced || 0 },
      success: true
    }).catch(() => {});

    return result;
  } catch (error) {
    console.error('[GraphSync] safeGraphSync failed:', error.message);
    logOperation('error_graceful', {
      details: {
        error_type: 'graph_sync_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      success: false
    }).catch(() => {});
    return null;
  }
}
