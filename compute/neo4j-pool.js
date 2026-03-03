/**
 * AEON Matrix - Neo4j Connection Pool
 *
 * Singleton Neo4j driver following the same pattern as db-pool.js.
 * Returns null when NEO4J_PASSWORD is not configured, allowing
 * graceful degradation — graph features simply don't activate.
 */

import neo4j from 'neo4j-driver';
import { NEO4J_CONFIG } from './constants.js';

let driver = null;

/**
 * Get or create the shared Neo4j driver.
 * Returns null if NEO4J_PASSWORD is not set.
 *
 * @returns {Object|null} Neo4j driver or null
 */
export function getNeo4jDriver() {
  if (!process.env.NEO4J_PASSWORD) {
    return null;
  }

  if (!driver) {
    try {
      const uri = process.env.NEO4J_URI || NEO4J_CONFIG.DEFAULT_URI;
      const user = process.env.NEO4J_USER || NEO4J_CONFIG.DEFAULT_USER;

      driver = neo4j.driver(
        uri,
        neo4j.auth.basic(user, process.env.NEO4J_PASSWORD)
      );

      console.log('[Neo4jPool] Driver created', { uri, user });
    } catch (error) {
      console.error('[Neo4jPool] Failed to create driver:', error.message);
      return null;
    }
  }

  return driver;
}

/**
 * Close the Neo4j driver. Called during graceful shutdown.
 * @returns {Promise<void>}
 */
export async function closeNeo4jDriver() {
  if (driver) {
    console.log('[Neo4jPool] Closing driver');
    try {
      await driver.close();
    } catch (error) {
      console.error('[Neo4jPool] Error closing driver:', error.message);
    }
    driver = null;
  }
}

/**
 * Run a Cypher query. Returns null if Neo4j is not configured.
 *
 * @param {string} query - Cypher query string
 * @param {Object} [params={}] - Query parameters
 * @returns {Promise<Object|null>} Query result or null
 */
export async function runCypher(query, params = {}) {
  const d = getNeo4jDriver();
  if (!d) return null;

  const session = d.session();
  try {
    const result = await session.run(query, params, {
      timeout: NEO4J_CONFIG.QUERY_TIMEOUT_MS
    });
    return result;
  } catch (error) {
    console.error('[Neo4jPool] Cypher query failed:', error.message);
    throw error;
  } finally {
    try {
      await session.close();
    } catch (closeError) {
      console.error('[Neo4jPool] Session close failed:', closeError.message);
    }
  }
}
