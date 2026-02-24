/**
 * AEON Matrix - Drift Analyzer
 *
 * Orchestrates voice drift analysis for persona responses.
 * Combines soul marker extraction, drift scoring, and persistent logging.
 *
 * Feature: 003-voice-fidelity
 * Constitution: Principle III (Voice Fidelity)
 */

import { getSharedPool } from './db-pool.js';
import { loadPersonaMarkers, getUniversalForbiddenPhrases } from './soul-marker-extractor.js';
import { logOperation } from './operator-logger.js';

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
// Severity Classification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify drift score into severity level.
 *
 * @param {number} driftScore - Drift score 0.0-1.0
 * @param {number} [threshold=0.3] - Custom WARNING threshold
 * @returns {'STABLE' | 'MINOR' | 'WARNING' | 'CRITICAL'} Severity level
 */
export function classifySeverity(driftScore, threshold = 0.3) {
  if (driftScore <= 0.1) {
    return 'STABLE';
  } else if (driftScore <= threshold) {
    return 'MINOR';
  } else if (driftScore <= threshold + 0.2) {
    return 'WARNING';
  } else {
    return 'CRITICAL';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Persona Drift Configuration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if drift analysis should run for a persona.
 *
 * @param {string} personaId - Persona identifier (name or UUID)
 * @returns {Promise<{enabled: boolean, threshold: number}>} Drift configuration
 */
export async function shouldAnalyzeDrift(personaId) {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT drift_check_enabled, drift_threshold
       FROM personas
       WHERE id::text = $1 OR LOWER(name) = LOWER($1)
       LIMIT 1`,
      [personaId]
    );

    if (result.rows.length > 0) {
      return {
        enabled: result.rows[0].drift_check_enabled ?? true,
        threshold: result.rows[0].drift_threshold ?? 0.3
      };
    }

    // Default if persona not found
    return { enabled: true, threshold: 0.3 };
  } catch (error) {
    console.error('[DriftAnalyzer] Error checking drift config, using defaults:', error.message);
    logOperation('error_graceful', {
      personaId,
      details: {
        error_type: 'drift_config_fetch_failure',
        error_message: error.message,
        fallback_used: 'enabled=true, threshold=0.3'
      },
      success: false
    }).catch(() => {});
    return { enabled: true, threshold: 0.3 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maximum number of items to store in diagnostic arrays.
 * Prevents unbounded array growth in logs.
 */
const MAX_DIAGNOSTIC_ITEMS = 10;

// ═══════════════════════════════════════════════════════════════════════════
// Core Drift Detection Algorithm
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect drift in a response against soul markers.
 * This is the core scoring algorithm.
 *
 * @param {string} text - Response text to analyze
 * @param {Object} markers - Soul markers object
 * @returns {Object} Drift detection result
 */
function detectDrift(text, markers) {
  const lowerText = text.toLowerCase();
  const result = {
    driftScore: 0,
    forbiddenUsed: [],
    missingVocabulary: [],
    patternViolations: [],
    genericAIDetected: [],
    warnings: [],
    scores: {
      forbidden: 0,
      vocabulary: 0,
      patterns: 0,
      genericAI: 0
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK 1: Forbidden phrases (highest penalty)
  // ─────────────────────────────────────────────────────────────────────────
  if (markers.forbidden && markers.forbidden.length > 0) {
    for (const forbidden of markers.forbidden) {
      if (lowerText.includes(forbidden.toLowerCase())) {
        result.forbiddenUsed.push(forbidden);
        result.scores.forbidden += 0.3;
        result.warnings.push(`Persona-specific forbidden phrase: "${forbidden}"`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK 2: Universal AI phrases (generic AI detection)
  // ─────────────────────────────────────────────────────────────────────────
  const universalForbidden = markers.universalForbidden || getUniversalForbiddenPhrases();
  for (const phrase of universalForbidden) {
    if (lowerText.includes(phrase.toLowerCase())) {
      result.genericAIDetected.push(phrase);
      result.scores.genericAI += 0.15;
      result.warnings.push(`Generic AI phrase detected: "${phrase}"`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK 3: Missing characteristic vocabulary
  // ─────────────────────────────────────────────────────────────────────────
  if (markers.vocabulary && markers.vocabulary.length > 0) {
    let vocabHits = 0;
    for (const word of markers.vocabulary) {
      if (lowerText.includes(word.toLowerCase())) {
        vocabHits++;
      } else {
        // Limit array growth to prevent log bloat
        if (result.missingVocabulary.length < MAX_DIAGNOSTIC_ITEMS) {
          result.missingVocabulary.push(word);
        }
      }
    }

    // If less than 30% of vocabulary is present, that's drift
    const vocabRatio = vocabHits / markers.vocabulary.length;
    if (vocabRatio < 0.3) {
      const penalty = (0.3 - vocabRatio) * 0.5; // Max 0.15 penalty
      result.scores.vocabulary = penalty;
      result.warnings.push(`Low vocabulary match: ${(vocabRatio * 100).toFixed(0)}%`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK 4: Pattern violations
  // ─────────────────────────────────────────────────────────────────────────
  if (markers.patterns && markers.patterns.length > 0) {
    for (const pattern of markers.patterns) {
      if (pattern.regex) {
        try {
          const regex = new RegExp(pattern.regex, 'i');
          if (!regex.test(text)) {
            result.patternViolations.push(pattern.name);
            result.scores.patterns += 0.1;
          }
        } catch (error) {
          console.warn(`[DriftAnalyzer] Invalid regex pattern "${pattern.name}": ${error.message}`);
        }
      }
    }
  }

  // Calculate total drift score (capped at 1.0)
  result.driftScore = Math.min(
    result.scores.forbidden +
    result.scores.vocabulary +
    result.scores.patterns +
    result.scores.genericAI,
    1.0
  );

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Analysis Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze a persona response for voice drift.
 *
 * @param {string} response - The persona's response text
 * @param {string} personaId - Persona identifier (name or UUID)
 * @param {string} [sessionId] - Session UUID for logging context
 * @returns {Promise<Object>} DriftAnalysis result
 */
export async function analyzeDrift(response, personaId, sessionId = null) {
  const startTime = performance.now();

  // Initialize result structure
  const analysis = {
    driftScore: 0,
    severity: 'STABLE',
    forbiddenUsed: [],
    missingVocabulary: [],
    patternViolations: [],
    genericAIDetected: [],
    warnings: [],
    scores: {
      forbidden: 0,
      vocabulary: 0,
      patterns: 0,
      genericAI: 0
    },
    personaId,
    sessionId,
    responseLength: response?.length || 0,
    analysisTimeMs: 0
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Check 1: Response length validation
  // ─────────────────────────────────────────────────────────────────────────
  if (!response || response.length < 10) {
    analysis.warnings.push('insufficient_content');
    analysis.analysisTimeMs = performance.now() - startTime;
    return analysis;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check 2: Should drift analysis run for this persona?
  // ─────────────────────────────────────────────────────────────────────────
  const config = await shouldAnalyzeDrift(personaId);

  if (!config.enabled) {
    analysis.warnings.push('drift_check_disabled');
    analysis.analysisTimeMs = performance.now() - startTime;
    return analysis;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Load soul markers for persona
  // ─────────────────────────────────────────────────────────────────────────
  const markers = await loadPersonaMarkers(personaId);

  // ─────────────────────────────────────────────────────────────────────────
  // Run drift detection
  // ─────────────────────────────────────────────────────────────────────────
  const driftResult = detectDrift(response, markers);

  // Merge results
  analysis.driftScore = driftResult.driftScore;
  analysis.forbiddenUsed = driftResult.forbiddenUsed;
  analysis.missingVocabulary = driftResult.missingVocabulary;
  analysis.patternViolations = driftResult.patternViolations;
  analysis.genericAIDetected = driftResult.genericAIDetected;
  analysis.warnings = driftResult.warnings;
  analysis.scores = driftResult.scores;

  // Classify severity using persona-specific threshold
  analysis.severity = classifySeverity(analysis.driftScore, config.threshold);

  // Record timing
  analysis.analysisTimeMs = performance.now() - startTime;

  // ─────────────────────────────────────────────────────────────────────────
  // Fire-and-forget logging to operator_logs
  // ─────────────────────────────────────────────────────────────────────────
  logOperation('drift_detection', {
    sessionId,
    personaId,
    details: {
      drift_score: analysis.driftScore,
      severity: analysis.severity,
      forbidden_used: analysis.forbiddenUsed,
      missing_vocabulary: analysis.missingVocabulary,
      pattern_violations: analysis.patternViolations,
      generic_ai_detected: analysis.genericAIDetected,
      warnings: analysis.warnings,
      response_excerpt: response.substring(0, 200),
      analysis_time_ms: analysis.analysisTimeMs
    },
    durationMs: analysis.analysisTimeMs,
    success: analysis.severity !== 'CRITICAL'
  }).catch(() => {
    // Fire-and-forget: silently ignore logging errors
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Create drift alert if severity >= WARNING
  // ─────────────────────────────────────────────────────────────────────────
  if (analysis.severity === 'WARNING' || analysis.severity === 'CRITICAL') {
    createDriftAlert(personaId, analysis.driftScore).catch((error) => {
      console.error('[DriftAnalyzer] Failed to create drift alert:', error.message);
    });
  }

  return analysis;
}

/**
 * Create a drift alert for operator review.
 *
 * @param {string} personaId - Persona identifier
 * @param {number} driftScore - Drift score
 * @returns {Promise<void>}
 */
async function createDriftAlert(personaId, driftScore) {
  try {
    const db = getPool();

    // Get persona UUID if we have a name
    const personaResult = await db.query(
      `SELECT id FROM personas WHERE id::text = $1 OR LOWER(name) = LOWER($1) LIMIT 1`,
      [personaId]
    );

    if (personaResult.rows.length > 0) {
      const personaUuid = personaResult.rows[0].id;
      await db.query(
        `INSERT INTO drift_alerts (persona_id, drift_score) VALUES ($1, $2)`,
        [personaUuid, driftScore]
      );
    }
  } catch (error) {
    console.error('[DriftAnalyzer] Error creating drift alert:', error.message);
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
