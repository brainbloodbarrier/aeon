/**
 * Unit Tests: Persona Bonds
 *
 * Tests for compute/persona-bonds.js
 * Feature: Issue #37 - Persona-to-persona bonds
 * Constitution: Principle VI (Persona Relationships)
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
let getBonds, getBondBetween, updateBond, getStrongestBonds;

beforeAll(async () => {
  const module = await import('../../compute/persona-bonds.js');
  getBonds = module.getBonds;
  getBondBetween = module.getBondBetween;
  updateBond = module.updateBond;
  getStrongestBonds = module.getStrongestBonds;
});

describe('Persona Bonds', () => {
  beforeEach(() => {
    mockQueryResults = [];
    queryCalls = [];
    mockPool.query.mockClear();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getBonds()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBonds()', () => {
    it('returns all bonds for a persona', async () => {
      mockQueryResults.push({
        rows: [
          { id: 1, persona_a: 'pessoa', persona_b: 'caeiro', relationship_type: 'creator', strength: 0.9 },
          { id: 2, persona_a: 'pessoa', persona_b: 'reis', relationship_type: 'creator', strength: 0.85 },
          { id: 3, persona_a: 'pessoa', persona_b: 'campos', relationship_type: 'creator', strength: 0.85 }
        ],
        rowCount: 3
      });

      const result = await getBonds('pessoa');
      expect(result).toHaveLength(3);
      expect(result[0].persona_a).toBe('pessoa');
      expect(result[0].relationship_type).toBe('creator');
      expect(queryCalls[0].sql).toContain('persona_a = $1 OR persona_b = $1');
      expect(queryCalls[0].params).toEqual(['pessoa']);
    });

    it('returns empty array when persona has no bonds', async () => {
      mockQueryResults.push({ rows: [], rowCount: 0 });

      const result = await getBonds('unknown');
      expect(result).toEqual([]);
    });

    it('returns null on database error', async () => {
      mockQueryResults.push(new Error('Connection refused'));

      const result = await getBonds('pessoa');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getBondBetween()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBondBetween()', () => {
    it('returns specific bond between two personas', async () => {
      mockQueryResults.push({
        rows: [
          { id: 1, persona_a: 'pessoa', persona_b: 'caeiro', relationship_type: 'creator', strength: 0.9 }
        ],
        rowCount: 1
      });

      const result = await getBondBetween('pessoa', 'caeiro');
      expect(result).toHaveLength(1);
      expect(result[0].strength).toBe(0.9);
      expect(queryCalls[0].params).toEqual(['pessoa', 'caeiro']);
    });

    it('handles bidirectional lookup (order does not matter)', async () => {
      mockQueryResults.push({
        rows: [
          { id: 1, persona_a: 'pessoa', persona_b: 'caeiro', relationship_type: 'creator', strength: 0.9 }
        ],
        rowCount: 1
      });

      const result = await getBondBetween('caeiro', 'pessoa');
      expect(result).toHaveLength(1);
      // SQL checks both directions
      expect(queryCalls[0].sql).toContain('persona_a = $2 AND persona_b = $1');
    });

    it('returns empty array when no bond exists', async () => {
      mockQueryResults.push({ rows: [], rowCount: 0 });

      const result = await getBondBetween('tesla', 'socrates');
      expect(result).toEqual([]);
    });

    it('returns null on database error', async () => {
      mockQueryResults.push(new Error('Connection refused'));

      const result = await getBondBetween('pessoa', 'caeiro');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateBond()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateBond()', () => {
    it('creates a new bond', async () => {
      mockQueryResults.push({
        rows: [{
          id: 10,
          persona_a: 'feynman',
          persona_b: 'diogenes',
          relationship_type: 'ally',
          strength: 0.6,
          context: 'Playful minds'
        }],
        rowCount: 1
      });

      const result = await updateBond('feynman', 'diogenes', 'ally', 0.6, 'Playful minds');
      expect(result.id).toBe(10);
      expect(result.strength).toBe(0.6);
      expect(result.context).toBe('Playful minds');
      expect(queryCalls[0].sql).toContain('INSERT INTO persona_relationships');
      expect(queryCalls[0].sql).toContain('ON CONFLICT');
      expect(queryCalls[0].params).toEqual(['feynman', 'diogenes', 'ally', 0.6, 'Playful minds']);
    });

    it('updates an existing bond (upsert)', async () => {
      mockQueryResults.push({
        rows: [{
          id: 1,
          persona_a: 'pessoa',
          persona_b: 'caeiro',
          relationship_type: 'creator',
          strength: 0.95,
          context: 'Updated bond'
        }],
        rowCount: 1
      });

      const result = await updateBond('pessoa', 'caeiro', 'creator', 0.95, 'Updated bond');
      expect(result.strength).toBe(0.95);
      expect(result.context).toBe('Updated bond');
    });

    it('handles null context', async () => {
      mockQueryResults.push({
        rows: [{
          id: 11,
          persona_a: 'hegel',
          persona_b: 'socrates',
          relationship_type: 'predecessor_successor',
          strength: 0.65,
          context: null
        }],
        rowCount: 1
      });

      const result = await updateBond('hegel', 'socrates', 'predecessor_successor', 0.65);
      expect(result.context).toBeNull();
      expect(queryCalls[0].params[4]).toBeNull();
    });

    it('returns null on database error', async () => {
      mockQueryResults.push(new Error('Constraint violation'));

      const result = await updateBond('a', 'b', 'test', 0.5);
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getStrongestBonds()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getStrongestBonds()', () => {
    it('returns top N strongest bonds', async () => {
      mockQueryResults.push({
        rows: [
          { id: 1, persona_a: 'pessoa', persona_b: 'caeiro', relationship_type: 'creator', strength: 0.9 },
          { id: 2, persona_a: 'pessoa', persona_b: 'reis', relationship_type: 'creator', strength: 0.85 }
        ],
        rowCount: 2
      });

      const result = await getStrongestBonds('pessoa', 2);
      expect(result).toHaveLength(2);
      expect(result[0].strength).toBeGreaterThanOrEqual(result[1].strength);
      expect(queryCalls[0].sql).toContain('LIMIT $2');
      expect(queryCalls[0].params).toEqual(['pessoa', 2]);
    });

    it('uses default limit of 5', async () => {
      mockQueryResults.push({ rows: [], rowCount: 0 });

      await getStrongestBonds('pessoa');
      expect(queryCalls[0].params).toEqual(['pessoa', 5]);
    });

    it('returns empty array when no bonds exist', async () => {
      mockQueryResults.push({ rows: [], rowCount: 0 });

      const result = await getStrongestBonds('unknown');
      expect(result).toEqual([]);
    });

    it('returns null on database error', async () => {
      mockQueryResults.push(new Error('Connection refused'));

      const result = await getStrongestBonds('pessoa');
      expect(result).toBeNull();
    });
  });
});
