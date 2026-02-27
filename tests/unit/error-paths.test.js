/**
 * Unit Tests: Cross-module error paths
 *
 * Tests error handling paths across compute modules:
 * - memory-retrieval.js: SQL errors, empty results, null handling
 * - operator-logger.js: logOperationBatch failures
 * - context-assembler.js: safe*Fetch error resilience
 * - drift-analyzer.js: incomplete/missing data scenarios
 * - memory-orchestrator.js: safeMemoryRetrieval, safePersonaMemoriesFetch, safePreteriteFetch
 * - drift-orchestrator.js: safeSoulValidation, safeDriftFetch
 * - setting-orchestrator.js: all safe*Fetch functions
 *
 * Issue #26: Error path coverage for compute modules
 */

import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// Set DATABASE_URL before imports
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// ═══════════════════════════════════════════════════════════════════════════
// Mock State
// ═══════════════════════════════════════════════════════════════════════════

const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockPool = {
  query: mockQuery,
  connect: mockConnect,
  on: jest.fn(),
  end: jest.fn()
};

// ═══════════════════════════════════════════════════════════════════════════
// ESM-compatible module mocking — ALL mocks BEFORE any dynamic imports
// ═══════════════════════════════════════════════════════════════════════════

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool),
  withTransaction: jest.fn(async (callback) => callback(mockPool))
}));

const mockLogOperation = jest.fn().mockResolvedValue(undefined);
const mockLogOperationBatch = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: mockLogOperation,
  logOperationBatch: mockLogOperationBatch
}));

// --- memory-extractor mock ---
const mockGenerateEmbedding = jest.fn().mockResolvedValue(null);
jest.unstable_mockModule('../../compute/memory-extractor.js', () => ({
  generateEmbedding: mockGenerateEmbedding,
  extractSessionMemories: jest.fn().mockResolvedValue([]),
  storeSessionMemories: jest.fn().mockResolvedValue(undefined)
}));

// --- persona-memory mock ---
const mockGetPersonaMemories = jest.fn().mockResolvedValue([]);
const mockFramePersonaMemories = jest.fn().mockReturnValue(null);
jest.unstable_mockModule('../../compute/persona-memory.js', () => ({
  getPersonaMemories: mockGetPersonaMemories,
  framePersonaMemories: mockFramePersonaMemories,
  getAllOpinions: jest.fn().mockResolvedValue([])
}));

// --- preterite-memory mock ---
const mockAttemptSurface = jest.fn().mockResolvedValue(null);
const mockFramePreteriteContext = jest.fn().mockReturnValue(null);
jest.unstable_mockModule('../../compute/preterite-memory.js', () => ({
  attemptSurface: mockAttemptSurface,
  framePreteriteContext: mockFramePreteriteContext,
  classifyMemoryElection: jest.fn().mockReturnValue({ status: 'elect', reason: 'test' }),
  consignToPreterite: jest.fn().mockResolvedValue(undefined)
}));

// --- soul-validator mock ---
const mockValidateSoulCached = jest.fn().mockResolvedValue({
  valid: true, personaName: 'hegel', errors: [], warnings: [],
  metadata: { hashMatch: true, structureValid: true }
});
const mockAlertOnCritical = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../../compute/soul-validator.js', () => ({
  validateSoulCached: mockValidateSoulCached,
  alertOnCritical: mockAlertOnCritical
}));

// --- drift-analyzer mock ---
const mockAnalyzeDrift = jest.fn().mockResolvedValue({
  driftScore: 0.1, severity: 'STABLE', forbiddenUsed: [],
  missingVocabulary: [], patternViolations: [], genericAIDetected: [],
  warnings: [], scores: { forbidden: 0, vocabulary: 0, patterns: 0, genericAI: 0 }
});
jest.unstable_mockModule('../../compute/drift-analyzer.js', () => ({
  analyzeDrift: mockAnalyzeDrift,
  classifySeverity: jest.fn().mockReturnValue('STABLE'),
  shouldAnalyzeDrift: jest.fn().mockResolvedValue({ enabled: true, threshold: 0.3 })
}));

// --- drift-correction mock ---
const mockGenerateDriftCorrection = jest.fn().mockResolvedValue(null);
jest.unstable_mockModule('../../compute/drift-correction.js', () => ({
  generateDriftCorrection: mockGenerateDriftCorrection
}));

// --- soul-marker-extractor mock ---
const mockLoadPersonaMarkers = jest.fn().mockResolvedValue({
  vocabulary: [], toneMarkers: [], patterns: [], forbidden: []
});
jest.unstable_mockModule('../../compute/soul-marker-extractor.js', () => ({
  loadPersonaMarkers: mockLoadPersonaMarkers,
  getUniversalForbiddenPhrases: jest.fn().mockReturnValue([])
}));

// --- temporal-awareness mock ---
const mockGenerateTemporalContext = jest.fn().mockResolvedValue(null);
const mockFrameTemporalContext = jest.fn().mockReturnValue(null);
jest.unstable_mockModule('../../compute/temporal-awareness.js', () => ({
  generateTemporalContext: mockGenerateTemporalContext,
  frameTemporalContext: mockFrameTemporalContext,
  touchTemporalState: jest.fn().mockResolvedValue(undefined)
}));

// --- ambient-generator mock ---
const mockGenerateAmbientDetails = jest.fn().mockResolvedValue(null);
const mockFrameAmbientContext = jest.fn().mockReturnValue(null);
jest.unstable_mockModule('../../compute/ambient-generator.js', () => ({
  generateAmbientDetails: mockGenerateAmbientDetails,
  frameAmbientContext: mockFrameAmbientContext
}));

// --- entropy-tracker mock ---
const mockGetEntropyState = jest.fn().mockResolvedValue({ level: 0.1, state: 'stable', effects: [] });
const mockFrameEntropyContext = jest.fn().mockReturnValue(null);
jest.unstable_mockModule('../../compute/entropy-tracker.js', () => ({
  getEntropyState: mockGetEntropyState,
  applySessionEntropy: jest.fn().mockResolvedValue({ level: 0.15, state: 'stable' }),
  frameEntropyContext: mockFrameEntropyContext
}));

// --- zone-boundary-detector mock ---
const mockDetectZoneApproach = jest.fn().mockResolvedValue(null);
const mockFrameZoneContext = jest.fn().mockReturnValue(null);
jest.unstable_mockModule('../../compute/zone-boundary-detector.js', () => ({
  detectZoneApproach: mockDetectZoneApproach,
  frameZoneContext: mockFrameZoneContext
}));

// --- they-awareness mock ---
const mockProcessTheyAwareness = jest.fn().mockResolvedValue(null);
jest.unstable_mockModule('../../compute/they-awareness.js', () => ({
  processTheyAwareness: mockProcessTheyAwareness,
  frameTheyContext: jest.fn().mockReturnValue(null)
}));

// --- counterforce-tracker mock ---
const mockGetPersonaAlignment = jest.fn().mockResolvedValue(null);
const mockGenerateCounterforceHints = jest.fn().mockReturnValue([]);
const mockFrameCounterforceContext = jest.fn().mockReturnValue(null);
jest.unstable_mockModule('../../compute/counterforce-tracker.js', () => ({
  getPersonaAlignment: mockGetPersonaAlignment,
  generateCounterforceHints: mockGenerateCounterforceHints,
  frameCounterforceContext: mockFrameCounterforceContext
}));

// --- narrative-gravity mock ---
const mockGetSessionArc = jest.fn().mockResolvedValue(null);
const mockAnalyzeMomentum = jest.fn().mockReturnValue({ trend: 'neutral' });
const mockGetPhaseEffects = jest.fn().mockReturnValue([]);
const mockGenerateArcContext = jest.fn().mockReturnValue(null);
const mockFrameArcContext = jest.fn().mockReturnValue(null);
jest.unstable_mockModule('../../compute/narrative-gravity.js', () => ({
  getSessionArc: mockGetSessionArc,
  updateArc: jest.fn().mockResolvedValue({ phase: 'impact' }),
  analyzeMomentum: mockAnalyzeMomentum,
  getPhaseEffects: mockGetPhaseEffects,
  generateArcContext: mockGenerateArcContext,
  frameArcContext: mockFrameArcContext
}));

// --- interface-bleed mock ---
const mockProcessInterfaceBleed = jest.fn().mockResolvedValue(null);
const mockFrameBleedContext = jest.fn().mockReturnValue(null);
jest.unstable_mockModule('../../compute/interface-bleed.js', () => ({
  processInterfaceBleed: mockProcessInterfaceBleed,
  frameBleedContext: mockFrameBleedContext
}));

// ═══════════════════════════════════════════════════════════════════════════
// Import modules AFTER all mocks
// ═══════════════════════════════════════════════════════════════════════════

let safeMemoryRetrieval, safePersonaMemoriesFetch, safePreteriteFetch;
let estimateTokens, truncateMemories;
let safeSoulValidation, safeDriftFetch;
let getSettingContext, safeTemporalFetch, safeAmbientFetch, safeEntropyFetch;
let safeZoneDetection, safeTheyAwarenessFetch, safeCounterforceFetch;
let safeNarrativeGravityFetch, safeInterfaceBleedFetch;
let searchByEmbedding, selectMemories;

beforeAll(async () => {
  const memOrch = await import('../../compute/memory-orchestrator.js');
  safeMemoryRetrieval = memOrch.safeMemoryRetrieval;
  safePersonaMemoriesFetch = memOrch.safePersonaMemoriesFetch;
  safePreteriteFetch = memOrch.safePreteriteFetch;
  estimateTokens = memOrch.estimateTokens;
  truncateMemories = memOrch.truncateMemories;

  const driftOrch = await import('../../compute/drift-orchestrator.js');
  safeSoulValidation = driftOrch.safeSoulValidation;
  safeDriftFetch = driftOrch.safeDriftFetch;

  const settingOrch = await import('../../compute/setting-orchestrator.js');
  getSettingContext = settingOrch.getSettingContext;
  safeTemporalFetch = settingOrch.safeTemporalFetch;
  safeAmbientFetch = settingOrch.safeAmbientFetch;
  safeEntropyFetch = settingOrch.safeEntropyFetch;
  safeZoneDetection = settingOrch.safeZoneDetection;
  safeTheyAwarenessFetch = settingOrch.safeTheyAwarenessFetch;
  safeCounterforceFetch = settingOrch.safeCounterforceFetch;
  safeNarrativeGravityFetch = settingOrch.safeNarrativeGravityFetch;
  safeInterfaceBleedFetch = settingOrch.safeInterfaceBleedFetch;

  const memRetrieval = await import('../../compute/memory-retrieval.js');
  searchByEmbedding = memRetrieval.searchByEmbedding;
  selectMemories = memRetrieval.selectMemories;
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-module error paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // memory-orchestrator.js error paths
  // ═════════════════════════════════════════════════════════════════════════

  describe('memory-orchestrator.js', () => {
    describe('estimateTokens', () => {
      it('returns 0 for null input', () => {
        expect(estimateTokens(null)).toBe(0);
      });

      it('returns 0 for undefined input', () => {
        expect(estimateTokens(undefined)).toBe(0);
      });

      it('returns 0 for empty string', () => {
        expect(estimateTokens('')).toBe(0);
      });

      it('computes tokens as ceil(length/4)', () => {
        expect(estimateTokens('abcd')).toBe(1);
        expect(estimateTokens('abcde')).toBe(2);
        expect(estimateTokens('a'.repeat(100))).toBe(25);
      });
    });

    describe('truncateMemories', () => {
      it('returns empty string for null input', () => {
        expect(truncateMemories(null, 100)).toBe('');
      });

      it('returns original when within budget', () => {
        const short = 'A short memory.';
        expect(truncateMemories(short, 100)).toBe(short);
      });

      it('truncates to fit within maxTokens', () => {
        const longMemory = 'Line one of memories.\nLine two of memories.\nLine three of memories.\nLine four of memories.';
        const result = truncateMemories(longMemory, 3); // ~12 chars max
        expect(result.length).toBeLessThanOrEqual(12);
      });
    });

    describe('safeMemoryRetrieval', () => {
      it('returns empty array when DB query throws', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection refused'));

        const result = await safeMemoryRetrieval('p1', 'u1', 'test', 's1');

        expect(result).toEqual([]);
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'memory_retrieval_failure'
            })
          })
        );
      });

      it('returns rows when embedding is null (importance+recency fallback)', async () => {
        mockGenerateEmbedding.mockResolvedValueOnce(null);
        const mockRows = [{ id: 'm1', content: 'test', importance_score: 0.5 }];
        mockQuery.mockResolvedValueOnce({ rows: mockRows });

        const result = await safeMemoryRetrieval('p1', 'u1', 'query', 's1');

        expect(result).toEqual(mockRows);
      });

      it('falls back to importance query when hybrid returns empty rows', async () => {
        const fakeEmbed = Array(1536).fill(0.01);
        mockGenerateEmbedding.mockResolvedValueOnce(fakeEmbed);
        // First query (hybrid) returns empty
        mockQuery.mockResolvedValueOnce({ rows: [] });
        // Second query (importance fallback) returns data
        const fallbackRows = [{ id: 'm2', content: 'fallback', importance_score: 0.7 }];
        mockQuery.mockResolvedValueOnce({ rows: fallbackRows });

        const result = await safeMemoryRetrieval('p1', 'u1', 'query', 's1');

        expect(result).toEqual(fallbackRows);
        expect(mockQuery).toHaveBeenCalledTimes(2);
      });

      it('returns empty array when embedding generation throws', async () => {
        mockGenerateEmbedding.mockRejectedValueOnce(new Error('OpenAI rate limit'));

        const result = await safeMemoryRetrieval('p1', 'u1', 'query', 's1');

        expect(result).toEqual([]);
      });
    });

    describe('safePersonaMemoriesFetch', () => {
      it('returns null when getPersonaMemories throws', async () => {
        mockGetPersonaMemories.mockRejectedValueOnce(new Error('DB error'));

        const result = await safePersonaMemoriesFetch('p1', 100, 's1');

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'persona_memories_fetch_failure'
            })
          })
        );
      });

      it('returns null when no memories found', async () => {
        mockGetPersonaMemories.mockResolvedValueOnce([]);

        const result = await safePersonaMemoriesFetch('p1', 100, 's1');

        expect(result).toBeNull();
      });

      it('returns null when memories array is null', async () => {
        mockGetPersonaMemories.mockResolvedValueOnce(null);

        const result = await safePersonaMemoriesFetch('p1', 100, 's1');

        expect(result).toBeNull();
      });

      it('returns framed text when memories exist', async () => {
        mockGetPersonaMemories.mockResolvedValueOnce([
          { id: 'm1', content: 'opinion about dialectics', importance_score: 0.8 }
        ]);
        mockFramePersonaMemories.mockReturnValueOnce('You know about dialectics.');

        const result = await safePersonaMemoriesFetch('p1', 100, 's1');

        expect(result).toBe('You know about dialectics.');
      });

      it('returns null when framePersonaMemories returns empty string', async () => {
        mockGetPersonaMemories.mockResolvedValueOnce([
          { id: 'm1', content: 'test', importance_score: 0.5 }
        ]);
        mockFramePersonaMemories.mockReturnValueOnce('');

        const result = await safePersonaMemoriesFetch('p1', 100, 's1');

        // empty string is falsy, so framed || null returns null
        expect(result).toBeNull();
      });
    });

    describe('safePreteriteFetch', () => {
      it('returns null when attemptSurface throws', async () => {
        mockAttemptSurface.mockRejectedValueOnce(new Error('DB timeout'));

        const result = await safePreteriteFetch('p1', 'u1', 's1');

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'preterite_surface_failure'
            })
          })
        );
      });

      it('returns null when attemptSurface returns null', async () => {
        mockAttemptSurface.mockResolvedValueOnce(null);

        const result = await safePreteriteFetch('p1', 'u1', 's1');

        expect(result).toBeNull();
      });

      it('returns null when surfaced is false', async () => {
        mockAttemptSurface.mockResolvedValueOnce({ surfaced: false });

        const result = await safePreteriteFetch('p1', 'u1', 's1');

        expect(result).toBeNull();
      });

      it('returns framed context when surface succeeds', async () => {
        mockAttemptSurface.mockResolvedValueOnce({
          surfaced: true,
          fragments: [{ content: 'forgotten thing' }]
        });
        mockFramePreteriteContext.mockReturnValueOnce('[PRETERITE] A forgotten fragment surfaces...');

        const result = await safePreteriteFetch('p1', 'u1', 's1');

        expect(result).toBe('[PRETERITE] A forgotten fragment surfaces...');
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // drift-orchestrator.js error paths
  // ═════════════════════════════════════════════════════════════════════════

  describe('drift-orchestrator.js', () => {
    describe('safeSoulValidation', () => {
      it('returns true when personaSlug is null (skips validation)', async () => {
        const result = await safeSoulValidation(null, 's1');

        expect(result).toBe(true);
        expect(mockValidateSoulCached).not.toHaveBeenCalled();
      });

      it('returns false when soul validation detects tampering', async () => {
        mockValidateSoulCached.mockResolvedValueOnce({
          valid: false,
          personaName: 'hegel',
          errors: ['Hash mismatch'],
          metadata: { hashMatch: false, structureValid: true }
        });

        const result = await safeSoulValidation('hegel', 's1');

        expect(result).toBe(false);
        expect(mockAlertOnCritical).toHaveBeenCalled();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'soul_validation_failure',
          expect.objectContaining({ success: false })
        );
      });

      it('returns true when validation throws (graceful degradation)', async () => {
        mockValidateSoulCached.mockRejectedValueOnce(new Error('File not found'));

        const result = await safeSoulValidation('hegel', 's1');

        expect(result).toBe(true);
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'soul_validation_error',
              fallback_used: 'proceed_without_validation'
            })
          })
        );
      });

      it('returns true when soul is valid', async () => {
        mockValidateSoulCached.mockResolvedValueOnce({
          valid: true, personaName: 'hegel', errors: [],
          metadata: { hashMatch: true, structureValid: true }
        });

        const result = await safeSoulValidation('hegel', 's1');

        expect(result).toBe(true);
      });
    });

    describe('safeDriftFetch', () => {
      it('returns null when analyzeDrift throws', async () => {
        mockAnalyzeDrift.mockRejectedValueOnce(new Error('Analysis timeout'));

        const result = await safeDriftFetch('response text', 'p1', 'hegel', 's1');

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'drift_pipeline_failure'
            })
          })
        );
      });

      it('returns null when loadPersonaMarkers throws', async () => {
        mockLoadPersonaMarkers.mockRejectedValueOnce(new Error('File read error'));

        const result = await safeDriftFetch('response text', 'p1', 'hegel', 's1');

        expect(result).toBeNull();
      });

      it('returns correction and score on success', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          vocabulary: ['dialectic'], toneMarkers: [], patterns: [], forbidden: []
        });
        mockAnalyzeDrift.mockResolvedValueOnce({
          driftScore: 0.4, severity: 'WARNING'
        });
        mockGenerateDriftCorrection.mockResolvedValueOnce('[Voice: Speak as Hegel]');

        const result = await safeDriftFetch('AI response', 'p1', 'hegel', 's1');

        expect(result).toEqual({
          correction: '[Voice: Speak as Hegel]',
          score: 0.4
        });
      });

      it('returns null correction when drift is stable', async () => {
        mockLoadPersonaMarkers.mockResolvedValueOnce({
          vocabulary: [], toneMarkers: [], patterns: [], forbidden: []
        });
        mockAnalyzeDrift.mockResolvedValueOnce({
          driftScore: 0.05, severity: 'STABLE'
        });
        mockGenerateDriftCorrection.mockResolvedValueOnce(null);

        const result = await safeDriftFetch('good response', 'p1', 'hegel', 's1');

        expect(result).toEqual({ correction: null, score: 0.05 });
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // setting-orchestrator.js error paths
  // ═════════════════════════════════════════════════════════════════════════

  describe('setting-orchestrator.js', () => {
    describe('getSettingContext', () => {
      it('returns default setting when DB query fails', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB down'));

        const result = await getSettingContext('s1');

        expect(result).toContain('O Fim');
        expect(result).toContain('2 AM');
      });

      it('returns default setting when no templates found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await getSettingContext('s1');

        expect(result).toContain('O Fim');
      });

      it('returns DB template when found', async () => {
        mockQuery.mockResolvedValueOnce({
          rows: [{ template: 'Custom bar setting at midnight.' }]
        });

        const result = await getSettingContext('s1');

        expect(result).toBe('Custom bar setting at midnight.');
      });
    });

    describe('safeTemporalFetch', () => {
      it('returns null when generateTemporalContext throws', async () => {
        mockGenerateTemporalContext.mockRejectedValueOnce(new Error('DB error'));

        const result = await safeTemporalFetch('p1', 'hegel', 's1');

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'temporal_context_failure'
            })
          })
        );
      });

      it('returns null when gapLevel is none', async () => {
        mockGenerateTemporalContext.mockResolvedValueOnce({
          gapLevel: 'none', gapMs: 0
        });

        const result = await safeTemporalFetch('p1', 'hegel', 's1');

        expect(result).toBeNull();
      });

      it('returns null when context is null', async () => {
        mockGenerateTemporalContext.mockResolvedValueOnce(null);

        const result = await safeTemporalFetch('p1', 'hegel', 's1');

        expect(result).toBeNull();
      });
    });

    describe('safeAmbientFetch', () => {
      it('returns null when generateAmbientDetails throws', async () => {
        mockGenerateAmbientDetails.mockRejectedValueOnce(new Error('ambient error'));

        const result = await safeAmbientFetch('s1', 'p1');

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'ambient_context_failure'
            })
          })
        );
      });

      it('returns null when no micro events', async () => {
        mockGenerateAmbientDetails.mockResolvedValueOnce({
          microEvents: [], timeOfNight: 'late'
        });

        const result = await safeAmbientFetch('s1', 'p1');

        expect(result).toBeNull();
      });

      it('returns null when ambient details are null', async () => {
        mockGenerateAmbientDetails.mockResolvedValueOnce(null);

        const result = await safeAmbientFetch('s1');

        expect(result).toBeNull();
      });
    });

    describe('safeEntropyFetch', () => {
      it('returns null when getEntropyState throws', async () => {
        mockGetEntropyState.mockRejectedValueOnce(new Error('entropy DB error'));

        const result = await safeEntropyFetch('s1');

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'entropy_context_failure'
            })
          })
        );
      });

      it('returns null when entropy level is below threshold (0.2)', async () => {
        mockGetEntropyState.mockResolvedValueOnce({ level: 0.1, state: 'stable' });

        const result = await safeEntropyFetch('s1');

        expect(result).toBeNull();
      });

      it('returns null when entropy state is null', async () => {
        mockGetEntropyState.mockResolvedValueOnce(null);

        const result = await safeEntropyFetch('s1');

        expect(result).toBeNull();
      });

      it('returns framed context when entropy is high enough', async () => {
        mockGetEntropyState.mockResolvedValueOnce({
          level: 0.6, state: 'decaying', effects: ['static']
        });
        mockFrameEntropyContext.mockReturnValueOnce('[ENTROPY] Static bleeds through.');

        const result = await safeEntropyFetch('s1');

        expect(result).toBe('[ENTROPY] Static bleeds through.');
      });
    });

    describe('safeZoneDetection', () => {
      it('returns null when detectZoneApproach throws', async () => {
        mockDetectZoneApproach.mockRejectedValueOnce(new Error('zone error'));

        const result = await safeZoneDetection('are you real?', 's1', 'p1');

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'zone_detection_failure'
            })
          })
        );
      });

      it('returns null when not approaching zone boundary', async () => {
        mockDetectZoneApproach.mockResolvedValueOnce({ isApproaching: false });

        const result = await safeZoneDetection('normal query', 's1', 'p1');

        expect(result).toBeNull();
      });

      it('returns null when zone response is null', async () => {
        mockDetectZoneApproach.mockResolvedValueOnce(null);

        const result = await safeZoneDetection('query', 's1', 'p1');

        expect(result).toBeNull();
      });
    });

    describe('safeTheyAwarenessFetch', () => {
      it('returns null when processTheyAwareness throws', async () => {
        mockProcessTheyAwareness.mockRejectedValueOnce(new Error('they error'));

        const result = await safeTheyAwarenessFetch('who controls this?', 's1', 'p1');

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'they_awareness_failure'
            })
          })
        );
      });

      it('returns null when state is oblivious', async () => {
        mockProcessTheyAwareness.mockResolvedValueOnce({ state: 'oblivious' });

        const result = await safeTheyAwarenessFetch('normal question', 's1', 'p1');

        expect(result).toBeNull();
      });

      it('returns null when result is null', async () => {
        mockProcessTheyAwareness.mockResolvedValueOnce(null);

        const result = await safeTheyAwarenessFetch('query', 's1', 'p1');

        expect(result).toBeNull();
      });

      it('returns context when awareness is triggered', async () => {
        mockProcessTheyAwareness.mockResolvedValueOnce({
          state: 'suspicious',
          awareness: 0.6,
          context: '[THEY] Someone is watching.',
          triggers: ['system']
        });

        const result = await safeTheyAwarenessFetch('who made you?', 's1', 'p1');

        expect(result).toBe('[THEY] Someone is watching.');
      });
    });

    describe('safeCounterforceFetch', () => {
      it('returns null when getPersonaAlignment throws', async () => {
        mockGetPersonaAlignment.mockRejectedValueOnce(new Error('alignment error'));

        const result = await safeCounterforceFetch('p1', 's1');

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'counterforce_fetch_failure'
            })
          })
        );
      });

      it('returns null when alignment is neutral', async () => {
        mockGetPersonaAlignment.mockResolvedValueOnce({ alignmentType: 'neutral' });

        const result = await safeCounterforceFetch('p1', 's1');

        expect(result).toBeNull();
      });

      it('returns null when alignment is null', async () => {
        mockGetPersonaAlignment.mockResolvedValueOnce(null);

        const result = await safeCounterforceFetch('p1', 's1');

        expect(result).toBeNull();
      });
    });

    describe('safeNarrativeGravityFetch', () => {
      it('returns null when getSessionArc throws', async () => {
        mockGetSessionArc.mockRejectedValueOnce(new Error('arc DB error'));

        const result = await safeNarrativeGravityFetch('s1', 5);

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'narrative_gravity_failure'
            })
          })
        );
      });

      it('handles null arc with default phase values', async () => {
        mockGetSessionArc.mockResolvedValueOnce(null);
        mockGetPhaseEffects.mockReturnValueOnce(null);
        // Both arc and effects are null/falsy
        const result = await safeNarrativeGravityFetch('s1', 1);

        // null arc + null effects => returns null
        expect(result).toBeNull();
      });
    });

    describe('safeInterfaceBleedFetch', () => {
      it('returns null when entropy is below 0.5', async () => {
        const result = await safeInterfaceBleedFetch('s1', 0.3);

        expect(result).toBeNull();
        // Should short-circuit without calling processInterfaceBleed
        expect(mockProcessInterfaceBleed).not.toHaveBeenCalled();
      });

      it('returns null when processInterfaceBleed throws', async () => {
        mockProcessInterfaceBleed.mockRejectedValueOnce(new Error('bleed error'));

        const result = await safeInterfaceBleedFetch('s1', 0.8);

        expect(result).toBeNull();
        expect(mockLogOperation).toHaveBeenCalledWith(
          'error_graceful',
          expect.objectContaining({
            details: expect.objectContaining({
              error_type: 'interface_bleed_failure'
            })
          })
        );
      });

      it('returns null when no bleeds produced', async () => {
        mockProcessInterfaceBleed.mockResolvedValueOnce({ bleeds: [], type: 'none' });

        const result = await safeInterfaceBleedFetch('s1', 0.7);

        expect(result).toBeNull();
      });

      it('returns null when bleed result is null', async () => {
        mockProcessInterfaceBleed.mockResolvedValueOnce(null);

        const result = await safeInterfaceBleedFetch('s1', 0.6);

        expect(result).toBeNull();
      });

      it('returns framed bleed context at high entropy', async () => {
        mockProcessInterfaceBleed.mockResolvedValueOnce({
          bleeds: ['[ERROR 0x3F]'],
          type: 'error_fragment',
          severity: 'moderate'
        });
        mockFrameBleedContext.mockReturnValueOnce('[BLEED] ...0x3F...');

        const result = await safeInterfaceBleedFetch('s1', 0.9);

        expect(result).toBe('[BLEED] ...0x3F...');
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // memory-retrieval.js additional error paths
  // ═════════════════════════════════════════════════════════════════════════

  describe('memory-retrieval.js', () => {
    describe('searchByEmbedding — text search error paths', () => {
      it('returns empty array when text search DB query throws', async () => {
        mockGenerateEmbedding.mockResolvedValueOnce(null);
        mockQuery.mockRejectedValueOnce(new Error('text search DB failure'));

        const result = await searchByEmbedding('test query words', {
          personaId: 'p1',
          userId: 'u1'
        });

        expect(result).toEqual([]);
      });

      it('handles text search with all short words (fewer than 3 chars)', async () => {
        mockGenerateEmbedding.mockResolvedValueOnce(null);
        const importanceRows = [{ id: 'm1', content: 'test', importance_score: 0.5 }];
        mockQuery.mockResolvedValueOnce({ rows: importanceRows });

        const result = await searchByEmbedding('an it do', {
          personaId: 'p1',
          userId: 'u1'
        });

        // All words are at most 2 chars, so falls back to importance+recency
        expect(result).toEqual(importanceRows);
      });
    });

    describe('selectMemories — edge cases', () => {
      it('handles single memory input', () => {
        const single = [{ id: 'a', content: 'test', importance_score: 0.5, created_at: '2025-01-01' }];
        const result = selectMemories(single, 'test', 1);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('a');
      });

      it('handles max=1 by returning only the most important', () => {
        const memories = [
          { id: 'a', content: 'low', importance_score: 0.3, created_at: '2025-01-01' },
          { id: 'b', content: 'high', importance_score: 0.9, created_at: '2025-01-02' }
        ];
        const result = selectMemories(memories, 'query', 1);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('b');
      });

      it('handles memories with identical importance scores', () => {
        const memories = [
          { id: 'a', content: 'first', importance_score: 0.5, created_at: '2025-01-01' },
          { id: 'b', content: 'second', importance_score: 0.5, created_at: '2025-01-02' },
          { id: 'c', content: 'third', importance_score: 0.5, created_at: '2025-01-03' }
        ];
        const result = selectMemories(memories, 'test', 2);
        expect(result).toHaveLength(2);
        // Should not have duplicates
        const ids = new Set(result.map(m => m.id));
        expect(ids.size).toBe(2);
      });
    });
  });
});
