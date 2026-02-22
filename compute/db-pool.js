/**
 * AEON Matrix - Shared Database Pool Manager
 *
 * Centralizes PostgreSQL connection pool management across all compute modules.
 * Prevents memory leaks from multiple singleton pools and provides consistent
 * error handling and reconnection logic.
 *
 * Feature: Code Review Remediation (Issue #4)
 */

import pg from 'pg';
const { Pool } = pg;

let sharedPool = null;
let poolCreatedAt = null;

/**
 * Default pool configuration.
 */
const POOL_CONFIG = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  allowExitOnIdle: false
};

/**
 * Get or create the shared database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
export function getSharedPool() {
  if (!sharedPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('[DBPool] DATABASE_URL environment variable is required');
    }
    const connectionString = process.env.DATABASE_URL;

    sharedPool = new Pool({
      connectionString,
      ...POOL_CONFIG
    });

    poolCreatedAt = new Date();

    // Handle pool-level errors (e.g., network issues, idle client errors)
    sharedPool.on('error', (err, client) => {
      console.error('[DBPool] Unexpected error on idle client:', {
        error: err.message,
        code: err.code,
        poolAge: poolCreatedAt ? `${Math.floor((Date.now() - poolCreatedAt) / 1000)}s` : 'unknown'
      });

      // For fatal errors, mark pool for recreation on next request
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        console.error('[DBPool] Fatal connection error, pool will be recreated on next request');
        const oldPool = sharedPool;
        sharedPool = null;
        poolCreatedAt = null;
        oldPool.end().catch(() => {});
      }
    });

    // Log pool creation for debugging
    console.log('[DBPool] Shared pool created', {
      max: POOL_CONFIG.max,
      idleTimeout: POOL_CONFIG.idleTimeoutMillis
    });
  }

  return sharedPool;
}

/**
 * Close the shared database connection pool.
 * Should be called during graceful shutdown.
 *
 * @returns {Promise<void>}
 */
export async function closeSharedPool() {
  if (sharedPool) {
    console.log('[DBPool] Closing shared pool');
    await sharedPool.end();
    sharedPool = null;
    poolCreatedAt = null;
  }
}

/**
 * Get pool statistics for monitoring.
 *
 * @returns {Object} Pool statistics
 */
export function getPoolStats() {
  if (!sharedPool) {
    return {
      active: false,
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
      createdAt: null
    };
  }

  return {
    active: true,
    totalCount: sharedPool.totalCount,
    idleCount: sharedPool.idleCount,
    waitingCount: sharedPool.waitingCount,
    createdAt: poolCreatedAt
  };
}

/**
 * Execute a query with automatic pool management.
 * Convenience wrapper for simple queries.
 *
 * @param {string} text - SQL query text
 * @param {Array} [values] - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, values) {
  const pool = getSharedPool();
  return pool.query(text, values);
}

/**
 * Get a client from the pool for transaction operations.
 * Caller is responsible for releasing the client.
 *
 * @returns {Promise<Object>} Database client
 *
 * @example
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   // ... operations
 *   await client.query('COMMIT');
 * } catch (e) {
 *   await client.query('ROLLBACK');
 *   throw e;
 * } finally {
 *   client.release();
 * }
 */
export async function getClient() {
  const pool = getSharedPool();
  return pool.connect();
}

/**
 * Execute operations within a transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 *
 * @param {Function} callback - Async function receiving client as argument
 * @returns {Promise<*>} Result of callback
 *
 * @example
 * const result = await withTransaction(async (client) => {
 *   await client.query('INSERT INTO ...');
 *   await client.query('UPDATE ...');
 *   return { success: true };
 * });
 */
export async function withTransaction(callback) {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
