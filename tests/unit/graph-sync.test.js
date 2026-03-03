/**
 * Unit tests for graph-sync.js
 * PostgreSQL to Neo4j graph synchronization
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

const mockRunCypher = jest.fn();
const mockGetNeo4jDriver = jest.fn();

jest.unstable_mockModule('../../compute/neo4j-pool.js', () => ({
  runCypher: mockRunCypher,
  getNeo4jDriver: mockGetNeo4jDriver
}));

const mockLogOperation = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: mockLogOperation
}));

// Import after mocking
const {
  syncPersonasToGraph,
  syncUserRelationshipsToGraph,
  syncPersonaRelationshipsToGraph,
  fullGraphSync,
  safeGraphSync
} = await import('../../compute/graph-sync.js');

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Graph Sync Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNeo4jDriver.mockReturnValue({});
  });

  // ─────────────────────────────────────────────────────────────────────
  // syncPersonasToGraph
  // ─────────────────────────────────────────────────────────────────────

  describe('syncPersonasToGraph', () => {
    test('syncs persona rows from PG to Neo4j via UNWIND', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 1, name: 'hegel', category: 'philosophers' },
          { id: 2, name: 'socrates', category: 'philosophers' }
        ]
      });
      mockRunCypher.mockResolvedValue({ records: [] });

      const result = await syncPersonasToGraph();
      expect(result).toEqual({ synced: 2 });
      expect(mockRunCypher).toHaveBeenCalledTimes(1);
      expect(mockRunCypher).toHaveBeenCalledWith(
        expect.stringContaining('UNWIND $rows'),
        {
          rows: [
            { id: 1, name: 'hegel', category: 'philosophers' },
            { id: 2, name: 'socrates', category: 'philosophers' }
          ]
        }
      );
    });

    test('handles empty persona result', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await syncPersonasToGraph();
      expect(result).toEqual({ synced: 0 });
      expect(mockRunCypher).not.toHaveBeenCalled();
    });

    test('returns synced 0 when cypher returns null', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 1, name: 'hegel', category: 'philosophers' }]
      });
      mockRunCypher.mockResolvedValue(null);

      const result = await syncPersonasToGraph();
      expect(result).toEqual({ synced: 0 });
    });

    test('returns null and logs error on failure', async () => {
      mockQuery.mockRejectedValue(new Error('PG down'));

      const result = await syncPersonasToGraph();
      expect(result).toBeNull();
      expect(mockLogOperation).toHaveBeenCalledWith('error_graceful', expect.objectContaining({
        details: expect.objectContaining({ error_type: 'graph_sync_personas' }),
        success: false
      }));
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // syncUserRelationshipsToGraph
  // ─────────────────────────────────────────────────────────────────────

  describe('syncUserRelationshipsToGraph', () => {
    test('creates user node and relationship edges in single batched call', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          user_id: 'user-1',
          persona_id: 1,
          trust_level: 'FAMILIAR',
          familiarity_score: 0.7,
          interaction_count: 15,
          persona_name: 'hegel'
        }]
      });
      mockRunCypher.mockResolvedValue({ records: [] });

      const result = await syncUserRelationshipsToGraph('user-1');
      expect(result).toEqual({ synced: 1 });
      expect(mockRunCypher).toHaveBeenCalledTimes(1);
      expect(mockRunCypher).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (u:User {id: $userId})'),
        expect.objectContaining({
          userId: 'user-1',
          rels: [{ personaId: 1, trust: 'FAMILIAR', fam: 0.7, count: 15 }]
        })
      );
    });

    test('handles empty relationships result', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await syncUserRelationshipsToGraph('user-1');
      expect(result).toEqual({ synced: 0 });
      expect(mockRunCypher).not.toHaveBeenCalled();
    });

    test('syncs multiple relationships in single batch', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { user_id: 'user-1', persona_id: 1, trust_level: 'FAMILIAR', familiarity_score: 0.7, interaction_count: 15, persona_name: 'hegel' },
          { user_id: 'user-1', persona_id: 2, trust_level: 'STRANGER', familiarity_score: 0.1, interaction_count: 1, persona_name: 'socrates' }
        ]
      });
      mockRunCypher.mockResolvedValue({ records: [] });

      const result = await syncUserRelationshipsToGraph('user-1');
      expect(result).toEqual({ synced: 2 });
      expect(mockRunCypher).toHaveBeenCalledTimes(1);
    });

    test('passes correct parameters for relationship edge', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          user_id: 'user-1',
          persona_id: 5,
          trust_level: 'CONFIDANT',
          familiarity_score: 0.95,
          interaction_count: 50,
          persona_name: 'moore'
        }]
      });
      mockRunCypher.mockResolvedValue({ records: [] });

      await syncUserRelationshipsToGraph('user-1');
      expect(mockRunCypher).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (u)-[r:KNOWS]->(p)'),
        {
          userId: 'user-1',
          rels: [{ personaId: 5, trust: 'CONFIDANT', fam: 0.95, count: 50 }]
        }
      );
    });

    test('returns null and logs error on failure', async () => {
      mockQuery.mockRejectedValue(new Error('DB down'));

      const result = await syncUserRelationshipsToGraph('user-1');
      expect(result).toBeNull();
      expect(mockLogOperation).toHaveBeenCalledWith('error_graceful', expect.objectContaining({
        details: expect.objectContaining({ error_type: 'graph_sync_user_rels' }),
        success: false
      }));
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // syncPersonaRelationshipsToGraph
  // ─────────────────────────────────────────────────────────────────────

  describe('syncPersonaRelationshipsToGraph', () => {
    test('syncs persona bonds to graph via UNWIND', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          persona_id_a: 1,
          persona_id_b: 2,
          affinity_score: 0.8,
          bond_type: 'philosophical'
        }]
      });
      mockRunCypher.mockResolvedValue({ records: [] });

      const result = await syncPersonaRelationshipsToGraph();
      expect(result).toEqual({ synced: 1 });
      expect(mockRunCypher).toHaveBeenCalledTimes(1);
      expect(mockRunCypher).toHaveBeenCalledWith(
        expect.stringContaining('UNWIND $bonds'),
        {
          bonds: [{ idA: 1, idB: 2, type: 'philosophical', strength: 0.8 }]
        }
      );
    });

    test('handles missing persona_bonds table gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('relation "persona_bonds" does not exist'));

      const result = await syncPersonaRelationshipsToGraph();
      expect(result).toEqual({ synced: 0 });
    });

    test('uses neutral as default bond type', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          persona_id_a: 1,
          persona_id_b: 2,
          affinity_score: 0.5,
          bond_type: null
        }]
      });
      mockRunCypher.mockResolvedValue({ records: [] });

      await syncPersonaRelationshipsToGraph();
      expect(mockRunCypher).toHaveBeenCalledWith(
        expect.any(String),
        {
          bonds: [expect.objectContaining({ type: 'neutral' })]
        }
      );
    });

    test('handles empty bonds result', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await syncPersonaRelationshipsToGraph();
      expect(result).toEqual({ synced: 0 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // fullGraphSync
  // ─────────────────────────────────────────────────────────────────────

  describe('fullGraphSync', () => {
    test('orchestrates all sync operations', async () => {
      // First call: personas query
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'hegel', category: 'philosophers' }] });
      // Second call: persona_bonds query
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Third call: users query
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] });
      // Fourth call: user relationships query
      mockQuery.mockResolvedValueOnce({ rows: [] });

      mockRunCypher.mockResolvedValue({ records: [] });

      const result = await fullGraphSync();
      expect(result).toHaveProperty('personas_synced');
      expect(result).toHaveProperty('persona_relationships_synced');
      expect(result).toHaveProperty('user_relationships_synced');
      expect(result).toHaveProperty('duration_ms');
      expect(typeof result.duration_ms).toBe('number');
    });

    test('logs summary after sync', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // personas
      mockQuery.mockResolvedValueOnce({ rows: [] }); // bonds
      mockQuery.mockResolvedValueOnce({ rows: [] }); // users

      const result = await fullGraphSync();
      expect(mockLogOperation).toHaveBeenCalledWith('full_graph_sync', expect.objectContaining({
        details: expect.objectContaining({
          personas_synced: 0,
          persona_relationships_synced: 0,
          user_relationships_synced: 0
        }),
        success: true
      }));
    });

    test('handles logOperation failure gracefully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // personas
      mockQuery.mockResolvedValueOnce({ rows: [] }); // bonds
      mockQuery.mockResolvedValueOnce({ rows: [] }); // users
      mockLogOperation.mockRejectedValue(new Error('log failed'));

      // Should not throw
      const result = await fullGraphSync();
      expect(result).toHaveProperty('personas_synced', 0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // safeGraphSync
  // ─────────────────────────────────────────────────────────────────────

  describe('safeGraphSync', () => {
    test('returns null when no userId provided', async () => {
      const result = await safeGraphSync(null);
      expect(result).toBeNull();
    });

    test('returns null when userId is empty string', async () => {
      const result = await safeGraphSync('');
      expect(result).toBeNull();
    });

    test('returns null when Neo4j is not configured', async () => {
      mockGetNeo4jDriver.mockReturnValue(null);

      const result = await safeGraphSync('user-1');
      expect(result).toBeNull();
    });

    test('calls syncUserRelationshipsToGraph on success', async () => {
      mockGetNeo4jDriver.mockReturnValue({});
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await safeGraphSync('user-1');
      expect(result).toEqual({ synced: 0 });
      expect(mockQuery).toHaveBeenCalled();
    });

    test('returns null on error without throwing', async () => {
      mockGetNeo4jDriver.mockReturnValue({});
      mockQuery.mockRejectedValue(new Error('DB connection failed'));

      const result = await safeGraphSync('user-1');
      // syncUserRelationshipsToGraph catches its own error and returns null
      // safeGraphSync then logs success with synced: 0
      expect(result).toBeNull();
    });

    test('logs on sync completion', async () => {
      mockGetNeo4jDriver.mockReturnValue({});
      mockQuery.mockResolvedValue({ rows: [] });

      await safeGraphSync('user-1');
      expect(mockLogOperation).toHaveBeenCalledWith('safe_graph_sync', expect.objectContaining({
        details: expect.objectContaining({ user_id: 'user-1' }),
        success: true
      }));
    });
  });
});
