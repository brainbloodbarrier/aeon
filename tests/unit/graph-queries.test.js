/**
 * Unit tests for graph-queries.js
 * Neo4j graph traversal utilities
 */

import { jest } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

const mockRunCypher = jest.fn();

jest.unstable_mockModule('../../compute/neo4j-pool.js', () => ({
  runCypher: mockRunCypher
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../../compute/persona-validator.js', () => ({
  validatePersonaName: jest.fn((name) => name)
}));

// Import after mocking
const {
  findPersonaNeighborhood,
  findRelationshipPath,
  detectPersonaCommunities,
  findInfluenceChain,
  findMostConnectedPersona
} = await import('../../compute/graph-queries.js');

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function mockRecord(data) {
  return { get: (key) => data[key] };
}

function mockResult(records) {
  return { records: records.map(d => mockRecord(d)) };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Graph Queries Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // findPersonaNeighborhood
  // ─────────────────────────────────────────────────────────────────────

  describe('findPersonaNeighborhood', () => {
    test('returns neighbors with properties', async () => {
      mockRunCypher.mockResolvedValue(mockResult([
        { name: 'socrates', relationship: 'RELATES_TO', strength: 0.9, labels: ['Persona'] },
        { name: 'user-1', relationship: 'KNOWS', strength: 0.5, labels: ['User'] }
      ]));

      const result = await findPersonaNeighborhood('hegel');
      expect(result).toEqual([
        { name: 'socrates', relationship: 'RELATES_TO', strength: 0.9, type: 'Persona' },
        { name: 'user-1', relationship: 'KNOWS', strength: 0.5, type: 'User' }
      ]);
    });

    test('returns null when Neo4j not available', async () => {
      mockRunCypher.mockResolvedValue(null);

      const result = await findPersonaNeighborhood('hegel');
      expect(result).toBeNull();
    });

    test('handles empty results', async () => {
      mockRunCypher.mockResolvedValue(mockResult([]));

      const result = await findPersonaNeighborhood('hegel');
      expect(result).toEqual([]);
    });

    test('defaults to Unknown when labels is null', async () => {
      mockRunCypher.mockResolvedValue(mockResult([
        { name: 'mystery', relationship: 'RELATES_TO', strength: 0.3, labels: null }
      ]));

      const result = await findPersonaNeighborhood('hegel');
      expect(result[0].type).toBe('Unknown');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // findRelationshipPath
  // ─────────────────────────────────────────────────────────────────────

  describe('findRelationshipPath', () => {
    test('finds path between personas', async () => {
      mockRunCypher.mockResolvedValue(mockResult([
        {
          names: ['socrates', 'hegel', 'moore'],
          relationships: ['RELATES_TO', 'RELATES_TO'],
          distance: 2
        }
      ]));

      const result = await findRelationshipPath('socrates', 'moore');
      expect(result).toEqual({
        path: ['socrates', 'hegel', 'moore'],
        relationships: ['RELATES_TO', 'RELATES_TO'],
        distance: 2
      });
    });

    test('returns null when no path exists', async () => {
      mockRunCypher.mockResolvedValue(mockResult([]));

      const result = await findRelationshipPath('socrates', 'moore');
      expect(result).toBeNull();
    });

    test('returns null when Neo4j unavailable', async () => {
      mockRunCypher.mockResolvedValue(null);

      const result = await findRelationshipPath('socrates', 'moore');
      expect(result).toBeNull();
    });

    test('handles integer distance with toNumber()', async () => {
      const mockInt = { toNumber: () => 3 };
      mockRunCypher.mockResolvedValue(mockResult([
        { names: ['a', 'b', 'c', 'd'], relationships: ['R', 'R', 'R'], distance: mockInt }
      ]));

      const result = await findRelationshipPath('a', 'd');
      expect(result.distance).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // detectPersonaCommunities
  // ─────────────────────────────────────────────────────────────────────

  describe('detectPersonaCommunities', () => {
    test('returns community groupings', async () => {
      mockRunCypher.mockResolvedValue(mockResult([
        { community: 'philosophers', members: ['hegel', 'socrates', 'diogenes'], size: 3 },
        { community: 'mystics', members: ['crowley', 'dee'], size: 2 }
      ]));

      const result = await detectPersonaCommunities();
      expect(result).toEqual([
        { community: 'philosophers', members: ['hegel', 'socrates', 'diogenes'], size: 3 },
        { community: 'mystics', members: ['crowley', 'dee'], size: 2 }
      ]);
    });

    test('handles empty graph', async () => {
      mockRunCypher.mockResolvedValue(mockResult([]));

      const result = await detectPersonaCommunities();
      expect(result).toEqual([]);
    });

    test('returns null when Neo4j unavailable', async () => {
      mockRunCypher.mockResolvedValue(null);

      const result = await detectPersonaCommunities();
      expect(result).toBeNull();
    });

    test('handles integer size with toNumber()', async () => {
      const mockInt = { toNumber: () => 5 };
      mockRunCypher.mockResolvedValue(mockResult([
        { community: 'all', members: ['a', 'b', 'c', 'd', 'e'], size: mockInt }
      ]));

      const result = await detectPersonaCommunities();
      expect(result[0].size).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // findInfluenceChain
  // ─────────────────────────────────────────────────────────────────────

  describe('findInfluenceChain', () => {
    test('traces influence from a persona', async () => {
      mockRunCypher.mockResolvedValue(mockResult([
        { name: 'socrates', distance: 1, strengths: [0.8] },
        { name: 'diogenes', distance: 2, strengths: [0.8, 0.6] }
      ]));

      const result = await findInfluenceChain('hegel');
      expect(result).toEqual([
        { name: 'socrates', distance: 1, strengths: [0.8] },
        { name: 'diogenes', distance: 2, strengths: [0.8, 0.6] }
      ]);
    });

    test('caps depth at 6', async () => {
      mockRunCypher.mockResolvedValue(mockResult([]));

      await findInfluenceChain('hegel', 100);
      expect(mockRunCypher).toHaveBeenCalledWith(
        expect.stringContaining('*1..6'),
        { name: 'hegel' }
      );
    });

    test('uses default depth of 3', async () => {
      mockRunCypher.mockResolvedValue(mockResult([]));

      await findInfluenceChain('hegel');
      expect(mockRunCypher).toHaveBeenCalledWith(
        expect.stringContaining('*1..3'),
        { name: 'hegel' }
      );
    });

    test('returns null when Neo4j unavailable', async () => {
      mockRunCypher.mockResolvedValue(null);

      const result = await findInfluenceChain('hegel');
      expect(result).toBeNull();
    });

    test('handles empty results', async () => {
      mockRunCypher.mockResolvedValue(mockResult([]));

      const result = await findInfluenceChain('hegel');
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // findMostConnectedPersona
  // ─────────────────────────────────────────────────────────────────────

  describe('findMostConnectedPersona', () => {
    test('returns most connected persona', async () => {
      mockRunCypher.mockResolvedValue(mockResult([
        { name: 'hegel', category: 'philosophers', connections: 12 }
      ]));

      const result = await findMostConnectedPersona();
      expect(result).toEqual({
        name: 'hegel',
        category: 'philosophers',
        connections: 12
      });
    });

    test('returns null for empty graph', async () => {
      mockRunCypher.mockResolvedValue(mockResult([]));

      const result = await findMostConnectedPersona();
      expect(result).toBeNull();
    });

    test('returns null when Neo4j unavailable', async () => {
      mockRunCypher.mockResolvedValue(null);

      const result = await findMostConnectedPersona();
      expect(result).toBeNull();
    });

    test('handles integer connections with toNumber()', async () => {
      const mockInt = { toNumber: () => 25 };
      mockRunCypher.mockResolvedValue(mockResult([
        { name: 'hegel', category: 'philosophers', connections: mockInt }
      ]));

      const result = await findMostConnectedPersona();
      expect(result.connections).toBe(25);
    });
  });
});
