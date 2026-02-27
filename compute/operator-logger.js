/**
 * AEON Matrix - Operator Logger
 *
 * Silent logging for all infrastructure operations.
 * Logs are written to operator_logs table and never exposed to users.
 * Falls back to file-based logging when the database is unavailable.
 *
 * Feature: 002-invisible-infrastructure
 */

import { getSharedPool } from './db-pool.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { LOGGER_FALLBACK } from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const FALLBACK_LOG_PATH = path.join(PROJECT_ROOT, LOGGER_FALLBACK.FALLBACK_LOG_FILE);
const FALLBACK_LOG_DIR = path.join(PROJECT_ROOT, LOGGER_FALLBACK.FALLBACK_LOG_DIR);

/** Consecutive DB failure counter for backoff logic */
let consecutiveFailures = 0;

/** Total log calls since backoff started, used for skip logic */
let callsSinceBackoff = 0;

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Write a log entry to the fallback file.
 * Creates the logs/ directory if it does not exist.
 * Never throws — errors are silently swallowed.
 *
 * @param {Object} entry - Log entry object
 * @returns {Promise<void>}
 */
async function writeToFallbackFile(entry) {
  try {
    await fs.mkdir(FALLBACK_LOG_DIR, { recursive: true });
    await fs.appendFile(FALLBACK_LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // Last-resort: if file fallback also fails, silently discard
  }
}

/**
 * Check whether this log call should be skipped due to backoff.
 *
 * @returns {boolean} true if the DB attempt should be skipped
 */
function shouldSkipDueToBackoff() {
  if (consecutiveFailures < LOGGER_FALLBACK.MAX_CONSECUTIVE_FAILURES) {
    return false;
  }
  callsSinceBackoff++;
  return (callsSinceBackoff % LOGGER_FALLBACK.BACKOFF_SKIP_COUNT) !== 0;
}

/**
 * Record a DB success: reset failure counter and backoff state.
 */
function recordSuccess() {
  consecutiveFailures = 0;
  callsSinceBackoff = 0;
}

/**
 * Record a DB failure: increment failure counter.
 */
function recordFailure() {
  consecutiveFailures++;
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
  const {
    sessionId = null,
    personaId = null,
    userId = null,
    details = {},
    durationMs = null,
    success = true
  } = params;

  const timestamp = new Date().toISOString();

  // Backoff: skip DB attempt if too many consecutive failures
  if (shouldSkipDueToBackoff()) {
    await writeToFallbackFile({
      operation,
      sessionId,
      personaId,
      userId,
      details,
      durationMs,
      success,
      timestamp,
      _fallback_reason: 'backoff_skip'
    });
    return;
  }

  try {
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

    recordSuccess();
  } catch (error) {
    recordFailure();

    // Write to fallback file
    await writeToFallbackFile({
      operation,
      sessionId,
      personaId,
      userId,
      details,
      durationMs,
      success,
      timestamp,
      _fallback_reason: 'db_error',
      error: error.message,
      errorCode: error.code
    });

    // Also log to stderr for container log capture
    console.error(JSON.stringify({
      _aeon_log_fallback: true,
      source: 'operator_logger',
      operation,
      sessionId,
      personaId,
      error: error.message,
      errorCode: error.code,
      timestamp
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
  const timestamp = new Date().toISOString();

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

    recordSuccess();
  } catch (error) {
    recordFailure();

    // Write each operation to fallback file
    for (const { operation, params = {} } of operations) {
      await writeToFallbackFile({
        operation,
        sessionId: params.sessionId || null,
        personaId: params.personaId || null,
        userId: params.userId || null,
        details: params.details || {},
        durationMs: params.durationMs || null,
        success: params.success !== undefined ? params.success : true,
        timestamp,
        _fallback_reason: 'db_error',
        error: error.message,
        errorCode: error.code
      });
    }

    // Also log to stderr for container log capture
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
      timestamp
    }));
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

/**
 * Reset internal backoff state.
 * Exposed for testing purposes only.
 */
export function _resetBackoffState() {
  consecutiveFailures = 0;
  callsSinceBackoff = 0;
}

/**
 * Get current backoff state.
 * Exposed for testing purposes only.
 *
 * @returns {{ consecutiveFailures: number, callsSinceBackoff: number }}
 */
export function _getBackoffState() {
  return { consecutiveFailures, callsSinceBackoff };
}
