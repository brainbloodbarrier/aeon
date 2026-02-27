#!/usr/bin/env node
/**
 * AEON Matrix - Operator Logs Inspector
 *
 * CLI tool for inspecting operator_logs entries.
 * For developer/operator use only (Constitution Principle II).
 *
 * Usage:
 *   node scripts/inspect-logs.js [options]
 *
 * Options:
 *   --persona <name>       Filter by persona name
 *   --operation <type>     Filter by operation type
 *   --since <duration>     Filter by time window (e.g., 1h, 24h, 7d, 30d)
 *   --severity <level>     Filter by severity in details
 *   --success              Show only successful operations
 *   --failed               Show only failed operations
 *   --limit <n>            Max results (default: 50)
 *   --json                 Output as JSON array
 *   --help                 Show this help message
 *
 * Examples:
 *   node scripts/inspect-logs.js --persona pessoa --since 24h
 *   node scripts/inspect-logs.js --operation drift_correction --limit 10
 *   node scripts/inspect-logs.js --since 7d --json
 *   node scripts/inspect-logs.js --failed --since 1h
 *
 * Issue: #30
 */

import { getSharedPool, closeSharedPool } from '../compute/db-pool.js';

const HELP_TEXT = `
AEON Matrix - Operator Logs Inspector
For developer/operator use only.

Usage:
  node scripts/inspect-logs.js [options]

Options:
  --persona <name>       Filter by persona name
  --operation <type>     Filter by operation type
  --since <duration>     Time window: e.g., 1h, 24h, 7d, 30d
  --severity <level>     Filter by severity in details JSON
  --success              Show only successful operations
  --failed               Show only failed operations
  --limit <n>            Max results (default: 50)
  --json                 Output as JSON array
  --help                 Show this help message

Examples:
  node scripts/inspect-logs.js --persona pessoa --since 24h
  node scripts/inspect-logs.js --operation drift_correction --limit 10
  node scripts/inspect-logs.js --since 7d --json
  node scripts/inspect-logs.js --failed --since 1h
`.trim();

/**
 * Parse a duration string like "24h", "7d", "30d" into a PostgreSQL interval string.
 *
 * @param {string} duration - Duration string (e.g., "1h", "24h", "7d", "30d")
 * @returns {string} PostgreSQL interval string
 */
function parseDuration(duration) {
  const match = duration.match(/^(\d+)(h|d|m)$/);
  if (!match) {
    console.error(`[InspectLogs] Invalid duration format: "${duration}". Use e.g., 1h, 24h, 7d, 30d`);
    process.exit(1);
  }
  const [, value, unit] = match;
  const unitMap = { h: 'hours', d: 'days', m: 'minutes' };
  return `${value} ${unitMap[unit]}`;
}

/**
 * Parse CLI arguments from process.argv.
 *
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    persona: null,
    operation: null,
    since: null,
    severity: null,
    success: null,
    limit: 50,
    json: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      case '--persona':
        parsed.persona = args[++i];
        break;
      case '--operation':
        parsed.operation = args[++i];
        break;
      case '--since':
        parsed.since = args[++i];
        break;
      case '--severity':
        parsed.severity = args[++i];
        break;
      case '--success':
        parsed.success = true;
        break;
      case '--failed':
        parsed.success = false;
        break;
      case '--limit':
        parsed.limit = parseInt(args[++i], 10);
        if (isNaN(parsed.limit) || parsed.limit < 1) {
          console.error('[InspectLogs] --limit must be a positive integer');
          process.exit(1);
        }
        break;
      case '--json':
        parsed.json = true;
        break;
      default:
        console.error(`[InspectLogs] Unknown option: ${args[i]}`);
        console.error('Run with --help for usage information.');
        process.exit(1);
    }
  }

  return parsed;
}

/**
 * Build the SQL query and parameters from parsed arguments.
 *
 * @param {Object} opts - Parsed CLI options
 * @returns {{ text: string, values: Array }} Parameterized query
 */
function buildQuery(opts) {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (opts.persona) {
    conditions.push(`p.name = $${paramIndex++}`);
    values.push(opts.persona);
  }

  if (opts.operation) {
    conditions.push(`ol.operation = $${paramIndex++}`);
    values.push(opts.operation);
  }

  if (opts.since) {
    const interval = parseDuration(opts.since);
    conditions.push(`ol.created_at > NOW() - $${paramIndex++}::INTERVAL`);
    values.push(interval);
  }

  if (opts.severity) {
    conditions.push(`ol.details->>'severity' = $${paramIndex++}`);
    values.push(opts.severity);
  }

  if (opts.success !== null) {
    conditions.push(`ol.success = $${paramIndex++}`);
    values.push(opts.success);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const text = `
    SELECT
      ol.id,
      p.name AS persona,
      ol.operation,
      ol.details,
      ol.duration_ms,
      ol.success,
      ol.created_at
    FROM operator_logs ol
    LEFT JOIN personas p ON ol.persona_id = p.id
    ${whereClause}
    ORDER BY ol.created_at DESC
    LIMIT $${paramIndex}
  `;
  values.push(opts.limit);

  return { text, values };
}

/**
 * Format a row for table display.
 *
 * @param {Object} row - Database row
 * @returns {Object} Formatted row for console.table
 */
function formatRow(row) {
  const ts = new Date(row.created_at).toISOString().replace('T', ' ').slice(0, 19);
  const details = row.details
    ? JSON.stringify(row.details).slice(0, 60)
    : '';
  return {
    time: ts,
    persona: row.persona || '-',
    operation: row.operation,
    success: row.success ? 'Y' : 'N',
    ms: row.duration_ms ?? '-',
    details: details.length === 60 ? details + '...' : details,
  };
}

async function main() {
  const opts = parseArgs();

  if (opts.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const pool = getSharedPool();

  try {
    const { text, values } = buildQuery(opts);
    const result = await pool.query(text, values);

    if (result.rows.length === 0) {
      console.log('[InspectLogs] No matching log entries found.');
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(result.rows, null, 2));
    } else {
      console.log(`[InspectLogs] Found ${result.rows.length} entries:\n`);
      console.table(result.rows.map(formatRow));
    }
  } catch (error) {
    console.error('[InspectLogs] Query error:', error.message);
    process.exit(1);
  } finally {
    await closeSharedPool();
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[InspectLogs] Fatal error:', error.message);
    process.exit(1);
  });
