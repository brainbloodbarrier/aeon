/**
 * AEON Matrix - Voice Drift Detection
 *
 * Compares a persona's response against their soul template markers
 * to detect deviation from core character.
 *
 * Run via Node.js Sandbox MCP: run_js_ephemeral
 *
 * Input (via environment):
 *   RESPONSE: The persona's response text
 *   SOUL_MARKERS: JSON object with voice markers
 *     {
 *       vocabulary: string[],     // Expected words/phrases
 *       forbidden: string[],      // Things this persona would NEVER say
 *       patterns: string[],       // Regex patterns they should match
 *       tone: string              // Expected tone description
 *     }
 *
 * Output: JSON with drift analysis
 */

const response = process.env.RESPONSE || '';
let soulMarkers;
try {
  soulMarkers = JSON.parse(process.env.SOUL_MARKERS || '{}');
} catch (error) {
  console.error(JSON.stringify({ error: 'Failed to parse SOUL_MARKERS', message: error.message }));
  process.exit(1);
}

/**
 * Calculate voice drift score.
 *
 * Drift is measured by:
 * 1. Forbidden phrases used (major penalty: +0.3 each)
 * 2. Missing characteristic vocabulary (minor penalty: +0.05 each)
 * 3. Pattern violations (moderate penalty: +0.1 each)
 *
 * @param {string} text - Response text to analyze
 * @param {Object} markers - Soul voice markers
 * @returns {Object} Drift analysis results
 */
function analyzeDrift(text, markers) {
  const lowerText = text.toLowerCase();
  const analysis = {
    driftScore: 0,
    forbiddenUsed: [],
    missingVocabulary: [],
    patternViolations: [],
    warnings: []
  };

  // ─────────────────────────────────────────────────────────────
  // CHECK 1: Forbidden phrases (highest penalty)
  // Things this persona would NEVER say
  // ─────────────────────────────────────────────────────────────
  if (markers.forbidden && markers.forbidden.length > 0) {
    for (const forbidden of markers.forbidden) {
      if (lowerText.includes(forbidden.toLowerCase())) {
        analysis.forbiddenUsed.push(forbidden);
        analysis.driftScore += 0.3;
        analysis.warnings.push(`CRITICAL: Used forbidden phrase "${forbidden}"`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CHECK 2: Missing characteristic vocabulary
  // Words/phrases the persona typically uses
  // ─────────────────────────────────────────────────────────────
  if (markers.vocabulary && markers.vocabulary.length > 0) {
    let vocabHits = 0;
    for (const word of markers.vocabulary) {
      if (lowerText.includes(word.toLowerCase())) {
        vocabHits++;
      } else {
        analysis.missingVocabulary.push(word);
      }
    }

    // If less than 30% of vocabulary is present, that's drift
    const vocabRatio = vocabHits / markers.vocabulary.length;
    if (vocabRatio < 0.3) {
      const penalty = (0.3 - vocabRatio) * 0.5; // Max 0.15 penalty
      analysis.driftScore += penalty;
      analysis.warnings.push(`Low vocabulary match: ${(vocabRatio * 100).toFixed(0)}%`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CHECK 3: Pattern violations (regex)
  // Structural patterns the persona should match
  // ─────────────────────────────────────────────────────────────
  if (markers.patterns && markers.patterns.length > 0) {
    for (const pattern of markers.patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (!regex.test(text)) {
          analysis.patternViolations.push(pattern);
          analysis.driftScore += 0.1;
        }
      } catch (e) {
        console.warn(`[DriftDetection] Skipping invalid regex pattern: ${e.message}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CHECK 4: Generic AI phrases (universal drift indicator)
  // Phrases that no historical persona would use
  // ─────────────────────────────────────────────────────────────
  const genericAIPhrases = [
    "as an ai",
    "i don't have personal",
    "i cannot provide",
    "let me help you",
    "great question",
    "absolutely",
    "i'd be happy to",
    "that's a wonderful"
  ];

  for (const phrase of genericAIPhrases) {
    if (lowerText.includes(phrase)) {
      analysis.driftScore += 0.2;
      analysis.warnings.push(`Generic AI phrase detected: "${phrase}"`);
    }
  }

  // Cap drift score at 1.0
  analysis.driftScore = Math.min(analysis.driftScore, 1.0);

  // Add severity level
  if (analysis.driftScore > 0.5) {
    analysis.severity = 'CRITICAL';
  } else if (analysis.driftScore > 0.3) {
    analysis.severity = 'WARNING';
  } else if (analysis.driftScore > 0.1) {
    analysis.severity = 'MINOR';
  } else {
    analysis.severity = 'STABLE';
  }

  return analysis;
}

// Execute and output
const result = analyzeDrift(response, soulMarkers);
console.log(JSON.stringify(result, null, 2));
