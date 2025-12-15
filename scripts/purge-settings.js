#!/usr/bin/env node
/**
 * Purge Stale Settings
 *
 * Removes user_settings records that haven't been updated in 90 days.
 * Run daily via cron to enforce data retention policy.
 *
 * Feature: 005-setting-preservation
 *
 * Usage:
 *   node scripts/purge-settings.js
 *
 * Cron example (daily at 3 AM):
 *   0 3 * * * node /path/to/aeon/scripts/purge-settings.js
 */

import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgres://architect:matrix_secret@localhost:5432/aeon_matrix';

async function purgeStaleSettings() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1
  });

  try {
    console.log('[PurgeSettings] Starting 90-day retention purge...');

    const result = await pool.query('SELECT purge_stale_settings() AS deleted_count');
    const deletedCount = result.rows[0].deleted_count;

    console.log(`[PurgeSettings] Purged ${deletedCount} stale setting records`);

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

    return { success: true, deletedCount };
  } catch (error) {
    console.error('[PurgeSettings] Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Run if executed directly
purgeStaleSettings()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('[PurgeSettings] Fatal error:', error);
    process.exit(1);
  });
