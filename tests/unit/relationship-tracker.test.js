/**
 * Unit Tests: Relationship Tracker
 *
 * Tests for compute/relationship-tracker.js
 * Feature: 004-relationship-continuity
 * Constitution: Principle IV (Relationship Continuity)
 */

import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// Set DATABASE_URL before imports (required by modules after security hardening)
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// Mock state
let mockQueryResults = [];
let queryCalls = [];

const mockPool = {
  query: jest.fn(async (sql, params) => {
    queryCalls.push({ sql, params });
    const result = mockQueryResults.shift();
    if (result instanceof Error) throw result;
    return result || { rows: [], rowCount: 0 };
  }),
  on: jest.fn(),
  end: jest.fn()
};

// ESM-compatible module mocking (must be before dynamic imports)
jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool)
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

// Module exports (populated in beforeAll)
let calculateTrustLevel,
  calculateEngagementScore,
  calculateEffectiveDelta,
  ensureRelationship,
  getRelationship,
  updateFamiliarity,
  updateUserSummary,
  updateUserPreferences,
  TRUST_THRESHOLDS,
  FAMILIARITY_CONFIG;

beforeAll(async () => {
  const module = await import('../../compute/relationship-tracker.js');
  calculateTrustLevel = module.calculateTrustLevel;
  calculateEngagementScore = module.calculateEngagementScore;
  calculateEffectiveDelta = module.calculateEffectiveDelta;
  ensureRelationship = module.ensureRelationship;
  getRelationship = module.getRelationship;
  updateFamiliarity = module.updateFamiliarity;
  updateUserSummary = module.updateUserSummary;
  updateUserPreferences = module.updateUserPreferences;
  TRUST_THRESHOLDS = module.TRUST_THRESHOLDS;
  FAMILIARITY_CONFIG = module.FAMILIARITY_CONFIG;
});

describe('Relationship Tracker', () => {
  beforeEach(() => {
    mockQueryResults = [];
    queryCalls = [];
    mockPool.query.mockClear();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Pure Functions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('calculateTrustLevel()', () => {
    it('returns stranger for score 0.0', () => {
      expect(calculateTrustLevel(0.0)).toBe('stranger');
    });

    it('returns stranger for score just below acquaintance threshold', () => {
      expect(calculateTrustLevel(0.19)).toBe('stranger');
    });

    it('returns acquaintance at exactly 0.2', () => {
      expect(calculateTrustLevel(0.2)).toBe('acquaintance');
    });

    it('returns acquaintance for score just below familiar threshold', () => {
      expect(calculateTrustLevel(0.49)).toBe('acquaintance');
    });

    it('returns familiar at exactly 0.5', () => {
      expect(calculateTrustLevel(0.5)).toBe('familiar');
    });

    it('returns familiar for score just below confidant threshold', () => {
      expect(calculateTrustLevel(0.79)).toBe('familiar');
    });

    it('returns confidant at exactly 0.8', () => {
      expect(calculateTrustLevel(0.8)).toBe('confidant');
    });

    it('returns confidant at maximum score 1.0', () => {
      expect(calculateTrustLevel(1.0)).toBe('confidant');
    });
  });

  describe('calculateEngagementScore()', () => {
    it('returns engagement floor for minimal session quality', () => {
      const score = calculateEngagementScore({
        messageCount: 0,
        durationMs: 0,
        hasFollowUps: false,
        topicDepth: 0
      });
      expect(score).toBe(FAMILIARITY_CONFIG.engagementFloor);
    });

    it('returns score within valid range for a normal session', () => {
      const score = calculateEngagementScore({
        messageCount: 5,
        durationMs: 120000,
        hasFollowUps: true,
        topicDepth: 2
      });
      expect(score).toBeGreaterThanOrEqual(FAMILIARITY_CONFIG.engagementFloor);
      expect(score).toBeLessThanOrEqual(FAMILIARITY_CONFIG.engagementCeiling);
    });

    it('caps at engagement ceiling for maximal session quality', () => {
      const score = calculateEngagementScore({
        messageCount: 100,
        durationMs: 600000,
        hasFollowUps: true,
        topicDepth: 3
      });
      expect(score).toBe(FAMILIARITY_CONFIG.engagementCeiling);
    });

    it('uses defaults for missing properties', () => {
      const score = calculateEngagementScore({});
      expect(score).toBe(FAMILIARITY_CONFIG.engagementFloor);
    });
  });

  describe('calculateEffectiveDelta()', () => {
    it('calculates proportional delta for low engagement', () => {
      const delta = calculateEffectiveDelta(1.0);
      expect(delta).toBe(FAMILIARITY_CONFIG.baseDelta * 1.0);
    });

    it('caps delta at maxDelta for high engagement', () => {
      const delta = calculateEffectiveDelta(FAMILIARITY_CONFIG.engagementCeiling);
      expect(delta).toBeLessThanOrEqual(FAMILIARITY_CONFIG.maxDelta);
    });

    it('returns exactly maxDelta when baseDelta * engagement exceeds it', () => {
      // baseDelta=0.02, maxDelta=0.05. At engagement 3.0, raw=0.06 > 0.05
      const delta = calculateEffectiveDelta(3.0);
      expect(delta).toBe(FAMILIARITY_CONFIG.maxDelta);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DB-Dependent Functions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ensureRelationship()', () => {
    it('returns existing relationship when found', async () => {
      // getRelationship query returns a row
      mockQueryResults.push({
        rows: [{
          id: 'rel-1',
          personaId: 'persona-1',
          userId: 'user-1',
          familiarityScore: 0.35,
          trustLevel: 'acquaintance',
          interactionCount: 12,
          userSummary: 'Asks about metaphysics',
          userPreferences: { style: 'formal' },
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        rowCount: 1
      });

      const result = await ensureRelationship('user-1', 'persona-1');
      expect(result.id).toBe('rel-1');
      expect(result.familiarityScore).toBe(0.35);
      expect(result.trustLevel).toBe('acquaintance');
    });

    it('creates new relationship when not found', async () => {
      // getRelationship query returns empty
      mockQueryResults.push({ rows: [], rowCount: 0 });
      // INSERT RETURNING query
      mockQueryResults.push({
        rows: [{
          id: 'rel-new',
          personaId: 'persona-1',
          userId: 'user-1',
          familiarityScore: 0.0,
          trustLevel: 'stranger',
          interactionCount: 0,
          userSummary: null,
          userPreferences: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        rowCount: 1
      });

      const result = await ensureRelationship('user-1', 'persona-1');
      expect(result.id).toBe('rel-new');
      expect(result.familiarityScore).toBe(0.0);
      expect(result.trustLevel).toBe('stranger');
      // Verify the INSERT query was executed
      expect(queryCalls[1].sql).toContain('INSERT INTO relationships');
    });

    it('returns fallback with _fallback: true on DB failure', async () => {
      // getRelationship query fails
      mockQueryResults.push(new Error('Connection refused'));

      const result = await ensureRelationship('user-1', 'persona-1');
      expect(result._fallback).toBe(true);
      expect(result.trustLevel).toBe('stranger');
      expect(result.familiarityScore).toBe(0);
      expect(result.personaId).toBe('persona-1');
      expect(result.userId).toBe('user-1');
    });
  });

  describe('updateFamiliarity()', () => {
    it('detects trust level transition correctly', async () => {
      // ensureRelationship -> getRelationship returns existing at boundary
      mockQueryResults.push({
        rows: [{
          id: 'rel-1',
          personaId: 'persona-1',
          userId: 'user-1',
          familiarityScore: 0.19,
          trustLevel: 'stranger',
          interactionCount: 5,
          userSummary: null,
          userPreferences: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        rowCount: 1
      });
      // UPDATE query
      mockQueryResults.push({ rows: [], rowCount: 1 });

      const result = await updateFamiliarity('user-1', 'persona-1', {
        messageCount: 5,
        durationMs: 120000,
        hasFollowUps: true,
        topicDepth: 2
      });

      expect(result.previousTrustLevel).toBe('stranger');
      expect(result.newTrustLevel).toBe('acquaintance');
      expect(result.trustLevelChanged).toBe(true);
      expect(result.newFamiliarity).toBeGreaterThan(0.19);
      expect(result.newFamiliarity).toBeLessThanOrEqual(1.0);
    });

    it('clamps familiarity to 0.0-1.0 range', async () => {
      // Already near maximum
      mockQueryResults.push({
        rows: [{
          id: 'rel-1',
          personaId: 'persona-1',
          userId: 'user-1',
          familiarityScore: 0.99,
          trustLevel: 'confidant',
          interactionCount: 200,
          userSummary: null,
          userPreferences: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        rowCount: 1
      });
      // UPDATE query
      mockQueryResults.push({ rows: [], rowCount: 1 });

      const result = await updateFamiliarity('user-1', 'persona-1', {
        messageCount: 100,
        durationMs: 600000,
        hasFollowUps: true,
        topicDepth: 3
      });

      expect(result.newFamiliarity).toBeLessThanOrEqual(1.0);
    });

    it('returns zeroed defaults on DB error', async () => {
      // getRelationship query fails -> getRelationship catches, returns null
      mockQueryResults.push(new Error('Connection refused'));
      // ensureRelationship INSERT fails -> ensureRelationship catches, returns fallback
      mockQueryResults.push(new Error('Insert failed'));
      // updateFamiliarity UPDATE fails -> updateFamiliarity catches, returns defaults
      mockQueryResults.push(new Error('Update failed'));

      const result = await updateFamiliarity('user-1', 'persona-1', {
        messageCount: 5,
        durationMs: 60000,
        hasFollowUps: false,
        topicDepth: 1
      });

      expect(result.previousFamiliarity).toBe(0);
      expect(result.newFamiliarity).toBe(0);
      expect(result.effectiveDelta).toBe(0);
      expect(result.trustLevelChanged).toBe(false);
      expect(result.previousTrustLevel).toBe('stranger');
      expect(result.newTrustLevel).toBe('stranger');
    });
  });

  describe('updateUserSummary()', () => {
    it('returns success on successful update', async () => {
      mockQueryResults.push({ rows: [], rowCount: 1 });

      const result = await updateUserSummary('user-1', 'persona-1', 'Enjoys epistemology');
      expect(result.success).toBe(true);
      expect(queryCalls[0].sql).toContain('UPDATE relationships');
      expect(queryCalls[0].params[0]).toBe('Enjoys epistemology');
    });

    it('returns failure on DB error', async () => {
      mockQueryResults.push(new Error('Update failed'));

      const result = await updateUserSummary('user-1', 'persona-1', 'some summary');
      expect(result.success).toBe(false);
    });
  });

  describe('updateUserPreferences()', () => {
    it('returns success on successful update', async () => {
      mockQueryResults.push({ rows: [], rowCount: 1 });

      const result = await updateUserPreferences('user-1', 'persona-1', { style: 'formal', topics: ['ethics'] });
      expect(result.success).toBe(true);
      expect(queryCalls[0].sql).toContain('user_preferences');
      expect(queryCalls[0].params[0]).toBe(JSON.stringify({ style: 'formal', topics: ['ethics'] }));
    });

    it('returns failure on DB error', async () => {
      mockQueryResults.push(new Error('Update failed'));

      const result = await updateUserPreferences('user-1', 'persona-1', { style: 'casual' });
      expect(result.success).toBe(false);
    });
  });
});
