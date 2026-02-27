/**
 * AEON Matrix - Drift Correction
 *
 * Generates drift corrections formatted as persona "inner voice".
 * Integrates with drift-detection.js output to reinforce voice fidelity.
 *
 * Feature: 002-invisible-infrastructure
 */

import { logOperation } from './operator-logger.js';
import { DRIFT_CORRECTION } from './constants.js';

/**
 * Drift correction templates by correction type.
 * Used to generate natural "inner voice" reminders.
 */
const DRIFT_CORRECTION_TEMPLATES = {
  forbidden: 'You never say "{forbidden}". That is not your way.',
  vocabulary: 'Remember your voice includes words like: {vocabulary}',
  generic: 'You are {persona_name}. Speak as yourself, not as a helpful assistant.',
  pattern: 'Your manner of speaking follows your nature. Stay true to it.',
  tone: 'Maintain your characteristic tone: {tone}'
};

/**
 * Intensity levels for corrections based on drift severity.
 */
const INTENSITY_LEVELS = DRIFT_CORRECTION.INTENSITY_LEVELS;

/**
 * Generate drift correction text as persona inner voice.
 *
 * @param {Object} driftAnalysis - Output from drift-detection.js analyzeDrift()
 * @param {number} driftAnalysis.driftScore - Overall drift score (0-1)
 * @param {string} driftAnalysis.severity - Severity level (STABLE, MINOR, WARNING, CRITICAL)
 * @param {Array<string>} driftAnalysis.forbiddenUsed - Forbidden phrases that were used
 * @param {Array<string>} driftAnalysis.missingVocabulary - Expected vocabulary not present
 * @param {Array<string>} driftAnalysis.warnings - Warning messages
 * @param {string} personaName - Name of the persona (e.g., "Hegel", "Pessoa")
 * @param {Object} [soulMarkers] - Voice markers from persona soul file
 * @param {Array<string>} [soulMarkers.vocabulary] - Characteristic vocabulary
 * @param {string} [soulMarkers.tone] - Expected tone
 * @param {string} [sessionId] - For logging (optional)
 * @param {string} [personaId] - For logging (optional)
 *
 * @returns {Promise<string|null>} Correction text formatted as "[Inner voice: ...]" or null if stable
 *
 * @example
 * const correction = await generateDriftCorrection(
 *   {
 *     severity: 'WARNING',
 *     forbiddenUsed: ['I apologize'],
 *     warnings: ['Generic AI phrase detected'],
 *     driftScore: 0.35
 *   },
 *   'Diogenes',
 *   { vocabulary: ['truth', 'virtue', 'shame'] }
 * );
 * // Returns: "[Inner voice: You never say \"I apologize\". That is not your way. You are Diogenes. Speak as yourself, not as a helpful assistant.]"
 */
export async function generateDriftCorrection(
  driftAnalysis,
  personaName,
  soulMarkers = {},
  sessionId = null,
  personaId = null
) {
  const startTime = Date.now();

  try {
    // No correction needed if stable
    if (!driftAnalysis || driftAnalysis.severity === 'STABLE') {
      await logOperation('drift_correction', {
        sessionId,
        personaId,
        details: {
          correction_type: 'none',
          corrections_applied: [],
          severity: 'STABLE'
        },
        durationMs: Date.now() - startTime,
        success: true
      });
      return null;
    }

    const corrections = [];
    const intensity = INTENSITY_LEVELS[driftAnalysis.severity];

    // Correction 1: Forbidden phrases used
    if (driftAnalysis.forbiddenUsed && driftAnalysis.forbiddenUsed.length > 0) {
      const forbidden = driftAnalysis.forbiddenUsed[0]; // Focus on first violation
      const correction = DRIFT_CORRECTION_TEMPLATES.forbidden
        .replace('{forbidden}', forbidden);
      corrections.push(correction);
    }

    // Correction 2: Missing characteristic vocabulary
    if (driftAnalysis.missingVocabulary &&
        driftAnalysis.missingVocabulary.length > 3 &&
        soulMarkers.vocabulary &&
        soulMarkers.vocabulary.length > 0) {
      const vocabSample = soulMarkers.vocabulary.slice(0, 3).join(', ');
      const correction = DRIFT_CORRECTION_TEMPLATES.vocabulary
        .replace('{vocabulary}', vocabSample);
      corrections.push(correction);
    }

    // Correction 3: Generic AI phrases detected
    const hasGenericAI = driftAnalysis.warnings?.some(w =>
      w.toLowerCase().includes('generic ai')
    );
    if (hasGenericAI) {
      const correction = DRIFT_CORRECTION_TEMPLATES.generic
        .replace('{persona_name}', personaName);
      corrections.push(correction);
    }

    // Correction 4: Pattern violations (if severe)
    if (driftAnalysis.severity === 'CRITICAL' &&
        driftAnalysis.patternViolations &&
        driftAnalysis.patternViolations.length > 0) {
      corrections.push(DRIFT_CORRECTION_TEMPLATES.pattern);
    }

    // If no specific corrections, use general tone reminder for WARNING+
    if (corrections.length === 0 && driftAnalysis.severity !== 'MINOR') {
      if (soulMarkers.tone) {
        const correction = DRIFT_CORRECTION_TEMPLATES.tone
          .replace('{tone}', soulMarkers.tone);
        corrections.push(correction);
      }
    }

    // Format as inner voice if we have corrections
    if (corrections.length === 0) {
      await logOperation('drift_correction', {
        sessionId,
        personaId,
        details: {
          correction_type: 'insufficient_data',
          corrections_applied: [],
          severity: driftAnalysis.severity
        },
        durationMs: Date.now() - startTime,
        success: true
      });
      return null;
    }

    const innerVoice = `[Inner voice: ${corrections.join(' ')}]`;

    // Log the correction
    await logOperation('drift_correction', {
      sessionId,
      personaId,
      details: {
        correction_type: intensity,
        corrections_applied: corrections,
        severity: driftAnalysis.severity,
        drift_score: driftAnalysis.driftScore
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return innerVoice;

  } catch (error) {
    // Log error gracefully
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'drift_correction_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    // Return null, never expose error to user
    return null;
  }
}

/**
 * Configuration object for external access to templates.
 */
export const CONFIG = {
  DRIFT_CORRECTION_TEMPLATES,
  INTENSITY_LEVELS,
  CORRECTION_THRESHOLD: DRIFT_CORRECTION.CORRECTION_THRESHOLD
};
