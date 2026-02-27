/**
 * Unit tests for entropy-tracker.js — cross-session persistence
 * Pynchon Stack: Entropy accumulation across sessions (Issue #36)
 */

import { jest } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  end: jest.fn()
};

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool)
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

// Import module AFTER mock setup
const {
  loadEntropyState,
  persistEntropyState,
  applyTemporalDecay,
  applySessionEntropy
} = await import('../../compute/entropy-tracker.js');

const { ENTROPY_PERSISTENCE } = await import('../../compute/constants.js');

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-Session Entropy Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // applyTemporalDecay
  // ─────────────────────────────────────────────────────────────────────

  describe('applyTemporalDecay', () => {
    it('should return same value when no time has passed', () => {
      const now = new Date();
      const result = applyTemporalDecay(0.5, now);
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('should decay entropy over time', () => {
      // 10 hours ago
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
      const result = applyTemporalDecay(0.8, tenHoursAgo);

      // Expected: 0.8 * exp(-0.01 * 10) = 0.8 * exp(-0.1) ≈ 0.8 * 0.9048 ≈ 0.7239
      expect(result).toBeLessThan(0.8);
      expect(result).toBeGreaterThan(0.6);
      expect(result).toBeCloseTo(0.8 * Math.exp(-ENTROPY_PERSISTENCE.DECAY_RATE * 10), 5);
    });

    it('should decay significantly over long periods', () => {
      // 100 hours ago
      const longAgo = new Date(Date.now() - 100 * 60 * 60 * 1000);
      const result = applyTemporalDecay(0.9, longAgo);

      // Expected: 0.9 * exp(-0.01 * 100) = 0.9 * exp(-1) ≈ 0.9 * 0.3679 ≈ 0.331
      expect(result).toBeCloseTo(0.9 * Math.exp(-ENTROPY_PERSISTENCE.DECAY_RATE * 100), 5);
      expect(result).toBeLessThan(0.5);
    });

    it('should return original value for future timestamps', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const result = applyTemporalDecay(0.5, future);
      expect(result).toBe(0.5);
    });

    it('should handle zero entropy', () => {
      const hoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const result = applyTemporalDecay(0, hoursAgo);
      expect(result).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // loadEntropyState
  // ─────────────────────────────────────────────────────────────────────

  describe('loadEntropyState', () => {
    it('should return defaults when no persisted state exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await loadEntropyState('socrates', 'user-123');

      expect(result.entropyValue).toBe(ENTROPY_PERSISTENCE.DEFAULT_VALUE);
      expect(result.sessionCount).toBe(0);
      expect(result.isNew).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('entropy_states'),
        ['socrates', 'user-123']
      );
    });

    it('should load existing state with temporal decay applied', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      mockQuery.mockResolvedValueOnce({
        rows: [{
          entropy_value: 0.6,
          last_updated: twoHoursAgo,
          session_count: 5
        }]
      });

      const result = await loadEntropyState('socrates', 'user-123');

      // Decayed: 0.6 * exp(-0.01 * 2) ≈ 0.6 * 0.9802 ≈ 0.588
      expect(result.entropyValue).toBeLessThan(0.6);
      expect(result.entropyValue).toBeGreaterThan(0.5);
      expect(result.sessionCount).toBe(5);
      expect(result.isNew).toBe(false);
    });

    it('should return defaults when DB fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await loadEntropyState('socrates', 'user-123');

      expect(result.entropyValue).toBe(ENTROPY_PERSISTENCE.DEFAULT_VALUE);
      expect(result.sessionCount).toBe(0);
      expect(result.isNew).toBe(true);
    });

    it('should handle null/invalid entropy_value in DB', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          entropy_value: null,
          last_updated: new Date(),
          session_count: 2
        }]
      });

      const result = await loadEntropyState('socrates', 'user-123');

      expect(result.entropyValue).toBe(ENTROPY_PERSISTENCE.DEFAULT_VALUE);
      expect(result.sessionCount).toBe(2);
      expect(result.isNew).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // persistEntropyState
  // ─────────────────────────────────────────────────────────────────────

  describe('persistEntropyState', () => {
    it('should upsert entropy state to DB', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await persistEntropyState('socrates', 'user-123', 0.45);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entropy_states'),
        ['socrates', 'user-123', 0.45]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });

    it('should return false when DB fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await persistEntropyState('socrates', 'user-123', 0.45);

      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // applySessionEntropy with cross-session
  // ─────────────────────────────────────────────────────────────────────

  describe('applySessionEntropy with cross-session options', () => {
    it('should use cross-session state when personaId and userId provided', async () => {
      // Mock loadEntropyState query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          entropy_value: 0.4,
          last_updated: new Date(),
          session_count: 3
        }]
      });
      // Mock persistEntropyState query (fire-and-forget)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await applySessionEntropy('session-1', null, {
        personaId: 'socrates',
        userId: 'user-123'
      });

      expect(result.level).toBeCloseTo(0.4, 1);
      expect(result.sessionCount).toBe(3);
      expect(result.state).toBeDefined();
      expect(result.marker).toBeDefined();
    });

    it('should fallback to global state when no personaId/userId', async () => {
      // Mock getEntropyState query (setting_state table)
      mockQuery.mockResolvedValueOnce({
        rows: [{
          entropy_level: 0.3,
          updated_at: new Date()
        }]
      });

      const result = await applySessionEntropy('session-1');

      expect(result.level).toBeCloseTo(0.3, 1);
      expect(result.state).toBeDefined();
      expect(result.marker).toBeDefined();
    });

    it('should return defaults when everything fails', async () => {
      mockQuery.mockRejectedValue(new Error('Total DB failure'));

      const result = await applySessionEntropy('session-1', null, {
        personaId: 'socrates',
        userId: 'user-123'
      });

      expect(result.level).toBe(0.15);
      expect(result.state).toBe('stable');
      expect(result.effect).toBeNull();
      expect(typeof result.shouldIncrement).toBe('boolean');
      expect(result.sessionCount).toBe(0);
    });
  });
});
