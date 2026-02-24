/**
 * AEON Matrix - Drift Dashboard
 *
 * Provides aggregate drift statistics for operator monitoring.
 * Enables operators to quickly identify drifting personas, common violations,
 * and trend directions across all 25 personas.
 *
 * Feature: 003-voice-fidelity
 * Constitution: Principle III (Voice Fidelity)
 */

import { getSharedPool } from './db-pool.js';

// ═══════════════════════════════════════════════════════════════════════════
// Database Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get database connection pool.
 *
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

// ═══════════════════════════════════════════════════════════════════════════
// Persona Drift Summary
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get drift summary for all personas over a time period.
 *
 * @param {number} [hours=24] - Time window in hours
 * @returns {Promise<Array<Object>>} Array of PersonaDriftSummary objects
 */
export async function getPersonaDriftSummary(hours = 24) {
  try {
    const db = getPool();

    // Query with dynamic time window
    const result = await db.query(`
      SELECT
        p.id as persona_id,
        p.name as persona_name,
        p.category,
        COALESCE(AVG((ol.details->>'drift_score')::float), 0) as avg_drift,
        COALESCE(MAX((ol.details->>'drift_score')::float), 0) as max_drift,
        COUNT(*) FILTER (WHERE ol.details->>'severity' = 'CRITICAL') as critical_count,
        COUNT(*) FILTER (WHERE ol.details->>'severity' = 'WARNING') as warning_count,
        COUNT(*) FILTER (WHERE ol.details->>'severity' = 'MINOR') as minor_count,
        COUNT(*) FILTER (WHERE ol.details->>'severity' = 'STABLE') as stable_count,
        COUNT(ol.id) as total_analyses
      FROM personas p
      LEFT JOIN operator_logs ol ON ol.persona_id = p.id
        AND ol.operation = 'drift_detection'
        AND ol.created_at > NOW() - ($1 || ' hours')::INTERVAL
      GROUP BY p.id, p.name, p.category
      ORDER BY avg_drift DESC
    `, [hours]);

    // Add needsAttention flag
    return result.rows.map(row => ({
      personaId: row.persona_id,
      personaName: row.persona_name,
      category: row.category,
      avgDrift: parseFloat(row.avg_drift) || 0,
      maxDrift: parseFloat(row.max_drift) || 0,
      criticalCount: parseInt(row.critical_count) || 0,
      warningCount: parseInt(row.warning_count) || 0,
      minorCount: parseInt(row.minor_count) || 0,
      stableCount: parseInt(row.stable_count) || 0,
      totalAnalyses: parseInt(row.total_analyses) || 0,
      needsAttention: parseInt(row.critical_count) > 0 || parseFloat(row.avg_drift) > 0.3
    }));
  } catch (error) {
    console.error('[DriftDashboard] Error getting persona summary:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trending Violations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the most common forbidden phrase violations.
 *
 * @param {number} [hours=24] - Time window in hours
 * @param {number} [limit=20] - Max results
 * @returns {Promise<Array<Object>>} Array of ViolationTrend objects
 */
export async function getTrendingViolations(hours = 24, limit = 20) {
  try {
    const db = getPool();

    const result = await db.query(`
      SELECT
        phrase,
        COUNT(*) as usage_count,
        COUNT(DISTINCT ol.persona_id) as personas_affected,
        array_agg(DISTINCT p.name) as affected_personas
      FROM operator_logs ol
      CROSS JOIN LATERAL jsonb_array_elements_text(
        COALESCE(ol.details->'forbidden_used', '[]'::jsonb) ||
        COALESCE(ol.details->'generic_ai_detected', '[]'::jsonb)
      ) as phrase
      JOIN personas p ON ol.persona_id = p.id
      WHERE ol.operation = 'drift_detection'
        AND ol.created_at > NOW() - ($1 || ' hours')::INTERVAL
      GROUP BY phrase
      ORDER BY usage_count DESC
      LIMIT $2
    `, [hours, limit]);

    return result.rows.map(row => ({
      phrase: row.phrase,
      usageCount: parseInt(row.usage_count) || 0,
      personasAffected: parseInt(row.personas_affected) || 0,
      affectedPersonas: row.affected_personas || []
    }));
  } catch (error) {
    console.error('[DriftDashboard] Error getting trending violations:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Drift Time Series
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get hourly drift averages for trend analysis.
 *
 * @param {string} [personaId] - Filter to specific persona (all if omitted)
 * @param {number} [hours=168] - Time window in hours (default: 7 days)
 * @returns {Promise<Array<Object>>} Array of DriftTimePoint objects
 */
export async function getDriftTimeSeries(personaId = null, hours = 168) {
  try {
    const db = getPool();

    let query = `
      SELECT
        date_trunc('hour', ol.created_at) as hour,
        p.name as persona_name,
        AVG((ol.details->>'drift_score')::float) as avg_drift,
        COUNT(*) as analysis_count
      FROM operator_logs ol
      JOIN personas p ON ol.persona_id = p.id
      WHERE ol.operation = 'drift_detection'
        AND ol.created_at > NOW() - ($1 || ' hours')::INTERVAL
    `;

    const params = [hours];

    if (personaId) {
      query += ` AND (p.id::text = $2 OR LOWER(p.name) = LOWER($2))`;
      params.push(personaId);
    }

    query += `
      GROUP BY date_trunc('hour', ol.created_at), p.name
      ORDER BY hour DESC, avg_drift DESC
    `;

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      hour: new Date(row.hour),
      personaName: row.persona_name,
      avgDrift: parseFloat(row.avg_drift) || 0,
      analysisCount: parseInt(row.analysis_count) || 0
    }));
  } catch (error) {
    console.error('[DriftDashboard] Error getting time series:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Individual Persona Stats
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get detailed drift statistics for a single persona.
 *
 * @param {string} personaId - Persona identifier (name or UUID)
 * @param {number} [hours=24] - Time window in hours
 * @returns {Promise<Object>} PersonaDriftStats object
 */
export async function getPersonaDriftStats(personaId, hours = 24) {
  try {
    const db = getPool();

    // Get persona UUID
    const personaResult = await db.query(
      `SELECT id, name FROM personas WHERE id::text = $1 OR LOWER(name) = LOWER($1) LIMIT 1`,
      [personaId]
    );

    if (personaResult.rows.length === 0) {
      console.warn(`[DriftDashboard] Persona not found: ${personaId}`);
      return getEmptyStats(personaId);
    }

    const persona = personaResult.rows[0];

    // Get stats using database function
    const statsResult = await db.query(
      `SELECT * FROM get_persona_drift_stats($1, $2)`,
      [persona.id, hours]
    );

    const stats = statsResult.rows[0] || {};

    // Get recent alerts
    const alertsResult = await db.query(`
      SELECT id, drift_score, detected_at, resolved_at IS NOT NULL as resolved, resolution_notes
      FROM drift_alerts
      WHERE persona_id = $1
      ORDER BY detected_at DESC
      LIMIT 10
    `, [persona.id]);

    // Calculate trend direction
    const trendDirection = await calculateTrendDirection(persona.id, hours);

    return {
      personaId: persona.id,
      personaName: persona.name,
      avgDrift: parseFloat(stats.avg_drift) || 0,
      maxDrift: parseFloat(stats.max_drift) || 0,
      criticalCount: parseInt(stats.critical_count) || 0,
      warningCount: parseInt(stats.warning_count) || 0,
      totalCount: parseInt(stats.total_count) || 0,
      topViolations: stats.top_violations || [],
      trendDirection,
      recentAlerts: alertsResult.rows.map(row => ({
        id: row.id,
        driftScore: parseFloat(row.drift_score),
        detectedAt: new Date(row.detected_at),
        resolved: row.resolved,
        resolutionNotes: row.resolution_notes
      }))
    };
  } catch (error) {
    console.error('[DriftDashboard] Error getting persona stats:', error.message);
    return getEmptyStats(personaId);
  }
}

/**
 * Calculate trend direction by comparing current period to previous period.
 *
 * @param {string} personaUuid - Persona UUID
 * @param {number} hours - Time window in hours
 * @returns {Promise<'improving' | 'stable' | 'worsening'>} Trend direction
 */
async function calculateTrendDirection(personaUuid, hours) {
  try {
    const db = getPool();

    const result = await db.query(`
      WITH current_period AS (
        SELECT AVG((details->>'drift_score')::float) as avg_drift
        FROM operator_logs
        WHERE persona_id = $1
          AND operation = 'drift_detection'
          AND created_at > NOW() - ($2 || ' hours')::INTERVAL
      ),
      previous_period AS (
        SELECT AVG((details->>'drift_score')::float) as avg_drift
        FROM operator_logs
        WHERE persona_id = $1
          AND operation = 'drift_detection'
          AND created_at > NOW() - ($2 * 2 || ' hours')::INTERVAL
          AND created_at <= NOW() - ($2 || ' hours')::INTERVAL
      )
      SELECT
        COALESCE(c.avg_drift, 0) as current_avg,
        COALESCE(p.avg_drift, 0) as previous_avg
      FROM current_period c, previous_period p
    `, [personaUuid, hours]);

    if (result.rows.length === 0) {
      return 'stable';
    }

    const { current_avg, previous_avg } = result.rows[0];
    const diff = current_avg - previous_avg;

    if (diff < -0.05) {
      return 'improving';
    } else if (diff > 0.05) {
      return 'worsening';
    }
    return 'stable';
  } catch (error) {
    console.error('[DriftDashboard] Error calculating trend direction:', error.message);
    return 'stable';
  }
}

/**
 * Get empty stats for when persona lookup fails.
 */
function getEmptyStats(personaId) {
  return {
    personaId,
    personaName: personaId,
    avgDrift: 0,
    maxDrift: 0,
    criticalCount: 0,
    warningCount: 0,
    totalCount: 0,
    topViolations: [],
    trendDirection: 'stable',
    recentAlerts: []
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Overview
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a high-level overview for the operator dashboard home.
 *
 * @returns {Promise<Object>} DriftOverview object
 */
export async function getDriftOverview() {
  try {
    const db = getPool();

    // Get 24-hour summary
    const summaryResult = await db.query(`
      SELECT
        COUNT(*) as total_analyses,
        COALESCE(AVG((details->>'drift_score')::float), 0) as avg_system_drift,
        COUNT(*) FILTER (WHERE details->>'severity' = 'CRITICAL') as critical_alerts,
        COUNT(*) FILTER (WHERE details->>'severity' = 'WARNING') as warning_alerts
      FROM operator_logs
      WHERE operation = 'drift_detection'
        AND created_at > NOW() - INTERVAL '24 hours'
    `);

    const summary = summaryResult.rows[0] || {};

    // Get personas needing attention
    const attentionResult = await db.query(`
      SELECT
        p.name as persona_name,
        AVG((ol.details->>'drift_score')::float) as avg_drift,
        COUNT(*) FILTER (WHERE ol.details->>'severity' = 'CRITICAL') as critical_count
      FROM personas p
      JOIN operator_logs ol ON ol.persona_id = p.id
      WHERE ol.operation = 'drift_detection'
        AND ol.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY p.id, p.name
      HAVING AVG((ol.details->>'drift_score')::float) > 0.3
         OR COUNT(*) FILTER (WHERE ol.details->>'severity' = 'CRITICAL') > 0
      ORDER BY avg_drift DESC
      LIMIT 5
    `);

    // Get top violations
    const violationsResult = await db.query(`
      SELECT
        phrase,
        COUNT(*) as count
      FROM operator_logs ol
      CROSS JOIN LATERAL jsonb_array_elements_text(
        COALESCE(ol.details->'forbidden_used', '[]'::jsonb) ||
        COALESCE(ol.details->'generic_ai_detected', '[]'::jsonb)
      ) as phrase
      WHERE ol.operation = 'drift_detection'
        AND ol.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY phrase
      ORDER BY count DESC
      LIMIT 5
    `);

    // Calculate overall trend
    const trendResult = await db.query(`
      WITH current_period AS (
        SELECT AVG((details->>'drift_score')::float) as avg_drift
        FROM operator_logs
        WHERE operation = 'drift_detection'
          AND created_at > NOW() - INTERVAL '24 hours'
      ),
      previous_period AS (
        SELECT AVG((details->>'drift_score')::float) as avg_drift
        FROM operator_logs
        WHERE operation = 'drift_detection'
          AND created_at > NOW() - INTERVAL '48 hours'
          AND created_at <= NOW() - INTERVAL '24 hours'
      )
      SELECT
        COALESCE(c.avg_drift, 0) as current_avg,
        COALESCE(p.avg_drift, 0) as previous_avg
      FROM current_period c, previous_period p
    `);

    let trendDirection = 'stable';
    if (trendResult.rows.length > 0) {
      const { current_avg, previous_avg } = trendResult.rows[0];
      const diff = current_avg - previous_avg;
      if (diff < -0.05) trendDirection = 'improving';
      else if (diff > 0.05) trendDirection = 'worsening';
    }

    return {
      totalAnalyses: parseInt(summary.total_analyses) || 0,
      avgSystemDrift: parseFloat(summary.avg_system_drift) || 0,
      criticalAlerts: parseInt(summary.critical_alerts) || 0,
      warningAlerts: parseInt(summary.warning_alerts) || 0,
      personasNeedingAttention: attentionResult.rows.map(row => ({
        personaName: row.persona_name,
        avgDrift: parseFloat(row.avg_drift) || 0,
        reason: parseInt(row.critical_count) > 0
          ? `${row.critical_count} critical alerts`
          : 'High average drift'
      })),
      topViolations: violationsResult.rows.map(row => ({
        phrase: row.phrase,
        count: parseInt(row.count) || 0
      })),
      trendDirection,
      trendComparisonPeriod: 'vs previous 24h'
    };
  } catch (error) {
    console.error('[DriftDashboard] Error getting overview:', error.message);
    return {
      totalAnalyses: 0,
      avgSystemDrift: 0,
      criticalAlerts: 0,
      warningAlerts: 0,
      personasNeedingAttention: [],
      topViolations: [],
      trendDirection: 'stable',
      trendComparisonPeriod: 'vs previous 24h'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Alert Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mark a drift alert as resolved.
 *
 * @param {string} alertId - UUID of drift alert
 * @param {string} [notes] - Resolution notes from operator
 * @returns {Promise<void>}
 */
export async function resolveAlert(alertId, notes = null) {
  try {
    const db = getPool();

    await db.query(`
      UPDATE drift_alerts
      SET resolved_at = NOW(), resolution_notes = $2
      WHERE id = $1
    `, [alertId, notes]);
  } catch (error) {
    console.error('[DriftDashboard] Error resolving alert:', error.message);
    throw error;
  }
}

/**
 * Close the database connection pool.
 * @deprecated Use closeSharedPool() from db-pool.js instead
 *
 * @returns {Promise<void>}
 */
export async function closePool() {
  // No-op: pool lifecycle is managed by db-pool.js
}
