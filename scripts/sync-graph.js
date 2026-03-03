#!/usr/bin/env node
/**
 * Manual Neo4j graph sync CLI.
 * Usage: node scripts/sync-graph.js
 */

import { fullGraphSync } from '../compute/graph-sync.js';
import { closeNeo4jDriver } from '../compute/neo4j-pool.js';
import { closeSharedPool } from '../compute/db-pool.js';

async function main() {
  console.log('[GraphSync] Starting full graph sync...');

  try {
    const result = await fullGraphSync();
    console.log('[GraphSync] Sync complete:', result);
  } catch (error) {
    console.error('[GraphSync] Sync failed:', error.message);
    process.exitCode = 1;
  } finally {
    await closeNeo4jDriver();
    await closeSharedPool();
  }
}

main();
