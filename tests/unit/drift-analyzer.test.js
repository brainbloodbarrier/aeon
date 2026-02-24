/**
 * Unit tests for drift-analyzer.js
 * Constitution Principle III: Voice Fidelity
 */

import { jest } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  end: jest.fn()
};

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool)
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

const mockLoadPersonaMarkers = jest.fn();
const mockGetUniversalForbiddenPhrases = jest.fn();

jest.unstable_mockModule('../../compute/soul-marker-extractor.js', () => ({
  loadPersonaMarkers: mockLoadPersonaMarkers,
  getUniversalForbiddenPhrases: mockGetUniversalForbiddenPhrases
}));

// Import after mocking
const {
  classifySeverity,
  shouldAnalyzeDrift,
  analyzeDrift,
  closePool
} = await import('../../compute/drift-analyzer.js');

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Drift Analyzer Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: persona markers with no forbidden phrases, vocabulary, or patterns
    mockLoadPersonaMarkers.mockResolvedValue({
      forbidden: [],
      vocabulary: [],
      patterns: [],
      universalForbidden: []
    });
    mockGetUniversalForbiddenPhrases.mockReturnValue([
      'as an ai',
      'as a language model',
      "i'd be happy to",
      'great question',
      'certainly'
    ]);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // classifySeverity — pure function
  // ═════════════════════════════════════════════════════════════════════════

  describe('classifySeverity', () => {
    describe('with default threshold (0.3)', () => {
      it('should return STABLE for driftScore <= 0.1', () => {
        expect(classifySeverity(0)).toBe('STABLE');
        expect(classifySeverity(0.05)).toBe('STABLE');
        expect(classifySeverity(0.1)).toBe('STABLE');
      });

      it('should return MINOR for 0.1 < driftScore <= 0.3', () => {
        expect(classifySeverity(0.11)).toBe('MINOR');
        expect(classifySeverity(0.2)).toBe('MINOR');
        expect(classifySeverity(0.3)).toBe('MINOR');
      });

      it('should return WARNING for 0.3 < driftScore <= 0.5', () => {
        expect(classifySeverity(0.31)).toBe('WARNING');
        expect(classifySeverity(0.4)).toBe('WARNING');
        expect(classifySeverity(0.5)).toBe('WARNING');
      });

      it('should return CRITICAL for driftScore > 0.5', () => {
        expect(classifySeverity(0.51)).toBe('CRITICAL');
        expect(classifySeverity(0.7)).toBe('CRITICAL');
        expect(classifySeverity(1.0)).toBe('CRITICAL');
      });
    });

    describe('boundary values', () => {
      it('should classify exactly 0.1 as STABLE', () => {
        expect(classifySeverity(0.1)).toBe('STABLE');
      });

      it('should classify exactly 0.3 as MINOR (at default threshold)', () => {
        expect(classifySeverity(0.3)).toBe('MINOR');
      });

      it('should classify exactly 0.5 as WARNING (threshold + 0.2 = 0.5)', () => {
        expect(classifySeverity(0.5)).toBe('WARNING');
      });

      it('should classify 0 as STABLE', () => {
        expect(classifySeverity(0)).toBe('STABLE');
      });
    });

    describe('with custom threshold', () => {
      it('should use custom threshold for MINOR boundary', () => {
        // threshold = 0.1, so MINOR is 0.1 < x <= 0.1 — actually <= 0.1 is STABLE
        // With threshold=0.1: STABLE <=0.1, MINOR 0.1<x<=0.1 (impossible boundary)
        // Actually: STABLE <= 0.1, MINOR 0.1 < x <= 0.1 means exact at 0.1 is STABLE
        // driftScore 0.15 with threshold 0.2:
        //   <= 0.1 → STABLE? No, 0.15 > 0.1
        //   <= 0.2 → MINOR? Yes
        expect(classifySeverity(0.15, 0.2)).toBe('MINOR');
      });

      it('should shift WARNING range with custom threshold', () => {
        // threshold=0.2: WARNING is 0.2 < x <= 0.4
        expect(classifySeverity(0.35, 0.2)).toBe('WARNING');
      });

      it('should shift CRITICAL range with custom threshold', () => {
        // threshold=0.2: CRITICAL is x > 0.4
        expect(classifySeverity(0.45, 0.2)).toBe('CRITICAL');
      });

      it('should handle very low threshold', () => {
        // threshold=0.05: STABLE <=0.1, MINOR <=0.05 (overlap: 0.1 boundary dominates)
        // Actually: first check is <= 0.1 → STABLE
        // So 0.08 with threshold 0.05 is STABLE (because 0.08 <= 0.1)
        expect(classifySeverity(0.08, 0.05)).toBe('STABLE');
        // 0.15 with threshold 0.05: > 0.1, <= 0.05? No. <= 0.25? Yes → WARNING
        expect(classifySeverity(0.15, 0.05)).toBe('WARNING');
      });

      it('should handle high threshold', () => {
        // threshold=0.6: STABLE <=0.1, MINOR <=0.6, WARNING <=0.8, CRITICAL >0.8
        expect(classifySeverity(0.4, 0.6)).toBe('MINOR');
        expect(classifySeverity(0.7, 0.6)).toBe('WARNING');
        expect(classifySeverity(0.9, 0.6)).toBe('CRITICAL');
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // shouldAnalyzeDrift — DB-dependent
  // ═════════════════════════════════════════════════════════════════════════

  describe('shouldAnalyzeDrift', () => {
    it('should return config from DB when persona found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ drift_check_enabled: true, drift_threshold: 0.4 }]
      });

      const result = await shouldAnalyzeDrift('hegel');

      expect(result).toEqual({ enabled: true, threshold: 0.4 });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('drift_check_enabled'),
        ['hegel']
      );
    });

    it('should return defaults when persona not found in DB', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await shouldAnalyzeDrift('unknown-persona');

      expect(result).toEqual({ enabled: true, threshold: 0.3 });
    });

    it('should return defaults on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await shouldAnalyzeDrift('hegel');

      expect(result).toEqual({ enabled: true, threshold: 0.3 });
    });

    it('should handle null drift_check_enabled with nullish coalescing', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ drift_check_enabled: null, drift_threshold: null }]
      });

      const result = await shouldAnalyzeDrift('hegel');

      expect(result).toEqual({ enabled: true, threshold: 0.3 });
    });

    it('should respect disabled drift config', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ drift_check_enabled: false, drift_threshold: 0.5 }]
      });

      const result = await shouldAnalyzeDrift('hegel');

      expect(result).toEqual({ enabled: false, threshold: 0.5 });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // analyzeDrift — integration (uses DB + soul markers)
  // ═════════════════════════════════════════════════════════════════════════

  describe('analyzeDrift', () => {
    beforeEach(() => {
      // Default: persona found and drift enabled
      mockQuery.mockResolvedValue({
        rows: [{ drift_check_enabled: true, drift_threshold: 0.3 }]
      });
    });

    describe('short response handling', () => {
      it('should return insufficient_content warning for empty response', async () => {
        const result = await analyzeDrift('', 'hegel');

        expect(result.warnings).toContain('insufficient_content');
        expect(result.driftScore).toBe(0);
        expect(result.severity).toBe('STABLE');
      });

      it('should return insufficient_content warning for null response', async () => {
        const result = await analyzeDrift(null, 'hegel');

        expect(result.warnings).toContain('insufficient_content');
        expect(result.responseLength).toBe(0);
      });

      it('should return insufficient_content warning for response < 10 chars', async () => {
        const result = await analyzeDrift('Too short', 'hegel');

        expect(result.warnings).toContain('insufficient_content');
        expect(result.driftScore).toBe(0);
      });

      it('should NOT warn for response with exactly 10 chars', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: [],
          vocabulary: [],
          patterns: [],
          universalForbidden: []
        });

        const result = await analyzeDrift('1234567890', 'hegel');

        expect(result.warnings).not.toContain('insufficient_content');
      });
    });

    describe('forbidden phrase detection', () => {
      it('should detect persona-specific forbidden phrases', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: ['I think', 'maybe'],
          vocabulary: [],
          patterns: [],
          universalForbidden: []
        });

        const response = 'I think the dialectic process is maybe a bit complex here.';
        const result = await analyzeDrift(response, 'hegel');

        expect(result.forbiddenUsed).toContain('I think');
        expect(result.forbiddenUsed).toContain('maybe');
        expect(result.scores.forbidden).toBeGreaterThan(0);
        expect(result.driftScore).toBeGreaterThan(0);
      });

      it('should detect universal AI forbidden phrases', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: [],
          vocabulary: [],
          patterns: [],
          universalForbidden: ['as an ai', 'great question']
        });

        const response = 'As an AI, I must say that is a great question about philosophy.';
        const result = await analyzeDrift(response, 'hegel');

        expect(result.genericAIDetected).toContain('as an ai');
        expect(result.genericAIDetected).toContain('great question');
        expect(result.scores.genericAI).toBeGreaterThan(0);
      });

      it('should produce high drift score with multiple forbidden phrases', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: ['absolutely', 'certainly'],
          vocabulary: [],
          patterns: [],
          universalForbidden: ['as an ai', "i'd be happy to", 'great question']
        });

        const response = "As an AI, I'd be happy to help! Great question! Absolutely, certainly.";
        const result = await analyzeDrift(response, 'hegel');

        expect(result.driftScore).toBeGreaterThan(0.5);
        expect(result.severity).toBe('CRITICAL');
      });
    });

    describe('vocabulary check', () => {
      it('should detect missing characteristic vocabulary', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: [],
          vocabulary: ['aufhebung', 'dialectic', 'synthesis', 'thesis', 'antithesis',
                       'absolute', 'spirit', 'negation', 'sublation', 'becoming'],
          patterns: [],
          universalForbidden: []
        });

        // Response with none of the expected vocabulary
        const response = 'The solution involves combining different elements into a unified approach for understanding.';
        const result = await analyzeDrift(response, 'hegel');

        expect(result.missingVocabulary.length).toBeGreaterThan(0);
        expect(result.scores.vocabulary).toBeGreaterThan(0);
      });

      it('should not penalize when vocabulary is present', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: [],
          vocabulary: ['dialectic', 'synthesis', 'thesis'],
          patterns: [],
          universalForbidden: []
        });

        const response = 'The dialectic process moves from thesis through antithesis to synthesis and beyond.';
        const result = await analyzeDrift(response, 'hegel');

        // All 3 vocab words present => vocabRatio >= 0.3, no penalty
        expect(result.scores.vocabulary).toBe(0);
      });
    });

    describe('pattern violations', () => {
      it('should detect pattern violations via regex', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: [],
          vocabulary: [],
          patterns: [
            { name: 'header_format', regex: '^⟨' }
          ],
          universalForbidden: []
        });

        // Response missing the expected header format
        const response = 'This response does not start with the required persona header.';
        const result = await analyzeDrift(response, 'hegel');

        expect(result.patternViolations).toContain('header_format');
        expect(result.scores.patterns).toBeGreaterThan(0);
      });

      it('should not flag patterns that match', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: [],
          vocabulary: [],
          patterns: [
            { name: 'contains_period', regex: '\\.' }
          ],
          universalForbidden: []
        });

        const response = 'This response has a period at the end.';
        const result = await analyzeDrift(response, 'hegel');

        expect(result.patternViolations).not.toContain('contains_period');
        expect(result.scores.patterns).toBe(0);
      });
    });

    describe('normal response scoring', () => {
      it('should return low drift score for well-formed persona response', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: [],
          vocabulary: ['dialectic', 'synthesis', 'thesis', 'negation'],
          patterns: [],
          universalForbidden: ['as an ai', 'great question']
        });

        const response = 'The dialectic reveals itself through negation. Thesis meets antithesis, synthesis emerges.';
        const result = await analyzeDrift(response, 'hegel');

        expect(result.driftScore).toBeLessThanOrEqual(0.3);
        expect(result.severity).not.toBe('CRITICAL');
      });

      it('should include personaId and sessionId in result', async () => {
        const result = await analyzeDrift('A sufficiently long response text here.', 'hegel', 'session-123');

        expect(result.personaId).toBe('hegel');
        expect(result.sessionId).toBe('session-123');
      });

      it('should include responseLength in result', async () => {
        const response = 'The dialectic of reason unfolds through its own contradictions.';
        const result = await analyzeDrift(response, 'hegel');

        expect(result.responseLength).toBe(response.length);
      });

      it('should record analysis time', async () => {
        const response = 'A valid response that is definitely long enough for analysis purposes.';
        const result = await analyzeDrift(response, 'hegel');

        expect(typeof result.analysisTimeMs).toBe('number');
        expect(result.analysisTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('drift check disabled', () => {
      it('should return early with warning when drift check is disabled', async () => {
        mockQuery.mockResolvedValueOnce({
          rows: [{ drift_check_enabled: false, drift_threshold: 0.3 }]
        });

        const response = 'As an AI, I would be happy to help you with that great question!';
        const result = await analyzeDrift(response, 'hegel');

        expect(result.warnings).toContain('drift_check_disabled');
        expect(result.driftScore).toBe(0);
        expect(result.severity).toBe('STABLE');
        // Should NOT have called loadPersonaMarkers since it short-circuited
        expect(mockLoadPersonaMarkers).not.toHaveBeenCalled();
      });
    });

    describe('drift score capping', () => {
      it('should cap drift score at 1.0', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: ['word1', 'word2', 'word3', 'word4'],
          vocabulary: [],
          patterns: [],
          universalForbidden: ['as an ai', 'great question', "i'd be happy to"]
        });

        // Trigger many forbidden phrases at once
        const response = "As an AI, great question! I'd be happy to say word1 word2 word3 word4 to help.";
        const result = await analyzeDrift(response, 'hegel');

        expect(result.driftScore).toBeLessThanOrEqual(1.0);
      });
    });

    describe('severity classification integration', () => {
      it('should use persona-specific threshold for severity', async () => {
        // Persona with a custom high threshold
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({
          rows: [{ drift_check_enabled: true, drift_threshold: 0.6 }]
        });

        mockLoadPersonaMarkers.mockResolvedValueOnce({
          forbidden: ['forbidden_word'],
          vocabulary: [],
          patterns: [],
          universalForbidden: []
        });

        const response = 'This response contains a forbidden_word somewhere in it.';
        const result = await analyzeDrift(response, 'hegel');

        // forbidden penalty = 0.3, with threshold 0.6:
        // driftScore 0.3 is MINOR (0.1 < 0.3 <= 0.6)
        expect(result.severity).toBe('MINOR');
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // closePool — deprecated no-op
  // ═════════════════════════════════════════════════════════════════════════

  describe('closePool', () => {
    it('should be a no-op that resolves without error', async () => {
      await expect(closePool()).resolves.toBeUndefined();
    });
  });
});
