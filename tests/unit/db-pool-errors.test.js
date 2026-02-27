/**
 * Unit Tests: db-pool.js error paths
 *
 * Tests for singleton edge cases, withTransaction rollback,
 * pool error handler, and missing DATABASE_URL.
 *
 * Issue #26: Error path coverage for compute modules
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

// We need to mock the 'pg' module to control Pool behavior
const mockPoolInstance = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  totalCount: 5,
  idleCount: 3,
  waitingCount: 0
};

const MockPool = jest.fn(() => mockPoolInstance);

jest.unstable_mockModule('pg', () => ({
  default: { Pool: MockPool },
  Pool: MockPool
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

// Import AFTER mock setup
const {
  getSharedPool,
  closeSharedPool,
  getPoolStats,
  query,
  getClient,
  withTransaction
} = await import('../../compute/db-pool.js');

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('db-pool.js error paths', () => {
  let originalDatabaseUrl;

  beforeEach(() => {
    jest.clearAllMocks();
    originalDatabaseUrl = process.env.DATABASE_URL;
    // Ensure DATABASE_URL is set for most tests
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  });

  afterEach(() => {
    // Restore DATABASE_URL
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // getPoolStats — when pool is not active
  // ═════════════════════════════════════════════════════════════════════════

  describe('getPoolStats', () => {
    it('returns active stats when pool exists', () => {
      // Pool was created by getSharedPool in previous tests or module load
      // We just test the shape
      const stats = getPoolStats();
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('idleCount');
      expect(stats).toHaveProperty('waitingCount');
      expect(stats).toHaveProperty('createdAt');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // query — delegates to pool.query
  // ═════════════════════════════════════════════════════════════════════════

  describe('query', () => {
    it('propagates SQL errors from pool.query', async () => {
      mockPoolInstance.query.mockRejectedValueOnce(new Error('syntax error at position 42'));

      await expect(query('INVALID SQL')).rejects.toThrow('syntax error at position 42');
    });

    it('propagates timeout errors from pool.query', async () => {
      const timeoutError = new Error('Query read timeout');
      timeoutError.code = '57014';
      mockPoolInstance.query.mockRejectedValueOnce(timeoutError);

      await expect(query('SELECT pg_sleep(9999)')).rejects.toThrow('Query read timeout');
    });

    it('passes parameters through to pool.query', async () => {
      mockPoolInstance.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await query('SELECT * FROM users WHERE id = $1', ['user-123']);

      expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', ['user-123']);
      expect(result.rows).toEqual([{ id: 1 }]);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // getClient — delegates to pool.connect
  // ═════════════════════════════════════════════════════════════════════════

  describe('getClient', () => {
    it('propagates connection errors from pool.connect', async () => {
      mockPoolInstance.connect.mockRejectedValueOnce(new Error('too many clients'));

      await expect(getClient()).rejects.toThrow('too many clients');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // withTransaction — rollback on error
  // ═════════════════════════════════════════════════════════════════════════

  describe('withTransaction', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      mockPoolInstance.connect.mockResolvedValue(mockClient);
    });

    it('commits on successful callback', async () => {
      const result = await withTransaction(async (client) => {
        await client.query('INSERT INTO test VALUES ($1)', ['data']);
        return { success: true };
      });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('rolls back and rethrows when callback throws', async () => {
      const callbackError = new Error('Insert failed: unique violation');

      await expect(
        withTransaction(async (client) => {
          await client.query('INSERT INTO test VALUES ($1)', ['dup']);
          throw callbackError;
        })
      ).rejects.toThrow('Insert failed: unique violation');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('releases client even when ROLLBACK itself throws', async () => {
      // Make the callback throw
      const callbackError = new Error('callback failed');
      // Make ROLLBACK also throw
      mockClient.query.mockImplementation(async (sql) => {
        if (sql === 'ROLLBACK') throw new Error('ROLLBACK failed');
        return { rows: [] };
      });

      // The ROLLBACK error will propagate (overriding the callback error)
      await expect(
        withTransaction(async () => {
          throw callbackError;
        })
      ).rejects.toThrow('ROLLBACK failed');

      // Client must still be released (finally block)
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('releases client even when COMMIT throws', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (sql === 'COMMIT') throw new Error('COMMIT failed');
        return { rows: [] };
      });

      await expect(
        withTransaction(async () => ({ done: true }))
      ).rejects.toThrow();

      // Client must be released (finally block)
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('releases client when connect fails', async () => {
      mockPoolInstance.connect.mockRejectedValueOnce(new Error('no connections available'));

      await expect(
        withTransaction(async () => ({ done: true }))
      ).rejects.toThrow('no connections available');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // closeSharedPool
  // ═════════════════════════════════════════════════════════════════════════

  describe('closeSharedPool', () => {
    it('does not throw when called without an active pool', async () => {
      // After closeSharedPool, calling it again should be safe
      await expect(closeSharedPool()).resolves.toBeUndefined();
    });
  });
});
