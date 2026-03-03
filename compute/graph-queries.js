/**
 * AEON Matrix - Graph Traversal Utilities
 *
 * Queries that leverage Neo4j's graph traversal capabilities
 * for insights PostgreSQL can't efficiently provide.
 */

import { runCypher } from './neo4j-pool.js';
import { logOperation } from './operator-logger.js';
import { validatePersonaName } from './persona-validator.js';

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute a graph query with standardized error handling.
 * On failure: logs error, returns null.
 *
 * @param {string} queryName - Name for diagnostics
 * @param {Function} queryFn - Async function that performs the query
 * @returns {Promise<*|null>}
 */
async function _safeGraphQuery(queryName, queryFn) {
  try {
    return await queryFn();
  } catch (error) {
    console.error(`[GraphQueries] ${queryName} failed:`, error.message);
    logOperation('error_graceful', {
      details: { error_type: 'graph_query_failure', error_message: error.message, query: queryName },
      success: false
    }).catch(() => {});
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find a persona's immediate neighborhood (direct connections).
 * @param {string} personaName
 * @returns {Promise<Object|null>}
 */
export async function findPersonaNeighborhood(personaName) {
  validatePersonaName(personaName);
  return _safeGraphQuery('findPersonaNeighborhood', async () => {
    const result = await runCypher(
      `MATCH (p:Persona {name: $name})-[r]-(connected)
       RETURN connected.name AS name, type(r) AS relationship,
              r.strength AS strength, labels(connected) AS labels
       ORDER BY r.strength DESC`,
      { name: personaName }
    );

    if (!result) return null;
    return result.records.map(r => ({
      name: r.get('name'),
      relationship: r.get('relationship'),
      strength: r.get('strength'),
      type: r.get('labels')?.[0] || 'Unknown'
    }));
  });
}

/**
 * Find shortest relationship path between two personas.
 * @param {string} personaA
 * @param {string} personaB
 * @returns {Promise<Object|null>}
 */
export async function findRelationshipPath(personaA, personaB) {
  validatePersonaName(personaA);
  validatePersonaName(personaB);
  return _safeGraphQuery('findRelationshipPath', async () => {
    const result = await runCypher(
      `MATCH path = shortestPath(
         (a:Persona {name: $nameA})-[*..6]-(b:Persona {name: $nameB})
       )
       RETURN [n IN nodes(path) | n.name] AS names,
              [r IN relationships(path) | type(r)] AS relationships,
              length(path) AS distance`,
      { nameA: personaA, nameB: personaB }
    );

    if (!result || result.records.length === 0) return null;
    const record = result.records[0];
    return {
      path: record.get('names'),
      relationships: record.get('relationships'),
      distance: record.get('distance')?.toNumber?.() ?? record.get('distance')
    };
  });
}

/**
 * Detect persona communities using label propagation.
 * @returns {Promise<Array|null>}
 */
export async function detectPersonaCommunities() {
  return _safeGraphQuery('detectPersonaCommunities', async () => {
    const result = await runCypher(
      `MATCH (p:Persona)
       RETURN p.category AS community, collect(p.name) AS members, count(*) AS size
       ORDER BY size DESC`
    );

    if (!result) return null;
    return result.records.map(r => ({
      community: r.get('community'),
      members: r.get('members'),
      size: r.get('size')?.toNumber?.() ?? r.get('size')
    }));
  });
}

/**
 * Find influence chain: who influences whom through connections.
 * @param {string} personaName - Starting persona
 * @param {number} [depth=3] - Max traversal depth
 * @returns {Promise<Array|null>}
 */
export async function findInfluenceChain(personaName, depth = 3) {
  validatePersonaName(personaName);
  return _safeGraphQuery('findInfluenceChain', async () => {
    // Cap depth at 6 to prevent expensive traversals.
    // Interpolation is required: Neo4j Cypher does not support parameterized
    // variable-length path bounds (*1..$depth is invalid syntax).
    // Math.floor guarantees integer; Math.min/max bounds to [1,6].
    const cappedDepth = Math.min(Math.max(1, Math.floor(depth)), 6);

    const result = await runCypher(
      `MATCH path = (p:Persona {name: $name})-[:RELATES_TO*1..${cappedDepth}]->(influenced:Persona)
       RETURN influenced.name AS name,
              length(path) AS distance,
              [r IN relationships(path) | r.strength] AS strengths
       ORDER BY distance, influenced.name`,
      { name: personaName }
    );

    if (!result) return null;
    return result.records.map(r => ({
      name: r.get('name'),
      distance: r.get('distance')?.toNumber?.() ?? r.get('distance'),
      strengths: r.get('strengths')
    }));
  });
}

/**
 * Find the most connected persona (highest degree centrality).
 * @returns {Promise<Object|null>}
 */
export async function findMostConnectedPersona() {
  return _safeGraphQuery('findMostConnectedPersona', async () => {
    const result = await runCypher(
      `MATCH (p:Persona)-[r]-()
       RETURN p.name AS name, p.category AS category, count(r) AS connections
       ORDER BY connections DESC
       LIMIT 1`
    );

    if (!result || result.records.length === 0) return null;
    const record = result.records[0];
    return {
      name: record.get('name'),
      category: record.get('category'),
      connections: record.get('connections')?.toNumber?.() ?? record.get('connections')
    };
  });
}
