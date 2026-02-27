/**
 * Unit tests for operator-logger.js fallback and backoff behavior
 * Tests file-based fallback when DB is unavailable and consecutive failure backoff.
 */

import { jest } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  end: jest.fn(),
  connect: jest.fn()
};

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool)
}));

const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockAppendFile = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    appendFile: mockAppendFile
  },
  mkdir: mockMkdir,
  appendFile: mockAppendFile
}));

// Import module AFTER mock setup
const {
  logOperation,
  _resetBackoffState,
  _getBackoffState
} = await import('../../compute/operator-logger.js');

const { LOGGER_FALLBACK } = await import('../../compute/constants.js');

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Operator Logger Fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetBackoffState();
  });

  describe('DB available — normal logging', () => {
    test('logs to DB when database is available', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await logOperation('memory_retrieval', {
        sessionId: 'session-123',
        personaId: 'hegel-uuid',
        userId: 'user-456',
        details: { memories_selected: 3 },
        durationMs: 45
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('log_operation'),
        [
          'session-123',
          'hegel-uuid',
          'user-456',
          'memory_retrieval',
          JSON.stringify({ memories_selected: 3 }),
          45,
          true
        ]
      );
      // Should NOT write to fallback file
      expect(mockAppendFile).not.toHaveBeenCalled();
    });

    test('resets consecutive failure counter on DB success', async () => {
      // First, cause some failures
      mockQuery.mockRejectedValueOnce(new Error('DB down'));
      await logOperation('test_op', {});
      expect(_getBackoffState().consecutiveFailures).toBe(1);

      // Now succeed
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await logOperation('test_op', {});
      expect(_getBackoffState().consecutiveFailures).toBe(0);
      expect(_getBackoffState().callsSinceBackoff).toBe(0);
    });
  });

  describe('DB down — file fallback', () => {
    test('falls back to file when DB query fails', async () => {
      const dbError = new Error('connection refused');
      dbError.code = 'ECONNREFUSED';
      mockQuery.mockRejectedValue(dbError);

      await logOperation('drift_detection', {
        sessionId: 'sess-1',
        personaId: 'persona-1',
        details: { score: 0.15 }
      });

      // Should have tried DB
      expect(mockQuery).toHaveBeenCalledTimes(1);

      // Should create logs directory
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true }
      );

      // Should write to fallback file
      expect(mockAppendFile).toHaveBeenCalledTimes(1);
      const writtenData = mockAppendFile.mock.calls[0][1];
      const parsed = JSON.parse(writtenData.trim());
      expect(parsed.operation).toBe('drift_detection');
      expect(parsed.sessionId).toBe('sess-1');
      expect(parsed.personaId).toBe('persona-1');
      expect(parsed.details).toEqual({ score: 0.15 });
      expect(parsed._fallback_reason).toBe('db_error');
      expect(parsed.error).toBe('connection refused');
      expect(parsed.timestamp).toBeDefined();
    });

    test('includes all fields in fallback file entry', async () => {
      mockQuery.mockRejectedValue(new Error('timeout'));

      await logOperation('setting_save', {
        sessionId: 'sess-2',
        personaId: 'persona-2',
        userId: 'user-2',
        details: { key: 'value' },
        durationMs: 100,
        success: false
      });

      const writtenData = mockAppendFile.mock.calls[0][1];
      const parsed = JSON.parse(writtenData.trim());
      expect(parsed.operation).toBe('setting_save');
      expect(parsed.sessionId).toBe('sess-2');
      expect(parsed.personaId).toBe('persona-2');
      expect(parsed.userId).toBe('user-2');
      expect(parsed.details).toEqual({ key: 'value' });
      expect(parsed.durationMs).toBe(100);
      expect(parsed.success).toBe(false);
    });

    test('never throws even if file fallback also fails', async () => {
      mockQuery.mockRejectedValue(new Error('DB down'));
      mockMkdir.mockRejectedValue(new Error('filesystem error'));

      // Should not throw
      await expect(
        logOperation('test_op', { sessionId: 'x' })
      ).resolves.toBeUndefined();
    });
  });

  describe('consecutive failures — backoff', () => {
    test('tracks consecutive DB failures', async () => {
      mockQuery.mockRejectedValue(new Error('DB down'));

      for (let i = 0; i < 3; i++) {
        await logOperation('test_op', {});
      }

      expect(_getBackoffState().consecutiveFailures).toBe(3);
    });

    test('skips DB attempts after MAX_CONSECUTIVE_FAILURES', async () => {
      mockQuery.mockRejectedValue(new Error('DB down'));

      // Cause MAX_CONSECUTIVE_FAILURES failures
      for (let i = 0; i < LOGGER_FALLBACK.MAX_CONSECUTIVE_FAILURES; i++) {
        await logOperation('test_op', {});
      }

      // Clear call counts but restore mock implementations
      mockQuery.mockClear();
      mockMkdir.mockClear().mockResolvedValue(undefined);
      mockAppendFile.mockClear().mockResolvedValue(undefined);

      // Next calls should skip DB (backoff active)
      // Only every BACKOFF_SKIP_COUNT-th call should attempt DB
      for (let i = 0; i < LOGGER_FALLBACK.BACKOFF_SKIP_COUNT - 1; i++) {
        await logOperation('test_op', {});
      }

      // DB should NOT have been called during backoff skips
      expect(mockQuery).not.toHaveBeenCalled();
      // But file fallback should have been called for each skipped entry
      expect(mockAppendFile).toHaveBeenCalledTimes(LOGGER_FALLBACK.BACKOFF_SKIP_COUNT - 1);

      // Verify skipped entries have backoff_skip reason
      const firstWrittenData = mockAppendFile.mock.calls[0][1];
      const parsed = JSON.parse(firstWrittenData.trim());
      expect(parsed._fallback_reason).toBe('backoff_skip');
    });

    test('retries DB on the Nth call during backoff', async () => {
      mockQuery.mockRejectedValue(new Error('DB down'));

      // Cause MAX_CONSECUTIVE_FAILURES failures
      for (let i = 0; i < LOGGER_FALLBACK.MAX_CONSECUTIVE_FAILURES; i++) {
        await logOperation('test_op', {});
      }

      mockQuery.mockClear();
      mockMkdir.mockClear().mockResolvedValue(undefined);
      mockAppendFile.mockClear().mockResolvedValue(undefined);
      mockQuery.mockRejectedValue(new Error('still down'));

      // Skip BACKOFF_SKIP_COUNT - 1 calls, then the Nth should retry DB
      for (let i = 0; i < LOGGER_FALLBACK.BACKOFF_SKIP_COUNT; i++) {
        await logOperation('test_op', {});
      }

      // DB should have been retried exactly once (on the Nth call)
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('recovers from backoff when DB comes back', async () => {
      mockQuery.mockRejectedValue(new Error('DB down'));

      // Cause enough failures for backoff
      for (let i = 0; i < LOGGER_FALLBACK.MAX_CONSECUTIVE_FAILURES; i++) {
        await logOperation('test_op', {});
      }

      // Skip to the retry point
      mockMkdir.mockClear().mockResolvedValue(undefined);
      mockAppendFile.mockClear().mockResolvedValue(undefined);
      for (let i = 0; i < LOGGER_FALLBACK.BACKOFF_SKIP_COUNT - 1; i++) {
        await logOperation('test_op', {});
      }

      // Now DB comes back
      mockQuery.mockClear();
      mockMkdir.mockClear().mockResolvedValue(undefined);
      mockAppendFile.mockClear().mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [] });

      // The next call (the Nth) should attempt and succeed
      await logOperation('test_op', {});

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(_getBackoffState().consecutiveFailures).toBe(0);
      expect(_getBackoffState().callsSinceBackoff).toBe(0);

      // Subsequent calls should go to DB normally (no more backoff)
      mockQuery.mockClear();
      await logOperation('test_op', {});
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });
});
