/**
 * Unit tests for neo4j-pool.js
 * Neo4j connection pool with graceful degradation
 */

import { jest } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

const mockSession = {
  run: jest.fn(),
  close: jest.fn()
};

const mockDriver = {
  session: jest.fn(() => mockSession),
  close: jest.fn()
};

const mockNeo4jDriverFn = jest.fn(() => mockDriver);
const mockBasicAuth = jest.fn((u, p) => ({ user: u, password: p }));

jest.unstable_mockModule('neo4j-driver', () => ({
  default: {
    driver: mockNeo4jDriverFn,
    auth: { basic: mockBasicAuth }
  }
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

// We need to reimport the module fresh for each test to reset the singleton
let getNeo4jDriver, closeNeo4jDriver, runCypher;

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Neo4j Pool Module', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset env
    process.env = { ...originalEnv };
    delete process.env.NEO4J_PASSWORD;
    delete process.env.NEO4J_URI;
    delete process.env.NEO4J_USER;

    // Re-import to reset singleton state
    jest.resetModules();

    // Re-setup mocks after resetModules
    jest.unstable_mockModule('neo4j-driver', () => ({
      default: {
        driver: mockNeo4jDriverFn,
        auth: { basic: mockBasicAuth }
      }
    }));
    jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
      logOperation: jest.fn().mockResolvedValue(undefined)
    }));

    const mod = await import('../../compute/neo4j-pool.js');
    getNeo4jDriver = mod.getNeo4jDriver;
    closeNeo4jDriver = mod.closeNeo4jDriver;
    runCypher = mod.runCypher;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ─────────────────────────────────────────────────────────────────────
  // getNeo4jDriver
  // ─────────────────────────────────────────────────────────────────────

  describe('getNeo4jDriver', () => {
    test('returns null when NEO4J_PASSWORD is not set', () => {
      const driver = getNeo4jDriver();
      expect(driver).toBeNull();
    });

    test('creates driver when NEO4J_PASSWORD is set', () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      const driver = getNeo4jDriver();
      expect(driver).toBe(mockDriver);
    });

    test('returns cached driver on second call', () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      const driver1 = getNeo4jDriver();
      const driver2 = getNeo4jDriver();
      expect(driver1).toBe(driver2);
      // driver factory should only be called once
      expect(mockNeo4jDriverFn).toHaveBeenCalledTimes(1);
    });

    test('uses default URI and user when env vars not set', () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      getNeo4jDriver();
      expect(mockNeo4jDriverFn).toHaveBeenCalledWith(
        'bolt://localhost:7687',
        expect.anything()
      );
      expect(mockBasicAuth).toHaveBeenCalledWith('neo4j', 'testpass');
    });

    test('uses custom URI from env var', () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      process.env.NEO4J_URI = 'bolt://custom:7688';
      getNeo4jDriver();
      expect(mockNeo4jDriverFn).toHaveBeenCalledWith(
        'bolt://custom:7688',
        expect.anything()
      );
    });

    test('uses custom user from env var', () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      process.env.NEO4J_USER = 'admin';
      getNeo4jDriver();
      expect(mockBasicAuth).toHaveBeenCalledWith('admin', 'testpass');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // closeNeo4jDriver
  // ─────────────────────────────────────────────────────────────────────

  describe('closeNeo4jDriver', () => {
    test('closes driver and resets to null', async () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      getNeo4jDriver();
      await closeNeo4jDriver();
      expect(mockDriver.close).toHaveBeenCalledTimes(1);
    });

    test('handles no-op when no driver exists', async () => {
      // No password set, no driver created
      await closeNeo4jDriver();
      expect(mockDriver.close).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // runCypher
  // ─────────────────────────────────────────────────────────────────────

  describe('runCypher', () => {
    test('returns null when driver is null (no password)', async () => {
      const result = await runCypher('MATCH (n) RETURN n');
      expect(result).toBeNull();
    });

    test('runs query via session', async () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      const mockResult = { records: [] };
      mockSession.run.mockResolvedValue(mockResult);

      const result = await runCypher('MATCH (n) RETURN n', { limit: 10 });
      expect(result).toBe(mockResult);
      expect(mockSession.run).toHaveBeenCalledWith('MATCH (n) RETURN n', { limit: 10 }, { timeout: 10000 });
    });

    test('closes session after query', async () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      mockSession.run.mockResolvedValue({ records: [] });

      await runCypher('MATCH (n) RETURN n');
      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });

    test('closes session on error', async () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      mockSession.run.mockRejectedValue(new Error('query failed'));

      await expect(runCypher('BAD QUERY')).rejects.toThrow('query failed');
      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });

    test('uses default empty params when none provided', async () => {
      process.env.NEO4J_PASSWORD = 'testpass';
      mockSession.run.mockResolvedValue({ records: [] });

      await runCypher('MATCH (n) RETURN n');
      expect(mockSession.run).toHaveBeenCalledWith('MATCH (n) RETURN n', {}, { timeout: 10000 });
    });
  });
});
