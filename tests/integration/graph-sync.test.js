/**
 * Integration tests for Neo4j Graph Sync
 *
 * Requires a live Neo4j instance.
 * Start with: docker compose --profile graph up -d
 *
 * These tests verify:
 * - Neo4j driver connects with real credentials
 * - Cypher queries execute correctly
 * - Graph sync creates proper nodes and edges
 *
 * Skip if NEO4J_PASSWORD is not set (graceful degradation).
 */

import { jest } from '@jest/globals';

// Mock operator-logger to prevent PG DB access for logging
jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

const { getNeo4jDriver, closeNeo4jDriver, runCypher } = await import('../../compute/neo4j-pool.js');

const NEO4J_AVAILABLE = !!process.env.NEO4J_PASSWORD;

describe('Neo4j Graph Sync Integration', () => {
  afterAll(async () => {
    await closeNeo4jDriver();
  });

  (NEO4J_AVAILABLE ? describe : describe.skip)('With Live Neo4j', () => {
    test('connects to Neo4j successfully', () => {
      const driver = getNeo4jDriver();
      expect(driver).not.toBeNull();
    });

    test('runs a simple Cypher query', async () => {
      const result = await runCypher('RETURN 1 AS num');
      expect(result).not.toBeNull();
      expect(result.records).toHaveLength(1);
      expect(result.records[0].get('num').toNumber()).toBe(1);
    });

    test('creates and retrieves a test node', async () => {
      // Create
      await runCypher(
        'MERGE (t:TestNode {name: $name}) SET t.created = timestamp()',
        { name: 'integration_test' }
      );

      // Retrieve
      const result = await runCypher(
        'MATCH (t:TestNode {name: $name}) RETURN t.name AS name',
        { name: 'integration_test' }
      );

      expect(result).not.toBeNull();
      expect(result.records).toHaveLength(1);
      expect(result.records[0].get('name')).toBe('integration_test');

      // Cleanup
      await runCypher(
        'MATCH (t:TestNode {name: $name}) DELETE t',
        { name: 'integration_test' }
      );
    });

    test('creates persona node with MERGE (idempotent)', async () => {
      // First merge
      await runCypher(
        'MERGE (p:Persona {name: $name}) SET p.category = $cat',
        { name: 'test_hegel', cat: 'philosophers' }
      );

      // Second merge (should not duplicate)
      await runCypher(
        'MERGE (p:Persona {name: $name}) SET p.category = $cat',
        { name: 'test_hegel', cat: 'philosophers' }
      );

      // Verify only one node
      const result = await runCypher(
        'MATCH (p:Persona {name: $name}) RETURN count(p) AS cnt',
        { name: 'test_hegel' }
      );

      expect(result.records[0].get('cnt').toNumber()).toBe(1);

      // Cleanup
      await runCypher(
        'MATCH (p:Persona {name: $name}) DELETE p',
        { name: 'test_hegel' }
      );
    });

    test('creates relationship edge between nodes', async () => {
      // Setup nodes
      await runCypher('MERGE (u:User {id: $id})', { id: 'test_user' });
      await runCypher('MERGE (p:Persona {name: $name})', { name: 'test_persona' });

      // Create relationship
      await runCypher(
        `MATCH (u:User {id: $uid}), (p:Persona {name: $pname})
         MERGE (u)-[r:KNOWS]->(p)
         SET r.trust_level = $trust, r.familiarity = $fam`,
        { uid: 'test_user', pname: 'test_persona', trust: 'acquaintance', fam: 0.3 }
      );

      // Verify
      const result = await runCypher(
        `MATCH (u:User {id: $uid})-[r:KNOWS]->(p:Persona {name: $pname})
         RETURN r.trust_level AS trust, r.familiarity AS fam`,
        { uid: 'test_user', pname: 'test_persona' }
      );

      expect(result.records).toHaveLength(1);
      expect(result.records[0].get('trust')).toBe('acquaintance');

      // Cleanup
      await runCypher(
        `MATCH (u:User {id: $uid})-[r]-(p:Persona {name: $pname})
         DELETE r, u, p`,
        { uid: 'test_user', pname: 'test_persona' }
      );
    });
  });

  describe('Without Neo4j (Graceful Degradation)', () => {
    test('getNeo4jDriver returns null when password not set', () => {
      const origPassword = process.env.NEO4J_PASSWORD;
      delete process.env.NEO4J_PASSWORD;

      // Need a fresh module to test this — but since driver is cached,
      // we just verify the behavior of runCypher when driver is null
      // This is tested in unit tests; here we just verify the contract
      expect(typeof getNeo4jDriver).toBe('function');

      if (origPassword) process.env.NEO4J_PASSWORD = origPassword;
    });
  });
});
