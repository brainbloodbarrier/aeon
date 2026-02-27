#!/usr/bin/env node
/**
 * Purge Stale Settings
 *
 * Removes user_settings records that haven't been updated in 90 days.
 * Can be run standalone via CLI or imported for lazy purge in context-assembler.
 *
 * Feature: 005-setting-preservation
 *
 * Usage (standalone):
 *   node scripts/purge-settings.js
 *
 * Usage (imported):
 *   import { purgeStaleSettings } from '../scripts/purge-settings.js';
 *   await purgeStaleSettings(pool);
 */

import pg from 'pg';

const { Pool } = pg;

/**
 * Purge user_settings records inactive for more than 90 days.
 *
 * @param {Object} pool - PostgreSQL pool instance (uses getSharedPool when imported)
 * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
 */
export async function purgeStaleSettings(pool) {
  try {
    const result = await pool.query('SELECT purge_stale_settings() AS deleted_count');
    const deletedCount = result.rows[0].deleted_count;
    return { success: true, deletedCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Standalone entry point with its own pool and verbose logging.
 */
async function runStandalone() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[PurgeSettings] DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1
  });

  try {
    console.log('[PurgeSettings] Starting 90-day retention purge...');

    const purgeResult = await purgeStaleSettings(pool);

    if (!purgeResult.success) {
      console.error('[PurgeSettings] Error:', purgeResult.error);
      return purgeResult;
    }

    console.log(`[PurgeSettings] Purged ${purgeResult.deletedCount} stale setting records`);

    // Log summary
    const stats = await pool.query(`
      SELECT
        COUNT(*) AS total_settings,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days') AS active_30d,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '60 days') AS active_60d
      FROM user_settings
    `);

    const { total_settings, active_30d, active_60d } = stats.rows[0];
    console.log(`[PurgeSettings] Remaining: ${total_settings} total, ${active_30d} active (30d), ${active_60d} active (60d)`);

    return purgeResult;
  } catch (error) {
    console.error('[PurgeSettings] Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Run if executed directly (ESM equivalent of require.main === module)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
  runStandalone()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('[PurgeSettings] Fatal error:', error);
      process.exit(1);
    });
}
