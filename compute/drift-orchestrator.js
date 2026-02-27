/**
 * AEON Matrix - Drift Orchestrator
 *
 * Extracted from context-assembler.js to handle drift-related safe*Fetch functions,
 * drift correction logic, voice fidelity helpers, and soul validation.
 *
 * All safe*Fetch helpers catch errors and return null — a failing subsystem
 * must never break context assembly (Constitution Principle II).
 *
 * Feature: 002-invisible-infrastructure
 */

import { logOperation } from './operator-logger.js';
import { analyzeDrift } from './drift-analyzer.js';
import { generateDriftCorrection } from './drift-correction.js';
import { loadPersonaMarkers } from './soul-marker-extractor.js';
import { validateSoulCached, alertOnCritical } from './soul-validator.js';

/**
 * Safely validate soul file integrity at invocation time.
 * Constitution Principle I: Soul Immutability.
 *
 * @param {string} personaSlug - Persona slug name
 * @param {string} sessionId - Session UUID
 * @returns {Promise<boolean>} True if valid or validation skipped, false if tampered
 */
export async function safeSoulValidation(personaSlug, sessionId) {
  if (!personaSlug) return true;

  const startTime = Date.now();

  try {
    const result = await validateSoulCached(personaSlug);

    if (!result.valid) {
      // Fire-and-forget critical alert
      alertOnCritical(result).catch(() => {});

      await logOperation('soul_validation_failure', {
        sessionId,
        details: {
          persona: personaSlug,
          errors: result.errors,
          hash_match: result.metadata.hashMatch,
          structure_valid: result.metadata.structureValid
        },
        durationMs: Date.now() - startTime,
        success: false
      });

      return false;
    }

    return true;
  } catch (error) {
    // Validation error should not block invocation
    await logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'soul_validation_error',
        error_message: error.message,
        fallback_used: 'proceed_without_validation'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return true;
  }
}

/**
 * Safely run drift analysis and generate correction for a previous response.
 * Follows safe-fetch pattern: try/catch, logOperation, return null on failure.
 *
 * @param {string} previousResponse - The persona's previous response text
 * @param {string} personaId - Persona UUID
 * @param {string} personaSlug - Persona slug (for marker loading)
 * @param {string} sessionId - Session UUID
 * @returns {Promise<{correction: string|null, score: number}|null>} Drift result or null
 */
export async function safeDriftFetch(previousResponse, personaId, personaSlug, sessionId) {
  const startTime = Date.now();

  try {
    // Load soul markers (cached after first call, <1ms subsequent)
    const markers = await loadPersonaMarkers(personaSlug);

    // Run drift analysis (~5-10ms)
    const analysis = await analyzeDrift(previousResponse, personaId, sessionId);

    // Generate correction based on analysis (<1ms)
    const correction = await generateDriftCorrection(
      analysis,
      personaSlug,
      markers,
      sessionId,
      personaId
    );

    await logOperation('drift_pipeline', {
      sessionId,
      personaId,
      details: {
        drift_score: analysis.driftScore,
        severity: analysis.severity,
        correction_generated: !!correction
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return { correction, score: analysis.driftScore };
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'drift_pipeline_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return null;
  }
}
