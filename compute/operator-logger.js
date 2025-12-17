/**
 * AEON Matrix - Operator Logger
 *
 * Silent logging for all infrastructure operations.
 * Logs are written to operator_logs table and never exposed to users.
 *
 * Feature: 002-invisible-infrastructure
 */

import pg from 'pg';
const { Pool } = pg;

let pool = null;

/**
 * Get or create database connection pool.
 * Uses DATABASE_URL environment variable.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('[OperatorLogger] DATABASE_URL environment variable is required');
    }
    const connectionString = process.env.DATABASE_URL;

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

/**
 * Log an infrastructure operation silently.
 * Fire-and-forget: errors are caught and logged but never thrown.
 *
 * @param {string} operation - Operation type (memory_retrieval, memory_framing, etc.)
 * @param {Object} params - Operation parameters
 * @param {string} [params.sessionId] - Session UUID
 * @param {string} [params.personaId] - Persona UUID
 * @param {string} [params.userId] - User UUID
 * @param {Object} [params.details] - Operation-specific details
 * @param {number} [params.durationMs] - Operation duration in milliseconds
 * @param {boolean} [params.success=true] - Whether operation succeeded
 *
 * @returns {Promise<void>} Resolves when logged (fire-and-forget)
 *
 * @example
 * await logOperation('memory_retrieval', {
 *   sessionId: 'session-123',
 *   personaId: 'hegel-uuid',
 *   userId: 'user-456',
 *   details: { memories_selected: 3, total_available: 15 },
 *   durationMs: 45
 * });
 */
export async function logOperation(operation, params = {}) {
  try {
    const {
      sessionId = null,
      personaId = null,
      userId = null,
      details = {},
      durationMs = null,
      success = true
    } = params;

    const db = getPool();

    await db.query(
      `SELECT log_operation($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        personaId,
        userId,
        operation,
        JSON.stringify(details),
        durationMs,
        success
      ]
    );
  } catch (error) {
    // Fire-and-forget: log to stderr in structured format for container log capture
    // This fallback ensures operations are still recorded even if database fails
    console.error(JSON.stringify({
      _aeon_log_fallback: true,
      source: 'operator_logger',
      operation,
      sessionId: params.sessionId || null,
      personaId: params.personaId || null,
      error: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Log multiple operations in a single batch.
 * More efficient for multiple related operations.
 * Fire-and-forget: errors are caught and logged but never thrown.
 *
 * @param {Array<{operation: string, params: Object}>} operations - Array of operations to log
 * @returns {Promise<void>}
 *
 * @example
 * await logOperationBatch([
 *   {
 *     operation: 'memory_retrieval',
 *     params: { sessionId: '123', details: { count: 3 } }
 *   },
 *   {
 *     operation: 'drift_detection',
 *     params: { sessionId: '123', details: { score: 0.15 } }
 *   }
 * ]);
 */
export async function logOperationBatch(operations) {
  try {
    const db = getPool();
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      for (const { operation, params = {} } of operations) {
        const {
          sessionId = null,
          personaId = null,
          userId = null,
          details = {},
          durationMs = null,
          success = true
        } = params;

        await client.query(
          `SELECT log_operation($1, $2, $3, $4, $5, $6, $7)`,
          [
            sessionId,
            personaId,
            userId,
            operation,
            JSON.stringify(details),
            durationMs,
            success
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    // Fire-and-forget: log to stderr in structured format for container log capture
    // This fallback ensures operations are still recorded even if database fails
    console.error(JSON.stringify({
      _aeon_log_fallback: true,
      source: 'operator_logger_batch',
      operations: operations.map(o => ({
        operation: o.operation,
        sessionId: o.params?.sessionId || null,
        personaId: o.params?.personaId || null
      })),
      error: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Close the database connection pool.
 * Call this when shutting down the application.
 *
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
